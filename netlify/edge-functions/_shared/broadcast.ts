import { PLAYER_CHANNEL } from "./constants";
import type { GameEvent } from "./constants";

export const publishToPlayer = (playerId: string, event: GameEvent) => {
  const channelName = PLAYER_CHANNEL(playerId);
  const channel = new BroadcastChannel(channelName);
  try {
    channel.postMessage(event);
  } finally {
    channel.close();
  }
};
