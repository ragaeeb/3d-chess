import { Redis } from '@upstash/redis';

export type PlayerColor = 'white' | 'black';

export type GameRecord = {
    id: string;
    fen: string;
    players: Record<PlayerColor, string>;
    lastUpdated: number;
    status: 'active' | 'finished';
};

export type PlayerAssignment = {
    gameId: string;
    color: PlayerColor;
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const WAITING_KEY = 'chessie:waiting-player';
const assignmentKey = (playerId: string) => `chessie:assignment:${playerId}`;
const gameKey = (gameId: string) => `chessie:game:${gameId}`;

const GAME_TTL_SECONDS = 60 * 60 * 24; // 24h safeguard

type MemoryStore = {
    waitingPlayer: string | null;
    games: Map<string, GameRecord>;
    assignments: Map<string, PlayerAssignment>;
};

type GlobalWithStore = typeof globalThis & { __memoryGameStore?: MemoryStore };
type ProcessWithStore = NodeJS.Process & { __memoryGameStore?: MemoryStore };

const resolveMemoryStore = (): MemoryStore => {
    const globalWithStore = globalThis as GlobalWithStore;
    const processWithStore = typeof process !== 'undefined' ? (process as ProcessWithStore) : undefined;

    if (processWithStore?.__memoryGameStore) {
        if (!globalWithStore.__memoryGameStore) {
            globalWithStore.__memoryGameStore = processWithStore.__memoryGameStore;
        }
        return processWithStore.__memoryGameStore;
    }

    if (!globalWithStore.__memoryGameStore) {
        globalWithStore.__memoryGameStore = {
            waitingPlayer: null,
            games: new Map<string, GameRecord>(),
            assignments: new Map<string, PlayerAssignment>(),
        } satisfies MemoryStore;
        if (processWithStore) {
            processWithStore.__memoryGameStore = globalWithStore.__memoryGameStore;
        }
    }

    return globalWithStore.__memoryGameStore;
};

const memoryStore = resolveMemoryStore();

const serialize = (value: unknown) => JSON.stringify(value);

const parseStoredValue = <T>(value: unknown): T | null => {
    if (value == null || value === '') {
        return null;
    }

    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch (error) {
            console.error('Failed to parse stored value', error);
            return null;
        }
    }

    return value as T;
};

const EMPTY_VALUE = '';

const CLAIM_WAITING_LUA = `
local current = redis.call('GET', KEYS[1])
if (not current) or current == '' then
  redis.call('SET', KEYS[1], ARGV[1])
  return ''
end
if current == ARGV[1] then
  return ''
end
redis.call('DEL', KEYS[1])
return current
`;

const CLEAR_WAITING_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1])
end
return 1
`;

const useRedisStore = Boolean(redis);

export const isRedisBacked = useRedisStore;

export const claimWaitingPlayer = async (playerId: string): Promise<string | null> => {
    if (!redis) {
        const waiting = memoryStore.waitingPlayer;
        if (!waiting || waiting === playerId) {
            memoryStore.waitingPlayer = playerId;
            return null;
        }
        memoryStore.waitingPlayer = null;
        return waiting;
    }

    const result = await redis.eval<string | null>(CLAIM_WAITING_LUA, [WAITING_KEY], [playerId]);
    if (!result || result === EMPTY_VALUE) {
        return null;
    }
    return result;
};

export const setWaitingPlayer = async (playerId: string | null) => {
    if (!redis) {
        memoryStore.waitingPlayer = playerId;
        return;
    }

    if (!playerId) {
        await redis.del(WAITING_KEY);
        return;
    }

    await redis.set(WAITING_KEY, playerId);
};

export const clearWaitingPlayer = async (playerId: string) => {
    if (!redis) {
        if (memoryStore.waitingPlayer === playerId) {
            memoryStore.waitingPlayer = null;
        }
        return;
    }

    await redis.eval<number>(CLEAR_WAITING_LUA, [WAITING_KEY], [playerId]);
};

export const getAssignment = async (playerId: string): Promise<PlayerAssignment | null> => {
    if (!redis) {
        return memoryStore.assignments.get(playerId) ?? null;
    }
    const value = await redis.get<PlayerAssignment | string>(assignmentKey(playerId));
    return parseStoredValue<PlayerAssignment>(value);
};

export const setAssignment = async (playerId: string, assignment: PlayerAssignment) => {
    if (!redis) {
        memoryStore.assignments.set(playerId, assignment);
        return;
    }

    await redis.set(assignmentKey(playerId), serialize(assignment), { ex: GAME_TTL_SECONDS });
};

export const removeAssignment = async (playerId: string) => {
    if (!redis) {
        memoryStore.assignments.delete(playerId);
        return;
    }

    await redis.del(assignmentKey(playerId));
};

export const getGameRecord = async (gameId: string): Promise<GameRecord | null> => {
    if (!redis) {
        return memoryStore.games.get(gameId) ?? null;
    }

    const value = await redis.get<GameRecord | string>(gameKey(gameId));
    return parseStoredValue<GameRecord>(value);
};

export const saveGameRecord = async (record: GameRecord) => {
    if (!redis) {
        memoryStore.games.set(record.id, record);
        return;
    }

    await redis.set(gameKey(record.id), serialize(record), { ex: GAME_TTL_SECONDS });
};

export const updateGameFen = async (gameId: string, fen: string) => {
    if (!redis) {
        const record = memoryStore.games.get(gameId);
        if (!record) {
            return;
        }
        record.fen = fen;
        record.lastUpdated = Date.now();
        memoryStore.games.set(gameId, record);
        return;
    }

    const record = await getGameRecord(gameId);
    if (!record) {
        return;
    }
    record.fen = fen;
    record.lastUpdated = Date.now();
    await saveGameRecord(record);
};

export const removeGameRecord = async (gameId: string) => {
    if (!redis) {
        const record = memoryStore.games.get(gameId);
        if (!record) {
            return;
        }
        memoryStore.games.delete(gameId);
        await removeAssignment(record.players.white);
        await removeAssignment(record.players.black);
        return;
    }

    const record = await getGameRecord(gameId);
    if (!record) {
        return;
    }
    await redis.del(gameKey(gameId));
    await removeAssignment(record.players.white);
    await removeAssignment(record.players.black);
};

export const ensureGameRecord = async (gameId: string, create: () => GameRecord): Promise<GameRecord> => {
    const existing = await getGameRecord(gameId);
    if (existing) {
        return existing;
    }
    const next = create();
    await saveGameRecord(next);
    return next;
};
