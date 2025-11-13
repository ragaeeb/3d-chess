import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameManager";

export async function POST(req: NextRequest) {
	const body = await req.json().catch(() => null);
	const playerId = body?.playerId as string | undefined;

	if (!playerId) {
		return NextResponse.json(
			{ error: "playerId is required" },
			{ status: 400 },
		);
	}

	const result = gameManager.queuePlayer(playerId);
	if (result.status === "error") {
		return NextResponse.json({ error: result.message }, { status: 400 });
	}

	return NextResponse.json(result);
}
