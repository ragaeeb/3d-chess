declare module "https://esm.sh/chess.js@1.4.0" {
  export class Chess {
    constructor(fen?: string);
    fen(): string;
    turn(): "w" | "b";
    move(move: { from: string; to: string; promotion?: string }): unknown;
    isGameOver(): boolean;
    isCheckmate(): boolean;
  }
}
