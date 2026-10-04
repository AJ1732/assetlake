import { getRouteDependencies } from "@/lib/server/dependencies";
import {
  clearSession,
  createSession,
} from "@/lib/server/http/session-handlers";
import { withRequestLog } from "@/lib/server/request-log";

export const POST = withRequestLog("POST /api/session", (request) =>
  createSession(request, getRouteDependencies()),
);

export const DELETE = withRequestLog("DELETE /api/session", (request) =>
  clearSession(request, getRouteDependencies()),
);
