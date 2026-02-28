import { distance } from "fastest-levenshtein";

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1 - distance(a, b) / maxLen;
}

function tokenSortRatio(a: string, b: string): number {
  const sort = (s: string) => s.split(" ").sort().join(" ");
  return levenshteinRatio(sort(a), sort(b));
}

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length, len2 = s2.length;
  if (!len1 || !len2) return 0.0;

  const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1m = new Array(len1).fill(false);
  const s2m = new Array(len2).fill(false);
  let matches = 0, transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2m[j] || s1[i] !== s2[j]) continue;
      s1m[i] = s2m[j] = true;
      matches++;
      break;
    }
  }

  if (!matches) return 0.0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1m[i]) continue;
    while (!s2m[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
}

export interface MatchResult {
  confidence: number;
  reason: string;
}

export function computeMatchConfidence(
  normA: string,
  normB: string,
  context?: { sameProgram?: boolean; sameLevelRange?: boolean }
): MatchResult {
  const lev = levenshteinRatio(normA, normB);
  const tsr = tokenSortRatio(normA, normB);
  const jar = jaro(normA, normB);

  let score = lev * 0.35 + tsr * 0.35 + jar * 0.20;
  if (context?.sameProgram) score = Math.min(1.0, score + 0.15);
  if (context?.sameLevelRange) score = Math.min(1.0, score + 0.05);

  const reason = [
    `lev:${lev.toFixed(3)}`,
    `tsr:${tsr.toFixed(3)}`,
    `jaro:${jar.toFixed(3)}`,
    context?.sameProgram ? "same_program:true" : null,
    context?.sameLevelRange ? "same_level:true" : null,
  ].filter(Boolean).join(",");

  return { confidence: score, reason };
}

export const THRESHOLDS = { AUTO_ASSOCIATE: 0.92, REVIEW_QUEUE: 0.75 } as const;
