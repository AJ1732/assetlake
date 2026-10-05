import { describe, expect, it } from "vitest";

import { checkSourceUrl } from "./check-source-url";

const ALLOWED = ["uploads.example.com", "*.bucket.example.net"];
const SIGNATURE = "X-Amz-Signature=deadbeefcafe";

function rejection(url: string, allowedHosts: string[] = ALLOWED) {
  try {
    checkSourceUrl(url, allowedHosts);
  } catch (error) {
    return error as Error & { code?: string };
  }
  throw new Error(`expected ${url} to be rejected`);
}

describe("checkSourceUrl", () => {
  it.each([
    [
      "an exact host",
      "https://uploads.example.com/a.png",
      "uploads.example.com",
    ],
    [
      "a subdomain under a wildcard",
      "https://eu.bucket.example.net/a.png",
      "eu.bucket.example.net",
    ],
    [
      "a mixed-case host",
      "https://UPLOADS.Example.com/a.png",
      "uploads.example.com",
    ],
  ])("accepts %s and returns its host", (_label, url, host) => {
    expect(checkSourceUrl(`${url}?${SIGNATURE}`, ALLOWED)).toBe(host);
  });

  it.each([
    ["http", "http://uploads.example.com/a.png"],
    ["a host off the list", "https://evil.example.org/a.png"],
    [
      "userinfo that spoofs the host",
      "https://uploads.example.com@evil.example.org/a.png",
    ],
    ["credentials", "https://user:pass@uploads.example.com/a.png"],
    ["an explicit port", "https://uploads.example.com:8443/a.png"],
    ["the bare wildcard apex", "https://bucket.example.net/a.png"],
    ["a suffix without a dot boundary", "https://evilbucket.example.net/a.png"],
    ["a lookalike suffix", "https://uploads.example.com.evil.org/a.png"],
    ["an IP literal", "https://127.0.0.1/a.png"],
    ["text that is not a URL", "not a url"],
  ])("rejects %s with SOURCE_URL_NOT_ALLOWED", (_label, url) => {
    expect(rejection(url).code).toBe("SOURCE_URL_NOT_ALLOWED");
  });

  it("rejects every URL when no hosts are allowed", () => {
    expect(rejection("https://uploads.example.com/a.png", []).code).toBe(
      "SOURCE_URL_NOT_ALLOWED",
    );
  });

  it("never echoes the URL, which may carry a presigned signature", () => {
    const error = rejection(`https://evil.example.org/a.png?${SIGNATURE}`);

    expect(error.message).not.toContain("deadbeefcafe");
    expect(error.message).not.toContain("evil.example.org");
  });
});
