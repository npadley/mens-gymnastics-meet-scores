import { db } from "@/lib/db";
import {
  gymnasts,
  results,
  meets,
  programs,
  gymnastPrograms,
} from "@/lib/db/schema";
import { eq, desc, and, sql, inArray, isNull } from "drizzle-orm";

export async function getGymnast(id: string) {
  const gymnast = await db.query.gymnasts.findFirst({
    where: and(eq(gymnasts.id, id), isNull(gymnasts.mergedIntoId)),
    with: {
      nameVariants: true,
    },
  });
  return gymnast ?? null;
}

export async function getGymnastWithResults(id: string) {
  const gymnast = await db.query.gymnasts.findFirst({
    where: and(eq(gymnasts.id, id), isNull(gymnasts.mergedIntoId)),
    with: {
      nameVariants: true,
      programs: {
        with: { program: true },
        orderBy: (gp, { desc }) => [desc(gp.season)],
      },
    },
  });

  if (!gymnast) return null;

  // Fetch all results with meet info, ordered by meet date descending
  const athleteResults = await db
    .select({
      resultId: results.id,
      meetId: results.meetId,
      meetName: meets.name,
      meetLevel: meets.level,
      meetSeason: meets.season,
      meetDate: meets.startDate,
      meetLocation: meets.location,
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
    .innerJoin(meets, eq(results.meetId, meets.id))
    .leftJoin(programs, eq(results.programId, programs.id))
    .where(eq(results.gymnastId, id))
    .orderBy(desc(meets.startDate), results.apparatus);

  // Group results by season → meet
  const seasonMap = new Map<
    number,
    Map<
      string,
      {
        meetId: string;
        meetName: string;
        meetLevel: string;
        meetDate: Date | null;
        meetLocation: string | null;
        programName: string | null;
        scores: Record<
          string,
          {
            dScore: string | null;
            eScore: string | null;
            finalScore: string;
            place: number | null;
            round: string;
          }
        >;
      }
    >
  >();

  for (const row of athleteResults) {
    if (!seasonMap.has(row.meetSeason)) {
      seasonMap.set(row.meetSeason, new Map());
    }
    const meetMap = seasonMap.get(row.meetSeason)!;

    if (!meetMap.has(row.meetId)) {
      meetMap.set(row.meetId, {
        meetId: row.meetId,
        meetName: row.meetName,
        meetLevel: row.meetLevel,
        meetDate: row.meetDate,
        meetLocation: row.meetLocation,
        programName: row.programName ?? null,
        scores: {},
      });
    }

    const meetEntry = meetMap.get(row.meetId)!;
    meetEntry.scores[row.apparatus] = {
      dScore: row.dScore,
      eScore: row.eScore,
      finalScore: row.finalScore,
      place: row.place,
      round: row.round,
    };
  }

  const seasons = Array.from(seasonMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, meetMap]) => ({
      year,
      meets: Array.from(meetMap.values()).sort((a, b) => {
        const dateA = a.meetDate ? new Date(a.meetDate).getTime() : 0;
        const dateB = b.meetDate ? new Date(b.meetDate).getTime() : 0;
        return dateB - dateA;
      }),
    }));

  return { gymnast, seasons };
}

export async function listGymnasts(opts: {
  q?: string;
  level?: string;
  state?: string;
  season?: number;
  page?: number;
  limit?: number;
}) {
  const { q, level, state, season, page = 1, limit = 20 } = opts;
  const offset = (page - 1) * limit;

  // Build base query conditions
  const conditions = [isNull(gymnasts.mergedIntoId)];

  if (state) {
    conditions.push(eq(gymnasts.state, state));
  }

  const baseQuery = db
    .select({
      id: gymnasts.id,
      canonicalName: gymnasts.canonicalName,
      state: gymnasts.state,
      isVerified: gymnasts.isVerified,
    })
    .from(gymnasts)
    .where(and(...conditions))
    .orderBy(gymnasts.canonicalName)
    .limit(limit)
    .offset(offset);

  // Use FTS when search query present
  if (q && q.length >= 2) {
    const rows = await db.execute(
      sql`
        SELECT id, canonical_name, state, is_verified
        FROM gymnasts
        WHERE merged_into_id IS NULL
          AND search_vector @@ plainto_tsquery('english', ${q})
        ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${q})) DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    );
    return rows.rows as {
      id: string;
      canonical_name: string;
      state: string | null;
      is_verified: boolean;
    }[];
  }

  return baseQuery;
}
