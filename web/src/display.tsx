import { useEffect, useState } from "react";
import type { Line } from "../../shared/lines";
import "./display.scss";
import { useLive } from "./api";
import { useMediaQuery } from "react-responsive";
import QRCode from "react-qr-code";
import { useSearchParams } from "react-router";

type Subtitle = Line;

const EMPTY: Subtitle = {
	id: "",
	act: "",
	scene: "",
	char: "",
	eng: "",
	thai: "",
	isLyric: false,
	remark: ""
};

// What the audience sees. The look of this page is intentionally left exactly
// as it was; only the way it gets its data changed (it now simply follows the
// server that served the page, so there is no backend URL to type in).
export default function Display() {
	const [searchParams] = useSearchParams();
	// Optional: /display?service=http://other-server:8001 follows another server.
	const service = (searchParams.get("service") || "").replace(/\/$/, "");
	const isDebug = searchParams.get("debug") === "true";
	const isLandscape = useMediaQuery({ query: "(max-height: 300px)" });

	const { live } = useLive(service);
	const isLoading = live === null;
	const subtitle: Subtitle[] = live?.lines ?? [];
	const index = live?.index ?? 0;
	const safeIndex =
		index >= subtitle.length ? subtitle.length - 1 : Math.max(index, 0);
	const currentSubtitle: Subtitle = subtitle[safeIndex] ?? EMPTY;

	// Address shown in the QR code so the audience can follow on their phones.
	const [audienceLink, setAudienceLink] = useState(
		service
			? `${window.location.origin}/display?service=${service}`
			: `${window.location.origin}/display`
	);
	useEffect(() => {
		if (service) return;
		fetch("/api/info")
			.then((response) => response.json())
			.then((info) => {
				if (info?.audienceUrl) setAudienceLink(`${info.audienceUrl}/display`);
			})
			.catch(() => {});
	}, [service]);

	useEffect(() => {
		if (document.documentElement.requestFullscreen) {
			document.documentElement.requestFullscreen().catch(() => {});
			// @ts-ignore
		} else if (document.documentElement.webkitRequestFullscreen) {
			// @ts-ignore
			document.documentElement.webkitRequestFullscreen();
		}
	}, []);

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

					<QRCode value={audienceLink} />
					<p>{audienceLink}</p>
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
				<div className="debug"
				
				style={
					{
						position: "absolute",
						top: 0,
						left: 0,
						color: "red",
						backgroundColor: "white",
						padding: "0rem",
	
						width: "fit-content",
						height: "fit-content",
						fontSize: "1.5rem",
						fontWeight: "bold",
					}
				}
				>
			<p style={
				{
					margin: 0,
					padding: 0,
				}
			}
			> index {index} | act {currentSubtitle?.act} | scene {currentSubtitle?.scene}</p>
			<p
				style={{
					margin: 0,
					padding: 0,
					marginTop: "0.5rem",
					fontWeight: "lighter",
				}}
			>
				{`act ${currentSubtitle.act} ${subtitle.findIndex(sub => sub.act === currentSubtitle.act && sub.scene === currentSubtitle.scene && sub.char === currentSubtitle.char && sub.thai === currentSubtitle.thai && sub.eng === currentSubtitle.eng) + 1} / ${subtitle.filter(sub => sub.act === currentSubtitle.act).length} `}
				{`scene ${currentSubtitle.scene} ${
					subtitle
						.filter(sub => sub.act === currentSubtitle.act && sub.scene === currentSubtitle.scene)
						.findIndex(sub => sub.char === currentSubtitle.char && sub.thai === currentSubtitle.thai && sub.eng === currentSubtitle.eng) + 1
				} / ${subtitle.filter(sub => sub.act === currentSubtitle.act && sub.scene === currentSubtitle.scene).length}`}
			</p>
					</div>
					<div className="index-display"
					style={{
						position: "absolute",
						top: 0,
						right: 0,
						fontSize: "1rem",
						fontWeight: "bold",
						color: "white",
						fontFamily: "Sarabun",
						backgroundColor: "red",
						height: "fit-content",
					}}>
						<p
						style={{
							margin: 0,
							padding: 0,
							fontSize: "4rem",
							lineHeight: 1,
						}}
						>{index}</p>
					</div>
					</>
			)}
			<h1 className="display__character">{currentSubtitle?.char}</h1>
			<div className="display__text">
				<h2 className="display__text--thai">{currentSubtitle?.thai}</h2>
				<h2 className="display__text--english">{currentSubtitle?.eng}</h2>
			</div>
		</div>
	);
}
