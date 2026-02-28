import { NextRequest, NextResponse } from "next/server";
import { listMeets } from "@/lib/queries/meets";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") ?? undefined;
  const season = searchParams.get("season")
    ? parseInt(searchParams.get("season")!)
    : undefined;
  const source = searchParams.get("source") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

  try {
    const data = await listMeets({ level, season, source, page, limit });
    return NextResponse.json({ data, page, limit });
  } catch (err) {
    console.error("[meets]", err);
    return NextResponse.json({ error: "Failed to fetch meets" }, { status: 500 });
  }
}
