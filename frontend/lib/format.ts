export function fmtINR(n: number): string {
  return "₹" + Number(n).toLocaleString("en-IN");
}
