import { chunkRequestSchema, makeApiError, type ApiError } from "@/lib/ai/schemas";
import { chunkTask, createProviders } from "@/server/ai/chunk-service";
import { getServerEnv } from "@/server/env";

// POST /api/ai/chunk — "Chunk it". Guest quota and rate limits are added in later steps.
// POST handlers are never cached, so no route segment config is needed.

const MAX_BODY_BYTES = 8 * 1024;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function error(status: number, body: ApiError): Response {
  const retryAfter = body.error.retryAfterSec;
  return json(body, status, retryAfter === undefined ? {} : { "retry-after": String(retryAfter) });
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

  try {
    const result = await chunkTask(parsed.data, {
      providers: createProviders(getServerEnv()),
      signal: request.signal,
    });
    return result.ok ? json(result.response) : error(result.status, result.body);
  } catch (thrown) {
    // The visitor cancelled (closed the dialog); nobody is waiting for an answer.
    if (request.signal.aborted) return new Response(null, { status: 499 });
    throw thrown;
  }
}
