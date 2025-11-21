import { randomUUID } from 'node:crypto';
import { Chess } from 'chess.js';
import { GAME_OVER, INIT_GAME, MOVE, OPPONENT_LEFT } from '../../src/types/socket';
import type { GameRecord, JoinGameDecision, PlayerColor } from './utils/gameStore';
import {
    claimWaitingPlayer,
    clearWaitingPlayer,
    getAssignment,
    getGameRecord,
    isRedisBacked,
    joinGameAtomically,
    removeAssignment,
    removeGameRecord,
    saveGameRecord,
    setAssignment,
    setWaitingPlayer,
    updateGameFen,
} from './utils/gameStore';
import type { NetlifyEvent, NetlifyResponse } from './utils/http';
import { jsonResponse, textResponse } from './utils/http';
import { getServerPusher } from './utils/pusher';

type QueueActionResponse =
    | { status: 'waiting' }
    | { status: 'matched' | 'already-playing'; gameId: string; color: PlayerColor; fen: string };

type MoveAction = { from: string; to: string; promotion?: string };

type RequestBody = {
    action?: 'create' | 'join' | 'queue' | 'move' | 'leave';
    playerId?: string;
    gameId?: string;
    move?: MoveAction;
};

const respond = (statusCode: number, data: unknown): NetlifyResponse => jsonResponse(statusCode, data);

const getOpponentId = (game: GameRecord, color: PlayerColor) =>
    color === 'white' ? game.players.black : game.players.white;

const handleCreateGame = async (playerId: string): Promise<NetlifyResponse> => {
    const gameId = randomUUID();
    const chess = new Chess();
    const playerColor: PlayerColor = Math.random() < 0.5 ? 'white' : 'black';

    const record: GameRecord = {
        id: gameId,
        fen: chess.fen(),
        players: { white: playerColor === 'white' ? playerId : null, black: playerColor === 'black' ? playerId : null },
        spectators: [],
        lastUpdated: Date.now(),
        status: 'waiting',
    };

    await saveGameRecord(record);
    await setAssignment(playerId, { gameId, color: playerColor });

    return respond(200, { gameId, color: playerColor, status: 'waiting', fen: record.fen });
};

const handleJoinGame = async (playerId: string, gameId: string): Promise<NetlifyResponse> => {
    const respondForDecision = async (decision: JoinGameDecision, game: GameRecord) => {
        if (decision.status === 'existing') {
            return respond(200, { gameId, color: decision.color, fen: game.fen, status: game.status });
        }

        if (decision.status === 'spectator') {
            return respond(200, { gameId, role: 'spectator', fen: game.fen, status: game.status });
        }

        if (decision.status === 'black' || decision.status === 'white') {
            const color = decision.status;
            await setAssignment(playerId, { gameId, color });

            const opponentColor = color === 'white' ? 'black' : 'white';
            const opponentId = color === 'white' ? game.players.black : game.players.white;

            if (opponentId) {
                try {
                    await getServerPusher().trigger(`private-player-${opponentId}`, INIT_GAME, {
                        status: 'matched',
                        gameId,
                        color: opponentColor,
                        fen: game.fen,
                    });
                } catch (error) {
                    console.error(`Failed to notify ${opponentColor} player`, error);
                }
            }
            return respond(200, { gameId, color, fen: game.fen, status: game.status });
        }

        return respond(404, { error: 'Game not found' });
    };

    if (isRedisBacked) {
        const decision = await joinGameAtomically(gameId, playerId);
        if (!decision || decision.status === 'not_found') {
            return respond(404, { error: 'Game not found' });
        }

        const record = await getGameRecord(gameId);
        if (!record) {
            return respond(404, { error: 'Game not found' });
        }

        return respondForDecision(decision, record);
    }

    const game = await getGameRecord(gameId);
    if (!game) {
        return respond(404, { error: 'Game not found' });
    }

    if (game.players.white === playerId) {
        return respondForDecision({ status: 'existing', color: 'white' }, game);
    }
    if (game.players.black === playerId) {
        return respondForDecision({ status: 'existing', color: 'black' }, game);
    }

    if (game.status === 'active' || (game.players.black && game.players.white)) {
        if (!game.spectators.includes(playerId)) {
            game.spectators.push(playerId);
            await saveGameRecord(game);
        }
        return respondForDecision({ status: 'spectator' }, game);
    }

    const colorToJoin = !game.players.white ? 'white' : 'black';
    if (colorToJoin === 'white') {
        game.players.white = playerId;
    } else {
        game.players.black = playerId;
    }

    game.status = 'active';
    game.lastUpdated = Date.now();
    await saveGameRecord(game);

    return respondForDecision({ status: colorToJoin }, game);
};

const triggerGameStart = async (
    playerId: string,
    payload: QueueActionResponse & { status: 'matched' | 'already-playing' },
) => {
    await getServerPusher().trigger(`private-player-${playerId}`, INIT_GAME, payload);
};

const handleQueue = async (playerId: string): Promise<NetlifyResponse> => {
    const existing = await getAssignment(playerId);
    if (existing) {
        const game = await getGameRecord(existing.gameId);
        if (!game) {
            await removeAssignment(playerId);
        } else {
            return respond(200, {
                status: 'already-playing',
                gameId: existing.gameId,
                color: existing.color,
                fen: game.fen,
            } satisfies QueueActionResponse);
        }
    }

    const waiting = await claimWaitingPlayer(playerId);
    if (!waiting) {
        return respond(200, { status: 'waiting' } satisfies QueueActionResponse);
    }

    const gameId = randomUUID();
    const chess = new Chess();
    const fen = chess.fen();

    const isWaitingWhite = Math.random() < 0.5;
    const whitePlayer = isWaitingWhite ? waiting : playerId;
    const blackPlayer = isWaitingWhite ? playerId : waiting;

    const record: GameRecord = {
        id: gameId,
        fen,
        players: { white: whitePlayer, black: blackPlayer },
        spectators: [],
        lastUpdated: Date.now(),
        status: 'active',
    };

    await saveGameRecord(record);
    await setAssignment(whitePlayer, { gameId, color: 'white' });
    await setAssignment(blackPlayer, { gameId, color: 'black' });

    try {
        await triggerGameStart(waiting, { status: 'matched', gameId, color: isWaitingWhite ? 'white' : 'black', fen });
    } catch (error) {
        console.error('Failed to notify waiting player about match', error);
        await removeGameRecord(gameId);
        await setWaitingPlayer(waiting);
        return respond(500, { error: 'Failed to notify opponent' });
    }

    return respond(200, { status: 'matched', gameId, color: 'black', fen } satisfies QueueActionResponse);
};

const handleMove = async (playerId: string, move: MoveAction): Promise<NetlifyResponse> => {
    const assignment = await getAssignment(playerId);
    if (!assignment) {
        return respond(400, { error: 'Player is not assigned to a game' });
    }

    const game = await getGameRecord(assignment.gameId);
    if (!game || game.status !== 'active') {
        return respond(400, { error: 'Game is no longer active' });
    }

    const chess = new Chess(game.fen);
    const expectedColor: PlayerColor = chess.turn() === 'w' ? 'white' : 'black';
    if (assignment.color !== expectedColor) {
        return respond(400, { error: 'Not your turn' });
    }

    const result = (() => {
        try {
            return chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
        } catch (_error) {
            return null;
        }
    })();

    if (!result) {
        return respond(400, { error: 'Illegal move' });
    }

    const updatedFen = chess.fen();
    await updateGameFen(game.id, updatedFen);

    const payload = {
        playerId,
        move: {
            from: move.from,
            to: move.to,
            promotion: result.promotion ?? undefined,
            captured: result.captured ?? undefined,
        },
        fen: updatedFen,
        turn: chess.turn(),
        check: chess.isCheck(),
    };

    try {
        await getServerPusher().trigger(`private-game-${game.id}`, MOVE, payload);
    } catch (error) {
        console.error('Failed to broadcast move', error);
        return respond(500, { error: 'Failed to broadcast move' });
    }

    if (chess.isGameOver()) {
        const winner: PlayerColor | null = chess.isCheckmate() ? assignment.color : null;
        const reason = chess.isCheckmate()
            ? 'checkmate'
            : chess.isDraw()
              ? 'draw'
              : chess.isStalemate()
                ? 'stalemate'
                : chess.isThreefoldRepetition()
                  ? 'threefold'
                  : chess.isInsufficientMaterial()
                    ? 'insufficient-material'
                    : 'unknown';

        if (game) {
            game.status = 'finished';
            await saveGameRecord(game);
        }
        try {
            await getServerPusher().trigger(`private-game-${game.id}`, GAME_OVER, { winner, reason, fen: updatedFen });
        } catch (error) {
            console.error('Failed to broadcast game over', error);
        }
        await removeGameRecord(game.id);
    }

    return respond(200, { ok: true });
};

const handleLeave = async (playerId: string, targetGameId?: string): Promise<NetlifyResponse> => {
    await clearWaitingPlayer(playerId);

    const assignment = await getAssignment(playerId);
    const resolvedGameId = targetGameId ?? assignment?.gameId;

    if (!resolvedGameId) {
        return respond(200, { status: 'ok' });
    }

    const assignmentForResolvedGame = assignment && assignment.gameId === resolvedGameId ? assignment : null;

    const game = await getGameRecord(resolvedGameId);
    if (game) {
        if (!assignmentForResolvedGame && game.spectators.includes(playerId)) {
            game.spectators = game.spectators.filter((id) => id !== playerId);
            await saveGameRecord(game);
            return respond(200, { status: 'left' });
        }

        if (assignmentForResolvedGame) {
            const opponentId = getOpponentId(game, assignmentForResolvedGame.color);
            try {
                await getServerPusher().trigger(`private-game-${game.id}`, OPPONENT_LEFT, { playerId, opponentId });
            } catch (error) {
                console.error('Failed to notify opponent about disconnect', error);
            }
            await removeGameRecord(game.id);
        }
    }

    return respond(200, { status: 'left' });
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
    if (event.httpMethod === 'OPTIONS') {
        return textResponse(200, 'OK');
    }

    if (event.httpMethod !== 'POST') {
        return respond(405, { error: 'Method not allowed' });
    }

    const contentType = event.headers['content-type'] ?? event.headers['Content-Type'];
    let body: RequestBody = {};
    try {
        body =
            contentType?.includes('application/json') && event.body
                ? JSON.parse(event.body)
                : event.body
                  ? (Object.fromEntries(new URLSearchParams(event.body)) as RequestBody)
                  : {};
    } catch (error) {
        console.error('Failed to parse move payload', error);
        return respond(400, { error: 'Invalid request body' });
    }

    const action = body.action;
    const playerId = body.playerId;

    if (!action || !playerId) {
        return respond(400, { error: 'Missing action or playerId' });
    }

    switch (action) {
        case 'create':
            return handleCreateGame(playerId);
        case 'join':
            if (!body.gameId) {
                return respond(400, { error: 'Missing gameId' });
            }
            return handleJoinGame(playerId, body.gameId);
        case 'queue':
            return handleQueue(playerId);
        case 'move':
            if (!body.move?.from || !body.move?.to) {
                return respond(400, { error: 'Invalid move payload' });
            }
            return handleMove(playerId, body.move);
        case 'leave':
            return handleLeave(playerId, body.gameId);
        default:
            return respond(400, { error: 'Unsupported action' });
    }
};
