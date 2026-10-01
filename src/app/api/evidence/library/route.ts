import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { listEvidence } from "@/features/evidence/server/list-evidence";

export async function GET() {
  try {
    await requireActiveUser();
    const result = await listEvidence({ page: 1 });
    return NextResponse.json({ items: result.items, count: result.count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load evidence library" },
      { status: 400 }
    );
  }
}
