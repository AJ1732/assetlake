import { describe, expect, it } from "vitest";

import {
  DEFAULT_DATASET,
  DEFAULT_PROJECT_ID,
  resolveSanityProject,
} from "./project";

const VARIABLES = { projectId: "APP_PROJECT_ID", dataset: "APP_DATASET" };

describe("resolveSanityProject", () => {
  it("falls back to the demo project when nothing is set", () => {
    expect(resolveSanityProject({}, VARIABLES)).toEqual({
      projectId: DEFAULT_PROJECT_ID,
      dataset: DEFAULT_DATASET,
    });
  });

  it("reads the variables it is given", () => {
    expect(
      resolveSanityProject(
        { APP_PROJECT_ID: "abc123", APP_DATASET: "staging_2" },
        VARIABLES,
      ),
    ).toEqual({ projectId: "abc123", dataset: "staging_2" });
  });

  it("treats blank and whitespace values as unset and trims the rest", () => {
    expect(
      resolveSanityProject(
        { APP_PROJECT_ID: "  ", APP_DATASET: " test " },
        VARIABLES,
      ),
    ).toEqual({ projectId: DEFAULT_PROJECT_ID, dataset: "test" });
  });

  it("ignores variables with other names", () => {
    expect(
      resolveSanityProject({ SANITY_PROJECT_ID: "abc123" }, VARIABLES)
        .projectId,
    ).toBe(DEFAULT_PROJECT_ID);
  });

  it.each(["Has-Caps", "has space", "dots.not.allowed"])(
    "rejects project id %j by variable name",
    (projectId) => {
      expect(() =>
        resolveSanityProject({ APP_PROJECT_ID: projectId }, VARIABLES),
      ).toThrow("Invalid Sanity project settings: APP_PROJECT_ID");
    },
  );

  it.each(["Production", "-test", "test-", "a".repeat(65), "has.dot"])(
    "rejects dataset %j by variable name",
    (dataset) => {
      expect(() =>
        resolveSanityProject({ APP_DATASET: dataset }, VARIABLES),
      ).toThrow("Invalid Sanity project settings: APP_DATASET");
    },
  );

  it("names every invalid variable and never echoes a value", () => {
    let message = "";
    try {
      resolveSanityProject(
        { APP_PROJECT_ID: "BAD-ID", APP_DATASET: "BAD.SET" },
        VARIABLES,
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe(
      "Invalid Sanity project settings: APP_PROJECT_ID, APP_DATASET",
    );
  });
});
