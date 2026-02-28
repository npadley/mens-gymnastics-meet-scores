import { nanoid } from "nanoid";
import { db } from "../lib/db.js";
import { normalizeName, toCanonicalName } from "../lib/identity/normalize.js";
import { computeMatchConfidence, THRESHOLDS } from "../lib/identity/fuzzy-match.js";
import { sql } from "drizzle-orm";

export interface RawResult {
  rawName: string;
  rawProgram?: string;
  apparatus: string; // 'FX'|'PH'|'SR'|'VT'|'PB'|'HB'|'AA'
  finalScore: number;
  dScore?: number | null;
  eScore?: number | null;
  penalty?: number | null;
  place?: number | null;
  round?: string;
}

export interface RawMeet {
  name: string;
  level: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  season: number;
  source: string;
  sourceUrl?: string;
  sourceId?: string;
  results: RawResult[];
}

interface IngestSummary {
  meetId: string;
  inserted: number;
  skipped: number;
  newGymnasts: number;
  pendingDuplicates: number;
}

/**
 * Core ingestion pipeline. Idempotent — safe to re-run on the same source data.
 */
export async function ingestMeet(raw: RawMeet): Promise<IngestSummary> {
  let inserted = 0, skipped = 0, newGymnasts = 0, pendingDuplicates = 0;

  // ── 1. Upsert the meet ───────────────────────────────────────────────────
  const existingMeet = raw.sourceId
    ? await db.execute(
        sql`SELECT id FROM meets WHERE source = ${raw.source} AND source_id = ${raw.sourceId} LIMIT 1`
      )
    : { rows: [] };

  let meetId: string;
  if (existingMeet.rows.length > 0) {
    meetId = (existingMeet.rows[0] as { id: string }).id;
  } else {
    meetId = `meet_${nanoid(10)}`;
    await db.execute(sql`
      INSERT INTO meets (id, name, level, start_date, end_date, location, season, source, source_url, source_id)
      VALUES (
        ${meetId}, ${raw.name}, ${raw.level}, ${raw.startDate.toISOString()},
        ${raw.endDate?.toISOString() ?? null}, ${raw.location ?? null},
        ${raw.season}, ${raw.source}, ${raw.sourceUrl ?? null}, ${raw.sourceId ?? null}
      )
      ON CONFLICT DO NOTHING
    `);
  }

  // ── 2. Load all existing gymnasts for fuzzy matching ────────────────────
  const allGymnasts = await db.execute(
    sql`SELECT id, normalized_name FROM gymnasts WHERE merged_into_id IS NULL`
  ) as { rows: { id: string; normalized_name: string }[] };

  // ── 3. Process each result row ────────────────────────────────────────────
  for (const row of raw.results) {
    const normalized = normalizeName(row.rawName);
    if (!normalized) continue;

    // ── 3a. Find or create gymnast ──────────────────────────────────────
    // First: check exact name variant match
    const exactVariant = await db.execute(
      sql`SELECT gymnast_id FROM gymnast_name_variants WHERE raw_name = ${row.rawName} AND source = ${raw.source} LIMIT 1`
    ) as { rows: { gymnast_id: string }[] };

    let gymnastId: string;

    if (exactVariant.rows.length > 0) {
      gymnastId = exactVariant.rows[0].gymnast_id;
    } else {
      // Fuzzy match against all known gymnasts
      let bestMatch: { id: string; confidence: number; reason: string } | null = null;

      for (const existing of allGymnasts.rows) {
        const match = computeMatchConfidence(normalized, existing.normalized_name);
        if (
          match.confidence > (bestMatch?.confidence ?? 0) &&
          match.confidence >= THRESHOLDS.REVIEW_QUEUE
        ) {
          bestMatch = { id: existing.id, confidence: match.confidence, reason: match.reason };
        }
      }

      if (bestMatch && bestMatch.confidence >= THRESHOLDS.AUTO_ASSOCIATE) {
        // High confidence: auto-associate
        gymnastId = bestMatch.id;
        await db.execute(sql`
          INSERT INTO gymnast_name_variants (id, gymnast_id, raw_name, source)
          VALUES (${nanoid(10)}, ${gymnastId}, ${row.rawName}, ${raw.source})
          ON CONFLICT DO NOTHING
        `);
      } else if (bestMatch && bestMatch.confidence >= THRESHOLDS.REVIEW_QUEUE) {
        // Medium confidence: create new gymnast but queue for admin review
        gymnastId = `gst_${nanoid(10)}`;
        const canonical = toCanonicalName(row.rawName);
        await db.execute(sql`
          INSERT INTO gymnasts (id, canonical_name, normalized_name)
          VALUES (${gymnastId}, ${canonical}, ${normalized})
          ON CONFLICT DO NOTHING
        `);
        await db.execute(sql`
          INSERT INTO gymnast_name_variants (id, gymnast_id, raw_name, source)
          VALUES (${nanoid(10)}, ${gymnastId}, ${row.rawName}, ${raw.source})
          ON CONFLICT DO NOTHING
        `);
        // Queue duplicate pair (ordered by id to prevent duplicate pairs in reverse order)
        const [idA, idB] = [bestMatch.id, gymnastId].sort();
        await db.execute(sql`
          INSERT INTO pending_duplicates (id, gymnast_a_id, gymnast_b_id, confidence, match_reason)
          VALUES (${nanoid(10)}, ${idA}, ${idB}, ${bestMatch.confidence.toFixed(3)}, ${bestMatch.reason})
          ON CONFLICT (gymnast_a_id, gymnast_b_id) DO NOTHING
        `);
        pendingDuplicates++;
        newGymnasts++;
        allGymnasts.rows.push({ id: gymnastId, normalized_name: normalized });
      } else {
        // Low confidence: definitely new gymnast
        gymnastId = `gst_${nanoid(10)}`;
        const canonical = toCanonicalName(row.rawName);
        await db.execute(sql`
          INSERT INTO gymnasts (id, canonical_name, normalized_name)
          VALUES (${gymnastId}, ${canonical}, ${normalized})
          ON CONFLICT DO NOTHING
        `);
        await db.execute(sql`
          INSERT INTO gymnast_name_variants (id, gymnast_id, raw_name, source)
          VALUES (${nanoid(10)}, ${gymnastId}, ${row.rawName}, ${raw.source})
          ON CONFLICT DO NOTHING
        `);
        newGymnasts++;
        allGymnasts.rows.push({ id: gymnastId, normalized_name: normalized });
      }
    }

    // ── 3b. Upsert program ──────────────────────────────────────────────
    let programId: string | null = null;
    if (row.rawProgram?.trim()) {
      const existingProgram = await db.execute(
        sql`SELECT id FROM programs WHERE name = ${row.rawProgram.trim()} LIMIT 1`
      ) as { rows: { id: string }[] };

      if (existingProgram.rows.length > 0) {
        programId = existingProgram.rows[0].id;
      } else {
        programId = `prg_${nanoid(10)}`;
        await db.execute(sql`
          INSERT INTO programs (id, name, type)
          VALUES (${programId}, ${row.rawProgram.trim()}, 'club')
          ON CONFLICT DO NOTHING
        `);
      }
    }

    // ── 3c. Upsert result (idempotent on unique constraint) ─────────────
    const round = row.round ?? "finals";
    const existing = await db.execute(
      sql`SELECT id FROM results WHERE meet_id = ${meetId} AND gymnast_id = ${gymnastId} AND apparatus = ${row.apparatus} AND round = ${round} LIMIT 1`
    ) as { rows: unknown[] };

    if (existing.rows.length > 0) {
      skipped++;
    } else {
      await db.execute(sql`
        INSERT INTO results (id, meet_id, gymnast_id, program_id, apparatus, d_score, e_score, penalty, final_score, place, round)
        VALUES (
          ${`res_${nanoid(10)}`}, ${meetId}, ${gymnastId}, ${programId},
          ${row.apparatus}, ${row.dScore ?? null}, ${row.eScore ?? null},
          ${row.penalty ?? 0}, ${row.finalScore.toString()},
          ${row.place ?? null}, ${round}
        )
      `);
      inserted++;
    }
  }

  return { meetId, inserted, skipped, newGymnasts, pendingDuplicates };
}
