import { notFound } from "next/navigation";
import Link from "next/link";
import { getMeetWithResults } from "@/lib/queries/meets";
import {
  levelLabel,
  levelColor,
  formatScore,
  formatDate,
  APPARATUS,
  APPARATUS_LABELS,
} from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMeetWithResults(id);
  if (!data) return { title: "Meet Not Found" };
  return { title: data.meet.name };
}

export default async function MeetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const activeEvent = (sp.event?.toUpperCase() as (typeof APPARATUS)[number]) ?? "AA";

  const data = await getMeetWithResults(id);
  if (!data) notFound();

  const { meet, scoreboard } = data;

  // Filter scoreboard to the active event
  const eventRows = scoreboard
    .filter((g) => g.scores[activeEvent])
    .sort((a, b) => {
      const scoreA = parseFloat(a.scores[activeEvent]?.finalScore ?? "0");
      const scoreB = parseFloat(b.scores[activeEvent]?.finalScore ?? "0");
      return scoreB - scoreA;
    });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <Link href="/meets" className="text-sm text-gray-400 hover:text-gray-600">
          ← Meets
        </Link>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{meet.name}</h1>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${levelColor(meet.level)}`}
          >
            {levelLabel(meet.level)}
          </span>
        </div>
        <div className="mt-1 text-sm text-gray-500">
          {formatDate(meet.startDate)}
          {meet.endDate && meet.endDate !== meet.startDate
            ? ` – ${formatDate(meet.endDate)}`
            : ""}
          {meet.location ? ` · ${meet.location}` : ""}
        </div>
        {meet.sourceUrl && (
          <a
            href={meet.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-blue-500 hover:underline"
          >
            Source →
          </a>
        )}
      </div>

      {/* Apparatus tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200 pb-0">
        {APPARATUS.map((ap) => (
          <Link
            key={ap}
            href={`/meets/${id}?event=${ap}`}
            className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              activeEvent === ap
                ? "border border-b-white border-gray-200 bg-white text-blue-700"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {APPARATUS_LABELS[ap]}
          </Link>
        ))}
      </div>

      {/* Scoreboard */}
      {eventRows.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          No {APPARATUS_LABELS[activeEvent]} results available for this meet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4 w-10">Pl.</th>
                <th className="pb-2 pr-4">Gymnast</th>
                <th className="pb-2 pr-4">Program</th>
                {activeEvent !== "AA" && (
                  <>
                    <th className="pb-2 pr-3 text-right">D</th>
                    <th className="pb-2 pr-3 text-right">E</th>
                  </>
                )}
                <th className="pb-2 text-right font-bold">
                  {activeEvent === "AA" ? "AA" : "Score"}
                </th>
              </tr>
            </thead>
            <tbody>
              {eventRows.map((row, idx) => {
                const score = row.scores[activeEvent];
                return (
                  <tr
                    key={row.gymnastId}
                    className={`border-b border-gray-100 ${idx % 2 === 0 ? "" : "bg-gray-50/50"}`}
                  >
                    <td className="py-2.5 pr-4 text-gray-400">
                      {score.place ?? idx + 1}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/gymnasts/${row.gymnastId}`}
                        className="font-medium text-gray-900 hover:text-blue-700"
                      >
                        {row.canonicalName}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">
                      {row.programName ?? "—"}
                    </td>
                    {activeEvent !== "AA" && (
                      <>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-gray-400">
                          {formatScore(score.dScore)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-gray-400">
                          {formatScore(score.eScore)}
                        </td>
                      </>
                    )}
                    <td className="py-2.5 text-right font-semibold tabular-nums text-gray-900">
                      {formatScore(score.finalScore)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
