import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

function checkAuth(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action: "merge" | "reject";
    duplicateId: string;
    keepGymnastId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, duplicateId, keepGymnastId } = body;

  if (!duplicateId || !["merge", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Fetch the duplicate pair
  const pair = await db.execute(
    sql`SELECT * FROM pending_duplicates WHERE id = ${duplicateId} AND status = 'pending' LIMIT 1`
  ) as { rows: Array<{ id: string; gymnast_a_id: string; gymnast_b_id: string }> };

  if (pair.rows.length === 0) {
    return NextResponse.json({ error: "Duplicate pair not found or already resolved" }, { status: 404 });
  }

  const { gymnast_a_id: idA, gymnast_b_id: idB } = pair.rows[0];

  if (action === "reject") {
    await db.execute(sql`
      UPDATE pending_duplicates
      SET status = 'rejected', resolved_at = NOW()
      WHERE id = ${duplicateId}
    `);
    return NextResponse.json({ ok: true, action: "rejected" });
  }

  // Merge action
  if (!keepGymnastId || ![idA, idB].includes(keepGymnastId)) {
    return NextResponse.json(
      { error: "keepGymnastId must be one of the pair IDs" },
      { status: 400 }
    );
  }

  const mergeId = keepGymnastId === idA ? idB : idA;

  try {
    // Run merge in a single transaction via multiple SQL statements
    // 1. Reassign all results from merged gymnast to keeper
    await db.execute(sql`
      UPDATE results SET gymnast_id = ${keepGymnastId} WHERE gymnast_id = ${mergeId}
    `);

    // 2. Move name variants to keeper
    await db.execute(sql`
      UPDATE gymnast_name_variants SET gymnast_id = ${keepGymnastId}
      WHERE gymnast_id = ${mergeId}
      AND raw_name NOT IN (
        SELECT raw_name FROM gymnast_name_variants
        WHERE gymnast_id = ${keepGymnastId}
      )
    `);
    await db.execute(sql`
      DELETE FROM gymnast_name_variants WHERE gymnast_id = ${mergeId}
    `);

    // 3. Reassign program memberships
    await db.execute(sql`
      UPDATE gymnast_programs SET gymnast_id = ${keepGymnastId}
      WHERE gymnast_id = ${mergeId}
      AND NOT EXISTS (
        SELECT 1 FROM gymnast_programs gp2
        WHERE gp2.gymnast_id = ${keepGymnastId}
          AND gp2.program_id = gymnast_programs.program_id
          AND gp2.season = gymnast_programs.season
      )
    `);
    await db.execute(sql`
      DELETE FROM gymnast_programs WHERE gymnast_id = ${mergeId}
    `);

    // 4. Remove any other pending duplicate pairs involving the merged gymnast
    await db.execute(sql`
      DELETE FROM pending_duplicates
      WHERE (gymnast_a_id = ${mergeId} OR gymnast_b_id = ${mergeId})
        AND id != ${duplicateId}
    `);

    // 5. Soft-delete the merged gymnast record
    await db.execute(sql`
      UPDATE gymnasts SET merged_into_id = ${keepGymnastId}, updated_at = NOW()
      WHERE id = ${mergeId}
    `);

    // 6. Mark duplicate as resolved
    await db.execute(sql`
      UPDATE pending_duplicates
      SET status = 'merged', resolved_at = NOW()
      WHERE id = ${duplicateId}
    `);

    return NextResponse.json({ ok: true, action: "merged", keepId: keepGymnastId, mergedId: mergeId });
  } catch (err) {
    console.error("[admin/deduplication] Merge failed:", err);
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }
}
