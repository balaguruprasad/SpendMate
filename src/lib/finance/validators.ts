const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export const isValidPan = (v: string) => PAN.test(v.toUpperCase());
export const isValidIfsc = (v: string) => IFSC.test(v.toUpperCase());
export const isValidGstin = (v: string) => GSTIN.test(v.toUpperCase());
export const isDuplicateBankAccount = (acct: string, existing: string[]) =>
  existing.map((e) => e.replace(/\s/g, "")).includes(acct.replace(/\s/g, ""));
