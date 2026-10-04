import { createImageUrls } from "@assetlake/core/url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssetLakeImage } from "./asset-lake-image";

const urls = createImageUrls({ projectId: "oshzwvjy", dataset: "production" });
const ASSET_ID = "image-0123456789abcdef0123456789abcdef01234567-1600x900-png";
const LQIP =
  "data:image/jpeg;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODw";

const hero = (lqip: string | null) =>
  urls.buildResponsive(
    ASSET_ID,
    { width: 1600, height: 900, fit: "max", quality: 82, autoFormat: true },
    { lqip },
  );

// HTML attribute names are case-insensitive, and React keeps `srcSet` camelCase in SSR output.
const attribute = (markup: string, name: string) =>
  markup.match(new RegExp(`\\s${name}="([^"]*)"`, "i"))?.[1] ?? "";

describe("AssetLakeImage", () => {
  it("renders a 3-entry srcSet straight from cdn.sanity.io", () => {
    const markup = renderToStaticMarkup(
      <AssetLakeImage image={hero(null)} alt="Hero" />,
    );
    const sourceSet = attribute(markup, "srcset").replaceAll("&amp;", "&");

    expect(
      sourceSet.split(", ").map((candidate) => candidate.split(" ")[1]),
    ).toEqual(["256w", "512w", "768w"]);
    expect(
      new URL(attribute(markup, "src").replaceAll("&amp;", "&")).host,
    ).toBe("cdn.sanity.io");
    expect(markup).not.toContain("/_next/image");
    expect(markup).toContain('alt="Hero"');
    expect(markup).toContain('width="768"');
    expect(markup).toContain('height="432"');
  });

  it("paints the LQIP behind the image only when one exists", () => {
    expect(
      renderToStaticMarkup(<AssetLakeImage image={hero(null)} alt="" />),
    ).not.toContain("background-image");
    expect(
      renderToStaticMarkup(<AssetLakeImage image={hero(LQIP)} alt="" />),
    ).toContain(`background-image:url(&quot;${LQIP}&quot;)`);
  });

  it("lazy-loads by default and loads a priority image eagerly at high priority", () => {
    const regular = renderToStaticMarkup(
      <AssetLakeImage image={hero(null)} alt="" />,
    );
    expect(attribute(regular, "loading")).toBe("lazy");
    expect(attribute(regular, "fetchPriority")).toBe("");

    const priority = renderToStaticMarkup(
      <AssetLakeImage image={hero(null)} alt="" priority />,
    );
    expect(attribute(priority, "loading")).toBe("eager");
    expect(attribute(priority, "fetchPriority")).toBe("high");
  });
});
