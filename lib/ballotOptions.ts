// proposals.options should be string[], but it arrives in three shapes
// depending on the server code path: a real array, a JSON string (raw-SQL
// paths return the jsonb column as text), or a double-encoded JSON string
// (a caller re-encoded a string it assumed was an array). Unwrap whatever
// we're given into a clean string[]; anything unrecognizable becomes [].
export function normalizeBallotOptions(raw: unknown): string[] {
  let v: any = raw;
  let hops = 0;
  while (typeof v === 'string' && hops < 3) {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
    hops++;
  }
  return Array.isArray(v) ? v.filter((o) => typeof o === 'string') : [];
}
