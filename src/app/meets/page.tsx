import Link from "next/link";
import { listMeets } from "@/lib/queries/meets";
import { levelLabel, levelColor, formatDate } from "@/lib/utils";

export const metadata = { title: "Browse Meets" };

const COMPETITION_LEVELS = [
  { value: "", label: "All Levels" },
  { value: "elite", label: "Elite" },
  { value: "junior_elite", label: "Junior Elite" },
  { value: "level_10", label: "Level 10" },
  { value: "level_9", label: "Level 9" },
  { value: "level_8", label: "Level 8" },
  { value: "level_7", label: "Level 7" },
  { value: "level_6", label: "Level 6" },
  { value: "ncaa", label: "NCAA" },
  { value: "gymact", label: "GymACT" },
];

export default async function MeetsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; season?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const level = sp.level;
  const season = sp.season ? parseInt(sp.season) : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1"));

  const meets = await listMeets({ level, season, page, limit: 24 });

  // Group by season for display
  const byYear = new Map<number, typeof meets>();
  for (const meet of meets) {
    if (!byYear.has(meet.season)) byYear.set(meet.season, []);
    byYear.get(meet.season)!.push(meet);
  }
  const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Meets</h1>

        {/* Level filter */}
        <div className="flex gap-2 flex-wrap">
          {COMPETITION_LEVELS.map((lvl) => (
            <Link
              key={lvl.value}
              href={lvl.value ? `/meets?level=${lvl.value}` : "/meets"}
              className={`rounded-full px-3 py-1 text-sm transition ${
                level === (lvl.value || undefined)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {lvl.label}
            </Link>
          ))}
        </div>
      </div>

      {meets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-400">
          <p>No meets found{level ? ` for level: ${levelLabel(level)}` : ""}.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {sortedYears.map((year) => (
            <section key={year}>
              <h2 className="mb-3 text-lg font-semibold text-gray-700">
                {year} Season
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {byYear.get(year)!.map((meet) => (
                  <Link
                    key={meet.id}
                    href={`/meets/${meet.id}`}
                    className="group rounded-lg border border-gray-200 p-4 transition hover:border-blue-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-gray-900 group-hover:text-blue-700 leading-tight">
                        {meet.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${levelColor(meet.level)}`}
                      >
                        {levelLabel(meet.level)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-sm text-gray-500">
                      {formatDate(meet.startDate)}
                      {meet.location && <span className="block text-xs text-gray-400">{meet.location}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meets.length === 24 && (
        <div className="mt-8 flex justify-center gap-3">
          {page > 1 && (
            <Link
              href={`/meets?page=${page - 1}${level ? `&level=${level}` : ""}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
            >
              ← Previous
            </Link>
          )}
          <Link
            href={`/meets?page=${page + 1}${level ? `&level=${level}` : ""}`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
