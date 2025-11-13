import {
  GAME_KEY,
  GAME_TTL_SECONDS,
  PLAYER_GAME_KEY,
  PLAYER_GAME_TTL_SECONDS,
} from "./constants.ts";
import { redisDel, redisGetJson, redisGetString, redisSetJson, redisSetString } from "./redis.ts";

export interface GameState {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  fen: string;
  turn: "w" | "b";
  status: "waiting" | "active" | "completed";
  createdAt: number;
  lastMoveAt: number;
  version: number;
  winner?: "white" | "black" | "draw";
  history: { from: string; to: string; fen: string }[];
}

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const createInitialGameState = (gameId: string, whitePlayerId: string, blackPlayerId: string): GameState => ({
  id: gameId,
  whitePlayerId,
  blackPlayerId,
  fen: STARTING_FEN,
  turn: "w",
  status: "active",
  createdAt: Date.now(),
  lastMoveAt: Date.now(),
  version: 1,
  history: [],
});

export const getGameState = async (gameId: string): Promise<GameState | null> => {
  return redisGetJson<GameState>(GAME_KEY(gameId));
};

export const saveGameState = async (gameId: string, state: GameState): Promise<void> => {
  await redisSetJson(GAME_KEY(gameId), state, { ex: GAME_TTL_SECONDS });
};

export const setPlayerGame = async (playerId: string, gameId: string): Promise<void> => {
  await redisSetString(PLAYER_GAME_KEY(playerId), gameId, { ex: PLAYER_GAME_TTL_SECONDS });
};

export const getPlayerGameId = async (playerId: string): Promise<string | null> => {
  return redisGetString(PLAYER_GAME_KEY(playerId));
};

export const clearPlayerGame = async (playerId: string): Promise<void> => {
  await redisDel(PLAYER_GAME_KEY(playerId));
};

export const deleteGameState = async (gameId: string): Promise<void> => {
  await redisDel(GAME_KEY(gameId));
};
