import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameManager";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const playerId = body?.playerId as string | undefined;
  const move = body?.move as { from?: string; to?: string } | undefined;

  if (!playerId || !move?.from || !move?.to) {
    return NextResponse.json({ error: "playerId and move.from/move.to are required" }, { status: 400 });
  }

  const result = gameManager.makeMove(playerId, { from: move.from, to: move.to });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
