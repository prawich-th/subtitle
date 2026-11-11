// Shared between the server and the web app: what a subtitle line looks like
// and how spreadsheet data (CSV / pasted cells / old JSON) is turned into lines.

export type Line = {
  id: string;
  act: string;
  scene: string;
  char: string;
  eng: string;
  thai: string;
  isLyric: boolean;
  remark: string;
};

/** One slide of the pre-show warning carousel ("NO FILM – No filming allowed"). */
export type Warning = {
  id: string;
  /** Short text in the coloured box. Leave empty for a plain text slide. */
  label: string;
  /** Colour of the box, e.g. "#a61b33". */
  color: string;
  eng: string;
  thai: string;
};

export type Show = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lines: Line[];
  warnings: Warning[];
  /** How long each warning stays on screen. */
  warningSeconds: number;
};

/** A line whose Character is this word shows the warning carousel on the displays. */
export const WARNINGS_CHAR = "WARNINGS";
export const isWarningsLine = (line?: { char: string } | null) =>
  /^warnings?$/i.test(line?.char.trim() ?? "");

export type ShowSummary = {
  id: string;
  title: string;
  updatedAt: string;
  lineCount: number;
  live: boolean;
};

export type LiveState = {
  showId: string | null;
  title: string;
  index: number;
  lines: Line[];
  warnings: Warning[];
  warningSeconds: number;
};

export const FIELDS = [
  "act",
  "scene",
  "char",
  "thai",
  "eng",
  "isLyric",
  "remark",
] as const;
export type Field = (typeof FIELDS)[number];

export const FIELD_LABELS: Record<Field, string> = {
  act: "Act",
  scene: "Scene",
  char: "Character",
  thai: "Thai",
  eng: "English",
  isLyric: "Lyric?",
  remark: "Remark",
};

// Column order used when a pasted sheet has no header row, and for CSV export.
// This matches the original production spreadsheet.
export const SHEET_ORDER: Field[] = [
  "act",
  "scene",
  "char",
  "eng",
  "thai",
  "isLyric",
  "remark",
];

const HEADER_ALIASES: Record<string, Field> = {
  act: "act",
  scene: "scene",
  char: "char",
  character: "char",
  speaker: "char",
  name: "char",
  eng: "eng",
  english: "eng",
  en: "eng",
  thai: "thai",
  th: "thai",
  ไทย: "thai",
  islyric: "isLyric",
  islyrics: "isLyric",
  lyric: "isLyric",
  lyrics: "isLyric",
  remark: "remark",
  remarks: "remark",
  note: "remark",
  notes: "remark",
};

export const newId = (): string =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

export const toBool = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  return ["true", "yes", "y", "1", "x", "✓"].includes(
    text(value).toLowerCase(),
  );
};

export const blankLine = (partial: Partial<Line> = {}): Line => ({
  id: newId(),
  act: "",
  scene: "",
  char: "",
  eng: "",
  thai: "",
  isLyric: false,
  remark: "",
  ...partial,
});

/** Accepts anything line-shaped (including the old sub.json rows) and returns a clean Line. */
export const normalizeLine = (raw: any): Line => ({
  id: text(raw?.id) || newId(),
  act: text(raw?.act),
  scene: text(raw?.scene),
  char: text(raw?.char),
  eng: text(raw?.eng),
  thai: text(raw?.thai),
  isLyric: toBool(raw?.isLyric ?? raw?.isLyrics),
  remark: text(raw?.remark),
});

/** Spreadsheets usually only write Act/Scene on the first row of a scene. Copy them down. */
export const fillDownActScene = (lines: Line[]): Line[] => {
  let act = "";
  let scene = "";
  return lines.map((line) => {
    if (line.act) act = line.act;
    if (line.scene) scene = line.scene;
    return { ...line, act, scene };
  });
};

export const normalizeLines = (raw: unknown, fillDown = false): Line[] => {
  const lines = Array.isArray(raw) ? raw.map(normalizeLine) : [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.id)) line.id = newId();
    seen.add(line.id);
  }
  return fillDown ? fillDownActScene(lines) : lines;
};

// ---------------------------------------------------------------------------
// Warning carousel
// ---------------------------------------------------------------------------

export const WARNING_COLORS = ["#a61b33", "#1e9e1e", "#1aa7f0", "#fbae3c", "#7b3fe4", "#444444"];
export const DEFAULT_WARNING_SECONDS = 5;

const defaultWarnings: Omit<Warning, "id">[] = [
  { label: "NO FILM", color: "#a61b33", eng: "No filming or video recording allowed.", thai: "ห้ามบันทึกภาพเคลื่อนไหวและวิดีโอทุกชนิด" },
  { label: "ALL AGES", color: "#1e9e1e", eng: "This show is suitable for all ages.", thai: "การแสดงนี้เหมาะสำหรับผู้ชมทุกวัย" },
  { label: "NO FLASH", color: "#1aa7f0", eng: "Photography is permitted without flash.", thai: "อนุญาตให้ถ่ายภาพนิ่งได้โดยงดใช้แฟลช" },
  { label: "NO FOOD", color: "#fbae3c", eng: "No food or drinks allowed inside the theatre.", thai: "งดนำอาหารและเครื่องดื่มเข้าภายในโรงละคร" },
  { label: "", color: "#444444", eng: "NovaDrama | No theatre without people", thai: "" },
];
export const makeDefaultWarnings = (): Warning[] =>
  defaultWarnings.map((w) => ({ ...w, id: newId() }));

export const blankWarning = (partial: Partial<Warning> = {}): Warning => ({
  id: newId(),
  label: "",
  color: WARNING_COLORS[0],
  eng: "",
  thai: "",
  ...partial,
});

/** `undefined` (a show saved before warnings existed) gets the standard set. */
export const normalizeWarnings = (raw: unknown): Warning[] => {
  if (!Array.isArray(raw)) return makeDefaultWarnings();
  const seen = new Set<string>();
  return raw.map((item: any) => {
    let id = text(item?.id) || newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    const color = text(item?.color);
    return {
      id,
      label: text(item?.label),
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : WARNING_COLORS[0],
      eng: text(item?.eng),
      thai: text(item?.thai),
    };
  });
};

export const normalizeSeconds = (raw: unknown): number => {
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(60, Math.max(2, seconds))
    : DEFAULT_WARNING_SECONDS;
};

// ---------------------------------------------------------------------------
// Spreadsheet import
// ---------------------------------------------------------------------------

/** Parses CSV or tab-separated text (what you get when copying cells from Sheets/Excel). */
export const parseDelimited = (input: string): string[][] => {
  const source = input.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
};

export type Table = {
  rows: string[][];
  hasHeader: boolean;
  /** Which field each column holds; null = ignore the column. */
  mapping: (Field | null)[];
};

const guessMapping = (
  rows: string[][],
): { hasHeader: boolean; mapping: (Field | null)[] } => {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const header = (rows[0] ?? []).map(
    (c) => HEADER_ALIASES[c.trim().toLowerCase().replace(/[\s_-]/g, "")],
  );
  if (header.some(Boolean)) {
    const used = new Set<Field>();
    const mapping = Array.from({ length: width }, (_, i) => {
      const field = header[i];
      if (!field || used.has(field)) return null;
      used.add(field);
      return field;
    });
    return { hasHeader: true, mapping };
  }
  return {
    hasHeader: false,
    mapping: Array.from({ length: width }, (_, i) => SHEET_ORDER[i] ?? null),
  };
};

/** Reads pasted cells, a .csv/.tsv file, or a .json export and guesses the columns. */
export const readTable = (input: string): Table => {
  const trimmed = input.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const items: any[] = Array.isArray(parsed) ? parsed : parsed?.lines;
      if (Array.isArray(items)) {
        const keys: string[] = [];
        for (const item of items) {
          for (const key of Object.keys(item ?? {})) {
            if (key !== "id" && !keys.includes(key)) keys.push(key);
          }
        }
        const rows = [
          keys,
          ...items.map((item) => keys.map((k) => text(item?.[k]))),
        ];
        return { rows, ...guessMapping(rows) };
      }
    } catch {
      // not JSON after all – fall through and treat it as plain text
    }
  }
  const rows = parseDelimited(input);
  return { rows, ...guessMapping(rows) };
};

export const tableToLines = (table: Table, fillDown = true): Line[] => {
  const rows = table.hasHeader ? table.rows.slice(1) : table.rows;
  const lines = rows.map((row) => {
    const raw: Record<string, string> = {};
    table.mapping.forEach((field, i) => {
      if (field) raw[field] = row[i] ?? "";
    });
    return normalizeLine(raw);
  });
  return fillDown ? fillDownActScene(lines) : lines;
};

// ---------------------------------------------------------------------------
// Spreadsheet export
// ---------------------------------------------------------------------------

const csvCell = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const linesToCsv = (lines: Line[]): string => {
  const header = SHEET_ORDER.map((f) => (f === "isLyric" ? "isLyrics" : f));
  const body = lines.map((line) =>
    SHEET_ORDER.map((f) =>
      f === "isLyric" ? (line.isLyric ? "TRUE" : "FALSE") : csvCell(line[f]),
    ).join(","),
  );
  // The BOM makes Excel open Thai text correctly.
  return "﻿" + [header.join(","), ...body].join("\r\n") + "\r\n";
};
