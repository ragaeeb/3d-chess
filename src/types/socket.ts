export const INIT_GAME = 'game-start' as const;
export const MOVE = 'move' as const;
export const GAME_OVER = 'game_over' as const;
export const OPPONENT_LEFT = 'opponent_left' as const;
export const ERROR = 'error' as const;

export type ServerMessageType = typeof INIT_GAME | typeof MOVE | typeof GAME_OVER | typeof OPPONENT_LEFT | typeof ERROR;
