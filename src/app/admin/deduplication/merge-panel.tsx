"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PairRow {
  id: string;
  confidence: string;
  match_reason: string;
  a_id: string;
  a_name: string;
  a_state: string | null;
  b_id: string;
  b_name: string;
  b_state: string | null;
  a_result_count: string;
  b_result_count: string;
}

export function MergePanel({ pair }: { pair: PairRow }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function act(action: "merge" | "reject", keepId?: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/deduplication", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${prompt("Admin secret:")}`,
        },
        body: JSON.stringify({
          action,
          duplicateId: pair.id,
          keepGymnastId: keepId,
        }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        alert("Action failed. Check the console.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) return null;

  const confidence = parseFloat(pair.confidence);
  const confidencePct = Math.round(confidence * 100);
  const confidenceColor =
    confidence >= 0.9
      ? "text-green-700 bg-green-50"
      : confidence >= 0.8
      ? "text-yellow-700 bg-yellow-50"
      : "text-orange-700 bg-orange-50";

  return (
    <div
      className={`rounded-lg border border-gray-200 p-4 transition ${loading ? "opacity-50" : ""}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${confidenceColor}`}
        >
          {confidencePct}% confidence
        </span>
        <span className="text-xs text-gray-400">{pair.match_reason}</span>
      </div>

      {/* Side-by-side cards */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { id: pair.a_id, name: pair.a_name, state: pair.a_state, count: pair.a_result_count },
          { id: pair.b_id, name: pair.b_name, state: pair.b_state, count: pair.b_result_count },
        ].map((g, idx) => (
          <div key={g.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{g.name}</p>
                {g.state && (
                  <p className="text-xs text-gray-400">{g.state}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {g.count} results
                </p>
              </div>
              <a
                href={`/gymnasts/${g.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline"
              >
                View →
              </a>
            </div>
            <button
              onClick={() => act("merge", g.id)}
              disabled={loading}
              className="mt-3 w-full rounded-md bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Keep {idx === 0 ? "A" : "B"} (merge other into this)
            </button>
          </div>
        ))}
      </div>

      {/* Reject */}
      <div className="mt-3 text-center">
        <button
          onClick={() => act("reject")}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
        >
          Not a duplicate — dismiss
        </button>
      </div>
    </div>
  );
}
