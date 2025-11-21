import type { Square } from 'chess.js';
export type GameStatus = 'not-started' | 'waiting-opponent' | 'started';
export type PlayerRole = 'white' | 'black' | 'spectator';
export type GameState = 'waiting' | 'active' | 'finished';

export type MovePayload = { from: string; to: string };

export type ChessMove = { from: Square; to: Square; captured?: string };
