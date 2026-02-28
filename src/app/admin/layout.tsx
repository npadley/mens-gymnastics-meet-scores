import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Simple cookie-based auth check
  const hdrs = await headers();
  const cookie = hdrs.get("cookie") ?? "";
  const isAuthed = cookie.includes("admin_authed=1");

  if (!isAuthed) {
    redirect("/admin/login");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4 border-b border-gray-200 pb-4">
        <span className="font-semibold text-gray-800">Admin</span>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-800">
          Dashboard
        </a>
        <a
          href="/admin/deduplication"
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Deduplication
        </a>
        <a
          href="/admin/scrape-logs"
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Scrape Logs
        </a>
      </div>
      {children}
    </div>
  );
}
