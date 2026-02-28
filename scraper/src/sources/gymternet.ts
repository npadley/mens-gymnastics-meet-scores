/**
 * The Gymternet scraper
 *
 * The Gymternet (thegymter.net) publishes gymnastics results as static HTML
 * tables after major competitions. This is the easiest source to scrape —
 * no JavaScript execution required.
 *
 * Men's results URL pattern:
 *   https://thegymter.net/{YYYY}/{MM}/{DD}/{YYYY}-{event-slug}-mens-results/
 *   https://thegymter.net/{YYYY}/{MM}/{DD}/{YYYY}-{event-slug}-men-results/
 */

import * as cheerio from "cheerio";
import { mapApparatus, parseScore } from "../parsers/score-normalizer.js";
import type { RawMeet, RawResult } from "../pipeline/ingest.js";

const RATE_LIMIT_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Seed list of known men's results pages on The Gymternet.
 * These are the starting points; additional pages can be discovered via sitemap.
 */
export const GYMTERNET_SEED_URLS: string[] = [
  // 2025
  "https://thegymter.net/2025/02/25/2025-winter-cup-mens-results/",
  // 2024
  "https://thegymter.net/2024/08/25/2024-u-s-championships-mens-results/",
  "https://thegymter.net/2024/02/27/2024-winter-cup-mens-results/",
  // 2023
  "https://thegymter.net/2023/08/26/2023-u-s-championships-mens-results/",
  "https://thegymter.net/2023/02/28/2023-winter-cup-mens-results/",
  // 2022
  "https://thegymter.net/2022/08/21/2022-u-s-gymnastics-championships-mens-results/",
  "https://thegymter.net/2022/02/26/2022-winter-cup-mens-results/",
  // 2021
  "https://thegymter.net/2021/06/04/2021-u-s-gymnastics-championships-mens-results/",
  // 2019
  "https://thegymter.net/2019/08/18/2019-u-s-gymnastics-championships-mens-results/",
  "https://thegymter.net/2019/02/23/2019-winter-cup-results/",
];

interface GymternetMeetMeta {
  name: string;
  level: string;
  season: number;
  sourceUrl: string;
}

/**
 * Infers meet metadata from the URL and page title.
 */
function inferMeetMeta(url: string, pageTitle: string): GymternetMeetMeta {
  const urlLower = url.toLowerCase();

  // Extract year from URL (e.g. /2025/)
  const yearMatch = url.match(/\/(\d{4})\//);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  let level = "elite";
  let name = pageTitle.replace(/Results?$/i, "").trim();

  if (urlLower.includes("winter-cup")) {
    name = `${year} Winter Cup`;
    level = "elite";
  } else if (urlLower.includes("u-s-championships") || urlLower.includes("us-gymnastics-championships")) {
    name = `${year} U.S. Gymnastics Championships`;
    level = "elite";
  } else if (urlLower.includes("world")) {
    level = "elite";
  } else if (urlLower.includes("olympic-trials")) {
    name = `${year} Olympic Trials`;
    level = "elite";
  }

  return { name, level, season: year, sourceUrl: url };
}

/**
 * Fetches and parses a single Gymternet results page.
 * Returns null if the page doesn't contain recognizable men's gymnastics results.
 */
export async function scrapeGymternetPage(url: string): Promise<RawMeet | null> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MAGScoresBot/1.0 (educational project)" },
    });
    if (!res.ok) {
      console.warn(`[gymternet] HTTP ${res.status} for ${url}`);
      return null;
    }
    html = await res.text();
  } catch (err) {
    console.error(`[gymternet] Fetch error for ${url}:`, err);
    return null;
  }

  const $ = cheerio.load(html);
  const pageTitle = $("h1.entry-title, h1").first().text().trim();

  // Only process men's results pages
  const isMens = /men'?s?/i.test(pageTitle) || /men'?s?/i.test(url);
  if (!isMens) {
    console.log(`[gymternet] Skipping non-men's page: ${url}`);
    return null;
  }

  const meta = inferMeetMeta(url, pageTitle);

  // Find all tables on the page
  const tableElements = $("table").toArray();
  if (tableElements.length === 0) {
    console.warn(`[gymternet] No tables found at ${url}`);
    return null;
  }

  // Extract the date from the URL or page
  const dateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  const startDate = dateMatch
    ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`)
    : new Date(`${meta.season}-01-01`);

  const allResults: RawResult[] = [];

  for (const tableEl of tableElements) {
    const tableHtml = $.html(tableEl);
    const results = parseGymternetTable($, tableEl, tableHtml);
    allResults.push(...results);
  }

  if (allResults.length === 0) {
    console.warn(`[gymternet] No parseable results at ${url}`);
    return null;
  }

  // Generate source ID from URL slug
  const sourceId = url.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");

  return {
    name: meta.name,
    level: meta.level,
    startDate,
    season: meta.season,
    source: "gymternet",
    sourceUrl: url,
    sourceId,
    results: allResults,
  };
}

/**
 * Parses a single HTML table from a Gymternet results page.
 * Gymternet tables have: Place | Name | Country/Club | FX | PH | SR | VT | PB | HB | AA (+ D/E subscores)
 */
function parseGymternetTable(
  $: cheerio.CheerioAPI,
  tableEl: Parameters<cheerio.CheerioAPI>[0],
  _tableHtml: string
): RawResult[] {
  const table = $(tableEl);
  const rows = table.find("tr").toArray();
  if (rows.length < 2) return [];

  // Parse header row to detect column positions
  const headerCells = $(rows[0])
    .find("th, td")
    .toArray()
    .map((el) => $(el).text().trim());

  // Map header names to apparatus codes
  const apparatusColumns: { idx: number; apparatus: string }[] = [];
  let nameColIdx = -1;
  let programColIdx = -1;
  let placeColIdx = -1;

  for (let i = 0; i < headerCells.length; i++) {
    const header = headerCells[i];
    const apparatus = mapApparatus(header);
    if (apparatus) {
      apparatusColumns.push({ idx: i, apparatus });
    } else if (/name|athlete|gymnast/i.test(header)) {
      nameColIdx = i;
    } else if (/gym|club|team|school|country|nation/i.test(header)) {
      programColIdx = i;
    } else if (/pl|rank|#/i.test(header) && i < 3) {
      placeColIdx = i;
    }
  }

  // Fallback: if no Name column found, assume column 1 (after Place)
  if (nameColIdx === -1 && headerCells.length > 1) nameColIdx = 1;
  if (apparatusColumns.length === 0) return [];

  const results: RawResult[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = $(rows[i])
      .find("td")
      .toArray()
      .map((el) => $(el).text().trim());

    if (cells.length < 2) continue;

    const rawName = (nameColIdx >= 0 ? cells[nameColIdx] : "")
      .split("\n")[0]
      .trim();
    if (!rawName || /total|avg|average/i.test(rawName)) continue;

    const rawProgram = programColIdx >= 0 ? cells[programColIdx] : undefined;
    const place = placeColIdx >= 0 ? parseInt(cells[placeColIdx]) || null : null;

    for (const { idx, apparatus } of apparatusColumns) {
      const scoreStr = cells[idx];
      const score = parseScore(scoreStr);
      if (score === null || score === 0) continue;

      results.push({
        rawName,
        rawProgram,
        apparatus,
        finalScore: score,
        place: apparatus === "AA" ? place : null,
        round: "finals",
      });
    }
  }

  return results;
}

/**
 * Scrapes all seed URLs and returns an array of RawMeet objects.
 * Respects rate limiting between requests.
 */
export async function scrapeGymternet(
  urls: string[] = GYMTERNET_SEED_URLS
): Promise<RawMeet[]> {
  const meets: RawMeet[] = [];

  for (const url of urls) {
    console.log(`[gymternet] Scraping ${url}`);
    const meet = await scrapeGymternetPage(url);
    if (meet) {
      meets.push(meet);
      console.log(`[gymternet] Found ${meet.results.length} results for "${meet.name}"`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  return meets;
}
