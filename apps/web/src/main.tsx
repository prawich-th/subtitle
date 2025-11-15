import { createRoot } from "react-dom/client";
import "./style.scss";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import Display from "./display/display";
import Controller from "./controller/controller";
import Verify from "./verify/verify";

const App = () => {
	return (
		<div>
			<img src="/novaprods.png" alt="Logo" className="logo" />
			<h2>Please select client mode:</h2>
			<div className="menu">
				<Link to="/display">Display</Link>
				<Link to="/controller">Controller</Link>
			</div>
		</div>
	);
};

createRoot(document.getElementById("app")!).render(
	<>
		<BrowserRouter>
			<Routes>
				<Route index element={<App />} />
				<Route path="/display" element={<Display />} />
				<Route path="/controller" element={<Controller />} />
				<Route path="/verify" element={<Verify />} />
			</Routes>
		</BrowserRouter>
	</>
);
