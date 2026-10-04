import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import {
  BASE_URL,
  deleteRequest,
  expectFailure,
  sessionRequest,
  stubServerEnvironment,
  TEST_PASSCODE,
  uploadRequest,
} from "./support/fixtures";

// Imports the real route modules against a stubbed environment. Only paths that stop before
// Sanity are exercised, so the gate lane stays offline.
const importRoutes = async () => ({
  session: await import("@/app/api/session/route"),
  images: await import("@/app/api/assets/images/route"),
  image: await import("@/app/api/assets/images/[id]/route"),
});

const imageContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe("route wiring", () => {
  let log: MockInstance<typeof console.log> | undefined;

  beforeAll(() => stubServerEnvironment());
  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => log?.mockRestore());

  const captureLog = () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log = spy;
    return () =>
      spy.mock.calls.map(
        ([line]) => JSON.parse(String(line)) as Record<string, unknown>,
      );
  };

  it("POST /api/assets/images without a cookie: 401 and one log line", async () => {
    const lines = captureLog();
    const { images } = await importRoutes();

    const response = await images.POST(await uploadRequest());

    await expectFailure(response, 401, "UNAUTHENTICATED");
    expect(lines()).toEqual([
      expect.objectContaining({
        event: "HTTP_REQUEST",
        route: "POST /api/assets/images",
        method: "POST",
        status: 401,
        durationMs: expect.any(Number),
        actorId: null,
      }),
    ]);
  });

  it("DELETE /api/assets/images/[id] without a cookie: 401", async () => {
    captureLog();
    const { image } = await importRoutes();
    const response = await image.DELETE(
      deleteRequest("assetlake-image-1"),
      imageContext("assetlake-image-1"),
    );
    await expectFailure(response, 401, "UNAUTHENTICATED");
  });

  it("POST /api/session with a wrong passcode: 401", async () => {
    captureLog();
    const { session } = await importRoutes();
    const response = await session.POST(sessionRequest({ passcode: "nope" }));
    await expectFailure(response, 401, "UNAUTHENTICATED");
  });

  it("a cookie issued by /api/session authenticates /api/assets/images/[id]", async () => {
    const lines = captureLog();
    const { session, image } = await importRoutes();

    const login = await session.POST(
      sessionRequest({ passcode: TEST_PASSCODE }),
    );
    expect(login.status).toBe(200);
    const { data } = await login.json();
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

    // A malformed id is refused after authentication and before core, so no network call.
    const response = await image.DELETE(
      deleteRequest("bad.id", cookie),
      imageContext("bad.id"),
    );

    await expectFailure(response, 400, "BAD_REQUEST");
    expect(lines().at(-1)).toMatchObject({
      route: "DELETE /api/assets/images/[id]",
      status: 400,
      actorId: data.userId,
    });
  });

  it("DELETE /api/session: 204 and a cleared cookie", async () => {
    captureLog();
    const { session } = await importRoutes();
    const response = await session.DELETE(
      new Request(`${BASE_URL}/api/session`, { method: "DELETE" }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
