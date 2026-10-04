import { AssetLakeError } from "@assetlake/core";
import { describe, expect, it, vi } from "vitest";

import { failure } from "@/lib/server/http-errors";
import { withRequestLog } from "@/lib/server/request-log";

import { BASE_URL, TEST_TOKEN } from "./support/fixtures";

function recorder() {
  const lines: Record<string, unknown>[] = [];
  return { lines, write: (line: string) => lines.push(JSON.parse(line)) };
}

const request = () => new Request(`${BASE_URL}/api/x`, { method: "POST" });

describe("withRequestLog", () => {
  it("writes one line with route, method, status, durationMs and actorId", async () => {
    const { lines, write } = recorder();
    const handler = withRequestLog(
      "POST /api/x",
      async () => ({
        response: new Response(null, { status: 204 }),
        actorId: "user-demo-aaaaaaaa",
      }),
      write,
    );

    const response = await handler(request());

    expect(response.status).toBe(204);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      level: "info",
      event: "HTTP_REQUEST",
      at: expect.any(String),
      route: "POST /api/x",
      method: "POST",
      status: 204,
      durationMs: expect.any(Number),
      actorId: "user-demo-aaaaaaaa",
    });
  });

  it("turns a thrown error into a generic 500 and logs its name only", async () => {
    const { lines, write } = recorder();
    const handler = withRequestLog(
      "POST /api/x",
      async () => {
        throw new TypeError(`leaked ${TEST_TOKEN}`);
      },
      write,
    );

    const response = await handler(request());

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(TEST_TOKEN);
    expect(lines[0]).toMatchObject({
      level: "error",
      status: 500,
      actorId: null,
      errorName: "TypeError",
    });
    expect(JSON.stringify(lines)).not.toContain(TEST_TOKEN);
  });

  it("logs the AssetLake error code a handler reports", async () => {
    const { lines, write } = recorder();
    const error = new AssetLakeError("FORBIDDEN", "not yours");
    const handler = withRequestLog(
      "DELETE /api/x",
      async () => ({
        response: failure("FORBIDDEN", error.message),
        actorId: "user-demo-aaaaaaaa",
        error,
      }),
      write,
    );

    await handler(request());

    expect(lines[0]).toMatchObject({
      status: 403,
      errorName: "AssetLakeError",
      errorCode: "FORBIDDEN",
    });
    expect(JSON.stringify(lines)).not.toContain("not yours");
  });

  it("writes to the console.log in effect at request time, not at wrap time", async () => {
    const handler = withRequestLog("POST /api/x", async () => ({
      response: new Response(null, { status: 204 }),
      actorId: null,
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await handler(request());
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });

  it("passes route context through to the handler", async () => {
    const { write } = recorder();
    const handler = withRequestLog(
      "DELETE /api/x/[id]",
      async (
        _request: Request,
        { params }: { params: Promise<{ id: string }> },
      ) => ({
        response: Response.json({ id: (await params).id }),
        actorId: null,
      }),
      write,
    );

    const response = await handler(request(), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(await response.json()).toEqual({ id: "abc" });
  });
});
