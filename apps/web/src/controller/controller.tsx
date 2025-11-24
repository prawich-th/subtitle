import { useEffect, useMemo, useRef, useState } from "react";
import { Subtitle } from "../types";
import "./controller.scss";
import { createSocket } from "../socket";
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
	const [showActSceneModal, setShowActSceneModal] = useState(false);
	const prevSubRef = useRef<HTMLDivElement | null>(null);
	const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);

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
		if (socketRef.current) {
			socketRef.current.disconnect();
		}
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
		// Only check verification after backend URL is set
		if (isBackendUrlSet && backendUrl && !isVerified) {
			console.log("Backend URL set, checking verification");
			navigate("/verify");
		}
	}, [isVerified, isBackendUrlSet, backendUrl, navigate]);

	useEffect(() => {
		if (!isVerified || !isBackendUrlSet || !backendUrl) {
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

		// Normalize the search values
		const searchAct = act ? String(act).trim() : "";
		const searchScene = scene ? String(scene).trim() : "";

		console.log("Jumping to Act:", searchAct, "Scene:", searchScene);

		// Find the first subtitle matching the act and/or scene
		const foundIndex = subtitle.findIndex((sub) => {
			// Normalize subtitle values for comparison (handle numbers, strings, null, undefined)
			const subAct = sub.act != null ? String(sub.act).trim() : "";
			const subScene = sub.scene != null ? String(sub.scene).trim() : "";

			// Match act: if act is provided, must match exactly; if empty, matches any
			const actMatch = !searchAct || subAct === searchAct;
			// Match scene: if scene is provided, must match exactly; if empty, matches any
			const sceneMatch = !searchScene || subScene === searchScene;

			if (actMatch && sceneMatch) {
				console.log("Found match at index:", subtitle.indexOf(sub), "Act:", subAct, "Scene:", subScene);
			}

			return actMatch && sceneMatch;
		});

		if (foundIndex === -1) {
			alert(
				`No subtitle found matching Act: ${act || "any"}, Scene: ${scene || "any"}`
			);
			return false;
		}

		console.log("Jumping to index:", foundIndex);
		handleJumpToLine(foundIndex);
		setShowActSceneModal(false);
		return true;
	};

	// Get unique acts and their scenes
	const getActsAndScenes = () => {
		const actMap = new Map<string, Set<string>>();
		
		subtitle.forEach((sub) => {
			// Convert to string, handling null/undefined/empty
			const act = sub.act != null ? String(sub.act).trim() : "";
			const scene = sub.scene != null ? String(sub.scene).trim() : "";
			
			// Skip if act or scene is empty or "0" (but include "1", "2", etc.)
			if (!act || act === "0" || !scene || scene === "0") {
				return;
			}
			
			if (!actMap.has(act)) {
				actMap.set(act, new Set());
			}
			actMap.get(act)?.add(scene);
		});

		// Convert to sorted arrays
		const acts = Array.from(actMap.keys()).sort((a, b) => {
			const numA = Number(a);
			const numB = Number(b);
			if (!isNaN(numA) && !isNaN(numB)) {
				return numA - numB;
			}
			return a.localeCompare(b);
		});

		const result: Array<{ act: string; scenes: string[] }> = acts.map((act) => {
			const scenes = Array.from(actMap.get(act) || []).sort((a, b) => {
				const numA = Number(a);
				const numB = Number(b);
				if (!isNaN(numA) && !isNaN(numB)) {
					return numA - numB;
				}
				return a.localeCompare(b);
			});
			return { act, scenes };
		});

		return result;
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

	const actsAndScenes = getActsAndScenes();

	return isLoading ? (
		<div>Loading Subtitles Data from the Server.</div>
	) : (
		<>
			{showActSceneModal && (
				<div
					style={{
						position: "fixed",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: "rgba(0, 0, 0, 0.7)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						zIndex: 1000,
						padding: "20px"
					}}
					onClick={() => setShowActSceneModal(false)}
				>
					<div
						style={{
							backgroundColor: "white",
							borderRadius: "8px",
							padding: "20px",
							maxWidth: "600px",
							maxHeight: "80vh",
							overflow: "auto",
							width: "100%",
							boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "20px"
							}}
						>
							<h2 style={{ margin: 0 }}>Jump to Act/Scene</h2>
							<button
								onClick={() => setShowActSceneModal(false)}
								style={{
									background: "none",
									border: "none",
									fontSize: "24px",
									cursor: "pointer",
									padding: "0 10px"
								}}
							>
								×
							</button>
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
							{actsAndScenes.map(({ act, scenes }) => (
								<div key={act} style={{ borderBottom: "1px solid #eee", paddingBottom: "15px" }}>
									<h3
										style={{
											margin: "0 0 10px 0",
											cursor: "pointer",
											color: "#333",
											padding: "8px",
											borderRadius: "4px",
											backgroundColor: "#f5f5f5"
										}}
										onClick={() => handleJumpToActScene(act, "")}
									>
										Act {act}
									</h3>
									<div
										style={{
											display: "grid",
											gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
											gap: "8px",
											marginLeft: "20px"
										}}
									>
										{scenes.map((scene) => (
											<button
												key={`${act}-${scene}`}
												onClick={() => handleJumpToActScene(act, scene)}
												style={{
													color: "black",
													fontFamily: "Sarabun",
													padding: "8px 12px",
													border: "1px solid #ddd",
													borderRadius: "4px",
													backgroundColor: "white",
													cursor: "pointer",
													fontSize: "14px",
													transition: "all 0.2s"
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
				</div>
			)}
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
					<button
						className="actions__jump-act-scene"
						onClick={() => setShowActSceneModal(true)}
					>
						Jump to Act/Scene
					</button>
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
