import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function globalSearch(query: string, limit = 5) {
  if (!query || query.trim().length < 2) return { gymnasts: [], meets: [] };

  const q = query.trim();

  const [gymnasts, meets] = await Promise.all([
    db.execute(sql`
      SELECT id, canonical_name, state
      FROM gymnasts
      WHERE merged_into_id IS NULL
        AND search_vector @@ plainto_tsquery('english', ${q})
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${q})) DESC
      LIMIT ${limit}
    `),
    db.execute(sql`
      SELECT id, name, level, season, location
      FROM meets
      WHERE search_vector @@ plainto_tsquery('english', ${q})
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${q})) DESC, start_date DESC
      LIMIT ${limit}
    `),
  ]);

  return {
    gymnasts: gymnasts.rows as {
      id: string;
      canonical_name: string;
      state: string | null;
    }[],
    meets: meets.rows as {
      id: string;
      name: string;
      level: string;
      season: number;
      location: string | null;
    }[],
  };
}
