import express from "express";
import type { ErrorRequestHandler, RequestHandler } from "express";
const app = express();
import http from "http";
const port = 8001;
const server = http.createServer(app);
import router from "./router";
import cors from "cors";
import { centralError, notFound404 } from "./controller/error";
import { Server as SocketServer } from "socket.io";
import path from "path";

export const io = new SocketServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

declare global {
  namespace Express {
    interface Request {
      [key: string]: any;
      user: {
        userId: number;
        name: string;
      };
    }
  }
  interface Error {
    statusCode: number;
    type?: string;
    header?: string;
    location?: string;
    modal?: boolean;
  }
}

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  }),
);

app.use("/files", express.static(path.join(__dirname, "..", "files")));

app.use("/", router);
io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

// Error Handling
app.use("/", notFound404);
app.use(centralError);

server.listen(port, () => {
  console.log(`Service listening on port ${port}`);
});
