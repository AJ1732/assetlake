import {
  assetHash,
  expect,
  logIn,
  requirePasscode,
  test,
  uploadAvatar,
} from "./fixtures/playground";

test.describe("upload then read from cdn.sanity.io", () => {
  test.beforeEach(() => requirePasscode());

  test("avatar and preset matrix render straight from cdn.sanity.io", async ({
    page,
    baseURL,
    uploads,
  }) => {
    const requests: Array<{ url: string; type: string }> = [];
    page.on("request", (request) =>
      requests.push({ url: request.url(), type: request.resourceType() }),
    );

    await logIn(page);
    const image = await uploadAvatar(page, uploads);
    const hash = assetHash(image.assetId);
    expect(new URL(image.url).host).toBe("cdn.sanity.io");

    const avatar = page
      .getByTestId("profile-card")
      .locator("[data-assetlake-image]");
    await expect(avatar).toHaveAttribute("src", new RegExp(hash), {
      timeout: 15_000,
    });

    const matrix = page
      .getByTestId("preset-matrix")
      .locator("[data-assetlake-image]");
    await expect(matrix.first()).toBeVisible();

    const rendered = page.locator(
      '[data-testid="profile-card"] img, [data-testid="preset-matrix"] img',
    );
    const sources = await rendered.evaluateAll((images) =>
      images.map(
        (element) =>
          (element as HTMLImageElement).currentSrc ||
          (element as HTMLImageElement).src,
      ),
    );
    expect(sources.length).toBeGreaterThanOrEqual(3);
    for (const source of sources)
      expect(new URL(source).host).toBe("cdn.sanity.io");

    const matrixSources = await matrix.evaluateAll((images) =>
      images.map((element) => (element as HTMLImageElement).src),
    );
    const sameAsset = matrixSources.filter((source) => source.includes(hash));
    const sizeVariants = new Set(
      sameAsset.map((source) => {
        const parameters = new URL(source).searchParams;
        return `${parameters.get("w")}x${parameters.get("h")}`;
      }),
    );
    expect(sizeVariants.size).toBeGreaterThanOrEqual(2);

    const appOrigin = new URL(baseURL!).origin;
    expect(
      requests.filter((request) => request.url.includes("/_next/image")),
    ).toEqual([]);
    // Network requests only: a blob: preview shares the app's origin but never leaves the browser.
    const isNetworkRequest = (url: string) => /^https?:/.test(url);
    expect(
      requests.filter(
        (request) =>
          request.type === "image" &&
          isNetworkRequest(request.url) &&
          new URL(request.url).origin === appOrigin,
      ),
    ).toEqual([]);
  });
});
