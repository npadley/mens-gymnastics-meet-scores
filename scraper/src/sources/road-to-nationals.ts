/**
 * Road to Nationals scraper (NCAA men's gymnastics)
 *
 * roadtonationals.com is the official statistical site for NCAA Men's Gymnastics.
 * It's a JavaScript-rendered React SPA, requiring Playwright for data extraction.
 *
 * Schedule page: https://roadtonationals.com/results/scheduleM/
 * Meet page: https://roadtonationals.com/results/scheduleM/meet/{ID}
 *
 * NOTE: Playwright must be installed: pnpm exec playwright install chromium
 */

import type { RawMeet, RawResult } from "../pipeline/ingest.js";
import { parseScore, mapApparatus } from "../parsers/score-normalizer.js";

const RATE_LIMIT_MS = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BASE_URL = "https://roadtonationals.com";

interface RtnMeetListItem {
  id: string;
  name: string;
  date: string;
  season: number;
}

/**
 * Loads the NCAA Men's schedule page and extracts meet IDs.
 * Returns a list of meet IDs and names found on the schedule.
 */
async function fetchMeetList(season?: number): Promise<RtnMeetListItem[]> {
  // Dynamic import so Playwright only loads when this source is active
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { chromium } = await import("playwright" as any);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/results/scheduleM/`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for meet list to render
    await page.waitForSelector("a[href*='/results/scheduleM/meet/']", {
      timeout: 15000,
    });

    const meets = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          "a[href*='/results/scheduleM/meet/']"
        )
      );

      return links.map((link) => {
        const href = link.href;
        const idMatch = href.match(/\/meet\/(\d+)/);
        return {
          id: idMatch?.[1] ?? "",
          name: link.textContent?.trim() ?? "",
          href,
        };
      });
    });

    await browser.close();

    return meets
      .filter((m: { id: string }) => m.id)
      .map((m: { id: string; name: string }) => ({
        id: m.id,
        name: m.name,
        date: new Date().toISOString(),
        season: season ?? new Date().getFullYear(),
      }));
  } catch (err) {
    await browser.close();
    throw err;
  }
}

/**
 * Scrapes a single Road to Nationals meet page and returns structured results.
 */
async function scrapeMeetPage(
  meetId: string,
  meetMeta: { name: string; season: number }
): Promise<RawMeet | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { chromium } = await import("playwright" as any);
  const url = `${BASE_URL}/results/scheduleM/meet/${meetId}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Wait for the results table to render
    await page.waitForSelector("table", { timeout: 15000 }).catch(() => null);

    const data = await page.evaluate(() => {
      // Extract meet title and date from the page
      const titleEl = document.querySelector("h1, h2, .meet-title");
      const title = titleEl?.textContent?.trim() ?? "";

      const dateEl = document.querySelector(".meet-date, time, [class*='date']");
      const dateText = dateEl?.textContent?.trim() ?? "";

      // Extract results table(s)
      const tables: Array<{
        headers: string[];
        rows: string[][];
      }> = [];

      document.querySelectorAll("table").forEach((table) => {
        const headers = Array.from(table.querySelectorAll("thead th, thead td")).map(
          (th) => th.textContent?.trim() ?? ""
        );
        const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
          Array.from(tr.querySelectorAll("td")).map(
            (td) => td.textContent?.trim() ?? ""
          )
        );
        if (headers.length > 0 && rows.length > 0) {
          tables.push({ headers, rows });
        }
      });

      return { title, dateText, tables };
    });

    await browser.close();

    if (data.tables.length === 0) {
      console.warn(`[rtn] No tables found at ${url}`);
      return null;
    }

    // Parse date
    const startDate = data.dateText
      ? new Date(data.dateText)
      : new Date(`${meetMeta.season}-01-01`);
    if (isNaN(startDate.getTime())) {
      startDate.setTime(new Date(`${meetMeta.season}-01-01`).getTime());
    }

    const allResults: RawResult[] = [];

    for (const table of data.tables) {
      const results = parseRtnTable(table.headers, table.rows);
      allResults.push(...results);
    }

    if (allResults.length === 0) return null;

    const meetName = data.title || meetMeta.name;
    return {
      name: meetName,
      level: "ncaa",
      startDate,
      season: meetMeta.season,
      source: "road_to_nationals",
      sourceUrl: url,
      sourceId: meetId,
      results: allResults,
    };
  } catch (err) {
    await browser.close();
    console.error(`[rtn] Error scraping meet ${meetId}:`, err);
    return null;
  }
}

function parseRtnTable(headers: string[], rows: string[][]): RawResult[] {
  const results: RawResult[] = [];

  // Map header index → apparatus
  const colMap: { idx: number; apparatus: string }[] = [];
  let nameIdx = -1;
  let programIdx = -1;
  let placeIdx = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim();
    const apparatus = mapApparatus(h);
    if (apparatus) {
      colMap.push({ idx: i, apparatus });
    } else if (/name|athlete/i.test(h)) {
      nameIdx = i;
    } else if (/school|team|gym/i.test(h)) {
      programIdx = i;
    } else if (/pl|rank|#/i.test(h) && i < 3) {
      placeIdx = i;
    }
  }

  if (nameIdx === -1 && headers.length > 1) nameIdx = 1;
  if (colMap.length === 0) return [];

  for (const cells of rows) {
    if (cells.length < 2) continue;
    const rawName = nameIdx >= 0 ? cells[nameIdx] : "";
    if (!rawName || /total|avg/i.test(rawName)) continue;

    const rawProgram = programIdx >= 0 ? cells[programIdx] : undefined;
    const place = placeIdx >= 0 ? parseInt(cells[placeIdx]) || null : null;

    for (const { idx, apparatus } of colMap) {
      const score = parseScore(cells[idx]);
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
 * Main entry point for Road to Nationals scraping.
 * Fetches the schedule, then scrapes each meet page.
 * Limits to maxMeets per run to be polite.
 */
export async function scrapeRoadToNationals(opts: {
  season?: number;
  maxMeets?: number;
} = {}): Promise<RawMeet[]> {
  const { season, maxMeets = 10 } = opts;

  console.log("[rtn] Fetching meet schedule...");
  let meetList: RtnMeetListItem[];
  try {
    meetList = await fetchMeetList(season);
  } catch (err) {
    console.error("[rtn] Failed to fetch meet list:", err);
    return [];
  }

  console.log(`[rtn] Found ${meetList.length} meets on schedule`);
  const meets: RawMeet[] = [];

  for (const item of meetList.slice(0, maxMeets)) {
    console.log(`[rtn] Scraping "${item.name}" (ID: ${item.id})`);
    await sleep(RATE_LIMIT_MS);

    try {
      const meet = await scrapeMeetPage(item.id, {
        name: item.name,
        season: item.season,
      });
      if (meet) {
        meets.push(meet);
        console.log(`[rtn] Found ${meet.results.length} results`);
      }
    } catch (err) {
      console.error(`[rtn] Error on meet ${item.id}:`, err);
    }
  }

  return meets;
}
