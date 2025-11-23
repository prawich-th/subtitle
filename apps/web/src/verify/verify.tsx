import { useNavigate } from "react-router";
import { useState } from "react";

export default function Verify() {
	const navigate = useNavigate();
	const [backendUrl, setBackendUrl] = useState<string>(() => {
		return localStorage.getItem("backendUrl") || "";
	});

	const handleVerify = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.target as HTMLFormElement);
		const url = (formData.get("backendUrl") as string)?.trim() || "";
		const code = (formData.get("code") as string)?.trim() || "";

		if (!url) {
			alert("Please enter a backend URL");
			return;
		}

		if (!code) {
			alert("Please enter a verification code");
			return;
		}

		// Remove trailing slash if present
		const cleanUrl = url.replace(/\/$/, "");

		fetch(`${cleanUrl}/verify`, {
			method: "POST",
			body: JSON.stringify({ code }),
			headers: {
				"Content-Type": "application/json"
			}
		})
			.then((response) => response.json())
			.then((data) => {
				console.log(data);
				if (data.verified) {
					// Save backend URL to localStorage
					localStorage.setItem("backendUrl", cleanUrl);
					setBackendUrl(cleanUrl);
					localStorage.setItem("verified", "true");
					navigate("/controller");
				} else {
					alert("Invalid code");
				}
			})
			.catch((error) => {
				console.error(error);
				alert(`Error verifying: ${error.message}`);
			});
	};

	return (
		<div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
			<h1>Verify</h1>
			<form
				onSubmit={handleVerify}
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "1rem"
				}}
			>
				<div>
					<label
						style={{
							display: "block",
							marginBottom: "0.5rem",
							fontWeight: "bold"
						}}
					>
						Backend URL:
					</label>
					<input
						type="text"
						name="backendUrl"
						placeholder="Enter Backend URL (e.g., http://192.168.1.169:8001)"
						defaultValue={backendUrl}
						required
						style={{
							padding: "0.75rem 1rem",
							width: "100%",
							boxSizing: "border-box",
							backgroundColor: "#eee",
							color: "black",
							border: "1px solid #ccc",
							borderRadius: "0.5rem",
							fontSize: "16px"
						}}
					/>
				</div>
				<div>
					<label
						style={{
							display: "block",
							marginBottom: "0.5rem",
							fontWeight: "bold"
						}}
					>
						Verification Code:
					</label>
					<input
						type="text"
						name="code"
						placeholder="Enter verification code"
						required
						style={{
							padding: "0.75rem 1rem",
							width: "100%",
							boxSizing: "border-box",
							backgroundColor: "#eee",
							color: "black",
							border: "1px solid #ccc",
							borderRadius: "0.5rem",
							fontSize: "16px"
						}}
					/>
				</div>
				<button
					type="submit"
					style={{
						padding: "0.75rem 1.5rem",
						backgroundColor: "#222",
						color: "white",
						border: "none",
						borderRadius: "0.5rem",
						fontSize: "16px",
						cursor: "pointer",
						fontWeight: "bold"
					}}
				>
					Verify
				</button>
			</form>
		</div>
	);
}
