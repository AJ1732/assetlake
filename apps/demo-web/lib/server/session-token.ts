import "server-only";

import type { Clock } from "@assetlake/core";
import type { EntityRef } from "@assetlake/core/contracts";
import { z } from "zod";

export interface DemoSession {
  userId: string;
  issuedAt: number;
}

export const SESSION_COOKIE_NAME = "assetlake_session";
export const SESSION_MAX_AGE_SECONDS = 86_400;

const USER_ID_PREFIX = "user-demo-";
const USER_ID_RANDOM_LENGTH = 8;
const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";
// 252 = 7 * 36: bytes at or above it are discarded so every base36 digit is equally likely.
const UNBIASED_BYTE_LIMIT = 252;
// Domain separation: a passcode MAC can never double as a session MAC.
const PASSCODE_CONTEXT = "passcode:";

const sessionPayloadSchema = z.object({
  userId: z.string().regex(/^user-demo-[0-9a-z]{8}$/),
  issuedAt: z.number().int().nonnegative(),
});

const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64url");

const fromBase64Url = (value: string) =>
  new Uint8Array(Buffer.from(value, "base64url"));

type FillRandom = (buffer: Uint8Array) => void;

const fillCryptoRandom: FillRandom = (buffer) => {
  crypto.getRandomValues(buffer);
};

export function generateDemoUserId(
  fillRandom: FillRandom = fillCryptoRandom,
): string {
  const characters: string[] = [];
  const buffer = new Uint8Array(16);
  while (characters.length < USER_ID_RANDOM_LENGTH) {
    fillRandom(buffer);
    for (const byte of buffer) {
      if (byte >= UNBIASED_BYTE_LIMIT) continue;
      if (characters.length === USER_ID_RANDOM_LENGTH) break;
      characters.push(BASE36[byte % BASE36.length]);
    }
  }
  return USER_ID_PREFIX + characters.join("");
}

function parsePayload(payload: string): DemoSession | null {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return sessionPayloadSchema.safeParse(decoded).data ?? null;
  } catch {
    return null;
  }
}

/**
 * Cookie value = base64url(payload).base64url(HMAC-SHA256(payload)). Expiry is enforced here,
 * not only through the cookie's Max-Age, because a client can replay a cookie it kept.
 */
export function createSessionCodec({
  secret,
  clock,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
}: {
  secret: string;
  clock: Clock;
  maxAgeSeconds?: number;
}) {
  const keyPromise = crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  const sign = async (data: string) =>
    new Uint8Array(
      await crypto.subtle.sign("HMAC", await keyPromise, encoder.encode(data)),
    );

  // subtle.verify compares in constant time.
  const verifySignature = async (data: string, signature: Uint8Array) =>
    crypto.subtle.verify(
      "HMAC",
      await keyPromise,
      new Uint8Array(signature),
      encoder.encode(data),
    );

  return {
    async issue(): Promise<{ session: DemoSession; cookieValue: string }> {
      const session: DemoSession = {
        userId: generateDemoUserId(),
        issuedAt: clock.now().getTime(),
      };
      const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
      return {
        session,
        cookieValue: `${payload}.${toBase64Url(await sign(payload))}`,
      };
    },

    async verify(cookieValue: string | undefined): Promise<DemoSession | null> {
      const [payload, signature, ...rest] = (cookieValue ?? "").split(".");
      if (!payload || !signature || rest.length > 0) return null;
      if (!(await verifySignature(payload, fromBase64Url(signature))))
        return null;

      const session = parsePayload(payload);
      if (!session) return null;
      const age = clock.now().getTime() - session.issuedAt;
      return age >= 0 && age < maxAgeSeconds * 1000 ? session : null;
    },

    /** Constant-time and length-independent: both sides are reduced to a MAC before comparing. */
    async matchesPasscode(
      candidate: string,
      expected: string,
    ): Promise<boolean> {
      const expectedSignature = await sign(PASSCODE_CONTEXT + expected);
      return verifySignature(PASSCODE_CONTEXT + candidate, expectedSignature);
    },
  };
}

export type SessionCodec = ReturnType<typeof createSessionCodec>;

export function sessionCookie(
  value: string,
  { secure }: { secure: boolean },
): string {
  return cookieHeader(value, SESSION_MAX_AGE_SECONDS, secure);
}

export function clearedSessionCookie({ secure }: { secure: boolean }): string {
  return cookieHeader("", 0, secure);
}

function cookieHeader(value: string, maxAge: number, secure: boolean): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${value}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === SESSION_COOKIE_NAME)
      return pair.slice(separator + 1).trim();
  }
  return undefined;
}

export const sessionEntity = (session: DemoSession): EntityRef => ({
  type: "user",
  id: session.userId,
});
