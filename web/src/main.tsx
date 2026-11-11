import { createRoot } from "react-dom/client";
// The Sarabun font is bundled with the program so the screens look right
// even when the venue has no internet.
import "@fontsource/sarabun/100.css";
import "@fontsource/sarabun/200.css";
import "@fontsource/sarabun/300.css";
import "@fontsource/sarabun/400.css";
import "@fontsource/sarabun/500.css";
import "@fontsource/sarabun/600.css";
import "@fontsource/sarabun/700.css";
import "@fontsource/sarabun/800.css";
import "./style.scss";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import Display from "./display";
import Controller from "./controller";
import { Editor, Shows } from "./editor";
import Verify from "./verify";

const App = () => {
	return (
		<div>
			<img src="/novaprods.png" alt="Logo" className="logo" />
			<h2>Please select client mode:</h2>
			<div className="menu">
				<Link to="/display">Display</Link>
				<Link to="/controller">Controller</Link>
				<Link to="/editor">Edit subtitles</Link>
			</div>
		</div>
	);
};

createRoot(document.getElementById("app")!).render(
	<BrowserRouter>
		<Routes>
			<Route index element={<App />} />
			<Route path="/display" element={<Display />} />
			<Route path="/controller" element={<Controller />} />
			<Route path="/editor" element={<Shows />} />
			<Route path="/editor/:showId" element={<Editor />} />
			<Route path="/verify" element={<Verify />} />
		</Routes>
	</BrowserRouter>
);
