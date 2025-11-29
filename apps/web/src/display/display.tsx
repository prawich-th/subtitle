import { useEffect, useState, useRef } from "react";
import { Subtitle } from "../types";
import "./display.scss";
import { createSocket } from "../socket";
import { useMediaQuery } from "react-responsive";
import QRCode from "react-qr-code";
import { useSearchParams } from "react-router";

export default function Display() {
	const [searchParams] = useSearchParams();
	// Check URL params first, then localStorage
	const getInitialBackendUrl = (): string => {
		const urlParam = searchParams.get("service");
		return urlParam
			? urlParam.replace(/\/$/, "")
			: localStorage.getItem("displayBackendUrl") || "";
	};

	const [backendUrl, setBackendUrl] = useState<string>(getInitialBackendUrl);
	const [isBackendUrlSet, setIsBackendUrlSet] = useState<boolean>(() => {
		return searchParams.get("service")
			? true
			: !!localStorage.getItem("displayBackendUrl");
	});
	const [isLoading, setIsLoading] = useState(true);
	const [subtitle, setSubtitle] = useState<Subtitle[]>([]);
	const [index, setIndex] = useState(0);
	const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle>({
		act: "",
		scene: "",
		char: "",
		eng: "",
		thai: "",
		isLyric: false,
		remark: ""
	});
	const [isDebug, setIsDebug] = useState(false);
	useEffect(() => {
		const debugParam = searchParams.get("debug");
		if (debugParam) {
			setIsDebug(debugParam === "true");
		}
	}, [searchParams]);
	const isLandscape = useMediaQuery({ query: "(max-height: 300px)" });
	const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);

	const handleBackendUrlSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.target as HTMLFormElement);
		const url = (formData.get("backendUrl") as string)?.trim() || "";
		if (url) {
			// Remove trailing slash if present
			const cleanUrl = url.replace(/\/$/, "");
			setBackendUrl(cleanUrl);
			localStorage.setItem("displayBackendUrl", cleanUrl);
			setIsBackendUrlSet(true);
		}
	};

	useEffect(() => {
		// Check URL params first (takes priority)
		const urlParam = searchParams.get("backendUrl");
		if (urlParam) {
			const cleanUrl = urlParam.replace(/\/$/, "");
			setBackendUrl(cleanUrl);
			localStorage.setItem("displayBackendUrl", cleanUrl);
			setIsBackendUrlSet(true);
		} else if (!isBackendUrlSet) {
			// If no URL param and not set, check localStorage
			const storedUrl = localStorage.getItem("displayBackendUrl");
			if (storedUrl) {
				setBackendUrl(storedUrl);
				setIsBackendUrlSet(true);
			}
		}
	}, [searchParams, isBackendUrlSet]);

	useEffect(() => {
		if (!isBackendUrlSet || !backendUrl) {
			return;
		}

		// Create socket with the backend URL
		const socket = createSocket(backendUrl);
		socketRef.current = socket;

		const handleSubIndex = (data: { index: number }) => {
			console.log("SubIndex received:", data);
			if (typeof data.index === "number") {
				setIndex(data.index);
			}
		};

		const handleConnect = () => {
			console.log("Socket connected to:", backendUrl);
			// Request current index when connected to ensure sync
			fetch(`${backendUrl}/subcontrol/current`)
				.then((response) => response.json())
				.then((data) => {
					console.log("Current subtitle on connect:", data);
					if (typeof data.index === "number") {
						setIndex(data.index);
					}
				})
				.catch((error) => {
					console.error("Error fetching current index on connect:", error);
				});
		};

		const handleDisconnect = (reason: string) => {
			console.log("Socket disconnected from:", backendUrl, "Reason:", reason);
		};

		const handleConnectError = (error: Error) => {
			console.error("Socket connection error:", error);
		};

		const handleReconnect = (attemptNumber: number) => {
			console.log("Socket reconnected after", attemptNumber, "attempts");
		};

		const handleReconnectAttempt = (attemptNumber: number) => {
			console.log("Socket reconnection attempt", attemptNumber);
		};

		const handleReconnectError = (error: Error) => {
			console.error("Socket reconnection error:", error);
		};

		const handleReconnectFailed = () => {
			console.error("Socket reconnection failed after all attempts");
		};

		// Set up all event listeners before connecting
		socket.on("subIndex", handleSubIndex);
		socket.on("connect", handleConnect);
		socket.on("disconnect", handleDisconnect);
		socket.on("connect_error", handleConnectError);
		socket.on("reconnect", handleReconnect);
		socket.on("reconnect_attempt", handleReconnectAttempt);
		socket.on("reconnect_error", handleReconnectError);
		socket.on("reconnect_failed", handleReconnectFailed);

		// Connect the socket
		socket.connect();

		console.info("Initializing subtitles");
		setIsLoading(true);
		fetch(`${backendUrl}/data`)
			.then((response) => response.json())
			.then((data) => {
				setSubtitle(data);
				if (data.length > 0) {
					setCurrentSubtitle(data[0]);
				}
			})
			.finally(() => {
				console.log("Subtitles fetched successfully");
				setIsLoading(false);
			});

		fetch(`${backendUrl}/subcontrol/current`)
			.then((response) => response.json())
			.then((data) => {
				console.log("Current subtitle:", data);
				setIndex(data.index);
			});

		return () => {
			if (socketRef.current) {
				// Remove all event listeners
				socketRef.current.off("subIndex");
				socketRef.current.off("connect");
				socketRef.current.off("disconnect");
				socketRef.current.off("connect_error");
				socketRef.current.off("reconnect");
				socketRef.current.off("reconnect_attempt");
				socketRef.current.off("reconnect_error");
				socketRef.current.off("reconnect_failed");
				// Disconnect the socket
				socketRef.current.disconnect();
				socketRef.current = null;
			}
		};
	}, [backendUrl, isBackendUrlSet]);

	useEffect(() => {
		if (!subtitle.length) {
			return;
		}
		const safeIndex =
			index >= subtitle.length ? subtitle.length - 1 : Math.max(index, 0);
		setCurrentSubtitle(subtitle[safeIndex]);
	}, [index, subtitle]);

	useEffect(() => {
		handleFullScreen();
	}, []);

	const handleFullScreen = () => {
		if (document.documentElement.requestFullscreen) {
			document.documentElement.requestFullscreen();
			// @ts-ignore
		} else if (document.documentElement.webkitRequestFullscreen) {
			// @ts-ignore
			document.documentElement.webkitRequestFullscreen();
		}
	};

	// const handleNext = () => {
	// 	fetch(`${backendUrl}/subcontrol/next`).catch((error) =>
	// 		console.error("Error moving to next subtitle:", error)
	// 	);
	// };

	if (!isBackendUrlSet) {
		return (
			<div className="display">
				<div style={{ padding: "2rem", textAlign: "center" }}>
					<h1>SETUP</h1>
					<form
						onSubmit={handleBackendUrlSubmit}
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "1rem",
							maxWidth: "500px",
							margin: "0 auto"
						}}
					>
						<input
							type="text"
							name="backendUrl"
							placeholder="Enter Backend URL (e.g., http://192.168.1.169:8001)"
							defaultValue={backendUrl}
							required
							style={{
								padding: "15px",
								fontSize: "18px",
								width: "100%",
								boxSizing: "border-box"
							}}
						/>
						<button
							type="submit"
							style={{
								padding: "15px 30px",
								fontSize: "18px",
								cursor: "pointer",
								backgroundColor: "#222",
								color: "white",
								border: "none",
								borderRadius: "5px"
							}}
						>
							Connect
						</button>
					</form>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (currentSubtitle?.char === "QR") {
		return (
			<div className="qr">
				<div className="qr__layout">
					<span className="qr__title">
						<img src="/tech.png" alt="Nova Prods Logo" />
						<h1>Scan this QR Code</h1>
						<h2>to view Subtitle on your device</h2>
					</span>

					<QRCode
						value={
							window.location.origin +
							"/display?debug=true&service=" +
							backendUrl
						}
					/>
					<p>
						{window.location.origin +
							"/display?debug=true&service=" +
							backendUrl}
					</p>
				</div>
			</div>
		);
	}

	return isLandscape ? (
		<div className="landscape">
			<div className="landscape__layout">
				<h1 className="landscape__character">{currentSubtitle?.char}</h1>
				<div className="landscape__text">
					<h2 className="landscape__text--thai">{currentSubtitle?.thai}</h2>
					<h2 className="landscape__text--english">{currentSubtitle?.eng}</h2>
				</div>
			</div>
		</div>
	) : (
		<div className="display">
			{isDebug && (
				<>
					<div onClick={handleFullScreen} className="debug">
						<p
							style={{
								margin: 0,
								padding: 0
							}}
						>
							{" "}
							index {index} | act {currentSubtitle?.act} | scene{" "}
							{currentSubtitle?.scene}
						</p>
						<p
							style={{
								margin: 0,
								padding: 0,
								marginTop: "0.5rem",
								fontWeight: "lighter"
							}}
						>
							{`act ${currentSubtitle.act} ${
								subtitle
									.filter((sub) => sub.act === currentSubtitle.act)
									.findIndex(
										(sub) =>
											sub.char === currentSubtitle.char &&
											sub.thai === currentSubtitle.thai &&
											sub.eng === currentSubtitle.eng
									) + 1
							} / ${subtitle.filter((sub) => sub.act === currentSubtitle.act).length} `}
							{`scene ${currentSubtitle.scene} ${
								subtitle
									.filter(
										(sub) =>
											sub.act === currentSubtitle.act &&
											sub.scene === currentSubtitle.scene
									)
									.findIndex(
										(sub) =>
											sub.char === currentSubtitle.char &&
											sub.thai === currentSubtitle.thai &&
											sub.eng === currentSubtitle.eng
									) + 1
							} / ${subtitle.filter((sub) => sub.act === currentSubtitle.act && sub.scene === currentSubtitle.scene).length}`}
							lyrics {currentSubtitle.isLyric}
						</p>
					</div>
					<div
						className="index-display"
						style={{
							position: "absolute",
							top: 0,
							right: 0,
							fontSize: "1rem",
							fontWeight: "bold",
							color: "white",
							fontFamily: "Sarabun",
							backgroundColor: "red",
							height: "fit-content"
						}}
					>
						<p
							style={{
								margin: 0,
								padding: 0,
								fontSize: "5rem",
								lineHeight: 1
							}}
						>
							{index}
						</p>
					</div>
				</>
			)}
			<h1 className="display__character">{currentSubtitle?.char}</h1>
			<div className="display__text">
				<h2 className="display__text--thai">
					{currentSubtitle.isLyric ? "♪" : ""} {currentSubtitle?.thai}
					{currentSubtitle.isLyric ? "♪" : ""}
				</h2>
				<h2 className="display__text--english">
					{currentSubtitle.isLyric ? "♪" : ""} {currentSubtitle?.eng}
					{currentSubtitle.isLyric ? "♪" : ""}
				</h2>
			</div>
		</div>
	);
}
