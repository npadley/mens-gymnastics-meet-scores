import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { MergePanel } from "./merge-panel";

export const metadata = { title: "Deduplication Queue" };

export default async function DeduplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const pairs = await db.execute(sql`
    SELECT
      pd.id,
      pd.confidence,
      pd.match_reason,
      pd.created_at,
      ga.id AS a_id,
      ga.canonical_name AS a_name,
      ga.state AS a_state,
      gb.id AS b_id,
      gb.canonical_name AS b_name,
      gb.state AS b_state,
      (SELECT COUNT(*) FROM results WHERE gymnast_id = ga.id) AS a_result_count,
      (SELECT COUNT(*) FROM results WHERE gymnast_id = gb.id) AS b_result_count
    FROM pending_duplicates pd
    JOIN gymnasts ga ON ga.id = pd.gymnast_a_id
    JOIN gymnasts gb ON gb.id = pd.gymnast_b_id
    WHERE pd.status = 'pending'
    ORDER BY pd.confidence DESC
    LIMIT ${limit} OFFSET ${offset}
  `) as {
    rows: Array<{
      id: string;
      confidence: string;
      match_reason: string;
      created_at: string;
      a_id: string;
      a_name: string;
      a_state: string | null;
      b_id: string;
      b_name: string;
      b_state: string | null;
      a_result_count: string;
      b_result_count: string;
    }>;
  };

  const totalCount = (await db.execute(
    sql`SELECT COUNT(*) FROM pending_duplicates WHERE status = 'pending'`
  )) as unknown as { rows: [{ count: string }] };
  const total = parseInt(totalCount.rows[0].count);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Deduplication Queue
        </h1>
        <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
          {total} pending
        </span>
      </div>

      {pairs.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-400">
          No pending duplicates — the queue is clear!
        </div>
      ) : (
        <div className="space-y-4">
          {pairs.rows.map((pair) => (
            <MergePanel key={pair.id} pair={pair} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="mt-6 flex justify-center gap-3">
          {page > 1 && (
            <a
              href={`/admin/deduplication?page=${page - 1}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
            >
              ← Previous
            </a>
          )}
          {offset + limit < total && (
            <a
              href={`/admin/deduplication?page=${page + 1}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
