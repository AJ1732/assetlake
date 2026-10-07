import { setImmediate } from "node:timers/promises";

import { describe, expect, it } from "vitest";

import type { UploadImageInput } from "../contracts";
import type { LogEvent } from "../logging/logger";
import { createPngBytes, signatureBytes } from "../testing/image-fixtures";
import {
  APPLICATION_ID,
  createScenario,
  POLICY_ID,
  type ScenarioOptions,
} from "../testing/scenario";

const SOURCE = "https://uploads.example.com/photo.png";
const CLOSING_EVENTS: readonly LogEvent[] = [
  "ASSET_UPLOAD_COMPLETED",
  "ASSET_UPLOAD_REPLAYED",
  "ASSET_UPLOAD_REJECTED",
  "ASSET_UPLOAD_FAILED",
];

const bytesInput = (
  overrides: Partial<UploadImageInput> = {},
): UploadImageInput => ({
  body: createPngBytes(600, 400),
  filename: "avatar.png",
  contentType: "image/png",
  applicationId: APPLICATION_ID,
  purpose: "avatar",
  entity: { type: "user", id: "user-demo-001" },
  actorId: "user-demo-001",
  ...overrides,
});

const httpError = (statusCode: number) =>
  Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });

type Scenario = ReturnType<typeof createScenario>;

interface ClosingCase {
  label: string;
  scenario?: ScenarioOptions;
  arrange?: (scenario: Scenario) => Promise<void> | void;
  input?: Partial<UploadImageInput>;
  fromUrl?: boolean;
  event: LogEvent;
  fields?: Record<string, unknown>;
}

const REPLAY_KEY = { idempotencyKey: "retry-1" };

async function uploadOnce(scenario: Scenario) {
  await scenario.assetLake.images.upload(bytesInput(REPLAY_KEY));
}

const CASES: ClosingCase[] = [
  { label: "a stored upload", event: "ASSET_UPLOAD_COMPLETED" },
  {
    label: "an idempotent replay",
    arrange: uploadOnce,
    input: REPLAY_KEY,
    event: "ASSET_UPLOAD_REPLAYED",
  },
  {
    label: "a retry that loses the create race",
    arrange: async (scenario) => {
      await uploadOnce(scenario);
      const realFind = scenario.store.findImage.bind(scenario.store);
      let lookups = 0;
      scenario.store.findImage = async (id) =>
        (lookups += 1) === 1 ? null : realFind(id);
    },
    input: { ...REPLAY_KEY, body: createPngBytes(30, 30, 9) },
    event: "ASSET_UPLOAD_REPLAYED",
  },
  {
    label: "a failed replay lookup",
    arrange: ({ store }) => store.failNext("findImage"),
    input: REPLAY_KEY,
    event: "ASSET_UPLOAD_FAILED",
    fields: { code: "UPLOAD_FAILED", stage: "lookup" },
  },
  {
    label: "a failed policy lookup",
    arrange: ({ store }) => store.failNext("findApplicationPolicy"),
    event: "ASSET_UPLOAD_FAILED",
    fields: { code: "UPLOAD_FAILED", stage: "lookup" },
  },
  {
    label: "an unknown application",
    input: { applicationId: "assetlake-application-missing" },
    event: "ASSET_UPLOAD_FAILED",
    fields: { code: "APPLICATION_NOT_FOUND", stage: "lookup" },
  },
  {
    label: "an unknown requested policy",
    input: { policyId: "assetlake-policy-missing" },
    event: "ASSET_UPLOAD_FAILED",
    fields: { code: "POLICY_NOT_FOUND", stage: "lookup" },
  },
  {
    label: "a missing default policy",
    arrange: ({ store }) => {
      store.policies.delete(POLICY_ID);
    },
    event: "ASSET_UPLOAD_FAILED",
    fields: { code: "POLICY_NOT_FOUND", stage: "lookup" },
  },
  {
    label: "a file the policy refuses before upload",
    input: { contentType: "image/gif", body: signatureBytes("image/gif") },
    event: "ASSET_UPLOAD_REJECTED",
    fields: { code: "UNSUPPORTED_IMAGE_TYPE", stage: "before-upload" },
  },
  {
    label: "a failed byte upload",
    arrange: ({ store }) => store.failNext("uploadImageAsset"),
    event: "ASSET_UPLOAD_FAILED",
    fields: { code: "UPLOAD_FAILED", stage: "store" },
  },
  {
    label: "a timed-out URL fetch",
    fromUrl: true,
    arrange: ({ store }) =>
      store.failNext("uploadImageAssetFromUrl", httpError(504)),
    event: "ASSET_UPLOAD_FAILED",
    fields: { code: "SOURCE_FETCH_FAILED", stage: "store", mayExist: true },
  },
  {
    label: "a URL source Sanity cannot decode",
    fromUrl: true,
    arrange: ({ store }) =>
      store.failNext("uploadImageAssetFromUrl", httpError(422)),
    event: "ASSET_UPLOAD_REJECTED",
    fields: { code: "UNSUPPORTED_IMAGE_TYPE", stage: "store" },
  },
  {
    label: "a stored file the policy refuses",
    scenario: { policy: { minWidth: 1000 } },
    event: "ASSET_UPLOAD_REJECTED",
    fields: {
      code: "DIMENSIONS_OUT_OF_RANGE",
      stage: "after-upload",
      assetId: expect.any(String),
    },
  },
  {
    label: "a failed record write",
    arrange: ({ store }) => store.failNext("createImage"),
    event: "ASSET_UPLOAD_FAILED",
    fields: {
      code: "METADATA_CREATE_FAILED",
      stage: "record",
      assetId: expect.any(String),
    },
  },
];

function attempt(scenario: Scenario, testCase: ClosingCase) {
  const input = bytesInput(testCase.input);
  if (!testCase.fromUrl) return scenario.assetLake.images.upload(input);
  const {
    body: _body,
    filename: _filename,
    contentType: _type,
    ...rest
  } = input;
  return scenario.assetLake.images.uploadFromUrl({ ...rest, url: SOURCE });
}

describe("upload closing event", () => {
  it.each(CASES)(
    "logs exactly one closing event for $label",
    async (testCase) => {
      const scenario = createScenario({
        ...testCase.scenario,
        config: { remoteUploads: { allowedHosts: ["uploads.example.com"] } },
      });
      scenario.store.serveRemote(SOURCE, createPngBytes(600, 400));
      await testCase.arrange?.(scenario);
      scenario.entries.length = 0;

      await attempt(scenario, testCase).catch(() => undefined);

      const closing = scenario.entries.filter(({ event }) =>
        CLOSING_EVENTS.includes(event),
      );
      expect(scenario.events()[0]).toBe("ASSET_UPLOAD_STARTED");
      expect(closing).toEqual([
        expect.objectContaining({
          event: testCase.event,
          fields: expect.objectContaining({
            durationMs: expect.any(Number),
            ...testCase.fields,
          }),
        }),
      ]);
    },
  );

  it("surfaces every failure as an AssetLakeError that keeps the cause", async () => {
    const { assetLake, store } = createScenario();
    const original = new Error("dataset unavailable");
    store.failNext("findApplicationPolicy", original);

    await expect(assetLake.images.upload(bytesInput())).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
      cause: original,
    });
  });
});

describe("upload round trips", () => {
  it("checks for a replay while the policy lookup is still in flight", async () => {
    const { assetLake, store } = createScenario();
    let releasePolicy!: () => void;
    const policyHeld = new Promise<void>((resolve) => {
      releasePolicy = resolve;
    });
    const realLookup = store.findApplicationPolicy.bind(store);
    store.findApplicationPolicy = async (query) => {
      await policyHeld;
      return realLookup(query);
    };

    const upload = assetLake.images.upload(bytesInput(REPLAY_KEY));
    await setImmediate();
    expect(store.callCount("findImage")).toBe(1);

    releasePolicy();
    await expect(upload).resolves.toMatchObject({ status: "ready" });
  });

  it("reads the application and its policy in one store call", async () => {
    const { assetLake, store } = createScenario();

    await assetLake.images.upload(bytesInput());

    expect(store.callCount("findApplicationPolicy")).toBe(1);
    expect(store.callCount()).toBe(3);
  });
});
