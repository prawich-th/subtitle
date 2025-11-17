import { useEffect, useMemo, useState } from "react";
import { Subtitle } from "../types";
import "./display.scss";
import { socket } from "../socket";
import { useMediaQuery } from "react-responsive";
import QRCode from "react-qr-code";

export default function Display() {
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
	const backendUrl = useMemo(() => "http://localhost:8001", []);
	const isLandscape = useMediaQuery({ query: "(max-height: 300px)" });
	const currentUrl = window.location.href;

	useEffect(() => {
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
	}, [backendUrl]);

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

					<QRCode value={currentUrl} />
					<p>{currentUrl}</p>
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
