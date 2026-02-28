import { describe, expect, it } from "vitest";
import { clampText, compactNumber, fmtTs, pct } from "./format";

describe("format helpers", () => {
  it("computes percentage safely", () => {
    expect(pct(5, 20)).toBe("25.0");
    expect(pct(1, 0)).toBe("0.0");
  });

  it("formats compact numbers for dashboard KPIs", () => {
    expect(compactNumber(1250)).toMatch(/1\.3K|1\.2K/);
  });

  it("clamps long text", () => {
    expect(clampText("abcdef", 4)).toBe("abc…");
    expect(clampText("abc", 8)).toBe("abc");
  });

  it("returns placeholder for invalid timestamps", () => {
    expect(fmtTs(null)).toBe("-");
    expect(fmtTs("bad-date")).toBe("-");
  });
});
