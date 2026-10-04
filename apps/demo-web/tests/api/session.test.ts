import { createManualClock } from "@assetlake/core/testing";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  clearSession,
  createSession,
  MAX_SESSION_BODY_BYTES,
} from "@/lib/server/http/sessionHandlers";
import {
  createSessionCodec,
  generateDemoUserId,
  readSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/server/sessionToken";

import {
  BASE_URL,
  createTestContext,
  expectFailure,
  sessionRequest,
  stubServerEnvironment,
  TEST_PASSCODE,
  TEST_SECRET,
} from "./support/fixtures";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const ONE_DAY_IN_MILLISECONDS = 86_400_000;

describe("POST /api/session", () => {
  it("rejects a wrong passcode with 401 and sets no cookie", async () => {
    const { dependencies } = createTestContext();
    const { response, actorId } = await createSession(
      sessionRequest({ passcode: "wrong" }),
      dependencies,
    );

    await expectFailure(response, 401, "UNAUTHENTICATED");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(actorId).toBeNull();
  });

  it.each([
    ["non-JSON body", "passcode=campus"],
    ["missing passcode", {}],
    ["non-string passcode", { passcode: 42 }],
    ["prefix of the passcode", { passcode: TEST_PASSCODE.slice(0, 4) }],
  ])("rejects a %s with the same 401", async (_label, body) => {
    const { dependencies } = createTestContext();
    const { response } = await createSession(
      sessionRequest(body),
      dependencies,
    );
    const error = await expectFailure(response, 401, "UNAUTHENTICATED");
    expect(error.message).toBe("That passcode is not right.");
  });

  it("refuses to read an oversized or unsized body", async () => {
    const { dependencies } = createTestContext();
    const json = vi.fn();
    for (const headers of [
      { "content-length": String(MAX_SESSION_BODY_BYTES + 1) },
      { "content-length": "" },
      { "content-length": "lots" },
    ]) {
      const request = sessionRequest({ passcode: TEST_PASSCODE }, headers);
      vi.spyOn(request, "json").mockImplementation(json);
      const { response } = await createSession(request, dependencies);
      await expectFailure(response, 401, "UNAUTHENTICATED");
    }
    expect(json).not.toHaveBeenCalled();
  });

  it("issues an HttpOnly, Lax, one-day cookie for the right passcode", async () => {
    const { dependencies, sessions } = createTestContext();
    const { response, actorId } = await createSession(
      sessionRequest({ passcode: TEST_PASSCODE }),
      dependencies,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toMatch(/^user-demo-[0-9a-z]{8}$/);
    expect(actorId).toBe(body.data.userId);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^assetlake_session=[\w-]+\.[\w-]+; /);
    for (const attribute of [
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=86400",
    ])
      expect(setCookie).toContain(attribute);
    expect(setCookie).not.toContain("Secure");

    const cookieRequest = new Request(BASE_URL, {
      headers: { cookie: setCookie.split(";")[0] },
    });
    await expect(
      sessions.verify(readSessionCookie(cookieRequest)),
    ).resolves.toEqual({
      userId: body.data.userId,
      issuedAt: expect.any(Number),
    });
  });

  it("marks the cookie Secure in production", async () => {
    const { dependencies } = createTestContext();
    const { response } = await createSession(
      sessionRequest({ passcode: TEST_PASSCODE }),
      { ...dependencies, secureCookies: true },
    );
    expect(response.headers.get("set-cookie")).toMatch(/; Secure$/);
  });
});

describe("DELETE /api/session", () => {
  it("clears the cookie with 204", async () => {
    const { response } = await clearSession(sessionRequest({}), {
      secureCookies: false,
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBe(
      "assetlake_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    );
  });
});

describe("session token", () => {
  const issueWith = async (clock = createManualClock()) => {
    const codec = createSessionCodec({ secret: TEST_SECRET, clock });
    return { codec, clock, ...(await codec.issue()) };
  };

  it("rejects a payload swapped for another user", async () => {
    const { codec, cookieValue } = await issueWith();
    const [, signature] = cookieValue.split(".");
    const forged = Buffer.from(
      JSON.stringify({ userId: "user-demo-aaaaaaaa", issuedAt: 0 }),
    ).toString("base64url");
    await expect(codec.verify(`${forged}.${signature}`)).resolves.toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const { codec, cookieValue } = await issueWith();
    const [payload, signature] = cookieValue.split(".");
    // The first base64url character carries six full bits, so changing it always changes the MAC.
    const tampered = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    await expect(codec.verify(`${payload}.${tampered}`)).resolves.toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const { cookieValue, clock } = await issueWith();
    const other = createSessionCodec({
      secret: "a-different-secret-that-is-also-long-enough",
      clock,
    });
    await expect(other.verify(cookieValue)).resolves.toBeNull();
  });

  it.each([undefined, "", "abc", "a.b.c", ".", "not-base64.!!!"])(
    "rejects malformed cookie value %j",
    async (value) => {
      const { codec } = await issueWith();
      await expect(codec.verify(value)).resolves.toBeNull();
    },
  );

  it("expires exactly at max age, enforced on the server", async () => {
    const { codec, clock, cookieValue, session } = await issueWith();
    clock.advance(ONE_DAY_IN_MILLISECONDS - 1);
    await expect(codec.verify(cookieValue)).resolves.toEqual(session);
    clock.advance(1);
    await expect(codec.verify(cookieValue)).resolves.toBeNull();
  });

  it("rejects a token issued in the future", async () => {
    const { cookieValue } = await issueWith(
      createManualClock(new Date("2026-10-05T00:00:00.000Z")),
    );
    const earlier = createSessionCodec({
      secret: TEST_SECRET,
      clock: createManualClock(new Date("2026-10-04T00:00:00.000Z")),
    });
    await expect(earlier.verify(cookieValue)).resolves.toBeNull();
  });

  it("compares passcodes by MAC: equal only for the exact string", async () => {
    const { codec } = await issueWith();
    await expect(
      codec.matchesPasscode(TEST_PASSCODE, TEST_PASSCODE),
    ).resolves.toBe(true);
    for (const candidate of [
      "",
      "campus",
      `${TEST_PASSCODE} `,
      "CAMPUS-DEMO-PASSCODE",
    ])
      await expect(
        codec.matchesPasscode(candidate, TEST_PASSCODE),
      ).resolves.toBe(false);
  });

  it("builds user ids from unbiased base36 digits", () => {
    const fill = (buffer: Uint8Array) => {
      buffer.fill(0);
      // 255 and 252 are discarded; 35 -> z, 36 -> 0, 71 -> z.
      buffer.set([255, 252, 35, 36, 71]);
    };
    expect(generateDemoUserId(fill)).toBe("user-demo-z0z00000");
    expect(generateDemoUserId()).toMatch(/^user-demo-[0-9a-z]{8}$/);
  });

  it("reads only the session cookie from a cookie header", () => {
    const request = new Request(BASE_URL, {
      headers: {
        cookie: `other=1; broken; ${SESSION_COOKIE_NAME}=a.b; trailing=2`,
      },
    });
    expect(readSessionCookie(request)).toBe("a.b");
    expect(readSessionCookie(new Request(BASE_URL))).toBeUndefined();
  });
});

describe("getSession (B04 server-module contract)", () => {
  afterAll(() => vi.unstubAllEnvs());

  it("verifies the cookie from next/headers", async () => {
    stubServerEnvironment();
    const { cookies } = await import("next/headers");
    const { getSession, getSessionCodec } =
      await import("@/lib/server/session");
    const { session, cookieValue } = await getSessionCodec().issue();
    const cookieStore = (value?: string) =>
      ({
        get: (name: string) =>
          name === SESSION_COOKIE_NAME && value ? { name, value } : undefined,
      }) as unknown as Awaited<ReturnType<typeof cookies>>;

    vi.mocked(cookies).mockResolvedValueOnce(cookieStore(cookieValue));
    await expect(getSession()).resolves.toEqual(session);

    vi.mocked(cookies).mockResolvedValueOnce(cookieStore());
    await expect(getSession()).resolves.toBeNull();

    vi.mocked(cookies).mockResolvedValueOnce(cookieStore(`${cookieValue}x`));
    await expect(getSession()).resolves.toBeNull();
  });
});
