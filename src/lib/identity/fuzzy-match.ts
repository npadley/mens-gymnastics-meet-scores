import { distance } from "fastest-levenshtein";

/**
 * Multi-signal fuzzy matching for gymnast identity resolution.
 *
 * Confidence score 0.0–1.0:
 *   >= 0.92  → auto-associate (add name variant to existing gymnast)
 *   0.75–0.92 → queue for admin review in pending_duplicates
 *   < 0.75  → treat as new gymnast
 */

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1 - distance(a, b) / maxLen;
}

/**
 * Token sort ratio: splits into tokens, sorts, rejoins, then compares.
 * Handles "John Smith" vs "Smith John" cases.
 */
function tokenSortRatio(a: string, b: string): number {
  const sortTokens = (s: string) =>
    s.split(" ").sort().join(" ");
  return levenshteinRatio(sortTokens(a), sortTokens(b));
}

/**
 * Jaro similarity (simplified implementation without the Winkler prefix boost,
 * which can over-boost very short names).
 */
function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  );
}

export interface MatchSignals {
  levenshteinRatio: number;
  tokenSortRatio: number;
  jaro: number;
  sameProgram: boolean;
  sameLevelRange: boolean;
}

export interface MatchResult {
  confidence: number;
  signals: MatchSignals;
  reason: string;
}

export function computeMatchConfidence(
  normalizedA: string,
  normalizedB: string,
  context?: {
    programAId?: string;
    programBId?: string;
    levelA?: string;
    levelB?: string;
  }
): MatchResult {
  const lev = levenshteinRatio(normalizedA, normalizedB);
  const tsr = tokenSortRatio(normalizedA, normalizedB);
  const jar = jaro(normalizedA, normalizedB);

  const sameProgram =
    !!context?.programAId &&
    !!context?.programBId &&
    context.programAId === context.programBId;

  // "Same level range" = both in youth (level_6-10), both elite, or both NCAA
  const sameLevelRange = (() => {
    if (!context?.levelA || !context?.levelB) return false;
    const youthLevels = new Set(["level_6", "level_7", "level_8", "level_9", "level_10"]);
    const eliteLevels = new Set(["elite", "junior_elite", "development"]);
    const ncaaLevels = new Set(["ncaa", "gymact"]);
    const bothIn = (set: Set<string>) =>
      set.has(context.levelA!) && set.has(context.levelB!);
    return bothIn(youthLevels) || bothIn(eliteLevels) || bothIn(ncaaLevels);
  })();

  let score = lev * 0.35 + tsr * 0.35 + jar * 0.20;

  if (sameProgram) score = Math.min(1.0, score + 0.15);
  if (sameLevelRange) score = Math.min(1.0, score + 0.05);

  const reasonParts = [
    `lev:${lev.toFixed(3)}`,
    `tsr:${tsr.toFixed(3)}`,
    `jaro:${jar.toFixed(3)}`,
    sameProgram ? "same_program:true" : null,
    sameLevelRange ? "same_level:true" : null,
  ].filter(Boolean);

  return {
    confidence: score,
    signals: { levenshteinRatio: lev, tokenSortRatio: tsr, jaro: jar, sameProgram, sameLevelRange },
    reason: reasonParts.join(","),
  };
}

export const THRESHOLDS = {
  AUTO_ASSOCIATE: 0.92,
  REVIEW_QUEUE: 0.75,
} as const;
