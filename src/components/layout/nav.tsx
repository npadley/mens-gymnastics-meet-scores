import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900">
          <span className="text-xl">🤸</span>
          <span>MAG Scores</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-gray-600">
          <Link href="/gymnasts" className="hover:text-gray-900">
            Gymnasts
          </Link>
          <Link href="/meets" className="hover:text-gray-900">
            Meets
          </Link>
          <Link href="/search" className="hover:text-gray-900">
            Search
          </Link>
        </nav>
      </div>
    </header>
  );
}
