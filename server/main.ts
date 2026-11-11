// The whole program is this one local server. It:
//   - serves the web pages (display, operator, editor)
//   - remembers which show is live and which line is on screen
//   - pushes every change to all connected screens instantly (socket.io)
//
// No database and no internet connection are needed.

import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import { Server as SocketServer } from "socket.io";
import type { Line, LiveState, Show } from "../shared/lines";
import {
  createShow,
  DATA_DIR,
  deleteShow,
  getSettings,
  getShow,
  listShows,
  loadState,
  saveSettings,
  saveState,
  seedIfEmpty,
  updateShow,
} from "./store";

const PORT = Number(process.env.PORT) || 8001;
const WEB_DIR = path.join(import.meta.dir, "..", "web", "dist");

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: "*" } });

// ---------------------------------------------------------------------------
// Live state: the show on screen and the current line
// ---------------------------------------------------------------------------

const NOT_STARTED: Line = {
  id: "not-started",
  act: "0",
  scene: "0",
  char: "NOT STARTED",
  eng: "Session Not Started",
  thai: "",
  isLyric: false,
  remark: "",
};

seedIfEmpty();

let liveShow: Show | null = null;
let liveIndex = 0;
{
  // Pick up exactly where we were if the program was restarted mid-show.
  const saved = loadState();
  liveShow = saved.showId ? getShow(saved.showId) : null;
  liveIndex = liveShow ? saved.index : 0;
}

const clampIndex = (index: number) =>
  Math.max(0, Math.min(index, (liveShow?.lines.length || 1) - 1));
liveIndex = clampIndex(liveIndex);

const liveState = (): LiveState => ({
  showId: liveShow?.id ?? null,
  title: liveShow?.title ?? "",
  index: liveIndex,
  lines: liveShow && liveShow.lines.length ? liveShow.lines : [NOT_STARTED],
});

const persist = () => saveState({ showId: liveShow?.id ?? null, index: liveIndex });

const setIndex = (index: number) => {
  liveIndex = clampIndex(index);
  persist();
  io.emit("subIndex", { index: liveIndex });
  return { index: liveIndex };
};

const setLiveShow = (show: Show | null, index = 0) => {
  liveShow = show;
  liveIndex = clampIndex(index);
  persist();
  io.emit("live", liveState());
};

// ---------------------------------------------------------------------------
// Who may operate: this Mac always can; other devices need the PIN
// ---------------------------------------------------------------------------

const isThisMac = (req: Request) => {
  const address = req.socket.remoteAddress ?? "";
  const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
  // If something forwards traffic to us (a tunnel or proxy), don't trust it blindly.
  const forwarded = req.headers["x-forwarded-for"] || req.headers["forwarded"];
  return loopback && !forwarded;
};

const failedAttempts = new Map<string, { count: number; until: number }>();

const pinMatches = (req: Request, pin: unknown) => {
  const who = req.socket.remoteAddress ?? "unknown";
  const record = failedAttempts.get(who);
  if (record && record.count >= 10 && Date.now() < record.until) return false;
  if (typeof pin === "string" && pin !== "" && pin === getSettings().pin) {
    failedAttempts.delete(who);
    return true;
  }
  if (typeof pin === "string" && pin !== "") {
    const count = (record && Date.now() < record.until ? record.count : 0) + 1;
    failedAttempts.set(who, { count, until: Date.now() + 60_000 });
  }
  return false;
};

const isOperator = (req: Request) =>
  isThisMac(req) || pinMatches(req, req.headers["x-operator-pin"]);

const operatorOnly = (req: Request, res: Response, next: NextFunction) => {
  if (isOperator(req)) return next();
  res.status(401).json({ message: "Operator PIN required" });
};

const lanAddresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => `http://${net!.address}:${PORT}`);

/** The address audience phones should open (shown as the QR code). */
const audienceUrl = () =>
  getSettings().publicUrl || lanAddresses()[0] || `http://localhost:${PORT}`;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

app.use((req, res, next) => {
  // Lets a display page hosted elsewhere point at this server with ?service=
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Operator-Pin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "20mb" }));

const api = express.Router();

// -- open to every screen ----------------------------------------------------

api.get("/health", (_req, res) => res.json({ ok: true, app: "subtitle" }));

api.get("/live", (_req, res) => res.json(liveState()));

api.get("/info", (req, res) =>
  res.json({
    audienceUrl: audienceUrl(),
    addresses: lanAddresses(),
    thisMac: isThisMac(req),
    operator: isOperator(req),
  }),
);

api.post("/verify", (req, res) => {
  const verified = isThisMac(req) || pinMatches(req, String(req.body?.pin ?? ""));
  res.status(verified ? 200 : 401).json({ verified });
});

// -- operator only -----------------------------------------------------------

api.use(operatorOnly);

api.post("/control/next", (_req, res) => res.json(setIndex(liveIndex + 1)));
api.post("/control/previous", (_req, res) => res.json(setIndex(liveIndex - 1)));
api.post("/control/jump", (req, res) => {
  const index = Number(req.body?.index);
  if (!Number.isInteger(index)) {
    return res.status(400).json({ message: "Invalid line number" });
  }
  res.json(setIndex(index));
});

// Put a show on the displays (this replaces the old "New Session").
api.post("/control/load", (req, res) => {
  const show = getShow(String(req.body?.showId ?? ""));
  if (!show) return res.status(404).json({ message: "Show not found" });
  const index = Number.isInteger(req.body?.index) ? req.body.index : 0;
  setLiveShow(show, index);
  res.json(liveState());
});

api.get("/shows", (_req, res) => res.json(listShows(liveShow?.id ?? null)));

api.post("/shows", (req, res) => {
  const copyOf = req.body?.copyOf ? getShow(String(req.body.copyOf)) : null;
  const lines = copyOf ? copyOf.lines.map(({ id, ...rest }) => rest) : req.body?.lines;
  res.status(201).json(createShow(String(req.body?.title ?? ""), lines));
});

api.get("/shows/:id", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ message: "Show not found" });
  res.json(show);
});

api.put("/shows/:id", (req, res) => {
  const show = updateShow(req.params.id, req.body ?? {});
  if (!show) return res.status(404).json({ message: "Show not found" });
  if (liveShow?.id === show.id) {
    // Editing the show that is on screen: stay on the same line even if rows
    // were added or removed above it.
    const currentLineId = liveShow.lines[liveIndex]?.id;
    const moved = show.lines.findIndex((line) => line.id === currentLineId);
    setLiveShow(show, moved >= 0 ? moved : liveIndex);
  }
  res.json(show);
});

api.delete("/shows/:id", (req, res) => {
  if (liveShow?.id === req.params.id) {
    return res.status(409).json({
      message: "This show is live. Put another show on the displays first.",
    });
  }
  if (!deleteShow(req.params.id)) {
    return res.status(404).json({ message: "Show not found" });
  }
  res.json({ deleted: true });
});

api.get("/settings", (_req, res) => res.json(getSettings()));
api.put("/settings", (req, res) => res.json(saveSettings(req.body ?? {})));

app.use("/api", api);
app.use("/api", (_req, res) => res.status(404).json({ message: "Not found" }));

// ---------------------------------------------------------------------------
// Web pages
// ---------------------------------------------------------------------------

if (fs.existsSync(path.join(WEB_DIR, "index.html"))) {
  app.use(express.static(WEB_DIR));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(WEB_DIR, "index.html"));
  });
} else {
  app.use((_req, res) => {
    res
      .status(503)
      .send("The web pages have not been built yet. Run: bun run build");
  });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(err?.status || 500).json({ message: err?.message || "Server error" });
});

// ---------------------------------------------------------------------------

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `\nPort ${PORT} is already in use – the subtitle program is probably already running.\n` +
        `Open http://localhost:${PORT} or close the other window first.\n`,
    );
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  const line = "─".repeat(58);
  console.log(`
${line}
  SUBTITLE SYSTEM IS RUNNING        (keep this window open)
${line}
  On this Mac
    Operator   http://localhost:${PORT}/controller
    Editor     http://localhost:${PORT}/editor
    Display    http://localhost:${PORT}/display

  Other devices on the same Wi-Fi / network
    Display    ${audienceUrl()}/display
    Operator   ${audienceUrl()}/controller   (PIN ${getSettings().pin})

  Live show    ${liveShow ? `${liveShow.title} – line ${liveIndex}` : "none yet"}
  Data folder  ${DATA_DIR}

  To stop: press Control + C, or close this window.
${line}
`);
});
