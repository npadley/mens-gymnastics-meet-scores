import { notFound } from "next/navigation";
import Link from "next/link";
import { getGymnastWithResults } from "@/lib/queries/gymnasts";
import { formatScore, formatDate, levelLabel, levelColor, APPARATUS, APPARATUS_LABELS } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getGymnastWithResults(id);
  if (!data) return { title: "Gymnast Not Found" };
  return { title: data.gymnast.canonicalName };
}

export default async function GymnastPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getGymnastWithResults(id);
  if (!data) notFound();

  const { gymnast, seasons } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href="/gymnasts" className="text-sm text-gray-400 hover:text-gray-600">
          ← Gymnasts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {gymnast.canonicalName}
          </h1>
          {gymnast.isVerified && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Verified
            </span>
          )}
        </div>
        {gymnast.state && (
          <p className="mt-0.5 text-sm text-gray-500">{gymnast.state}</p>
        )}
      </div>

      {/* Seasons */}
      {seasons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-400">
          No results found for this gymnast.
        </div>
      ) : (
        <div className="space-y-10">
          {seasons.map((season) => (
            <section key={season.year}>
              <h2 className="mb-4 text-lg font-semibold text-gray-800">
                {season.year} Season
              </h2>
              <div className="space-y-3">
                {season.meets.map((meet) => (
                  <div key={meet.meetId} className="overflow-hidden rounded-lg border border-gray-200">
                    {/* Meet header */}
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/meets/${meet.meetId}`}
                          className="font-medium text-gray-900 hover:text-blue-700"
                        >
                          {meet.meetName}
                        </Link>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${levelColor(meet.meetLevel)}`}
                        >
                          {levelLabel(meet.meetLevel)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        {meet.programName && <span>{meet.programName}</span>}
                        {meet.meetDate && <span>{formatDate(meet.meetDate)}</span>}
                      </div>
                    </div>

                    {/* Scores row */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {APPARATUS.map((ap) => (
                              <th
                                key={ap}
                                className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400"
                              >
                                {APPARATUS_LABELS[ap]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {APPARATUS.map((ap) => {
                              const score = meet.scores[ap];
                              return (
                                <td key={ap} className="px-3 py-3 text-center tabular-nums">
                                  {score ? (
                                    <div>
                                      <div className={`font-semibold ${ap === "AA" ? "text-base text-gray-900" : "text-gray-800"}`}>
                                        {formatScore(score.finalScore)}
                                      </div>
                                      {score.place !== null && (
                                        <div className="text-xs text-gray-400">
                                          #{score.place}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
