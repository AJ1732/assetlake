import { createAssetLake } from "@assetlake/core";
import {
  createManualClock,
  createPngBytes,
  InMemoryStore,
  silentLogger,
} from "@assetlake/core/testing";
import { expect, vi } from "vitest";

import type { RouteDependencies } from "@/lib/server/dependencies";
import { createQuotaCounters, createUploadQuota } from "@/lib/server/quota";
import {
  createSessionCodec,
  type DemoSession,
  SESSION_COOKIE_NAME,
} from "@/lib/server/sessionToken";

export const TEST_TOKEN = "sk-test-write-token-must-never-leak";
export const TEST_PASSCODE = "campus-demo-passcode";
export const TEST_SECRET = "test-session-secret-with-at-least-32-chars";
export const APPLICATION_ID = "assetlake-application-campus-demo";
export const BASE_URL = "http://localhost:3000";
const POLICY_ID = "assetlake-policy-public-profile-images";

export const RESULT_KEYS = [
  "aspectRatio",
  "assetId",
  "blurHash",
  "height",
  "id",
  "lqip",
  "mimeType",
  "size",
  "status",
  "url",
  "width",
];

/** Real core facade over the in-memory store, so policy rejections come from core itself. */
export function createTestContext({ dailyCap = 200 } = {}) {
  const store = new InMemoryStore({
    applications: [
      { id: APPLICATION_ID, slug: "campus-demo", defaultPolicyId: POLICY_ID },
    ],
    policies: [
      {
        id: POLICY_ID,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        maxFileSizeBytes: 5 * 1024 * 1024,
        minWidth: null,
        minHeight: null,
        maxWidth: null,
        maxHeight: null,
        requiresReview: false,
      },
    ],
  });
  const clock = createManualClock();
  const assetLake = createAssetLake(
    {
      projectId: "testproject",
      dataset: "test",
      apiVersion: "2026-10-04",
      token: TEST_TOKEN,
    },
    { store, logger: silentLogger, clock },
  );
  const sessions = createSessionCodec({ secret: TEST_SECRET, clock });
  const dependencies: RouteDependencies = {
    images: assetLake.images,
    applicationId: APPLICATION_ID,
    sessions,
    quota: createUploadQuota({
      images: assetLake.images,
      applicationId: APPLICATION_ID,
      dailyCap,
      clock,
      counters: createQuotaCounters(),
    }),
    passcode: TEST_PASSCODE,
    secureCookies: false,
  };

  async function signIn(): Promise<{ session: DemoSession; cookie: string }> {
    const { session, cookieValue } = await sessions.issue();
    return { session, cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` };
  }

  return { store, clock, assetLake, sessions, dependencies, signIn };
}

export type TestContext = ReturnType<typeof createTestContext>;

interface UploadRequestOptions {
  cookie?: string;
  bytes?: Uint8Array;
  contentType?: string;
  filename?: string;
  purpose?: string;
  alt?: string;
  headers?: Record<string, string>;
  omitContentLength?: boolean;
}

/** Serialises a real multipart body so content-type boundary and content-length are genuine. */
export async function uploadRequest({
  cookie,
  bytes = createPngBytes(8, 8),
  contentType = "image/png",
  filename = "avatar.png",
  purpose = "avatar",
  alt,
  headers = {},
  omitContentLength = false,
}: UploadRequestOptions = {}): Promise<Request> {
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array(bytes)], filename, { type: contentType }),
  );
  form.set("purpose", purpose);
  if (alt !== undefined) form.set("alt", alt);

  const encoded = new Response(form);
  const body = new Uint8Array(await encoded.arrayBuffer());
  const requestHeaders = new Headers(headers);
  requestHeaders.set("content-type", encoded.headers.get("content-type") ?? "");
  if (!omitContentLength && !requestHeaders.has("content-length"))
    requestHeaders.set("content-length", String(body.byteLength));
  if (cookie) requestHeaders.set("cookie", cookie);

  return new Request(`${BASE_URL}/api/assets/images`, {
    method: "POST",
    body,
    headers: requestHeaders,
  });
}

export const deleteRequest = (id: string, cookie?: string) =>
  new Request(`${BASE_URL}/api/assets/images/${id}`, {
    method: "DELETE",
    headers: cookie ? { cookie } : {},
  });

export function sessionRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(`${BASE_URL}/api/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(new TextEncoder().encode(text).byteLength),
      ...headers,
    },
    body: text,
  });
}

/** Stores an image owned by the given session, bypassing HTTP. */
export const seedImage = (
  context: TestContext,
  session: DemoSession,
  seed = 1,
) =>
  context.assetLake.images.upload({
    body: createPngBytes(8, 8, seed),
    filename: "seed.png",
    contentType: "image/png",
    applicationId: APPLICATION_ID,
    purpose: "avatar",
    entity: { type: "user", id: session.userId },
    actorId: session.userId,
  });

export async function expectNoSecret(response: Response): Promise<void> {
  expect(await response.clone().text()).not.toContain(TEST_TOKEN);
  response.headers.forEach((value) => expect(value).not.toContain(TEST_TOKEN));
}

export async function expectFailure(
  response: Response,
  status: number,
  code: string,
): Promise<{ code: string; message: string }> {
  expect(response.status).toBe(status);
  const body = await response.clone().json();
  expect(body).toEqual({
    success: false,
    error: { code, message: expect.any(String) },
  });
  return body.error;
}

export function stubServerEnvironment(overrides: Record<string, string> = {}) {
  const values = {
    SANITY_DATASET: "test",
    SANITY_API_VERSION: "2026-10-04",
    SANITY_WRITE_TOKEN: TEST_TOKEN,
    ASSETLAKE_DEMO_PASSCODE: TEST_PASSCODE,
    ASSETLAKE_SESSION_SECRET: TEST_SECRET,
    ASSETLAKE_DAILY_UPLOAD_CAP: "200",
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}
