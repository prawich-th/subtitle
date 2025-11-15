import express, { ErrorRequestHandler, RequestHandler } from "express";
const app = express();
import http from "http";
const port = 8001;
const server = http.createServer(app);
import router from "./router";
import cors from "cors";
import { centralError, notFound404 } from "./controller/error";
import { Server as SocketServer } from "socket.io";

export const io = new SocketServer(server);

declare global {
	namespace Express {
		interface Request {
			[key: string]: any;
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

app.use(cors());

// app.use((req, res, next) => {
// 	res.setHeader(
// 		"Access-Control-Allow-Origin",
// 		"*, http://192.168.88.127:5173/"
// 	); // Allow all origins
// 	res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE"); // Allowed methods
// 	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Allowed headers
// 	next();
// });

app.use(express.json());
app.use(
	express.urlencoded({
		extended: true
	})
);

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
