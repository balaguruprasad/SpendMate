import { describe, it, expect } from "vitest";
import { isValidPan, isValidIfsc, isValidGstin } from "./validators";
describe("validators", () => {
  it("PAN AAAAA0000A", () => { expect(isValidPan("AAACA5678P")).toBe(true); expect(isValidPan("AAA")).toBe(false); });
  it("IFSC 11 chars, 5th is 0", () => { expect(isValidIfsc("HDFC0001234")).toBe(true); expect(isValidIfsc("HDFC1001234")).toBe(false); });
  it("GSTIN 15 chars", () => { expect(isValidGstin("29ABCDE1234F1Z5")).toBe(true); expect(isValidGstin("29ABCDE")).toBe(false); });
});
