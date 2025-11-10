import { Chess } from "chess.js";
import { ERROR, GAME_OVER, INIT_GAME, MOVE, OPPONENT_LEFT } from "@/types/socket";

const encoder = new TextEncoder();

type Move = { from: string; to: string };

type ClientConnection = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  keepAlive?: NodeJS.Timeout;
};

class Game {
  private board = new Chess();
  private gameOver = false;

  constructor(
    private readonly manager: GameManager,
    public readonly whiteId: string,
    public readonly blackId: string,
  ) {
    this.manager.send(whiteId, {
      type: INIT_GAME,
      payload: { color: "white" },
    });
    this.manager.send(blackId, {
      type: INIT_GAME,
      payload: { color: "black" },
    });
  }

  getOpponent(playerId: string) {
    return playerId === this.whiteId ? this.blackId : this.whiteId;
  }

  makeMove(playerId: string, move: Move) {
    if (this.gameOver) {
      this.manager.send(playerId, { type: ERROR, payload: { message: "Game is already over" } });
      return { ok: false, message: "Game is already over" };
    }

    const expectedPlayer = this.board.turn() === "w" ? this.whiteId : this.blackId;
    if (playerId !== expectedPlayer) {
      this.manager.send(playerId, { type: ERROR, payload: { message: "Not your turn" } });
      return { ok: false, message: "Not your turn" };
    }

    let result;
    try {
      result = this.board.move(move);
    } catch {
      result = null;
    }

    if (!result) {
      this.manager.send(playerId, { type: ERROR, payload: { message: "Illegal move" } });
      return { ok: false, message: "Illegal move" };
    }

    const opponentId = this.getOpponent(playerId);
    this.manager.send(opponentId, { type: MOVE, payload: move });

    if (this.board.isGameOver()) {
      this.gameOver = true;
      const winner = this.board.turn() === "w" ? "black" : "white";
      this.manager.send(this.whiteId, { type: GAME_OVER, payload: { winner } });
      this.manager.send(this.blackId, { type: GAME_OVER, payload: { winner } });
      this.manager.endGame(this);
    }

    return { ok: true };
  }

  handleDisconnect(leaverId: string) {
    if (this.gameOver) return;
    const opponent = this.getOpponent(leaverId);
    this.manager.send(opponent, { type: OPPONENT_LEFT });
    this.manager.endGame(this);
  }
}

export class GameManager {
  private readonly clients = new Map<string, ClientConnection>();
  private readonly games = new Map<string, Game>();
  private pendingPlayer: string | null = null;

  addConnection(playerId: string, controller: ReadableStreamDefaultController<Uint8Array>) {
    const existing = this.clients.get(playerId);
    if (existing?.keepAlive) {
      clearInterval(existing.keepAlive);
    }
    this.clients.set(playerId, { controller });
  }

  removeConnection(playerId: string) {
    const client = this.clients.get(playerId);
    if (!client) return;
    if (client.keepAlive) {
      clearInterval(client.keepAlive);
    }
    this.clients.delete(playerId);

    if (this.pendingPlayer === playerId) {
      this.pendingPlayer = null;
    }

    const game = this.games.get(playerId);
    if (game) {
      game.handleDisconnect(playerId);
    }
  }

  queuePlayer(playerId: string) {
    if (!this.clients.has(playerId)) {
      return { status: "error", message: "Player is not connected" } as const;
    }

    if (this.games.has(playerId)) {
      return { status: "alreadyPlaying" } as const;
    }

    if (this.pendingPlayer && this.pendingPlayer !== playerId) {
      const opponentId = this.pendingPlayer;
      this.pendingPlayer = null;
      const game = new Game(this, opponentId, playerId);
      this.games.set(opponentId, game);
      this.games.set(playerId, game);
      return { status: "matched" as const };
    }

    this.pendingPlayer = playerId;
    return { status: "waiting" as const };
  }

  makeMove(playerId: string, move: Move) {
    const game = this.games.get(playerId);
    if (!game) {
      return { ok: false, message: "Game not found" } as const;
    }
    return game.makeMove(playerId, move);
  }

  endGame(game: Game) {
    this.games.delete(game.whiteId);
    this.games.delete(game.blackId);
  }

  registerKeepAlive(playerId: string, interval: NodeJS.Timeout) {
    const client = this.clients.get(playerId);
    if (client) {
      client.keepAlive = interval;
    }
  }

  send(playerId: string, message: unknown) {
    const client = this.clients.get(playerId);
    if (!client) return;
    try {
      client.controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
    } catch (error) {
      console.error("Failed to send SSE message", error);
      this.removeConnection(playerId);
    }
  }
}

const globalGameManager = globalThis as unknown as { __gameManager?: GameManager };

export const gameManager =
  globalGameManager.__gameManager ?? (globalGameManager.__gameManager = new GameManager());
