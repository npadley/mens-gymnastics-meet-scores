import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Scrape Logs" };

export default async function ScrapeLogsPage() {
  const logs = await db.execute(sql`
    SELECT id, source, target_url, target_id, status,
           records_found, records_inserted, error_message,
           started_at, completed_at
    FROM scrape_logs
    ORDER BY started_at DESC
    LIMIT 100
  `) as {
    rows: Array<{
      id: string;
      source: string;
      target_url: string | null;
      target_id: string | null;
      status: string;
      records_found: number;
      records_inserted: number;
      error_message: string | null;
      started_at: string;
      completed_at: string | null;
    }>;
  };

  const statusColor: Record<string, string> = {
    success: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
    partial: "bg-yellow-100 text-yellow-800",
    skipped: "bg-gray-100 text-gray-600",
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Scrape Logs</h1>

      {logs.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-400">
          No scrape runs yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Target</th>
                <th className="pb-2 pr-4 text-right">Found</th>
                <th className="pb-2 pr-4 text-right">Inserted</th>
                <th className="pb-2">Started</th>
              </tr>
            </thead>
            <tbody>
              {logs.rows.map((log) => (
                <tr key={log.id} className="border-b border-gray-100">
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-700">
                    {log.source}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[log.status] ?? "bg-gray-100"}`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 max-w-xs truncate text-xs text-gray-500">
                    {log.target_id ?? log.target_url ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {log.records_found ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-green-700">
                    {log.records_inserted ?? "—"}
                  </td>
                  <td className="py-2.5 text-gray-400 text-xs">
                    {formatDate(log.started_at)}
                    {log.error_message && (
                      <span
                        className="ml-2 text-red-500"
                        title={log.error_message}
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
