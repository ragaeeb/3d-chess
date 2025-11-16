import { getAssignment, getGameRecord } from './utils/gameStore';
import type { NetlifyEvent, NetlifyResponse } from './utils/http';
import { getCorsHeaders, jsonResponse, textResponse } from './utils/http';
import { getServerPusher } from './utils/pusher';

const parseBody = (body: string | null, contentType?: string) => {
  if (!body) {
    return {} as Record<string, string>;
  }

  if (contentType?.includes("application/json")) {
    try {
      return JSON.parse(body) as Record<string, string>;
    } catch (error) {
      console.error("Failed to parse JSON auth payload", error);
      return {} as Record<string, string>;
    }
  }

  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const channelSuffix = (channelName: string, prefix: string) =>
  channelName.startsWith(prefix) ? channelName.slice(prefix.length) : null;

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return textResponse(200, "OK");
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const payload = parseBody(event.body, event.headers["content-type"] ?? event.headers["Content-Type"]);
  const socketId = payload.socket_id;
  const channelName = payload.channel_name;
  const playerId = payload.playerId ?? payload.player_id;

  if (!socketId || !channelName || !playerId) {
    return jsonResponse(400, { error: "Missing authentication parameters" });
  }

  try {
    const corsHeaders = getCorsHeaders();
    const pusher = getServerPusher();
    if (channelName.startsWith("private-player-")) {
      const requestedPlayer = channelSuffix(channelName, "private-player-");
      if (requestedPlayer !== playerId) {
        return jsonResponse(403, { error: "Cannot subscribe to another player's channel" });
      }

      const auth = pusher.authorizeChannel(socketId, channelName);
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(auth),
      };
    }

    if (channelName.startsWith("private-game-") || channelName.startsWith("presence-game-")) {
      const suffix = channelName.replace(/^(private|presence)-game-/, "");
      const assignment = await getAssignment(playerId);
      const game = await getGameRecord(suffix);

      const isPlayer = Boolean(assignment && assignment.gameId === suffix);
      const isSpectator = Boolean(game && game.spectators.includes(playerId));

      if (!isPlayer && !isSpectator) {
        return jsonResponse(403, { error: "Player is not part of this game" });
      }

      if (channelName.startsWith("presence-game-")) {
        const auth = pusher.authorizeChannel(socketId, channelName, {
          user_id: playerId,
          user_info: {
            color: assignment?.color ?? null,
            role: isSpectator ? 'spectator' : assignment?.color,
          },
        });
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(auth),
        };
      }

      const auth = pusher.authorizeChannel(socketId, channelName);
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(auth),
      };
    }

    return jsonResponse(403, { error: "Unknown channel" });
  } catch (error) {
    console.error("Failed to authorize Pusher channel", error);
    return jsonResponse(500, { error: "Failed to authorize" });
  }
};
