import Link from "next/link";
import { globalSearch } from "@/lib/queries/search";
import { SearchBar } from "@/components/search/search-bar";
import { levelLabel, levelColor } from "@/lib/utils";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  return { title: sp.q ? `Search: ${sp.q}` : "Search" };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const results = q.length >= 2 ? await globalSearch(q, 20) : null;

  const totalResults = (results?.gymnasts.length ?? 0) + (results?.meets.length ?? 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <SearchBar initialQuery={q} />
      </div>

      {q.length >= 2 ? (
        <>
          <p className="mb-6 text-sm text-gray-500">
            {totalResults} result{totalResults !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
          </p>

          {results?.gymnasts && results.gymnasts.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-base font-semibold text-gray-700">Gymnasts</h2>
              <div className="space-y-1">
                {results.gymnasts.map((g) => (
                  <Link
                    key={g.id}
                    href={`/gymnasts/${g.id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span className="font-medium text-gray-900">{g.canonical_name}</span>
                    {g.state && <span className="text-sm text-gray-400">{g.state}</span>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results?.meets && results.meets.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-base font-semibold text-gray-700">Meets</h2>
              <div className="space-y-1">
                {results.meets.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meets/${m.id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span className="font-medium text-gray-900">{m.name}</span>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${levelColor(m.level)}`}
                      >
                        {levelLabel(m.level)}
                      </span>
                      <span>{m.season}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {totalResults === 0 && (
            <div className="py-12 text-center text-gray-400">
              No results found for &ldquo;{q}&rdquo;.
            </div>
          )}
        </>
      ) : (
        <div className="py-12 text-center text-gray-400">
          Enter a gymnast name or meet to search.
        </div>
      )}
    </div>
  );
}
