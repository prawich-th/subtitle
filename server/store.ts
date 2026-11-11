// Everything the program remembers lives in plain files inside the `data/` folder:
//
//   data/shows/<id>.json     one file per show (the subtitles)
//   data/backups/<id>/...    automatic older copies of each show
//   data/state.json          which show is live and which line it is on
//   data/settings.json       operator PIN and audience link
//
// Copy the `data/` folder to move everything to another Mac.

import fs from "fs";
import path from "path";
import {
  type Line,
  type Show,
  type ShowSummary,
  type Warning,
  newId,
  normalizeLines,
  normalizeSeconds,
  normalizeWarnings,
} from "../shared/lines";

export const DATA_DIR = path.resolve(
  process.env.SUBTITLE_DATA_DIR || path.join(import.meta.dir, "..", "data"),
);
const SHOWS_DIR = path.join(DATA_DIR, "shows");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const SEED_FILE = path.join(import.meta.dir, "seed", "default-show.json");

const BACKUP_EVERY_MS = 5 * 60 * 1000;
const BACKUPS_TO_KEEP = 40;

export type Settings = {
  /** Code other devices must type before they can operate or edit. */
  pin: string;
  /** Optional address to put in the audience QR code instead of the auto-detected one. */
  publicUrl: string;
};

type SavedState = { showId: string | null; index: number };

const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
};

// Write to a temporary file first so a crash can never leave a half-written show.
const writeJson = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
};

const isValidId = (id: string) => /^[a-z0-9-]{1,80}$/.test(id);
const showFile = (id: string) => path.join(SHOWS_DIR, `${id}.json`);

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

// --- settings ---------------------------------------------------------------

export const getSettings = (): Settings => {
  const saved = readJson<Partial<Settings>>(SETTINGS_FILE) ?? {};
  if (saved.pin) return { pin: String(saved.pin), publicUrl: saved.publicUrl ?? "" };
  const settings: Settings = {
    pin: String(Math.floor(1000 + Math.random() * 9000)),
    publicUrl: saved.publicUrl ?? "",
  };
  writeJson(SETTINGS_FILE, settings);
  return settings;
};

export const saveSettings = (changes: Partial<Settings>): Settings => {
  const settings = { ...getSettings() };
  if (typeof changes.pin === "string" && changes.pin.trim()) {
    settings.pin = changes.pin.trim();
  }
  if (typeof changes.publicUrl === "string") {
    settings.publicUrl = changes.publicUrl.trim().replace(/\/+$/, "");
  }
  writeJson(SETTINGS_FILE, settings);
  return settings;
};

// --- live state -------------------------------------------------------------

export const loadState = (): SavedState => {
  const saved = readJson<SavedState>(STATE_FILE);
  return {
    showId: typeof saved?.showId === "string" ? saved.showId : null,
    index: Number.isInteger(saved?.index) ? (saved!.index as number) : 0,
  };
};

export const saveState = (state: SavedState) => writeJson(STATE_FILE, state);

// --- shows ------------------------------------------------------------------

export const getShow = (id: string): Show | null => {
  if (!isValidId(id)) return null;
  const show = readJson<Show>(showFile(id));
  if (!show) return null;
  return {
    ...show,
    id,
    lines: normalizeLines(show.lines),
    warnings: normalizeWarnings(show.warnings),
    warningSeconds: normalizeSeconds(show.warningSeconds),
  };
};

export const listShows = (liveId: string | null): ShowSummary[] => {
  if (!fs.existsSync(SHOWS_DIR)) return [];
  return fs
    .readdirSync(SHOWS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => getShow(name.slice(0, -5)))
    .filter((show): show is Show => show !== null)
    .map((show) => ({
      id: show.id,
      title: show.title,
      updatedAt: show.updatedAt,
      lineCount: show.lines.length,
      live: show.id === liveId,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const createShow = (
  title: string,
  lines: Line[] = [],
  extra: { warnings?: Warning[]; warningSeconds?: number } = {},
): Show => {
  const cleanTitle = title.trim() || "Untitled show";
  let id = slug(cleanTitle) || "show";
  if (fs.existsSync(showFile(id))) id = `${id}-${newId().slice(0, 5)}`;
  const now = new Date().toISOString();
  const show: Show = {
    id,
    title: cleanTitle,
    createdAt: now,
    updatedAt: now,
    lines: normalizeLines(lines),
    warnings: normalizeWarnings(extra.warnings),
    warningSeconds: normalizeSeconds(extra.warningSeconds),
  };
  writeJson(showFile(id), show);
  return show;
};

const backUp = (id: string) => {
  const dir = path.join(BACKUPS_DIR, id);
  const existing = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  const latest = existing[existing.length - 1];
  if (latest) {
    const age = Date.now() - fs.statSync(path.join(dir, latest)).mtimeMs;
    if (age < BACKUP_EVERY_MS) return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(showFile(id), path.join(dir, `${stamp}.json`));
  for (const old of existing.slice(0, Math.max(0, existing.length + 1 - BACKUPS_TO_KEEP))) {
    fs.rmSync(path.join(dir, old), { force: true });
  }
};

export const updateShow = (
  id: string,
  changes: {
    title?: string;
    lines?: unknown;
    warnings?: unknown;
    warningSeconds?: unknown;
  },
): Show | null => {
  const show = getShow(id);
  if (!show) return null;
  backUp(id);
  if (typeof changes.title === "string" && changes.title.trim()) {
    show.title = changes.title.trim();
  }
  if (Array.isArray(changes.lines)) show.lines = normalizeLines(changes.lines);
  if (Array.isArray(changes.warnings)) {
    show.warnings = normalizeWarnings(changes.warnings);
  }
  if (changes.warningSeconds !== undefined) {
    show.warningSeconds = normalizeSeconds(changes.warningSeconds);
  }
  show.updatedAt = new Date().toISOString();
  writeJson(showFile(id), show);
  return show;
};

/** Deleted shows are moved into the backups folder rather than destroyed. */
export const deleteShow = (id: string): boolean => {
  if (!getShow(id)) return false;
  const dir = path.join(BACKUPS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.renameSync(showFile(id), path.join(dir, `${stamp}-deleted.json`));
  return true;
};

/** On the very first start, load the original production script so there is something to see. */
export const seedIfEmpty = () => {
  fs.mkdirSync(SHOWS_DIR, { recursive: true });
  if (fs.existsSync(STATE_FILE) || listShows(null).length > 0) return;
  const seed = readJson<unknown[]>(SEED_FILE);
  if (!seed) return;
  const show = createShow("Example show", normalizeLines(seed, true));
  saveState({ showId: show.id, index: 0 });
};
