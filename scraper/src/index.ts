/**
 * MAG Scores Scraper — CLI entrypoint
 *
 * Usage:
 *   pnpm scrape                          # Run all sources
 *   pnpm scrape:gymternet                # Gymternet only
 *   pnpm scrape:usag                     # USAG PDFs only
 *   pnpm scrape:ncaa                     # Road to Nationals only
 *   tsx src/index.ts --source=gymternet  # Direct invocation
 *   tsx src/index.ts --dry-run           # Dry run (no DB writes)
 */

import { runScrapers } from "./pipeline/runner.js";

const args = process.argv.slice(2);

const sourceArg = args.find((a) => a.startsWith("--source="))?.split("=")[1];
const isDryRun = args.includes("--dry-run");

const validSources = ["gymternet", "usag_pdf", "road_to_nationals", "all"] as const;
type Source = typeof validSources[number];

function isValidSource(s?: string): s is Source {
  return !s || validSources.includes(s as Source);
}

if (sourceArg && !isValidSource(sourceArg)) {
  console.error(`Invalid source: ${sourceArg}`);
  console.error(`Valid sources: ${validSources.join(", ")}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

runScrapers({
  source: (sourceArg as Source) ?? "all",
  dryRun: isDryRun,
})
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
