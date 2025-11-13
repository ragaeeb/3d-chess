"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Chess, type Square } from "chess.js";

import ChessBoard from "@/components/3d/chessBoard";
import GameStatusPanel from "@/components/GameStatusPanel";
import { INIT_GAME, MOVE, OPPONENT_LEFT, GAME_OVER, ERROR, KEEPALIVE } from "@/types/socket";
import type { ChessMove, GameStatus, SocketMessage } from "@/types/game";

const GamePage: React.FC = () => {
  const [playerId] = useState(() => crypto.randomUUID());

  const eventSourceRef = useRef<EventSource | null>(null);
  const [game] = useState(() => new Chess());

  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>("not-started");
  const [playerColor, setPlayerColor] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastMove, setLastMove] = useState<ChessMove | null>(null);
  const [board, setBoard] = useState(() => game.board());

  const resetBoard = useCallback(() => {
    game.reset();
    setBoard(game.board());
    setLastMove(null);
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = null;
    }
    setBannerMessage(null);
  }, [game]);

  const updateBannerFromGame = useCallback(() => {
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = null;
    }

    if (game.isCheckmate()) {
      setBannerMessage("Checkmate");
      return;
    }

    if (game.isCheck()) {
      setBannerMessage("Check");
      bannerTimeoutRef.current = setTimeout(() => {
        setBannerMessage(null);
        bannerTimeoutRef.current = null;
      }, 2000);
      return;
    }

    setBannerMessage(null);
  }, [game]);

  const handleServerMessage = useCallback(
    (data: SocketMessage) => {
      switch (data.type) {
        case INIT_GAME: {
          resetBoard();
          setGameStatus("started");
          setPlayerColor(data.payload?.color ?? null);
          setMessage(null);
          setBannerMessage(null);
          break;
        }
        case MOVE: {
          if (data.payload?.from && data.payload?.to) {
            const moveResult = game.move({
              from: data.payload.from as Square,
              to: data.payload.to as Square,
              promotion: "q",
            });
            if (moveResult) {
              setLastMove({
                from: data.payload.from as Square,
                to: data.payload.to as Square,
              });
              setBoard(game.board());
              updateBannerFromGame();
            }
          }
          break;
        }
        case OPPONENT_LEFT: {
          setGameStatus("not-started");
          setMessage("Your opponent has left the game. Queue again to find a new match.");
          setPlayerColor(null);
          resetBoard();
          break;
        }
        case GAME_OVER: {
          const winner = data.payload?.winner;
          if (winner) {
            setBannerMessage(`Game Over - ${winner} wins`);
            setMessage(null);
          } else {
            setBannerMessage("Game Over");
          }
          if (bannerTimeoutRef.current) {
            clearTimeout(bannerTimeoutRef.current);
            bannerTimeoutRef.current = null;
          }
          setGameStatus("not-started");
          setPlayerColor(null);
          break;
        }
        case ERROR: {
          if (typeof data.payload?.message === "string") {
            setMessage(data.payload.message);
          }
          break;
        }
        default:
          break;
      }
    },
    [game, resetBoard, updateBannerFromGame],
  );

  useEffect(() => {
    const eventSource = new EventSource(`/api/game/stream?playerId=${playerId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setMessage(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: SocketMessage = JSON.parse(event.data);
        if (data.type === KEEPALIVE) {
          return;
        }
        handleServerMessage(data);
      } catch (error) {
        console.error("Invalid message from server", error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setMessage("Connection interrupted. Attempting to reconnect...");
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      setPlayerColor(null);
      setGameStatus("not-started");
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = null;
      }
      setBannerMessage(null);
    };
  }, [playerId, handleServerMessage]);

  const handleStartGame = useCallback(async () => {
    if (!isConnected) {
      setMessage("Unable to start game while disconnected.");
      return;
    }

    resetBoard();
    setMessage(null);
    setBannerMessage(null);
    setPlayerColor(null);
    setGameStatus("waiting-opponent");

    try {
      const response = await fetch("/api/game/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to join queue" }));
        setMessage(error.error ?? "Failed to join queue");
        setGameStatus("not-started");
      } else {
        const result = await response.json();
        if (result.status === "alreadyPlaying") {
          setGameStatus("started");
        } else if (result.status === "waiting") {
          setMessage("Waiting for an opponent...");
        }
      }
    } catch (error) {
      console.error(error);
      setMessage("Unable to join the queue. Please try again.");
      setGameStatus("not-started");
    }
  }, [isConnected, playerId, resetBoard]);

  const handleLocalMove = useCallback(
    (move: { from: string; to: string }) => {
      if (gameStatus !== "started" || !playerColor) {
        return;
      }

      const expectedTurn = playerColor === "white" ? "w" : "b";
      if (game.turn() !== expectedTurn) {
        setMessage("It isn't your turn yet.");
        return;
      }

      const availableMoves = game.moves({ square: move.from as Square, verbose: true });
      const isLegalDestination = availableMoves.some((m) => m.to === move.to);
      if (!isLegalDestination) {
        setMessage("Illegal move");
        return;
      }

      const targetSquare = game.get(move.to as Square);
      const captured = targetSquare ? targetSquare.type : undefined;

      const result = game.move({
        from: move.from as Square,
        to: move.to as Square,
        promotion: "q",
      });

      if (result) {
        setLastMove({ from: move.from as Square, to: move.to as Square, captured });
        setBoard(game.board());
        setMessage(null);
        updateBannerFromGame();

        fetch("/api/game/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, move }),
        }).catch((error) => {
          console.error(error);
          setMessage("Failed to send move to server");
        });
      }
    },
    [game, gameStatus, playerColor, playerId, updateBannerFromGame],
  );

  const getLegalMoves = useCallback((square: Square): Square[] => {
    const moves = game.moves({ square, verbose: true });
    return moves.map((move) => move.to as Square);
  }, [game]);

  const turn = game.turn();

  return (
    <div className="relative h-screen">
      {bannerMessage && (
        <div className="w-full z-50 h-20 text-2xl font-bold absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white text-white shadow-2xl">
          {bannerMessage}
        </div>
      )}

      <GameStatusPanel
        isConnected={isConnected}
        message={message}
        gameStatus={gameStatus}
        playerColor={playerColor}
        handleStartGame={handleStartGame}
        turn={turn}
      />

      <Canvas
        shadows
        className="bg-gradient-to-b from-black to-zinc-700"
        camera={{ position: [10, 10, 10], fov: 20 }}
        style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%" }}
      >
        <ChessBoard
          board={board}
          onMove={handleLocalMove}
          getLegalMoves={getLegalMoves}
          gameStatus={gameStatus}
          playerColor={playerColor}
          lastMove={lastMove}
        />
      </Canvas>
    </div>
  );
};

export default GamePage;
