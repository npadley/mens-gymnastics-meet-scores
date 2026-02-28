import { NextRequest, NextResponse } from "next/server";
import { globalSearch } from "@/lib/queries/search";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "5"), 10);

  if (q.trim().length < 2) {
    return NextResponse.json({ gymnasts: [], meets: [], query: q });
  }

  try {
    const results = await globalSearch(q, limit);
    return NextResponse.json({ ...results, query: q });
  } catch (err) {
    console.error("[search]", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
