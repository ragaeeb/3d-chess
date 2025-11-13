import { beforeEach, describe, expect, it } from "bun:test";
import { POST as join } from "app/api/game/join/route";
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

const createJsonRequest = (body: unknown): NextRequest =>
	({
		json: async () => body,
	}) as unknown as NextRequest;

const stubController = () =>
	({
		enqueue: () => {},
		close: () => {},
		error: () => {},
	}) as unknown as ReadableStreamDefaultController<Uint8Array>;

const resetGameManager = () => {
	const internal = gameManager as unknown as InternalGameManager;
	const clients = Array.from(internal.clients.keys());
	for (const id of clients) {
		gameManager.removeConnection(id);
	}
	internal.pendingPlayer = null;
	internal.games.clear();
};

describe("POST /api/game/join", () => {
	beforeEach(() => {
		resetGameManager();
	});

	it("returns 400 when playerId is missing", async () => {
		const request = createJsonRequest({});
		const response = await join(request);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "playerId is required" });
	});

	it("returns error when player is not connected", async () => {
		const request = createJsonRequest({ playerId: "no-connection" });
		const response = await join(request);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Player is not connected" });
	});

	it("queues a connected player", async () => {
		const playerId = "player-waiting";
		gameManager.addConnection(playerId, stubController());

		const request = createJsonRequest({ playerId });
		const response = await join(request);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "waiting" });
	});

	it("matches two waiting players", async () => {
		const white = "white-player";
		const black = "black-player";
		gameManager.addConnection(white, stubController());
		gameManager.addConnection(black, stubController());

		await join(createJsonRequest({ playerId: white }));
		const response = await join(createJsonRequest({ playerId: black }));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "matched" });
	});
});
