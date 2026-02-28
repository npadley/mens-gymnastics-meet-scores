import Link from "next/link";
import { listGymnasts } from "@/lib/queries/gymnasts";

export const metadata = { title: "Browse Gymnasts" };

export default async function GymnastsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q;
  const state = sp.state;
  const page = Math.max(1, parseInt(sp.page ?? "1"));

  const gymnasts = await listGymnasts({ q, state, page, limit: 40 });

  // Normalize to consistent shape
  const rows = gymnasts.map((g: Record<string, unknown>) => ({
    id: (g.id ?? g.id) as string,
    canonicalName: (g.canonicalName ?? g.canonical_name) as string,
    state: (g.state ?? null) as string | null,
    isVerified: (g.isVerified ?? g.is_verified ?? false) as boolean,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Gymnasts</h1>
        <form className="mt-4 flex gap-2" method="get" action="/gymnasts">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name…"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-400">
          <p>No gymnasts found{q ? ` for "${q}"` : ""}.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((gymnast) => (
            <Link
              key={gymnast.id}
              href={`/gymnasts/${gymnast.id}`}
              className="group flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 transition hover:border-blue-300 hover:shadow-sm"
            >
              <div>
                <span className="font-medium text-gray-900 group-hover:text-blue-700">
                  {gymnast.canonicalName}
                </span>
                {gymnast.isVerified && (
                  <span className="ml-2 text-xs text-blue-500">✓</span>
                )}
              </div>
              {gymnast.state && (
                <span className="text-sm text-gray-400">{gymnast.state}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {rows.length === 40 && (
        <div className="mt-8 flex justify-center gap-3">
          {page > 1 && (
            <Link
              href={`/gymnasts?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
            >
              ← Previous
            </Link>
          )}
          <Link
            href={`/gymnasts?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
