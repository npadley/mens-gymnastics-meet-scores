/**
 * USA Gymnastics PDF scraper
 *
 * Elite and development program results are published as PDFs at:
 *   https://static.usagym.org/PDFs/Results/{YYYY}/
 *
 * PDF structure (men's):
 *   Place | Name | Club/Team | FX | PH | SR | VT | PB | HB | AA
 *
 * D scores may or may not be present depending on level.
 */

import pdfParse from "pdf-parse";
import { mapApparatus, parseScore, detectScoringSystem } from "../parsers/score-normalizer.js";
import type { RawMeet, RawResult } from "../pipeline/ingest.js";

const RATE_LIMIT_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Known PDF URLs for men's gymnastics results.
 * Add new ones each season.
 */
export const USAG_PDF_URLS: Array<{
  url: string;
  name: string;
  level: string;
  season: number;
  date: string;
}> = [
  // 2025
  {
    url: "https://static.usagym.org/PDFs/Results/2025/m_2025wintercup_allaroundresults.pdf",
    name: "2025 Winter Cup",
    level: "elite",
    season: 2025,
    date: "2025-02-22",
  },
  // 2024
  {
    url: "https://static.usagym.org/PDFs/Results/2024/m_2024uschamps_sr_aa_results.pdf",
    name: "2024 U.S. Championships - Senior",
    level: "elite",
    season: 2024,
    date: "2024-08-25",
  },
  {
    url: "https://static.usagym.org/PDFs/Results/2024/m_2024uschamps_jr_aa_results.pdf",
    name: "2024 U.S. Championships - Junior",
    level: "junior_elite",
    season: 2024,
    date: "2024-08-25",
  },
  // 2023
  {
    url: "https://static.usagym.org/PDFs/Results/2023/m_2023uschamps_sr_aa_results.pdf",
    name: "2023 U.S. Championships - Senior",
    level: "elite",
    season: 2023,
    date: "2023-08-25",
  },
];

/**
 * Downloads and parses a single USAG PDF results file.
 */
export async function scrapeUsagPdf(entry: typeof USAG_PDF_URLS[number]): Promise<RawMeet | null> {
  let buffer: Buffer;
  try {
    const res = await fetch(entry.url, {
      headers: { "User-Agent": "MAGScoresBot/1.0 (educational project)" },
    });
    if (!res.ok) {
      console.warn(`[usag-pdf] HTTP ${res.status} for ${entry.url}`);
      return null;
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error(`[usag-pdf] Fetch error:`, err);
    return null;
  }

  let pdfData: pdfParse.Result;
  try {
    pdfData = await pdfParse(buffer);
  } catch (err) {
    console.error(`[usag-pdf] PDF parse error for ${entry.url}:`, err);
    return null;
  }

  const results = parsePdfText(pdfData.text);
  if (results.length === 0) {
    console.warn(`[usag-pdf] No results extracted from ${entry.url}`);
    return null;
  }

  const startDate = new Date(entry.date);
  const sourceId = entry.url.split("/").pop()?.replace(".pdf", "") ?? entry.url;

  return {
    name: entry.name,
    level: entry.level,
    startDate,
    season: entry.season,
    source: "usag_pdf",
    sourceUrl: entry.url,
    sourceId,
    results,
  };
}

/**
 * Parses raw PDF text into structured results.
 *
 * USAG PDFs use a consistent column layout:
 * Place  Name  Club  FX  PH  SR  VT  PB  HB  AA
 *
 * The text extraction from pdf-parse is line-based.
 * We detect the header row, then parse each subsequent data row.
 */
function parsePdfText(text: string): RawResult[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Find the header line containing apparatus names
  let headerLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    // A header line should contain at least 3 apparatus codes
    const apparatusHits = ["FX", "PH", "SR", "VT", "PB", "HB", "AA"].filter(
      (ap) => line.includes(ap)
    ).length;
    if (apparatusHits >= 3) {
      headerLineIdx = i;
      break;
    }
  }

  if (headerLineIdx === -1) {
    console.warn("[usag-pdf] Could not find apparatus header line");
    return parsePdfTextFallback(text);
  }

  // Parse column positions from the header line
  const headerLine = lines[headerLineIdx];
  const apparatusPositions = detectApparatusColumns(headerLine);

  const results: RawResult[] = [];

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip blank lines, section headers, and totals
    if (!line.trim() || /^(place|rank|#|name|total|avg)/i.test(line)) continue;

    // A data row starts with a number (place)
    const placeMatch = line.match(/^(\d+)\s+(.+)/);
    if (!placeMatch) continue;

    const place = parseInt(placeMatch[1]);
    const rest = placeMatch[2];

    // Try to extract scores using space-separated tokens at end of line
    const tokens = rest.trim().split(/\s{2,}/); // Split on 2+ spaces
    if (tokens.length < 3) continue;

    // Last tokens are scores, first token(s) are name + club
    // Heuristic: find where scores begin (first token that looks like a score)
    let scoreStartIdx = tokens.length;
    for (let j = tokens.length - 1; j >= 0; j--) {
      if (/^\d+\.\d{3}$/.test(tokens[j]) || /^\d+\.\d{1,3}$/.test(tokens[j])) {
        scoreStartIdx = j;
      } else {
        break;
      }
    }

    const nameAndClub = tokens.slice(0, scoreStartIdx);
    const scoreTokens = tokens.slice(scoreStartIdx);

    if (scoreTokens.length === 0) continue;

    // Name is first token, club is second (if present)
    const rawName = nameAndClub[0] ?? "";
    const rawProgram = nameAndClub[1] ?? undefined;

    if (!rawName || rawName.length < 2) continue;

    // Map scores to apparatus using position
    const apparatusCodes = ["FX", "PH", "SR", "VT", "PB", "HB", "AA"];
    const scoringSystem = detectScoringSystem(
      scoreTokens.map((s) => parseScore(s))
    );

    for (let j = 0; j < Math.min(scoreTokens.length, apparatusCodes.length); j++) {
      const score = parseScore(scoreTokens[j]);
      if (score === null || score === 0) continue;

      results.push({
        rawName,
        rawProgram,
        apparatus: apparatusCodes[j],
        finalScore: score,
        place: apparatusCodes[j] === "AA" ? place : null,
        round: "finals",
      });
    }
  }

  return results;
}

function detectApparatusColumns(
  headerLine: string
): Array<{ apparatus: string; position: number }> {
  const apparatuses = ["FX", "PH", "SR", "VT", "PB", "HB", "AA"];
  const positions: Array<{ apparatus: string; position: number }> = [];

  for (const ap of apparatuses) {
    const idx = headerLine.indexOf(ap);
    if (idx >= 0) positions.push({ apparatus: ap, position: idx });
  }

  return positions.sort((a, b) => a.position - b.position);
}

/**
 * Fallback parser using regex patterns for PDFs with inconsistent formatting.
 */
function parsePdfTextFallback(text: string): RawResult[] {
  const results: RawResult[] = [];

  // Match lines like: 1  John Smith  Gym Pride  13.500  12.400  14.100  ...  82.350
  const scorePattern = /^(\d{1,3})\s+([\w\s,'-]+?)\s{2,}([\w\s&.']+?)\s{2,}([\d.]+(?:\s+[\d.]+){0,6})$/gm;

  let match: RegExpExecArray | null;
  while ((match = scorePattern.exec(text)) !== null) {
    const place = parseInt(match[1]);
    const rawName = match[2].trim();
    const rawProgram = match[3].trim();
    const scoreStr = match[4];

    const scoreTokens = scoreStr.trim().split(/\s+/);
    const apparatusCodes = ["FX", "PH", "SR", "VT", "PB", "HB", "AA"];

    for (let j = 0; j < Math.min(scoreTokens.length, apparatusCodes.length); j++) {
      const score = parseScore(scoreTokens[j]);
      if (score === null || score === 0) continue;

      results.push({
        rawName,
        rawProgram,
        apparatus: apparatusCodes[j],
        finalScore: score,
        place: apparatusCodes[j] === "AA" ? place : null,
        round: "finals",
      });
    }
  }

  return results;
}

/**
 * Scrapes all configured USAG PDF URLs.
 */
export async function scrapeUsagPdfs(): Promise<RawMeet[]> {
  const meets: RawMeet[] = [];

  for (const entry of USAG_PDF_URLS) {
    console.log(`[usag-pdf] Scraping ${entry.name}`);
    const meet = await scrapeUsagPdf(entry);
    if (meet) {
      meets.push(meet);
      console.log(`[usag-pdf] Found ${meet.results.length} results for "${meet.name}"`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  return meets;
}
