import { describe, expect, it } from "vitest";

import { createImageUrls, responsiveWidths } from "./imageUrls";

const urls = createImageUrls({
  projectId: "testproject",
  dataset: "production",
});
const assetId = "image-928ac96d53b0c9049836c86ff25fd3c009039a16-1200x800-png";
const base =
  "https://cdn.sanity.io/images/testproject/production/928ac96d53b0c9049836c86ff25fd3c009039a16-1200x800.png";

const params = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("buildUrl", () => {
  it("serves from cdn.sanity.io with every transform mapped to a pipeline parameter", () => {
    const url = urls.buildUrl(assetId, {
      width: 256,
      height: 256,
      fit: "crop",
      crop: "entropy",
      quality: 82,
      autoFormat: true,
    });
    expect(url.startsWith(base)).toBe(true);
    expect(params(url)).toEqual({
      w: "256",
      h: "256",
      fit: "crop",
      crop: "entropy",
      q: "82",
      auto: "format",
    });
  });

  it("adds no parameters for an empty transform", () => {
    expect(urls.buildUrl(assetId, {})).toBe(base);
  });
});

describe("responsiveWidths", () => {
  it.each([
    [undefined, [256, 512, 768]],
    [1600, [256, 512, 768]],
    [640, [256, 512]],
    [96, [96]],
  ])("for transform width %s yields %o", (width, expected) => {
    expect(responsiveWidths(width)).toEqual(expected);
  });
});

describe("buildResponsive", () => {
  it("builds a bounded srcSet that keeps the preset aspect ratio", () => {
    const image = urls.buildResponsive(assetId, {
      width: 640,
      height: 360,
      fit: "crop",
      autoFormat: true,
    });
    const candidates = image.srcSet.split(", ");
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatch(/w=256&h=144.* 256w$/);
    expect(candidates[1]).toMatch(/w=512&h=288.* 512w$/);
    expect(image).toMatchObject({
      width: 512,
      height: 288,
      src: candidates[1].replace(/ 512w$/, ""),
    });
  });

  it("uses the original aspect ratio for width-only transforms and passes lqip through", () => {
    const image = urls.buildResponsive(
      assetId,
      { width: 1600, fit: "max" },
      {
        dimensions: { width: 1200, height: 800 },
        lqip: "data:image/png;base64,AA",
        sizes: "100vw",
      },
    );
    expect(image).toMatchObject({
      width: 768,
      height: 512,
      sizes: "100vw",
      lqip: "data:image/png;base64,AA",
    });
    expect(params(image.src)).not.toHaveProperty("h");
  });

  it("never routes through the Next.js image optimizer", () => {
    const image = urls.buildResponsive(assetId, { width: 256, height: 256 });
    expect(`${image.src} ${image.srcSet}`).not.toContain("/_next/image");
  });
});
