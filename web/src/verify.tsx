import { useState } from "react";
import { useSearchParams } from "react-router";
import { api, setPin } from "./api";
import "./operator.scss";

// Shown on phones/laptops other than the Mac running the program, before they
// are allowed to operate or edit. The PIN is printed in the Terminal window
// and shown under Settings on the operator page.
export default function Verify() {
	const [searchParams] = useSearchParams();
	const [error, setError] = useState("");

	const handleVerify = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const pin = String(new FormData(e.currentTarget).get("pin") || "").trim();
		api<{ verified: boolean }>("/verify", { body: { pin } })
			.then(() => {
				setPin(pin);
				const next = searchParams.get("next") || "/controller";
				window.location.assign(next.startsWith("/") ? next : "/controller");
			})
			.catch(() =>
				setError("That PIN is not right (or too many tries – wait a minute).")
			);
	};

	return (
		<div className="page page--narrow">
			<h1>Operator PIN</h1>
			<p className="muted">
				Ask the person running the subtitle Mac for the PIN. It is shown in the
				Terminal window and under Settings on the operator page.
			</p>
			<form onSubmit={handleVerify} className="stack">
				<input
					className="field"
					type="text"
					name="pin"
					inputMode="numeric"
					autoComplete="off"
					autoFocus
					placeholder="PIN"
					required
				/>
				{error && <p className="error">{error}</p>}
				<button type="submit" className="btn btn--primary">
					Continue
				</button>
			</form>
		</div>
	);
}
