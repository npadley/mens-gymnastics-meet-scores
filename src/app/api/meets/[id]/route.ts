import { NextRequest, NextResponse } from "next/server";
import { getMeetWithResults } from "@/lib/queries/meets";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await getMeetWithResults(id);
    if (!data) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[meets/id]", err);
    return NextResponse.json({ error: "Failed to fetch meet" }, { status: 500 });
  }
}
