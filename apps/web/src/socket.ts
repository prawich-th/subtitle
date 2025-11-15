import io, { Socket } from "socket.io-client";

const URL =
	import.meta.env.VITE_BACKEND_URL ??
	(import.meta.env.DEV ? "http://192.168.1.169:8001/" : undefined);

export const socket: Socket = URL
	? io(URL, {
			autoConnect: false,
			transports: ["websocket"]
		})
	: io({
			autoConnect: false,
			transports: ["websocket"]
		});
