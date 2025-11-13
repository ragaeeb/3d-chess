import {
  EVENT_TYPES,
  WAITING_PLAYER_KEY,
  WAITING_TTL_SECONDS,
  type GameEvent,
} from "./_shared/constants";
import { publishToPlayer } from "./_shared/broadcast";
import {
  clearPlayerGame,
  createInitialGameState,
  getGameState,
  getPlayerGameId,
  saveGameState,
  setPlayerGame,
} from "./_shared/game-state";
import { redisDel, redisGetString, redisSetIfAbsent, redisSetString } from "./_shared/redis";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const notifyPlayers = (whiteId: string, blackId: string, gameId: string) => {
  const whiteEvent: GameEvent = {
    type: EVENT_TYPES.INIT_GAME,
    payload: { color: "white", gameId },
  };
  const blackEvent: GameEvent = {
    type: EVENT_TYPES.INIT_GAME,
    payload: { color: "black", gameId },
  };

  publishToPlayer(whiteId, whiteEvent);
  publishToPlayer(blackId, blackEvent);
};

export default async (request: Request, _context?: unknown) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.json().catch(() => null);
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;

  if (!playerId) {
    return jsonResponse({ error: "playerId is required" }, 400);
  }

  const existingGameId = await getPlayerGameId(playerId);
  if (existingGameId) {
    const game = await getGameState(existingGameId);
    if (game && game.status === "active") {
      return jsonResponse({ status: "alreadyPlaying" });
    }
    await clearPlayerGame(playerId);
  }

  const waitingPlayer = await redisGetString(WAITING_PLAYER_KEY);

  if (!waitingPlayer) {
    const inserted = await redisSetIfAbsent(WAITING_PLAYER_KEY, playerId, { ex: WAITING_TTL_SECONDS });
    if (!inserted) {
      // Another player beat us to the queue; try to retrieve them and fall through to matching logic
      const updatedWaiting = await redisGetString(WAITING_PLAYER_KEY);
      if (!updatedWaiting || updatedWaiting === playerId) {
        await redisSetString(WAITING_PLAYER_KEY, playerId, { ex: WAITING_TTL_SECONDS });
        return jsonResponse({ status: "waiting" });
      }
    } else {
      return jsonResponse({ status: "waiting" });
    }
  }

  const opponentId = await redisGetString(WAITING_PLAYER_KEY);

  if (!opponentId) {
    await redisSetString(WAITING_PLAYER_KEY, playerId, { ex: WAITING_TTL_SECONDS });
    return jsonResponse({ status: "waiting" });
  }

  if (opponentId === playerId) {
    await redisSetString(WAITING_PLAYER_KEY, playerId, { ex: WAITING_TTL_SECONDS });
    return jsonResponse({ status: "waiting" });
  }

  await redisDel(WAITING_PLAYER_KEY);

  const gameId = crypto.randomUUID();
  const gameState = createInitialGameState(gameId, opponentId, playerId);

  await saveGameState(gameId, gameState);
  await setPlayerGame(opponentId, gameId);
  await setPlayerGame(playerId, gameId);

  notifyPlayers(opponentId, playerId, gameId);

  return jsonResponse({ status: "matched" });
};

export const config = { path: "/api/game/join", method: "POST" };
