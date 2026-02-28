import { db } from "@/lib/db";
import { meets, results, gymnasts, programs } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function getMeet(id: string) {
  return db.query.meets.findFirst({
    where: eq(meets.id, id),
  });
}

export async function getMeetWithResults(id: string) {
  const meet = await db.query.meets.findFirst({
    where: eq(meets.id, id),
  });

  if (!meet) return null;

  const meetResults = await db
    .select({
      resultId: results.id,
      gymnastId: results.gymnastId,
      canonicalName: gymnasts.canonicalName,
      apparatus: results.apparatus,
      dScore: results.dScore,
      eScore: results.eScore,
      penalty: results.penalty,
      finalScore: results.finalScore,
      place: results.place,
      round: results.round,
      programName: programs.name,
    })
    .from(results)
    .innerJoin(gymnasts, eq(results.gymnastId, gymnasts.id))
    .leftJoin(programs, eq(results.programId, programs.id))
    .where(eq(results.meetId, id))
    .orderBy(results.apparatus, results.place);

  // Group by gymnast → apparatus scores
  const gymnastMap = new Map<
    string,
    {
      gymnastId: string;
      canonicalName: string;
      programName: string | null;
      place: number | null;
      scores: Record<
        string,
        {
          dScore: string | null;
          eScore: string | null;
          finalScore: string;
          place: number | null;
        }
      >;
    }
  >();

  for (const row of meetResults) {
    if (!gymnastMap.has(row.gymnastId)) {
      gymnastMap.set(row.gymnastId, {
        gymnastId: row.gymnastId,
        canonicalName: row.canonicalName,
        programName: row.programName ?? null,
        place: null,
        scores: {},
      });
    }
    const entry = gymnastMap.get(row.gymnastId)!;
    entry.scores[row.apparatus] = {
      dScore: row.dScore,
      eScore: row.eScore,
      finalScore: row.finalScore,
      place: row.place,
    };
    // Use AA place as the gymnast's overall place
    if (row.apparatus === "AA" && row.place !== null) {
      entry.place = row.place;
    }
  }

  const scoreboard = Array.from(gymnastMap.values()).sort(
    (a, b) => (a.place ?? 9999) - (b.place ?? 9999)
  );

  return { meet, scoreboard };
}

export async function listMeets(opts: {
  level?: string;
  season?: number;
  source?: string;
  page?: number;
  limit?: number;
}) {
  const { level, season, source, page = 1, limit = 20 } = opts;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (level) conditions.push(eq(meets.level, level as never));
  if (season) conditions.push(eq(meets.season, season));
  if (source) conditions.push(eq(meets.source, source as never));

  const rows = await db
    .select({
      id: meets.id,
      name: meets.name,
      level: meets.level,
      startDate: meets.startDate,
      location: meets.location,
      season: meets.season,
      source: meets.source,
    })
    .from(meets)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(meets.startDate))
    .limit(limit)
    .offset(offset);

  return rows;
}
