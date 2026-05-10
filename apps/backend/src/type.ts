export type Subtitle = {
  act: number;
  scene: number;
  char: string;
  eng: string;
  thai: string;
  isLyric: boolean;
  remark: string;
  display: "normal" | "full-screen" | "video" | "img";
  srcIndex: number;
};
