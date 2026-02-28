import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import Link from "next/link";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboard() {
  const [gymnastsCount, meetsCount, resultsCount, pendingDupes] =
    await Promise.all([
      db.execute(sql`SELECT COUNT(*) FROM gymnasts WHERE merged_into_id IS NULL`),
      db.execute(sql`SELECT COUNT(*) FROM meets`),
      db.execute(sql`SELECT COUNT(*) FROM results`),
      db.execute(
        sql`SELECT COUNT(*) FROM pending_duplicates WHERE status = 'pending'`
      ),
    ]);

  const stats = [
    {
      label: "Gymnasts",
      value: (gymnastsCount.rows[0] as { count: string }).count,
      href: "/gymnasts",
    },
    {
      label: "Meets",
      value: (meetsCount.rows[0] as { count: string }).count,
      href: "/meets",
    },
    {
      label: "Results",
      value: (resultsCount.rows[0] as { count: string }).count,
      href: null,
    },
    {
      label: "Pending Duplicates",
      value: (pendingDupes.rows[0] as { count: string }).count,
      href: "/admin/deduplication",
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-gray-200 p-4"
          >
            <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
            <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
            {stat.href && (
              <Link
                href={stat.href}
                className="mt-2 block text-xs text-blue-600 hover:underline"
              >
                View →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/deduplication"
          className="rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm"
        >
          <h2 className="font-semibold text-gray-900">Deduplication Queue</h2>
          <p className="mt-1 text-sm text-gray-500">
            Review and resolve gymnast identity conflicts flagged by the
            fuzzy-matching pipeline.
          </p>
        </Link>
        <Link
          href="/admin/scrape-logs"
          className="rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm"
        >
          <h2 className="font-semibold text-gray-900">Scrape Logs</h2>
          <p className="mt-1 text-sm text-gray-500">
            View recent scraper runs, success/error rates, and records
            inserted.
          </p>
        </Link>
      </div>
    </div>
  );
}
