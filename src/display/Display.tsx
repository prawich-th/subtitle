import { useEffect, useState } from "react";
import subtitles from "../../data/subtitle.json";

type Subtitle = {
	act: number;
	scene: number;
	char: string;
	thai: string;
	eng: string;
	isLyric: boolean;
	remark: string;
};

function Display() {
	const [data, setData] = useState<Subtitle[]>([]);
	const [loading, setLoading] = useState(true);
	const [currentTextIndex, setCurrentTextIndex] = useState(0);
	const [currentText, setCurrentText] = useState({
		act: 0,
		scene: 0,
		char: "",
		thai: "",
		eng: "",
		isLyric: false,
		remark: ""
	});

	useEffect(() => {
		console.log("Initialisaing");

		setData(subtitles as unknown as Subtitle[]);
		setCurrentText(subtitles[currentTextIndex] as unknown as Subtitle);
		setLoading(false);
	}, []);

	const NextHandler = () => {
		console.log("BEFORE ", currentTextIndex);
		setCurrentTextIndex((index) => {
			if (index + 1 < data.length) {
				setCurrentText(data[index + 1]);
				return index + 1;
			} else {
				setCurrentText(data[0]);
				return 0;
			}
		});
		console.log("AFTER ", currentTextIndex);
	};

	return loading ? (
		<div>Loading...</div>
	) : (
		<>
			<h1>{currentText.char}</h1>
			<p>{currentText.thai}</p>
			<p>{currentText.eng}</p>
			<p>
				{currentText.act} {currentText.scene}
			</p>
			<button onClick={NextHandler}>Next {currentTextIndex}</button>
		</>
	);
}

export default Display;
