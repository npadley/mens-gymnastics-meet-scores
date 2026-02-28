import { NextRequest, NextResponse } from "next/server";
import { listGymnasts } from "@/lib/queries/gymnasts";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const level = searchParams.get("level") ?? undefined;
  const state = searchParams.get("state") ?? undefined;
  const season = searchParams.get("season")
    ? parseInt(searchParams.get("season")!)
    : undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

  try {
    const data = await listGymnasts({ q, level, state, season, page, limit });
    return NextResponse.json({ data, page, limit });
  } catch (err) {
    console.error("[gymnasts]", err);
    return NextResponse.json({ error: "Failed to fetch gymnasts" }, { status: 500 });
  }
}
