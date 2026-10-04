import { describe, expect, it } from "vitest";

import { DEFAULT_API_VERSION, DEFAULT_DATASET } from "../project";
import { readSeedConfig } from "./seedConfig";

const TOKEN = "sk-test-not-a-real-token";

describe("readSeedConfig", () => {
  it("requires a write token", () => {
    expect(() => readSeedConfig({ SANITY_DATASET: "production" }, [])).toThrow(
      /SANITY_WRITE_TOKEN/,
    );
  });

  it("defaults to the production dataset, pinned api version, and non-destructive mode", () => {
    expect(readSeedConfig({ SANITY_WRITE_TOKEN: TOKEN }, [])).toEqual({
      dataset: DEFAULT_DATASET,
      apiVersion: DEFAULT_API_VERSION,
      token: TOKEN,
      mode: "create-if-missing",
    });
  });

  it("switches to reset mode only when --reset is passed", () => {
    expect(
      readSeedConfig({ SANITY_WRITE_TOKEN: TOKEN }, ["--reset"]).mode,
    ).toBe("reset");
  });

  it.each(["Production", "-test", "test-", "a".repeat(65), "has.dot"])(
    "rejects invalid dataset name %s",
    (dataset) => {
      expect(() =>
        readSeedConfig(
          { SANITY_WRITE_TOKEN: TOKEN, SANITY_DATASET: dataset },
          [],
        ),
      ).toThrow(/Invalid SANITY_DATASET/);
    },
  );

  it("accepts the test dataset", () => {
    expect(
      readSeedConfig({ SANITY_WRITE_TOKEN: TOKEN, SANITY_DATASET: "test" }, [])
        .dataset,
    ).toBe("test");
  });
});
