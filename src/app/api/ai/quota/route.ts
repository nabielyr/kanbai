import { type QuotaResponse } from "@/lib/ai/schemas";
import { identifyCaller } from "@/server/caller";
import { getCounterStore } from "@/server/counter-store";
import { getServerEnv } from "@/server/env";
import { getFreeTriesLeft, readGuestIdentity } from "@/server/guest-quota";
import { getChunksLeftToday, rateLimitsFromEnv, userSubject } from "@/server/rate-limit";

// GET /api/ai/quota: what this visitor has left, for the badge: free tries for guests,
// chunks for today for logged-in users. It reads the request, so it always runs at request
// time (never prerendered).

const NO_LIMIT: QuotaResponse = { freeTriesLeft: null, chunksLeftToday: null };

function json(body: QuotaResponse): Response {
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  const caller = await identifyCaller();
  if (caller.kind === "no-login") return json(NO_LIMIT);

  const env = getServerEnv();
  try {
    const store = getCounterStore(env);
    if (caller.kind === "user") {
      const left = await getChunksLeftToday(
        store,
        userSubject(caller.userId),
        rateLimitsFromEnv(env),
      );
      return json({ freeTriesLeft: null, chunksLeftToday: left });
    }
    const guest = await readGuestIdentity(request.headers, env.IP_HASH_SALT);
    const left = await getFreeTriesLeft(store, guest, env.GUEST_FREE_CHUNKS);
    return json({ freeTriesLeft: left, chunksLeftToday: null });
  } catch (thrown) {
    // The badge is a hint; the chunk route still enforces the limits.
    console.error("[kanbai] Couldn't read the quota", thrown);
    return json(NO_LIMIT);
  }
}
