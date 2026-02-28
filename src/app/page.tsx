import Link from "next/link";
import { listMeets } from "@/lib/queries/meets";
import { SearchBar } from "@/components/search/search-bar";
import { levelLabel, levelColor, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const recentMeets = await listMeets({ page: 1, limit: 6 });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-gray-900">
          US Men&apos;s Gymnastics Scores
        </h1>
        <p className="mx-auto max-w-xl text-lg text-gray-500">
          Search meet results for every level of US men&apos;s artistic gymnastics —
          from Level 6 through Elite and NCAA.
        </p>
      </div>

      {/* Search */}
      <div className="mb-12">
        <SearchBar />
        <div className="mt-3 flex justify-center gap-4 text-sm text-gray-500">
          <Link href="/gymnasts" className="hover:text-blue-600 hover:underline">
            Browse gymnasts →
          </Link>
          <Link href="/meets" className="hover:text-blue-600 hover:underline">
            Browse meets →
          </Link>
        </div>
      </div>

      {/* Recent Meets */}
      {recentMeets.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Recent Meets</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recentMeets.map((meet) => (
              <Link
                key={meet.id}
                href={`/meets/${meet.id}`}
                className="group rounded-lg border border-gray-200 p-4 transition hover:border-blue-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-gray-900 group-hover:text-blue-700">
                    {meet.name}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${levelColor(meet.level)}`}
                  >
                    {levelLabel(meet.level)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {formatDate(meet.startDate)}
                  {meet.location ? ` · ${meet.location}` : ""}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link
              href="/meets"
              className="text-sm text-blue-600 hover:underline"
            >
              View all meets →
            </Link>
          </div>
        </section>
      )}

      {/* Empty state */}
      {recentMeets.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-400">
          <p className="text-lg">No meet data yet.</p>
          <p className="mt-1 text-sm">Run the scrapers to import results.</p>
        </div>
      )}
    </div>
  );
}
