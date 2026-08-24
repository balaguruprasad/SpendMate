import { describe, it, expect } from "vitest";
import { computeGst } from "./gst";

describe("computeGst", () => {
  it("intra-state (29…) splits into CGST+SGST, IGST zero", () => {
    const r = computeGst({ taxableValue: 10000, gstin: "29ABCDE1234F1Z5", rate: 18 });
    expect(r.cgstAmount).toBe(900);
    expect(r.sgstAmount).toBe(900);
    expect(r.igstAmount).toBe(0);
    expect(r.totalPayable).toBe(11800);
  });
  it("inter-state (≠29) uses IGST, CGST/SGST zero", () => {
    const r = computeGst({ taxableValue: 10000, gstin: "27AAFCG9012R1Z2", rate: 18 });
    expect(r.igstAmount).toBe(1800);
    expect(r.cgstAmount).toBe(0);
    expect(r.totalPayable).toBe(11800);
  });
  it("no gstin → no tax", () => {
    const r = computeGst({ taxableValue: 10000, gstin: null, rate: 18 });
    expect(r.totalPayable).toBe(10000);
  });
});
