const PLAYER_ID_STORAGE_KEY = 'chessie:playerId';

const isBrowser = () => typeof window !== 'undefined';

export const readStoredPlayerId = (): string | null => {
    if (!isBrowser()) {
        return null;
    }

    try {
        return window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to read player id from storage', error);
        return null;
    }
};

export const persistPlayerId = (playerId: string): string => {
    if (isBrowser()) {
        try {
            window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);
        } catch (error) {
            console.warn('Failed to persist player id', error);
        }
    }

    return playerId;
};

export const ensurePlayerId = (): string => {
    const existing = readStoredPlayerId();
    if (existing) {
        return existing;
    }

    const id = crypto.randomUUID();
    return persistPlayerId(id);
};
