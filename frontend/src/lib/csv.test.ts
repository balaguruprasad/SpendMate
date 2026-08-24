import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv } from "./csv";

describe("csv escaping", () => {
  it("quotes cells containing commas, quotes, and newlines", () => {
    expect(csvCell('Say "hi", ok?')).toBe('"Say ""hi"", ok?"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("plain")).toBe("plain");
  });

  it("guards formula injection (= + - @ tab CR)", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("+123")).toBe("'+123");
    expect(csvCell("-123")).toBe("'-123");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("quotes a formula-guarded cell that also contains a comma", () => {
    expect(csvCell("=1,2")).toBe("\"'=1,2\"");
  });

  it("joins rows with CRLF", () => {
    expect(toCsv([["a", "b"], [1, 2]])).toBe("a,b\r\n1,2");
  });
});

describe("parseCsv", () => {
  it("parses header + rows into keyed objects", () => {
    const rows = parseCsv("name,cohort\r\nAarav,C3\r\nDiya,C4");
    expect(rows).toEqual([
      { name: "Aarav", cohort: "C3" },
      { name: "Diya", cohort: "C4" },
    ]);
  });

  it("handles quoted cells with commas and escaped quotes", () => {
    const rows = parseCsv('name,note\n"Sharma, Aarav","said ""hi"""');
    expect(rows).toEqual([{ name: "Sharma, Aarav", note: 'said "hi"' }]);
  });

  it("skips blank lines and missing trailing cells", () => {
    const rows = parseCsv("a,b\n1\n\n2,3\n");
    expect(rows).toEqual([
      { a: "1", b: "" },
      { a: "2", b: "3" },
    ]);
  });
});
