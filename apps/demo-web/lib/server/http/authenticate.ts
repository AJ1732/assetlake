import "server-only";

import { failure } from "../httpErrors";
import type { HandlerResult } from "../requestLog";
import {
  type DemoSession,
  readSessionCookie,
  type SessionCodec,
} from "../sessionToken";

export type SessionVerifier = Pick<SessionCodec, "verify">;

export const authenticate = (
  request: Request,
  sessions: SessionVerifier,
): Promise<DemoSession | null> => sessions.verify(readSessionCookie(request));

export const unauthenticated = (): HandlerResult => ({
  response: failure("UNAUTHENTICATED", "Sign in with the demo passcode first."),
  actorId: null,
});
