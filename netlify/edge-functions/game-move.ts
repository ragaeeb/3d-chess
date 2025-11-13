import { Chess } from "https://esm.sh/chess.js@1.4.0";
import {
  EVENT_TYPES,
  type GameEvent,
} from "./_shared/constants.ts";
import { publishToPlayer } from "./_shared/broadcast.ts";
import {
  clearPlayerGame,
  deleteGameState,
  getGameState,
  getPlayerGameId,
  saveGameState,
  type GameState,
} from "./_shared/game-state.ts";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const broadcastMove = (game: GameState, move: { from: string; to: string }) => {
  const event: GameEvent = {
    type: EVENT_TYPES.MOVE,
    payload: move,
  };

  publishToPlayer(game.whitePlayerId, event);
  publishToPlayer(game.blackPlayerId, event);
};

const broadcastGameOver = (game: GameState) => {
  const event: GameEvent = {
    type: EVENT_TYPES.GAME_OVER,
    payload: game.winner ? { winner: game.winner } : undefined,
  };

  publishToPlayer(game.whitePlayerId, event);
  publishToPlayer(game.blackPlayerId, event);
};

export default async (request: Request, _context?: unknown) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.json().catch(() => null);
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;
  const move = body?.move;

  if (!playerId || typeof move?.from !== "string" || typeof move?.to !== "string") {
    return jsonResponse({ error: "playerId and move.from/move.to are required" }, 400);
  }

  const gameId = await getPlayerGameId(playerId);
  if (!gameId) {
    return jsonResponse({ error: "Game not found" }, 404);
  }

  const gameState = await getGameState(gameId);
  if (!gameState) {
    return jsonResponse({ error: "Game not found" }, 404);
  }

  if (gameState.status !== "active") {
    return jsonResponse({ error: "Game is not active" }, 400);
  }

  const expectedPlayer = gameState.turn === "w" ? gameState.whitePlayerId : gameState.blackPlayerId;
  if (expectedPlayer !== playerId) {
    return jsonResponse({ error: "Not your turn" }, 400);
  }

  const chess = new Chess(gameState.fen);
  const result = (() => {
    try {
      return chess.move({ from: move.from, to: move.to, promotion: "q" });
    } catch {
      return null;
    }
  })();

  if (!result) {
    return jsonResponse({ error: "Invalid move" }, 400);
  }

  const updatedFen = chess.fen();
  gameState.fen = updatedFen;
  gameState.turn = chess.turn();
  gameState.lastMoveAt = Date.now();
  gameState.version = (gameState.version ?? 0) + 1;
  gameState.history.push({ from: move.from, to: move.to, fen: updatedFen });

  const isGameOver = chess.isGameOver();
  if (isGameOver) {
    gameState.status = "completed";
    if (chess.isCheckmate()) {
      gameState.winner = chess.turn() === "w" ? "black" : "white";
    } else {
      gameState.winner = "draw";
    }
  }

  await saveGameState(gameId, gameState);

  broadcastMove(gameState, { from: move.from, to: move.to });

  if (isGameOver) {
    broadcastGameOver(gameState);
    await clearPlayerGame(gameState.whitePlayerId);
    await clearPlayerGame(gameState.blackPlayerId);
    await deleteGameState(gameId);
  }

  return jsonResponse({ ok: true });
};

export const config = { path: "/api/game/move", method: "POST" };
