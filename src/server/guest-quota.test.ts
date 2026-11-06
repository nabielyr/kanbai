// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createMemoryCounterStore, type CounterStore } from "./counter-store";
import {
  clientIp,
  DEVICE_COOKIE,
  deviceCookie,
  getFreeTriesLeft,
  hashIp,
  readGuestIdentity,
  reserveGuestTry,
  type GuestIdentity,
} from "./guest-quota";

const DEVICE = "0f6b1c9e-2a4d-4c8e-9b7a-3d2e1f0a9b8c";

const guest = (overrides: Partial<GuestIdentity> = {}): GuestIdentity => ({
  ipHash: "ip-1",
  deviceId: "device-1",
  isNewDevice: false,
  ...overrides,
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("hashIp", () => {
  it("is a salted SHA-256 hex digest that never contains the IP", async () => {
    const hash = await hashIp("203.0.113.7", "salt");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(await hashIp("203.0.113.7", "salt"));
    expect(hash).not.toBe(await hashIp("203.0.113.7", "other salt"));
  });
});

describe("readGuestIdentity", () => {
  it("reuses a valid device cookie", async () => {
    const headers = new Headers({
      cookie: `theme=dark; ${DEVICE_COOKIE}=${DEVICE}`,
      "x-forwarded-for": "203.0.113.7",
    });
    const identity = await readGuestIdentity(headers, "salt");
    expect(identity).toEqual({
      ipHash: await hashIp("203.0.113.7", "salt"),
      deviceId: DEVICE,
      isNewDevice: false,
    });
  });

  it("makes a new device id when the cookie is missing or tampered with", async () => {
    const makeId = () => DEVICE;
    for (const cookie of ["", `${DEVICE_COOKIE}=short`, `${DEVICE_COOKIE}=${"x".repeat(80)}`]) {
      const identity = await readGuestIdentity(new Headers({ cookie }), "salt", makeId);
      expect(identity).toMatchObject({ deviceId: DEVICE, isNewDevice: true });
    }
  });
});

describe("deviceCookie", () => {
  it("is long-lived, httpOnly and Secure on https", () => {
    expect(deviceCookie(DEVICE, true)).toBe(
      `${DEVICE_COOKIE}=${DEVICE}; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax; Secure`,
    );
    expect(deviceCookie(DEVICE, false)).not.toContain("Secure");
  });
});

describe("reserveGuestTry", () => {
  it("allows `limit` tries, then refuses", async () => {
    const store = createMemoryCounterStore();
    const lefts = [];
    for (let i = 0; i < 3; i++) lefts.push((await reserveGuestTry(store, guest(), 3)).left);
    expect(lefts).toEqual([2, 1, 0]);

    expect(await reserveGuestTry(store, guest(), 3)).toEqual({ ok: false, left: 0 });
    expect(await getFreeTriesLeft(store, guest(), 3)).toBe(0);
  });

  it("counts the higher of IP and device, so a new cookie or network doesn't reset it", async () => {
    const store = createMemoryCounterStore();
    for (let i = 0; i < 3; i++) await reserveGuestTry(store, guest(), 3);

    expect((await reserveGuestTry(store, guest({ deviceId: "device-2" }), 3)).ok).toBe(false);
    expect((await reserveGuestTry(store, guest({ ipHash: "ip-2" }), 3)).ok).toBe(false);
    expect((await reserveGuestTry(store, guest({ ipHash: "ip-2", deviceId: "d-3" }), 3)).ok).toBe(
      true,
    );
  });

  it("gives a try back on refund (once), and refusals don't pile up", async () => {
    const store = createMemoryCounterStore();
    const first = await reserveGuestTry(store, guest(), 1);
    expect(await reserveGuestTry(store, guest(), 1)).toMatchObject({ ok: false });
    expect(await getFreeTriesLeft(store, guest(), 1)).toBe(0);

    if (!first.ok) throw new Error("expected a try");
    await first.refund();
    await first.refund();
    expect(await getFreeTriesLeft(store, guest(), 1)).toBe(1);
  });

  it("refuses everything when the limit is 0", async () => {
    expect(await reserveGuestTry(createMemoryCounterStore(), guest(), 0)).toMatchObject({
      ok: false,
    });
  });

  it("passes store failures to the caller", async () => {
    const broken: CounterStore = {
      add: async () => {
        throw new Error("down");
      },
      get: async () => [0],
    };
    await expect(reserveGuestTry(broken, guest(), 3)).rejects.toThrow("down");
  });
});
