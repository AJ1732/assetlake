import "server-only";

import type { ApiSuccess } from "@assetlake/core/contracts";
import { z } from "zod";

import { failure } from "../httpErrors";
import type { HandlerResult } from "../requestLog";
import {
  clearedSessionCookie,
  type SessionCodec,
  sessionCookie,
} from "../sessionToken";

export interface SessionDependencies {
  sessions: Pick<SessionCodec, "issue" | "matchesPasscode">;
  passcode: string;
  secureCookies: boolean;
}

const sessionRequestSchema = z.object({ passcode: z.string().max(256) });

// request.json() buffers the whole body, and this route is open to anyone.
export const MAX_SESSION_BODY_BYTES = 1024;

async function readSessionBody(request: Request): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (!declaredLength || !(Number(declaredLength) <= MAX_SESSION_BODY_BYTES))
    return null;
  return request.json().catch(() => null);
}

export async function createSession(
  request: Request,
  { sessions, passcode, secureCookies }: SessionDependencies,
): Promise<HandlerResult> {
  const body = sessionRequestSchema.safeParse(await readSessionBody(request));
  // A malformed body still runs the passcode check so every failure takes the same path.
  const matches = await sessions.matchesPasscode(
    body.success ? body.data.passcode : "",
    passcode,
  );
  if (!body.success || !matches)
    return {
      response: failure("UNAUTHENTICATED", "That passcode is not right."),
      actorId: null,
    };

  const { session, cookieValue } = await sessions.issue();
  const payload: ApiSuccess<{ userId: string }> = {
    success: true,
    data: { userId: session.userId },
  };
  return {
    response: Response.json(payload, {
      status: 200,
      headers: {
        "Set-Cookie": sessionCookie(cookieValue, { secure: secureCookies }),
      },
    }),
    actorId: session.userId,
  };
}

export async function clearSession(
  _request: Request,
  { secureCookies }: Pick<SessionDependencies, "secureCookies">,
): Promise<HandlerResult> {
  return {
    response: new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie": clearedSessionCookie({ secure: secureCookies }),
      },
    }),
    actorId: null,
  };
}
