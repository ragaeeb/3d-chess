export const WAITING_PLAYER_KEY = "queue:waiting";
export const PLAYER_GAME_KEY = (playerId: string) => `player:${playerId}:game`;
export const GAME_KEY = (gameId: string) => `game:${gameId}`;
export const PLAYER_CHANNEL = (playerId: string) => `player:${playerId}`;

export const GAME_TTL_SECONDS = 60 * 60 * 24; // 1 day
export const PLAYER_GAME_TTL_SECONDS = 60 * 60 * 24; // 1 day
export const WAITING_TTL_SECONDS = 60; // 1 minute timeout for queue entries

export const EVENT_TYPES = {
  INIT_GAME: "init_game",
  MOVE: "move",
  GAME_OVER: "game_over",
  OPPONENT_LEFT: "opponent_left",
  ERROR: "error",
  KEEPALIVE: "keepalive",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export interface GameEvent {
  type: EventType;
  payload?: unknown;
}
