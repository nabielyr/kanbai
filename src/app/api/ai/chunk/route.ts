import {
  chunkRequestSchema,
  FREE_TRIES_HEADER,
  makeApiError,
  type ApiError,
} from "@/lib/ai/schemas";
import { chunkTask, createProviders } from "@/server/ai/chunk-service";
import { identifyCaller } from "@/server/caller";
import { getCounterStore } from "@/server/counter-store";
import { getServerEnv } from "@/server/env";
import {
  deviceCookie,
  readGuestIdentity,
  reserveGuestTry,
  type GuestReservation,
} from "@/server/guest-quota";

// POST /api/ai/chunk — "Chunk it". Guests get a few free tries (then LOGIN_REQUIRED);
// rate limits for everyone are added in a later step.
// POST handlers are never cached, so no route segment config is needed.

const MAX_BODY_BYTES = 8 * 1024;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function error(status: number, body: ApiError, headers: Record<string, string> = {}): Response {
  const retryAfter = body.error.retryAfterSec;
  return json(body, status, {
    ...headers,
    ...(retryAfter === undefined ? {} : { "retry-after": String(retryAfter) }),
  });
}

/** Only the app itself may call this route (blocks other sites using a visitor's browser). */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return error(403, makeApiError("VALIDATION", "Requests must come from the KanbAI app."));
  }

  const tooLarge = makeApiError("VALIDATION", "The task is too long.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return error(413, tooLarge);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return error(413, tooLarge);

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return error(400, makeApiError("VALIDATION", "The request body must be JSON."));
  }
  const parsed = chunkRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join(".") || "body";
    return error(400, makeApiError("VALIDATION", `Invalid ${field}.`));
  }

  const env = getServerEnv();
  const headers: Record<string, string> = {};
  let reservation: GuestReservation | null = null;

  if ((await identifyCaller()).kind === "guest") {
    const guest = await readGuestIdentity(request.headers, env.IP_HASH_SALT);
    if (guest.isNewDevice) {
      const secure = new URL(request.url).protocol === "https:";
      headers["set-cookie"] = deviceCookie(guest.deviceId, secure);
    }
    try {
      reservation = await reserveGuestTry(getCounterStore(env), guest, env.GUEST_FREE_CHUNKS);
    } catch (thrown) {
      // Without the counter, free tries can't be checked; logged-in users are unaffected.
      console.error("[kanbai] Guest quota check failed", thrown);
      return error(
        503,
        makeApiError("UNAVAILABLE", "AI is unavailable for guests right now. Log in to use it."),
        headers,
      );
    }
    headers[FREE_TRIES_HEADER] = String(reservation.left);
    if (!reservation.ok) {
      const limit = env.GUEST_FREE_CHUNKS;
      const message =
        limit === 0
          ? "Log in free to use Chunk it."
          : `You've used your ${limit} free ${limit === 1 ? "chunk" : "chunks"}. Log in free to keep going.`;
      return error(401, makeApiError("LOGIN_REQUIRED", message), headers);
    }
  }

  try {
    const result = await chunkTask(parsed.data, {
      providers: createProviders(env),
      signal: request.signal,
    });
    if (result.ok) return json(result.response, 200, headers);
    // A failed try doesn't count.
    if (reservation?.ok) {
      await reservation.refund();
      headers[FREE_TRIES_HEADER] = String(reservation.left + 1);
    }
    return error(result.status, result.body, headers);
  } catch (thrown) {
    if (reservation?.ok) await reservation.refund();
    // The visitor cancelled (closed the dialog); nobody is waiting for an answer.
    if (request.signal.aborted) return new Response(null, { status: 499 });
    throw thrown;
  }
}
