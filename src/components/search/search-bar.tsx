"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { levelLabel } from "@/lib/utils";

interface SearchResults {
  gymnasts: { id: string; canonical_name: string; state: string | null }[];
  meets: { id: string; name: string; level: string; season: number }[];
  query: string;
}

export function SearchBar({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}&limit=5`
        );
        const data: SearchResults = await res.json();
        setResults(data);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setOpen(false);
    }
  };

  const hasResults =
    results &&
    (results.gymnasts.length > 0 || results.meets.length > 0);

  return (
    <div ref={containerRef} className="relative mx-auto max-w-xl">
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 2 && results && setOpen(true)}
            placeholder="Search gymnasts, meets, or events…"
            className="w-full rounded-full border border-gray-300 bg-white py-3 pl-5 pr-12 text-base shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700"
            aria-label="Search"
          >
            {loading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {!hasResults && !loading && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {results?.gymnasts && results.gymnasts.length > 0 && (
            <div>
              <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Gymnasts
              </div>
              {results.gymnasts.map((g) => (
                <Link
                  key={g.id}
                  href={`/gymnasts/${g.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50"
                >
                  <span className="font-medium text-gray-900">
                    {g.canonical_name}
                  </span>
                  {g.state && (
                    <span className="text-xs text-gray-400">{g.state}</span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {results?.meets && results.meets.length > 0 && (
            <div>
              <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Meets
              </div>
              {results.meets.map((m) => (
                <Link
                  key={m.id}
                  href={`/meets/${m.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50"
                >
                  <span className="font-medium text-gray-900">{m.name}</span>
                  <span className="text-xs text-gray-400">
                    {levelLabel(m.level)} · {m.season}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {hasResults && (
            <button
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              className="w-full border-t border-gray-100 px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50"
            >
              See all results for &ldquo;{query}&rdquo; →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
