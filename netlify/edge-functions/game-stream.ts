import {
  EVENT_TYPES,
  PLAYER_CHANNEL,
  type GameEvent,
} from "./_shared/constants";
import { handlePlayerDisconnect } from "./_shared/disconnect";

const encoder = new TextEncoder();

const formatEvent = (event: GameEvent) => `data: ${JSON.stringify(event)}\n\n`;

export default async (request: Request, _context?: unknown) => {
  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId");

  if (!playerId) {
    return new Response("Missing playerId", { status: 400 });
  }

  let channel: BroadcastChannel | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendEvent = (event: GameEvent) => {
        try {
          controller.enqueue(encoder.encode(formatEvent(event)));
        } catch (error) {
          console.error("Failed to send SSE event", error);
        }
      };

      channel = new BroadcastChannel(PLAYER_CHANNEL(playerId));
      channel.onmessage = (message: MessageEvent) => {
        const event = message.data as GameEvent;
        sendEvent(event);
      };

      sendEvent({ type: EVENT_TYPES.KEEPALIVE });
      keepAliveTimer = setInterval(() => {
        sendEvent({ type: EVENT_TYPES.KEEPALIVE });
      }, 25000);

      const onAbort = () => {
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
          keepAliveTimer = null;
        }

        channel?.close();
        controller.close();
        handlePlayerDisconnect(playerId).catch((error) => {
          console.error("Failed to cleanup player disconnect", error);
        });
      };

      request.signal.addEventListener("abort", onAbort, { once: true });
    },
    cancel() {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      channel?.close();
      handlePlayerDisconnect(playerId).catch((error) => {
        console.error("Failed to cleanup player disconnect", error);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};

export const config = { path: "/api/game/stream" };
