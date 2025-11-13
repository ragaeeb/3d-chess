import { EVENT_TYPES, WAITING_PLAYER_KEY } from "./constants.ts";
import { publishToPlayer } from "./broadcast.ts";
import { clearPlayerGame, deleteGameState, getGameState, getPlayerGameId } from "./game-state.ts";
import { redisDel, redisGetString } from "./redis.ts";

export const handlePlayerDisconnect = async (playerId: string): Promise<void> => {
  const waitingPlayer = await redisGetString(WAITING_PLAYER_KEY);
  if (waitingPlayer === playerId) {
    await redisDel(WAITING_PLAYER_KEY);
  }

  const gameId = await getPlayerGameId(playerId);
  if (!gameId) {
    return;
  }

  await clearPlayerGame(playerId);

  const gameState = await getGameState(gameId);
  if (!gameState) {
    return;
  }

  const opponentId = gameState.whitePlayerId === playerId ? gameState.blackPlayerId : gameState.whitePlayerId;

  if (opponentId) {
    await clearPlayerGame(opponentId);
    if (gameState.status === "active") {
      publishToPlayer(opponentId, { type: EVENT_TYPES.OPPONENT_LEFT });
    }
  }

  await deleteGameState(gameId);
};
