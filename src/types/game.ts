import type { Piece, Square } from "chess.js";
import type { ERROR, GAME_OVER, INIT_GAME, MOVE, OPPONENT_LEFT } from "./socket";

export type GameStatus = "not-started" | "waiting-opponent" | "started";

export type MovePayload = { from: string; to: string };

export type SocketMessage = {
  type: typeof INIT_GAME | typeof MOVE | typeof OPPONENT_LEFT | typeof GAME_OVER | typeof ERROR;
  payload?: any;
};

export interface AnimatedPieceProps {
  from: Square;
  to: Square;
  captured?: string | boolean;
  children: React.ReactNode;
}

export type ChessBoardProps = {
  board: (Piece | null)[][];
  onMove: (move: { from: Square; to: Square }) => void;
  getLegalMoves: (square: Square) => Square[];
  gameStatus: GameStatus;
  playerColor: string | null;
  lastMove: ChessMove | null;
};

export type ChessMove = {
  from: Square;
  to: Square;
  captured?: string;
};
