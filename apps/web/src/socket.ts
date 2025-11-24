import io, { Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export const createSocket = (url: string): Socket => {
	// Disconnect existing socket if any
	if (socketInstance) {
		socketInstance.removeAllListeners();
		if (socketInstance.connected) {
			socketInstance.disconnect();
		}
		socketInstance = null;
	}

	// Remove trailing slash
	const cleanUrl = url.replace(/\/$/, "");

	// Create new socket with the provided URL
	socketInstance = io(cleanUrl, {
		autoConnect: false,
		transports: ["websocket", "polling"],
		reconnection: true,
		reconnectionDelay: 1000,
		reconnectionDelayMax: 5000,
		reconnectionAttempts: Infinity,
		timeout: 20000,
		forceNew: true
	});

	return socketInstance;
};

// Default socket for backward compatibility (will be replaced when createSocket is called)
export const socket: Socket = io({
	autoConnect: false,
	transports: ["websocket", "polling"]
});
