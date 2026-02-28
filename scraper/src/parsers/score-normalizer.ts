/**
 * Parses a score string into a numeric value.
 * Handles both D+E format (14.250) and 10.0-scale (9.850).
 * Returns null if the value is not a valid score.
 */
export function parseScore(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (isNaN(n) || n < 0 || n > 20) return null;
  return n;
}

/**
 * Detects whether a score string is in D+E format or 10.0-scale.
 * D+E format: scores can exceed 10.0 (typically 11-16 range for elite)
 * 10.0-scale: scores are <= 10.0
 */
export function detectScoringSystem(
  scores: (number | null)[]
): "de" | "tenpoint" | "unknown" {
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length === 0) return "unknown";

  const maxScore = Math.max(...valid);
  if (maxScore > 10.1) return "de";
  if (maxScore <= 10.0) return "tenpoint";
  return "unknown";
}

/**
 * Map of common column name variations found in PDFs/HTML to canonical apparatus codes.
 */
export const APPARATUS_COLUMN_MAP: Record<string, string> = {
  // Floor
  FX: "FX", Floor: "FX", "Floor Exercise": "FX", FL: "FX",
  // Pommel Horse
  PH: "PH", "Pommel Horse": "PH", Pommel: "PH", POM: "PH",
  // Still Rings
  SR: "SR", Rings: "SR", "Still Rings": "SR", R: "SR", RI: "SR",
  // Vault
  VT: "VT", Vault: "VT", V: "VT",
  // Parallel Bars
  PB: "PB", "Parallel Bars": "PB", "P-Bars": "PB", PBars: "PB",
  // High Bar
  HB: "HB", "High Bar": "HB", "Horizontal Bar": "HB", HBar: "HB",
  // All-Around
  AA: "AA", "All-Around": "AA", AllAround: "AA", Total: "AA",
};

export function mapApparatus(raw: string): string | null {
  const key = raw.trim();
  return APPARATUS_COLUMN_MAP[key] ?? null;
}
