import { useEffect, useMemo, useRef, useState } from "react";
import { Subtitle } from "../types";
import "./controller.scss";
import { socket } from "../socket";
import { useNavigate } from "react-router";

const Card = ({
	index,
	subtitle,
	className,
	jump,
	handler
}: {
	index: number;
	subtitle: Subtitle;
	className: string;
	jump: boolean;
	handler: (index: number) => void;
}) => {
	return (
		<div
			className={`preview__card ${className}`}
			onClick={() => {
				if (jump) {
					handler(index);
				}
			}}
		>
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
	const [backendUrl, setBackendUrl] = useState<string>(() => {
		return localStorage.getItem("backendUrl") || "";
	});
	const [backendUrl2, setBackendUrl2] = useState<string>(() => {
		return localStorage.getItem("backendUrl2") || "";
	});
	const [useSecondServer, setUseSecondServer] = useState<boolean>(() => {
		return localStorage.getItem("useSecondServer") === "true";
	});
	const [isBackendUrlSet, setIsBackendUrlSet] = useState<boolean>(() => {
		return !!localStorage.getItem("backendUrl");
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
	const isVerified = useMemo(() => {
		return localStorage.getItem("verified") === "true";
	}, []);
	const [willJumpToClick, setWillJumpToClick] = useState(false);
	const [showSecondServer, setShowSecondServer] = useState(useSecondServer);
	const prevSubRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		setShowSecondServer(useSecondServer);
	}, [useSecondServer]);

	const handleBackendUrlSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.target as HTMLFormElement);
		const url = (formData.get("backendUrl") as string)?.trim() || "";
		const url2 = (formData.get("backendUrl2") as string)?.trim() || "";
		const useSecond = (formData.get("useSecondServer") as string) === "on";
		
		if (url) {
			// Remove trailing slash if present
			const cleanUrl = url.replace(/\/$/, "");
			setBackendUrl(cleanUrl);
			localStorage.setItem("backendUrl", cleanUrl);
			
			if (url2 && useSecond) {
				const cleanUrl2 = url2.replace(/\/$/, "");
				setBackendUrl2(cleanUrl2);
				localStorage.setItem("backendUrl2", cleanUrl2);
				setUseSecondServer(true);
				localStorage.setItem("useSecondServer", "true");
			} else {
				setUseSecondServer(false);
				localStorage.setItem("useSecondServer", "false");
			}
			
			setIsBackendUrlSet(true);
		}
	};

	const handleChangeBackendUrl = () => {
		socket.disconnect();
		setIsBackendUrlSet(false);
		setIsLoading(true);
		setSubtitle([]);
		setIndex(0);
	};

	const fetchFromServer = async (url: string): Promise<Subtitle[]> => {
		try {
			const response = await fetch(`${url}/data`);
			if (!response.ok) {
				throw new Error(`Failed to fetch from ${url}`);
			}
			return await response.json();
		} catch (error) {
			console.error(`Error fetching from ${url}:`, error);
			return [];
		}
	};

	useEffect(() => {
		console.log("isVerified", isVerified);
		if (!isVerified) {
			navigate("/verify");
		}
	}, [isVerified]);

	useEffect(() => {
		if (!isVerified || !isBackendUrlSet || !backendUrl) {
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
		
		// Fetch from both servers simultaneously if second server is enabled
		const fetchPromises = [fetchFromServer(backendUrl)];
		if (useSecondServer && backendUrl2) {
			fetchPromises.push(fetchFromServer(backendUrl2));
		}

		Promise.all(fetchPromises)
			.then((results) => {
				// Use the first server's data as primary, or merge if needed
				const primaryData = results[0];
				const secondaryData = results[1] || [];
				
				// If both servers returned data, log for comparison
				if (secondaryData.length > 0) {
					console.log("Primary server data length:", primaryData.length);
					console.log("Secondary server data length:", secondaryData.length);
				}
				
				setSubtitle(primaryData);
				if (primaryData.length > 0) {
					setCurrentSubtitle(primaryData[0]);
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
	}, [backendUrl, backendUrl2, useSecondServer, isVerified, isBackendUrlSet]);

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

		const fetchPromises = [fetch(`${backendUrl}/subcontrol/next`)];
		if (useSecondServer && backendUrl2) {
			fetchPromises.push(fetch(`${backendUrl2}/subcontrol/next`));
		}

		Promise.all(fetchPromises)
			.catch((error) => console.error("Error moving to next subtitle:", error))
			.finally(() => {
				if (prevSubRef.current) {
					if (prevSubRef.current.getBoundingClientRect().top < 0) {
						console.log("Scrolling to current subtitle");
						prevSubRef.current.scrollIntoView({
							behavior: "smooth"
						});
					}
				}
			});
	};

	const handlePrevious = () => {
		if (!isVerified) {
			return;
		}
		const fetchPromises = [fetch(`${backendUrl}/subcontrol/previous`)];
		if (useSecondServer && backendUrl2) {
			fetchPromises.push(fetch(`${backendUrl2}/subcontrol/previous`));
		}
		Promise.all(fetchPromises).catch((error) =>
			console.error("Error moving to previous subtitle:", error)
		);
	};

	const handleJumpToLine = (index: number) => {
		console.log("handleJumpToLine", index);
		if (!index) return;
		const fetchPromises = [fetch(`${backendUrl}/subcontrol/jump/${index}`)];
		if (useSecondServer && backendUrl2) {
			fetchPromises.push(fetch(`${backendUrl2}/subcontrol/jump/${index}`));
		}
		Promise.all(fetchPromises).catch((error) =>
			console.error("Error jumping to line:", error)
		);
	};

	const handleNewSession = () => {
		if (!isVerified) {
			return;
		}
		const fetchPromises = [fetch(`${backendUrl}/subcontrol/init`)];
		if (useSecondServer && backendUrl2) {
			fetchPromises.push(fetch(`${backendUrl2}/subcontrol/init`));
		}
		Promise.all(fetchPromises).catch((error) =>
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
			handleJumpToLine(foundIndex);
			return true;
		} else {
			console.error(
				`No subtitle found matching Act: ${act || "any"}, Scene: ${scene || "any"}`
			);
			return false;

		}
	};

	if (!isBackendUrlSet) {
		return (
			<div className="controller">
				<div className="actions">
					<h1>SETUP</h1>
					<form onSubmit={handleBackendUrlSubmit}>
						<div style={{ marginBottom: "15px" }}>
							<label style={{ display: "block", marginBottom: "5px" }}>
								Primary Backend URL:
							</label>
							<input
								type="text"
								name="backendUrl"
								placeholder="Enter Backend URL (e.g., http://192.168.1.169:8001)"
								defaultValue={backendUrl}
								required
								style={{
									padding: "10px",
									fontSize: "16px",
									width: "400px",
									marginRight: "10px"
								}}
							/>
						</div>
						<div style={{ marginBottom: "15px" }}>
							<label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
								<input
									type="checkbox"
									name="useSecondServer"
									checked={showSecondServer}
									onChange={(e) => setShowSecondServer(e.target.checked)}
								/>
								<span>Enable Second Server</span>
							</label>
						</div>
						{showSecondServer && (
							<div style={{ marginBottom: "15px" }}>
								<label style={{ display: "block", marginBottom: "5px" }}>
									Secondary Backend URL (optional):
								</label>
								<input
									type="text"
									name="backendUrl2"
									placeholder="Enter Second Backend URL (e.g., http://192.168.1.170:8001)"
									defaultValue={backendUrl2}
									style={{
										padding: "10px",
										fontSize: "16px",
										width: "400px",
										marginRight: "10px"
									}}
								/>
							</div>
						)}
						<button
							type="submit"
							style={{
								padding: "10px 20px",
								fontSize: "16px",
								cursor: "pointer"
							}}
						>
							Connect
						</button>
					</form>
				</div>
			</div>
		);
	}

	return isLoading ? (
		<div>Loading Subtitles Data from the Server.</div>
	) : (
		<>
			<div className="controller">
				<div className="actions">
					<h1>OPERATOR</h1>
					<button
						className="actions__change-url"
						onClick={handleChangeBackendUrl}
						style={{ marginBottom: "10px" }}
					>
						Change Backend URL{useSecondServer ? "s" : ""} ({backendUrl}
						{useSecondServer && backendUrl2 ? `, ${backendUrl2}` : ""})
					</button>
					<br />
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
						onSubmit={(e) => {
							e.preventDefault();
							(e.target as HTMLFormElement).reset();
							const formData = new FormData(e.target as HTMLFormElement);
							const index = Number((formData.get("index") as string)?.trim());
							console.log("Jumping to line:", index, "formData", formData);
							handleJumpToLine(index);
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
					<button
						className="actions__jump-to-click"
						onClick={() => {
							setWillJumpToClick(!willJumpToClick);
						}}
						style={{
							backgroundColor: willJumpToClick ? "orangered" : ""
						}}
					>
						{willJumpToClick ? "Stop Jump to Click" : "Start Jump to Click"}
					</button>
				</div>
				<div className="preview">
					{index - 1 >= 0 && (
						<span ref={prevSubRef} style={{ padding: "0", margin: "0" }}>
							<Card
								className="preview__previous"
								index={index - 1}
								subtitle={subtitle[index - 1]}
								jump={willJumpToClick}
								handler={handleJumpToLine}
							/>
						</span>
					)}
					<Card
						className="preview__current"
						index={index}
						subtitle={currentSubtitle}
						jump={willJumpToClick}
						handler={handleJumpToLine}
					/>

					{subtitle.slice(index + 1).map((nextSubtitle, nextOffset) => {
						const nextIndex = index + 1 + nextOffset;
						return (
							<Card
								className="preview__next"
								index={nextIndex}
								subtitle={nextSubtitle}
								key={nextIndex}
								jump={willJumpToClick}
								handler={handleJumpToLine}
							/>
						);
					})}
				</div>
			</div>
		</>
	);
}
