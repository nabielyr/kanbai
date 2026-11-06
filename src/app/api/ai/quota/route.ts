import { type FreeTriesResponse } from "@/lib/ai/schemas";
import { identifyCaller } from "@/server/caller";
import { getCounterStore } from "@/server/counter-store";
import { getServerEnv } from "@/server/env";
import { getFreeTriesLeft, readGuestIdentity } from "@/server/guest-quota";

// GET /api/ai/quota: how many free "Chunk it" tries this guest has left, for the badge.
// It reads the request, so it always runs at request time (never prerendered).

function json(body: FreeTriesResponse): Response {
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  if ((await identifyCaller()).kind !== "guest") return json({ freeTriesLeft: null });

  const env = getServerEnv();
  try {
    const guest = await readGuestIdentity(request.headers, env.IP_HASH_SALT);
    const left = await getFreeTriesLeft(getCounterStore(env), guest, env.GUEST_FREE_CHUNKS);
    return json({ freeTriesLeft: left });
  } catch (thrown) {
    // The badge is a hint; the chunk route still enforces the limit.
    console.error("[kanbai] Couldn't read guest tries", thrown);
    return json({ freeTriesLeft: null });
  }
}
