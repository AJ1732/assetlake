import { getRouteDependencies } from "@/lib/server/dependencies";
import { clearSession, createSession } from "@/lib/server/http/sessionHandlers";
import { withRequestLog } from "@/lib/server/requestLog";

export const POST = withRequestLog("POST /api/session", (request) =>
  createSession(request, getRouteDependencies()),
);

export const DELETE = withRequestLog("DELETE /api/session", (request) =>
  clearSession(request, getRouteDependencies()),
);
