import { beforeEach, describe, expect, it } from "bun:test";
import { GET as streamRoute } from "app/api/game/stream/route";
import type { NextRequest } from "next/server";
import { gameManager } from "@/lib/gameManager";

type InternalGameManager = typeof gameManager & {
	clients: Map<
		string,
		{
			controller: ReadableStreamDefaultController<Uint8Array>;
			keepAlive?: NodeJS.Timeout;
		}
	>;
	pendingPlayer: string | null;
	games: Map<string, unknown>;
};

const createStreamRequest = (url: string, signal: AbortSignal): NextRequest =>
	({ url, signal }) as unknown as NextRequest;

const resetGameManager = () => {
	const internal = gameManager as unknown as InternalGameManager;
	const clients = Array.from(internal.clients.keys());
	for (const id of clients) {
		gameManager.removeConnection(id);
	}
	internal.pendingPlayer = null;
	internal.games.clear();
};

describe("GET /api/game/stream", () => {
	beforeEach(() => {
		resetGameManager();
	});

	it("requires a playerId", async () => {
		const response = await streamRoute(
			createStreamRequest(
				"https://example.com/api/game/stream",
				new AbortController().signal,
			),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Missing playerId" });
	});

	it("starts streaming immediately with a keepalive message", async () => {
		const controller = new AbortController();
		const playerId = "stream-player";

		const response = await streamRoute(
			createStreamRequest(
				`https://example.com/api/game/stream?playerId=${playerId}`,
				controller.signal,
			),
		);

		expect(response.headers.get("Content-Type")).toBe("text/event-stream");

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error("Expected SSE response to expose a readable body");
		}
		const { value, done } = await reader.read();
		expect(done).toBe(false);

		const text = new TextDecoder().decode(value);
		expect(text.trim()).toBe('data: {"type":"keepalive"}');

		controller.abort();
	});
});
