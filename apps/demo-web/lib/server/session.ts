import "server-only";

import { cookies } from "next/headers";

import { serverEnv as environment } from "./env";
import {
  createSessionCodec,
  type DemoSession,
  SESSION_COOKIE_NAME,
  type SessionCodec,
} from "./sessionToken";
import { systemClock } from "./systemClock";

export type { DemoSession } from "./sessionToken";

let codec: SessionCodec | undefined;

export function getSessionCodec(): SessionCodec {
  codec ??= createSessionCodec({
    secret: environment.ASSETLAKE_SESSION_SECRET,
    clock: systemClock,
  });
  return codec;
}

/** For Server Components and Server Actions. Route Handlers read the cookie off the Request. */
export async function getSession(): Promise<DemoSession | null> {
  const cookieStore = await cookies();
  return getSessionCodec().verify(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
