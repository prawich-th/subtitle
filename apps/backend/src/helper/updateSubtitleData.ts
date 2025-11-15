import { Subtitle } from "../type";
import fs from "fs";
import path from "path";

export const updateSubtitleData = (): Promise<
	Subtitle[] | [] | Error | null
> => {
	try {
		console.info("Updating subtitles");
		return new Promise<Subtitle[] | [] | Error | null>((resolve, reject) => {
			fs.readFile(
				path.join(__dirname, "..", "..", "data", "sub.json"),
				"utf8",
				(err, data) => {
					if (err) {
						console.error("Error reading subdata:", err);
						reject(err);
					}

					const parsedData = JSON.parse(data) as Subtitle[] | [];
					const subtitles: Subtitle[] = [];

					let curScene = 1;
					let curAct = 1;
					parsedData.forEach((line: Subtitle) => {
						if (line.scene && line.scene != curScene) {
							curScene = line.scene;
						}
						if (line.act && line.act != curAct) {
							curAct = line.act;
						}
						subtitles.push({
							act: curAct,
							scene: curScene,
							char: line.char,
							eng: line.eng,
							thai: line.thai,
							isLyric: line.isLyric,
							remark: line.remark
						});
					});
					resolve(subtitles);
				}
			);
		});
	} catch (error) {
		console.error("Error updating subdata:", error);
		return Promise.reject(error as Error);
	}
};
