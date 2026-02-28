import { NextRequest, NextResponse } from "next/server";
import { getGymnastWithResults } from "@/lib/queries/gymnasts";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await getGymnastWithResults(id);
    if (!data) {
      return NextResponse.json({ error: "Gymnast not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[gymnasts/id]", err);
    return NextResponse.json({ error: "Failed to fetch gymnast" }, { status: 500 });
  }
}
