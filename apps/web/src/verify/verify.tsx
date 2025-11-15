import { useNavigate } from "react-router";
import { useMemo } from "react";

export default function Verify() {
	const navigate = useNavigate();
	const backendUrl = useMemo(() => "http://192.168.1.169:8001", []);
	const handleVerify = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.target as HTMLFormElement);
		const code = formData.get("code") as string;

		fetch(`${backendUrl}/verify`, {
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
					localStorage.setItem("verified", "true");
					navigate("/controller");
				} else {
					alert("Invalid code");
				}
			})
			.catch((error) => {
				console.error(error);
			});
	};
	return (
		<div>
			<h1>Verify</h1>
			<form onSubmit={handleVerify}>
				<input type="text" name="code" placeholder="Enter code" />
				<button type="submit">Verify</button>
			</form>
		</div>
	);
}
