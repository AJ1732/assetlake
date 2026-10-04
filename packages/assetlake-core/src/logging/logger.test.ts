import { describe, expect, it } from "vitest";

import { createJsonLogger, redact } from "./logger";

describe("logger", () => {
  it("redacts credential-shaped keys at any depth and summarises binary bodies", () => {
    expect(
      redact({
        token: "sk-1",
        nested: {
          Authorization: "Bearer x",
          sessionSecret: "s",
          cookie: "c",
          keep: 1,
        },
        body: new Uint8Array(10),
      }),
    ).toEqual({
      token: "[redacted]",
      nested: {
        Authorization: "[redacted]",
        sessionSecret: "[redacted]",
        cookie: "[redacted]",
        keep: 1,
      },
      body: "[10 bytes]",
    });
  });

  it("writes one JSON line per event with level and event code", () => {
    const lines: string[] = [];
    createJsonLogger((line) => lines.push(line)).log(
      "info",
      "ASSET_UPLOAD_COMPLETED",
      { imageId: "a", token: "t" },
    );
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      level: "info",
      event: "ASSET_UPLOAD_COMPLETED",
      imageId: "a",
      token: "[redacted]",
    });
  });
});
