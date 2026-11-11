import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import QRCode from "react-qr-code";
import type { Line, ShowSummary } from "../../shared/lines";
import { api, useLive } from "./api";
import "./operator.scss";

const Card = memo(function Card({
	index,
	subtitle,
	className,
	jump,
	handler
}: {
	index: number;
	subtitle: Line;
	className: string;
	jump: boolean;
	handler: (index: number) => void;
}) {
	return (
		<div
			className={`preview__card ${className} ${jump ? "preview__card--clickable" : ""}`}
			onClick={() => {
				if (jump) handler(index);
			}}
		>
			<p className="preview__card--index">
				INDEX {index} | ACT {subtitle?.act} | SCENE {subtitle?.scene}
				{subtitle?.isLyric && " | ♪ LYRIC"}
			</p>
			<h2 className="preview__card--character">{subtitle?.char}</h2>
			<p className="preview__card--thai">{subtitle?.thai}</p>
			<p className="preview__card--english">{subtitle?.eng}</p>
			{subtitle?.remark && (
				<p className="preview__card--remark">Note: {subtitle.remark}</p>
			)}
		</div>
	);
});

type Info = { audienceUrl: string; addresses: string[]; thisMac: boolean };
type Settings = { pin: string; publicUrl: string };

const numeric = (a: string, b: string) => {
	const numA = Number(a);
	const numB = Number(b);
	return !isNaN(numA) && !isNaN(numB) ? numA - numB : a.localeCompare(b);
};

export default function Controller() {
	const { live, connected } = useLive();
	const [shows, setShows] = useState<ShowSummary[]>([]);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState("");
	const [willJumpToClick, setWillJumpToClick] = useState(false);
	const [modal, setModal] = useState<"" | "actScene" | "settings">("");
	const previewRef = useRef<HTMLDivElement | null>(null);
	const modalRef = useRef(modal);
	modalRef.current = modal;

	const subtitle = live?.lines ?? [];
	const index = Math.min(live?.index ?? 0, Math.max(subtitle.length - 1, 0));
	const showId = live?.showId ?? null;

	const send = (path: string, body: unknown = {}) => {
		setError("");
		return api(path, { body }).catch((err: Error) => {
			setError(
				`Could not reach the server – ${err.message}. Is the program still running?`
			);
		});
	};

	// Loading the list of shows also checks that this device may operate
	// (other devices are sent to the PIN page).
	useEffect(() => {
		api<ShowSummary[]>("/shows")
			.then((list) => {
				setShows(list);
				setReady(true);
			})
			.catch((err: Error) => setError(err.message));
	}, [showId]);

	const handleNext = () => send("/control/next");
	const handlePrevious = () => send("/control/previous");
	const handleJumpToLine = (line: number) => send("/control/jump", { index: line });

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			// Don't steal keys while someone is typing a line number etc.
			if (modalRef.current || target?.closest("input, select, textarea")) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if ([" ", "ArrowRight", "ArrowDown", "PageDown"].includes(event.key)) {
				event.preventDefault();
				handleNext();
			} else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
				event.preventDefault();
				handlePrevious();
			}
		};
		addEventListener("keydown", handleKeyDown);
		return () => removeEventListener("keydown", handleKeyDown);
	}, []);

	// Keep the current line at the top of the list.
	useEffect(() => {
		previewRef.current?.scrollTo({ top: 0, behavior: "smooth" });
	}, [index, showId]);

	const handleChangeShow = (id: string) => {
		const show = shows.find((s) => s.id === id);
		if (!show || id === showId) return;
		if (
			confirm(
				`Put "${show.title}" on the displays?\n\nEvery screen switches to its first line straight away.`
			)
		) {
			send("/control/load", { showId: id });
		}
	};

	const handleRestart = () => {
		if (!showId) return;
		if (confirm("Go back to the very first line? Every screen will follow.")) {
			send("/control/load", { showId });
		}
	};

	// Acts and scenes with the line each one starts on.
	const actsAndScenes = useMemo(() => {
		const acts = new Map<string, { start: number; scenes: Map<string, number> }>();
		subtitle.forEach((sub, i) => {
			const act = sub.act.trim();
			const scene = sub.scene.trim();
			if (!act || act === "0" || !scene || scene === "0") return;
			if (!acts.has(act)) acts.set(act, { start: i, scenes: new Map() });
			const entry = acts.get(act)!;
			if (!entry.scenes.has(scene)) entry.scenes.set(scene, i);
		});
		return Array.from(acts.entries())
			.sort((a, b) => numeric(a[0], b[0]))
			.map(([act, entry]) => ({
				act,
				start: entry.start,
				scenes: Array.from(entry.scenes.entries()).sort((a, b) =>
					numeric(a[0], b[0])
				)
			}));
	}, [subtitle]);

	if (!ready || !live) {
		return (
			<div className="page page--narrow">
				<p>{error || "Loading Subtitles Data from the Server."}</p>
			</div>
		);
	}

	return (
		<>
			{modal === "actScene" && (
				<div className="modal" onClick={() => setModal("")}>
					<div className="modal__box" onClick={(e) => e.stopPropagation()}>
						<div className="modal__head">
							<h2>Jump to Act/Scene</h2>
							<button className="modal__close" onClick={() => setModal("")}>
								×
							</button>
						</div>
						{actsAndScenes.length === 0 && (
							<p className="muted">This show has no acts or scenes filled in.</p>
						)}
						{actsAndScenes.map(({ act, start, scenes }) => (
							<div key={act} className="actlist">
								<button
									className="actlist__act"
									onClick={() => {
										handleJumpToLine(start);
										setModal("");
									}}
								>
									Act {act}
								</button>
								<div className="actlist__scenes">
									{scenes.map(([scene, line]) => (
										<button
											key={scene}
											className="btn"
											onClick={() => {
												handleJumpToLine(line);
												setModal("");
											}}
										>
											Scene {scene}
										</button>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
			{modal === "settings" && <SettingsModal onClose={() => setModal("")} />}

			<div className="controller">
				<div className="actions">
					<h1>OPERATOR</h1>
					<p className={`status ${connected ? "status--ok" : "status--bad"}`}>
						{connected ? "● Connected" : "● Connection lost – reconnecting…"}
					</p>
					{error && <p className="error">{error}</p>}

					<label className="actions__label">
						Show on the displays
						<select
							className="field"
							value={showId ?? ""}
							onChange={(e) => handleChangeShow(e.target.value)}
						>
							{!showId && <option value="">— choose a show —</option>}
							{shows.map((show) => (
								<option key={show.id} value={show.id}>
									{show.title} ({show.lineCount} lines)
								</option>
							))}
						</select>
					</label>

					<button className="actions__previous" onClick={handlePrevious}>
						Previous
					</button>
					<button className="actions__next" onClick={handleNext}>
						Next
					</button>
					<p className="muted actions__hint">
						Keyboard: Space / → / ↓ = next, ← / ↑ = previous
					</p>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							const form = e.currentTarget;
							const value = String(new FormData(form).get("index") || "").trim();
							if (value !== "" && !isNaN(Number(value))) {
								handleJumpToLine(Math.round(Number(value)));
							}
							form.reset();
						}}
					>
						<input type="number" name="index" placeholder="Index" min={0} />
						<button type="submit" className="actions__jump">
							Jump to Line
						</button>
					</form>
					<button
						className="actions__jump-act-scene"
						onClick={() => setModal("actScene")}
					>
						Jump to Act/Scene
					</button>
					<button
						className="actions__jump-to-click"
						onClick={() => setWillJumpToClick(!willJumpToClick)}
						style={{ backgroundColor: willJumpToClick ? "orangered" : "" }}
					>
						{willJumpToClick ? "Stop Jump to Click" : "Start Jump to Click"}
					</button>
					<button className="actions__new-session" onClick={handleRestart}>
						Restart from first line
					</button>

					<div className="actions__links">
						<Link to={showId ? `/editor/${showId}?line=${index}` : "/editor"}>
							Edit subtitles
						</Link>
						<a href="/display" target="_blank" rel="noreferrer">
							Open display
						</a>
						<button className="linklike" onClick={() => setModal("settings")}>
							Audience link &amp; PIN
						</button>
					</div>
				</div>

				<div className="preview" ref={previewRef}>
					{!showId && (
						<div className="notice">
							No show is on the displays yet. Choose one on the left, or{" "}
							<Link to="/editor">create a show</Link>.
						</div>
					)}
					{index - 1 >= 0 && (
						<Card
							className="preview__previous"
							index={index - 1}
							subtitle={subtitle[index - 1]}
							jump={willJumpToClick}
							handler={handleJumpToLine}
						/>
					)}
					<Card
						className="preview__current"
						index={index}
						subtitle={subtitle[index]}
						jump={false}
						handler={handleJumpToLine}
					/>
					{subtitle.slice(index + 1).map((nextSubtitle, nextOffset) => {
						const nextIndex = index + 1 + nextOffset;
						return (
							<Card
								className="preview__next"
								index={nextIndex}
								subtitle={nextSubtitle}
								key={nextSubtitle.id}
								jump={willJumpToClick}
								handler={handleJumpToLine}
							/>
						);
					})}
					{index >= subtitle.length - 1 && showId && (
						<div className="notice">End of the show.</div>
					)}
				</div>
			</div>
		</>
	);
}

function SettingsModal({ onClose }: { onClose: () => void }) {
	const [info, setInfo] = useState<Info | null>(null);
	const [settings, setSettings] = useState<Settings | null>(null);
	const [saved, setSaved] = useState(false);

	const load = () => {
		api<Info>("/info").then(setInfo).catch(() => {});
		api<Settings>("/settings").then(setSettings).catch(() => {});
	};
	useEffect(load, []);

	const save = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const data = new FormData(e.currentTarget);
		api<Settings>("/settings", {
			method: "PUT",
			body: { pin: data.get("pin"), publicUrl: data.get("publicUrl") }
		}).then(() => {
			setSaved(true);
			load();
		});
	};

	const link = info ? `${info.audienceUrl}/display` : "";

	return (
		<div className="modal" onClick={onClose}>
			<div className="modal__box" onClick={(e) => e.stopPropagation()}>
				<div className="modal__head">
					<h2>Audience link &amp; PIN</h2>
					<button className="modal__close" onClick={onClose}>
						×
					</button>
				</div>
				{info && settings ? (
					<form onSubmit={save} className="stack" key={link + settings.pin}>
						<p>
							Any device on the same Wi-Fi / network can open the display at:
						</p>
						<p className="biglink">{link}</p>
						<div className="qrbox">
							<QRCode value={link} size={160} />
						</div>
						<p className="muted">
							Tip: a line whose Character is <b>QR</b> shows this QR code on the
							displays.
						</p>
						<label>
							Operator PIN (needed to operate or edit from another device)
							<input className="field" name="pin" defaultValue={settings.pin} required />
						</label>
						<label>
							Audience address (leave empty to detect automatically)
							<input
								className="field"
								name="publicUrl"
								defaultValue={settings.publicUrl}
								placeholder={info.addresses[0] || "http://192.168.1.20:8001"}
							/>
						</label>
						{info.addresses.length > 1 && (
							<p className="muted">
								This Mac has several addresses: {info.addresses.join(", ")}
							</p>
						)}
						<button className="btn btn--primary" type="submit">
							{saved ? "Saved ✓" : "Save"}
						</button>
					</form>
				) : (
					<p>Loading…</p>
				)}
			</div>
		</div>
	);
}
