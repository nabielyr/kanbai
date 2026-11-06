import "server-only";
import type { CounterStore } from "./counter-store";

// Guests get a few free "Chunk it" tries, counted on the server. Each guest is counted under
// a salted hash of their IP address and under a device cookie; the higher count wins, so
// neither clearing cookies nor switching networks resets it.

export const DEVICE_COOKIE = "kanbai_device";
/** Browsers cap cookie lifetime at 400 days, so that's "never expires". */
const DEVICE_COOKIE_MAX_AGE_SEC = 400 * 24 * 60 * 60;
/** Counts fade after 30 quiet days, so a shared IP (school, office) isn't blocked forever. */
export const GUEST_COUNT_TTL_SEC = 30 * 24 * 60 * 60;

const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;

export interface GuestIdentity {
  ipHash: string;
  deviceId: string;
  /** The browser had no (valid) device cookie: send `deviceCookie(deviceId)` back. */
  isNewDevice: boolean;
}

/** The visitor's IP as the host saw it (Vercel sets x-forwarded-for; first entry = client). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** IPs are never stored: only a salted SHA-256 hash of them. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(header: string | null, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export async function readGuestIdentity(
  headers: Headers,
  salt: string,
  makeDeviceId: () => string = () => crypto.randomUUID(),
): Promise<GuestIdentity> {
  const cookie = readCookie(headers.get("cookie"), DEVICE_COOKIE);
  const valid = cookie !== undefined && DEVICE_ID.test(cookie);
  return {
    ipHash: await hashIp(clientIp(headers), salt),
    deviceId: valid ? cookie : makeDeviceId(),
    isNewDevice: !valid,
  };
}

/** The Set-Cookie value that remembers this device. */
export function deviceCookie(deviceId: string, secure: boolean): string {
  return [
    `${DEVICE_COOKIE}=${deviceId}`,
    "Path=/",
    `Max-Age=${DEVICE_COOKIE_MAX_AGE_SEC}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

function counterKeys(identity: GuestIdentity): string[] {
  return [`kanbai:guest:ip:${identity.ipHash}`, `kanbai:guest:dev:${identity.deviceId}`];
}

export async function getFreeTriesLeft(
  store: CounterStore,
  identity: GuestIdentity,
  limit: number,
): Promise<number> {
  const used = Math.max(...(await store.get(counterKeys(identity))));
  return Math.max(0, limit - used);
}

export type GuestReservation =
  { ok: true; left: number; refund: () => Promise<void> } | { ok: false; left: 0 };

/**
 * Takes one free try before the AI runs, so parallel requests can't slip past the limit.
 * Call `refund()` when the try didn't produce anything (AI failed, visitor cancelled).
 */
export async function reserveGuestTry(
  store: CounterStore,
  identity: GuestIdentity,
  limit: number,
): Promise<GuestReservation> {
  const keys = counterKeys(identity);
  const used = Math.max(...(await store.add(keys, 1, GUEST_COUNT_TTL_SEC)));
  const giveBack = async () => {
    try {
      await store.add(keys, -1, GUEST_COUNT_TTL_SEC);
    } catch (error) {
      // The guest loses one try at worst.
      console.error("[kanbai] Couldn't give back a guest try", error);
    }
  };

  if (used > limit) {
    await giveBack();
    return { ok: false, left: 0 };
  }
  let refunded = false;
  return {
    ok: true,
    left: limit - used,
    refund: async () => {
      if (refunded) return;
      refunded = true;
      await giveBack();
    },
  };
}
