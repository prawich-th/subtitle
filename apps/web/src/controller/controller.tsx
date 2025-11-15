import { useEffect, useMemo, useState } from "react";
import { Subtitle } from "../types";
import "./controller.scss";
import { socket } from "../socket";
import { useNavigate } from "react-router";

const Card = ({
	index,
	subtitle,
	className
}: {
	index: number;
	subtitle: Subtitle;
	className: string;
}) => {
	return (
		<div className={`preview__card ${className}`}>
			<p className="preview__card--index">
				INDEX {index} | ACT {subtitle?.act} | SCENE {subtitle?.scene}
			</p>
			<h2 className="preview__card--character">{subtitle?.char}</h2>
			<p className="preview__card--thai">{subtitle?.thai}</p>
			<p className="preview__card--english">{subtitle?.eng}</p>
		</div>
	);
};

export default function Controller() {
	const navigate = useNavigate();
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
	const backendUrl = useMemo(() => "http://192.168.1.169:8001", []);
	const isVerified = useMemo(() => {
		return localStorage.getItem("verified") === "true";
	}, []);

	useEffect(() => {
		console.log("isVerified", isVerified);
		if (!isVerified) {
			navigate("/verify");
		}
	}, [isVerified]);

	useEffect(() => {
		if (!isVerified) {
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
			.catch((error: Error) => {
				console.error("Error fetching subtitles:", error);
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
		if (!isVerified) {
			return;
		}
		if (!subtitle.length) {
			return;
		}
		const safeIndex =
			index >= subtitle.length ? subtitle.length - 1 : Math.max(index, 0);
		setCurrentSubtitle(subtitle[safeIndex]);
	}, [index, subtitle]);

	useEffect(() => {
		if (!isVerified) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === "ArrowRight" ||
				event.key === " " ||
				event.key === "ArrowDown"
			) {
				handleNext();
			}
			if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
				handlePrevious();
			}
		};
		addEventListener("keydown", handleKeyDown);
		return () => {
			removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	const handleNext = () => {
		if (!isVerified) {
			return;
		}
		fetch(`${backendUrl}/subcontrol/next`).catch((error) =>
			console.error("Error moving to next subtitle:", error)
		);
	};

	const handlePrevious = () => {
		if (!isVerified) {
			return;
		}
		fetch(`${backendUrl}/subcontrol/previous`).catch((error) =>
			console.error("Error moving to previous subtitle:", error)
		);
	};

	const handleNewSession = () => {
		if (!isVerified) {
			return;
		}
		fetch(`${backendUrl}/subcontrol/init`).catch((error) =>
			console.error("Error creating new session:", error)
		);
	};

	const handleJumpToActScene = (act: string, scene: string) => {
		if (!act && !scene) {
			console.error("Please provide at least Act or Scene");
			return;
		}

		// Find the first subtitle matching the act and/or scene
		const foundIndex = subtitle.findIndex((sub) => {
			const actMatch = !act || String(sub.act) === String(act);
			const sceneMatch = !scene || String(sub.scene) === String(scene);

			return actMatch && sceneMatch;
		});

		if (foundIndex === -1) {
			alert(
				`No subtitle found matching Act: ${act || "any"}, Scene: ${scene || "any"}`
			);
			return false;
		}

		if (foundIndex !== -1) {
			fetch(`${backendUrl}/subcontrol/jump/${foundIndex}`).catch((error) =>
				console.error("Error jumping to act/scene:", error)
			);
		} else {
			console.error(
				`No subtitle found matching Act: ${act || "any"}, Scene: ${scene || "any"}`
			);
		}
	};

	return isLoading ? (
		<div>Loading Subtitles Data from the Server.</div>
	) : (
		<>
			<div className="controller">
				<div className="actions">
					<h1>ACTIONS</h1>
					<button className="actions__new-session" onClick={handleNewSession}>
						New Session
					</button>{" "}
					<button className="actions__previous" onClick={handlePrevious}>
						Previous
					</button>
					<button className="actions__next" onClick={handleNext}>
						Next
					</button>
					<form
						action={`${backendUrl}/subcontrol/jump/${index}`}
						method="get"
						onSubmit={(e) => {
							e.preventDefault();
							(e.target as HTMLFormElement).reset();

							if (index) {
								fetch(`${backendUrl}/subcontrol/jump/${index}`).catch((error) =>
									console.error("Error jumping to line:", error)
								);
							}
						}}
					>
						<input type="number" name="index" placeholder="Index" />
						<button type="submit" className="actions__jump">
							Jump to Line
						</button>
					</form>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							const formData = new FormData(e.target as HTMLFormElement);
							const act = (formData.get("act") as string)?.trim() || "";
							const scene = (formData.get("scene") as string)?.trim() || "";
							handleJumpToActScene(act, scene);
						}}
					>
						<input
							type="text"
							name="act"
							placeholder="Act (optional)"
							className="actions__act-input"
						/>
						<input
							type="text"
							name="scene"
							placeholder="Scene (optional)"
							className="actions__scene-input"
						/>
						<button type="submit" className="actions__jump-act-scene">
							Jump to Act/Scene
						</button>
					</form>
				</div>
				<div className="preview">
					{index - 1 >= 0 && (
						<Card
							className="preview__previous"
							index={index - 1}
							subtitle={subtitle[index - 1]}
						/>
					)}
					<Card
						className="preview__current"
						index={index}
						subtitle={currentSubtitle}
					/>

					{subtitle.slice(index + 1).map((nextSubtitle, nextOffset) => {
						const nextIndex = index + 1 + nextOffset;
						return (
							<Card
								className="preview__next"
								index={nextIndex}
								subtitle={nextSubtitle}
								key={nextIndex}
							/>
						);
					})}
				</div>
			</div>
		</>
	);
}
