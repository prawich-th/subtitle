import { expect, test } from "bun:test";
import {
  linesToCsv,
  normalizeLines,
  parseDelimited,
  readTable,
  tableToLines,
} from "./lines";

const pick = (lines: ReturnType<typeof tableToLines>) =>
  lines.map((l) => [l.act, l.scene, l.char, l.eng, l.thai, l.isLyric, l.remark]);

test("pasted spreadsheet cells (tabs) with a header row", () => {
  const table = readTable(
    "act\tscene\tchar\teng\tthai\tisLyrics\tremark\n" +
      "1\t1\tAnna\tHello\tสวัสดี\tFALSE\t\n" +
      "\t\tBob\tSing\tร้อง\tTRUE\tnote\n" +
      "\t2\tAnna\tBye\tลาก่อน\tFALSE\t\n",
  );
  expect(table.hasHeader).toBe(true);
  expect(pick(tableToLines(table))).toEqual([
    ["1", "1", "Anna", "Hello", "สวัสดี", false, ""],
    ["1", "1", "Bob", "Sing", "ร้อง", true, "note"],
    ["1", "2", "Anna", "Bye", "ลาก่อน", false, ""],
  ]);
});

test("CSV with quotes, commas and line breaks inside a cell", () => {
  expect(parseDelimited('a,"b, ""c""",d\r\n"two\nlines",,x\n')).toEqual([
    ["a", 'b, "c"', "d"],
    ["two\nlines", "", "x"],
  ]);
});

test("headers in another order and with other names are recognised", () => {
  const table = readTable("Character,Thai,English,Notes\nAnna,สวัสดี,Hello,hi");
  expect(table.mapping).toEqual(["char", "thai", "eng", "remark"]);
  expect(pick(tableToLines(table))).toEqual([
    ["", "", "Anna", "Hello", "สวัสดี", false, "hi"],
  ]);
});

test("no header row: assumes the original sheet's column order", () => {
  const table = readTable("1,1,Anna,Hello,สวัสดี,FALSE,");
  expect(table.hasHeader).toBe(false);
  expect(pick(tableToLines(table))).toEqual([
    ["1", "1", "Anna", "Hello", "สวัสดี", false, ""],
  ]);
});

test("old sub.json files can be imported", () => {
  const table = readTable(
    JSON.stringify([
      { act: 99, scene: 99, char: "QR" },
      { act: 1, scene: 1, char: "A", eng: "x", thai: "y", isLyrics: "TRUE", remark: "" },
      { act: "", scene: "", char: "B", eng: "z", thai: "w", isLyrics: "FALSE", remark: "r" },
    ]),
  );
  expect(pick(tableToLines(table))).toEqual([
    ["99", "99", "QR", "", "", false, ""],
    ["1", "1", "A", "x", "y", true, ""],
    ["1", "1", "B", "z", "w", false, "r"],
  ]);
});

test("export then import gives the same lines back", () => {
  const lines = normalizeLines([
    { act: "1", scene: "2", char: "A", eng: 'He said "hi", twice', thai: "ก\nข", isLyric: true, remark: "" },
  ]);
  expect(pick(tableToLines(readTable(linesToCsv(lines))))).toEqual(pick(lines));
});

test("duplicate or missing ids are repaired", () => {
  const lines = normalizeLines([{ id: "a" }, { id: "a" }, {}]);
  expect(new Set(lines.map((l) => l.id)).size).toBe(3);
});
