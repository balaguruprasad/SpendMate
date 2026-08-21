export interface GstInput { taxableValue: number; gstin: string | null; rate: number; }
export interface GstResult {
  isIntraState: boolean;
  cgstRate: number; cgstAmount: number;
  sgstRate: number; sgstAmount: number;
  igstRate: number; igstAmount: number;
  totalPayable: number;
}
const KARNATAKA = "29";
const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeGst({ taxableValue, gstin, rate }: GstInput): GstResult {
  if (!gstin) {
    return { isIntraState: false, cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0, igstRate: 0, igstAmount: 0, totalPayable: round2(taxableValue) };
  }
  const intra = gstin.slice(0, 2) === KARNATAKA;
  if (intra) {
    const half = rate / 2;
    const cgst = round2((taxableValue * half) / 100);
    const sgst = round2((taxableValue * half) / 100);
    return { isIntraState: true, cgstRate: half, cgstAmount: cgst, sgstRate: half, sgstAmount: sgst, igstRate: 0, igstAmount: 0, totalPayable: round2(taxableValue + cgst + sgst) };
  }
  const igst = round2((taxableValue * rate) / 100);
  return { isIntraState: false, cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0, igstRate: rate, igstAmount: igst, totalPayable: round2(taxableValue + igst) };
}
