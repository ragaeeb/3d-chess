import { beforeEach, describe, expect, it } from "bun:test";
import { POST as moveRoute } from "app/api/game/move/route";
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

describe("POST /api/game/move", () => {
	beforeEach(() => {
		resetGameManager();
	});

	it("requires playerId and move coordinates", async () => {
		const response = await moveRoute(createJsonRequest({}));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "playerId and move.from/move.to are required",
		});
	});

	it("returns an error when the player is not in a game", async () => {
		const response = await moveRoute(
			createJsonRequest({
				playerId: "missing",
				move: { from: "e2", to: "e4" },
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Game not found" });
	});

	it("accepts a legal move for an active game", async () => {
		const white = "white-player";
		const black = "black-player";

		gameManager.addConnection(white, stubController());
		gameManager.addConnection(black, stubController());

		gameManager.queuePlayer(white);
		gameManager.queuePlayer(black);

		const response = await moveRoute(
			createJsonRequest({ playerId: white, move: { from: "e2", to: "e4" } }),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });

		gameManager.removeConnection(white);
		gameManager.removeConnection(black);
	});
});
