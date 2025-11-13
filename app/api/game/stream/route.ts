import type { NextRequest } from "next/server";
import { gameManager } from "@/lib/gameManager";
import { KEEPALIVE } from "@/types/socket";

const encoder = new TextEncoder();
const formatKeepAlive = () =>
	encoder.encode(`data: ${JSON.stringify({ type: KEEPALIVE })}\n\n`);

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const playerId = searchParams.get("playerId");

	if (!playerId) {
		return new Response(JSON.stringify({ error: "Missing playerId" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			gameManager.addConnection(playerId, controller);

			// Send an initial keepalive event immediately so that the response
			// starts streaming right away. Without this, the client may wait for the
			// first interval tick before the EventSource connection becomes "open",
			// which blocks the UI from enabling the start button.
			controller.enqueue(formatKeepAlive());

			const keepAlive = setInterval(() => {
				controller.enqueue(formatKeepAlive());
			}, 25000);
			gameManager.registerKeepAlive(playerId, keepAlive);

			const onAbort = () => {
				clearInterval(keepAlive);
				gameManager.removeConnection(playerId);
				controller.close();
			};

			req.signal.addEventListener("abort", onAbort);
		},
		cancel() {
			gameManager.removeConnection(playerId);
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
		},
	});
}
