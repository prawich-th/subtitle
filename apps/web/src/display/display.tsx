import { useEffect, useState } from "react";
import { Subtitle } from "../types";
import "./display.scss";
import { socket } from "../socket";
import { useMediaQuery } from "react-responsive";
import QRCode from "react-qr-code";
import { useSearchParams } from "react-router";

export default function Display() {
	const [searchParams] = useSearchParams();
	// Check URL params first, then localStorage
	const getInitialBackendUrl = (): string => {
		const urlParams = new URLSearchParams(window.location.search);
		const urlParam = urlParams.get("service");
		if (urlParam) {
			const cleanUrl = urlParam.replace(/\/$/, "");
			localStorage.setItem("displayBackendUrl", cleanUrl);
			return cleanUrl;
		}
		return localStorage.getItem("displayBackendUrl") || "";
	};

	const [backendUrl, setBackendUrl] = useState<string>(getInitialBackendUrl);
	const [isBackendUrlSet, setIsBackendUrlSet] = useState<boolean>(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const urlParam = urlParams.get("backendUrl");
		if (urlParam) {
			return true;
		}
		return !!localStorage.getItem("displayBackendUrl");
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
	const isLandscape = useMediaQuery({ query: "(max-height: 300px)" });
	const currentUrl = window.location.href;

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
		socket.connect();
		const handleSubIndex = (data: { index: number }) => {
			console.log("SubIndex:", data);
			if (typeof data.index === "number") {
				setIndex(data.index);
			}
		};

		socket.on("subIndex", handleSubIndex);

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
			socket.off("subIndex", handleSubIndex);
			socket.disconnect();
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
		if (document.documentElement.requestFullscreen) {
			document.documentElement.requestFullscreen();
			// @ts-ignore
		} else if (document.documentElement.webkitRequestFullscreen) {
			// @ts-ignore
			document.documentElement.webkitRequestFullscreen();
		}
	}, []);

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

					<QRCode value={"https://subtitle.prawichth.com/display?service=" + backendUrl} />
					<p>{"https://subtitle.prawichth.com/display?service=" + backendUrl}</p>
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
			<h1 className="display__character">{currentSubtitle?.char}</h1>
			<div className="display__text">
				<h2 className="display__text--thai">{currentSubtitle?.thai}</h2>
				<h2 className="display__text--english">{currentSubtitle?.eng}</h2>
			</div>
		</div>
	);
}
