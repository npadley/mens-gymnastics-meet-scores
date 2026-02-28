import { nanoid } from "nanoid";
import { db } from "../lib/db.js";
import { ingestMeet, type RawMeet } from "./ingest.js";
import { sql } from "drizzle-orm";

type Source = "gymternet" | "usag_pdf" | "road_to_nationals" | "all";

interface RunOptions {
  source?: Source;
  dryRun?: boolean;
}

async function logScrapeStart(source: string, targetUrl?: string, targetId?: string): Promise<string> {
  const id = `log_${nanoid(10)}`;
  await db.execute(sql`
    INSERT INTO scrape_logs (id, source, target_url, target_id, status, started_at)
    VALUES (${id}, ${source}, ${targetUrl ?? null}, ${targetId ?? null}, 'success', NOW())
  `);
  return id;
}

async function logScrapeEnd(
  id: string,
  status: "success" | "error" | "partial" | "skipped",
  stats: { recordsFound?: number; recordsInserted?: number; errorMessage?: string }
) {
  await db.execute(sql`
    UPDATE scrape_logs
    SET status = ${status},
        records_found = ${stats.recordsFound ?? 0},
        records_inserted = ${stats.recordsInserted ?? 0},
        error_message = ${stats.errorMessage ?? null},
        completed_at = NOW()
    WHERE id = ${id}
  `);
}

async function runSource(sourceName: string, meets: RawMeet[], dryRun: boolean) {
  console.log(`\n══ Running source: ${sourceName} (${meets.length} meets) ══`);
  let totalInserted = 0, totalSkipped = 0, totalNewGymnasts = 0;

  for (const meet of meets) {
    const logId = await logScrapeStart(sourceName, meet.sourceUrl, meet.sourceId);
    try {
      if (dryRun) {
        console.log(`  [dry-run] Would ingest "${meet.name}" (${meet.results.length} results)`);
        await logScrapeEnd(logId, "skipped", { recordsFound: meet.results.length });
        continue;
      }

      const summary = await ingestMeet(meet);
      totalInserted += summary.inserted;
      totalSkipped += summary.skipped;
      totalNewGymnasts += summary.newGymnasts;

      console.log(
        `  ✓ "${meet.name}" → inserted: ${summary.inserted}, skipped: ${summary.skipped}, ` +
        `new gymnasts: ${summary.newGymnasts}, pending dupes: ${summary.pendingDuplicates}`
      );

      await logScrapeEnd(logId, "success", {
        recordsFound: meet.results.length,
        recordsInserted: summary.inserted,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ "${meet.name}" failed: ${message}`);
      await logScrapeEnd(logId, "error", {
        recordsFound: meet.results.length,
        errorMessage: message,
      });
    }
  }

  console.log(`  Total: ${totalInserted} inserted, ${totalSkipped} skipped, ${totalNewGymnasts} new gymnasts`);
}

export async function runScrapers(opts: RunOptions = {}) {
  const { source = "all", dryRun = false } = opts;

  console.log(`Starting scraper run | source=${source} | dryRun=${dryRun}`);
  console.log(`Time: ${new Date().toISOString()}`);

  if (source === "gymternet" || source === "all") {
    const { scrapeGymternet } = await import("../sources/gymternet.js");
    const meets = await scrapeGymternet();
    await runSource("gymternet", meets, dryRun);
  }

  if (source === "usag_pdf" || source === "all") {
    const { scrapeUsagPdfs } = await import("../sources/usag-pdf.js");
    const meets = await scrapeUsagPdfs();
    await runSource("usag_pdf", meets, dryRun);
  }

  if (source === "road_to_nationals" || source === "all") {
    // Only run NCAA scraper if playwright is available
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await import("playwright" as any);
      const { scrapeRoadToNationals } = await import("../sources/road-to-nationals.js");
      const meets = await scrapeRoadToNationals({ maxMeets: 15 });
      await runSource("road_to_nationals", meets, dryRun);
    } catch {
      console.warn("[runner] Playwright not installed — skipping Road to Nationals. Run: pnpm exec playwright install chromium");
    }
  }

  console.log("\n✓ Scraper run complete");
}
