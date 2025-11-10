import { NextRequest } from "next/server";
import { gameManager } from "@/lib/gameManager";
import { KEEPALIVE } from "@/types/socket";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");

  if (!playerId) {
    return new Response(JSON.stringify({ error: "Missing playerId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      gameManager.addConnection(playerId, controller);
      const keepAlive = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: KEEPALIVE })}\n\n`));
      }, 25000);
      gameManager.registerKeepAlive(playerId, keepAlive);

      const onAbort = () => {
        clearInterval(keepAlive);
        gameManager.removeConnection(playerId);
        controller.close();
      };

      req.signal.addEventListener("abort", onAbort);
    },
    cancel() {
      gameManager.removeConnection(playerId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
