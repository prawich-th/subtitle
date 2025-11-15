import * as fs from "fs";
import * as path from "path";
import { parse } from 'csv-parse';

type Subtitle = {act: number, scene: number,char: string, thai: string, eng: string, isLyric: boolean, remark: string};

export default function getSubtitles() {
  const csvFilePath = path.resolve('./data/subtitle.csv');
  console.log("CSV FILE PATH ", csvFilePath);
  const headers = ['act', 'scene', 'char', 'eng','thai', 'isLyric', 'remark'];

  const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
let content : Subtitle[] = [];
  parse(fileContent, {
    delimiter: ',',
    columns: headers,
  }, (error, result: Subtitle[]) => {
    if (error) {
      console.error(error);
    }
    console.log("RESULT ", result);
   content = result;
  });

  return content;
}

