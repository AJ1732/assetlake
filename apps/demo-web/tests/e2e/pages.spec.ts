import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/playground", "/live", "/architecture", "/docs"];

test.describe("public pages", () => {
  for (const route of ROUTES) {
    test(`${route} renders one h1 and no horizontal scroll at 375px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("pages that mention uploads say public images only", async ({
    page,
  }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.getByText(/public images only/i).first()).toBeVisible();
    }
  });

  test("/playground asks for the passcode without a session", async ({
    page,
  }) => {
    await page.goto("/playground");
    await expect(
      page.getByLabel("Demo passcode", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("upload-panel")).toHaveCount(0);
  });

  test("/live shows the feed shell from the public dataset", async ({
    page,
  }) => {
    await page.goto("/live");
    await expect(page.getByTestId("live-feed")).toHaveAttribute(
      "data-status",
      /ready|error/,
    );
  });
});
