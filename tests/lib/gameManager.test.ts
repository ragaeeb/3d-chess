import { beforeEach, describe, expect, it } from "bun:test";
import { GameManager } from "@/lib/gameManager";
import { ERROR, INIT_GAME, MOVE, OPPONENT_LEFT } from "@/types/socket";

type MutableManager = GameManager & {
	clients: Map<
		string,
		{
			controller: ReadableStreamDefaultController<Uint8Array>;
			keepAlive?: NodeJS.Timeout;
		}
	>;
};

const decoder = new TextDecoder();

const parseSseMessage = (chunk: string) =>
	JSON.parse(chunk.replace(/^data: /, "").trim());

const createController = (messages: string[]) =>
	({
		enqueue: (value: Uint8Array) => {
			messages.push(decoder.decode(value));
		},
		close: () => {},
		error: () => {},
	}) as unknown as ReadableStreamDefaultController<Uint8Array>;

describe("GameManager", () => {
	let manager: GameManager;

	beforeEach(() => {
		manager = new GameManager();
	});

	it("rejects players that are not connected", () => {
		expect(manager.queuePlayer("missing")).toEqual({
			status: "error",
			message: "Player is not connected",
		});
	});

	it("waits for an opponent when the first player queues", () => {
		manager.addConnection("p1", createController([]));

		expect(manager.queuePlayer("p1")).toEqual({ status: "waiting" });
	});

	it("matches two players and assigns colors", () => {
		const messagesP1: string[] = [];
		const messagesP2: string[] = [];
		manager.addConnection("p1", createController(messagesP1));
		manager.addConnection("p2", createController(messagesP2));

		manager.queuePlayer("p1");
		const result = manager.queuePlayer("p2");

		expect(result).toEqual({ status: "matched" });

		const initWhite = parseSseMessage(messagesP1[0]);
		const initBlack = parseSseMessage(messagesP2[0]);

		expect(initWhite).toEqual({ type: INIT_GAME, payload: { color: "white" } });
		expect(initBlack).toEqual({ type: INIT_GAME, payload: { color: "black" } });
	});

	it("prevents moves when the player has no game", () => {
		expect(manager.makeMove("p1", { from: "e2", to: "e4" })).toEqual({
			ok: false,
			message: "Game not found",
		});
	});

	it("enforces turn order and broadcasts legal moves", () => {
		const messagesP1: string[] = [];
		const messagesP2: string[] = [];
		manager.addConnection("white", createController(messagesP1));
		manager.addConnection("black", createController(messagesP2));

		manager.queuePlayer("white");
		manager.queuePlayer("black");

		const notYourTurn = manager.makeMove("black", { from: "e7", to: "e5" });
		expect(notYourTurn).toEqual({ ok: false, message: "Not your turn" });
		const latestError = messagesP2.at(-1);
		if (!latestError) {
			throw new Error("Expected error message for out-of-turn move");
		}
		const errorMessage = parseSseMessage(latestError);
		expect(errorMessage).toEqual({
			type: ERROR,
			payload: { message: "Not your turn" },
		});

		const moveResult = manager.makeMove("white", { from: "e2", to: "e4" });
		expect(moveResult).toEqual({ ok: true });
		const latestMove = messagesP2.at(-1);
		if (!latestMove) {
			throw new Error("Expected move message for successful turn");
		}
		const moveMessage = parseSseMessage(latestMove);
		expect(moveMessage).toEqual({
			type: MOVE,
			payload: { from: "e2", to: "e4" },
		});
	});

	it("notifies the opponent when a player disconnects", () => {
		const messagesP1: string[] = [];
		const messagesP2: string[] = [];
		manager.addConnection("white", createController(messagesP1));
		manager.addConnection("black", createController(messagesP2));
		manager.queuePlayer("white");
		manager.queuePlayer("black");

		manager.removeConnection("white");

		const latestDisconnect = messagesP2.at(-1);
		if (!latestDisconnect) {
			throw new Error("Expected disconnect notification");
		}
		const disconnectMessage = parseSseMessage(latestDisconnect);
		expect(disconnectMessage).toEqual({ type: OPPONENT_LEFT });
	});

	it("tracks keepalive handles for connected clients", () => {
		manager.addConnection("player", createController([]));
		const interval = setInterval(() => {}, 1000);
		manager.registerKeepAlive("player", interval);

		const client = (manager as MutableManager).clients.get("player");
		expect(client.keepAlive).toBe(interval);

		clearInterval(interval);
	});
});
