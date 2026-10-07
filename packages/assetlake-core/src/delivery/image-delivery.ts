import type {
  AssetLakeImageWithSource,
  EntityRef,
  ImagePurpose,
  ResponsiveImage,
} from "../contracts";
import { toImageResult } from "../images/normalize";
import { requireImage } from "../images/require-image";
import type { PresetResolver } from "../presets/preset-resolver";
import type { AssetLakeStore } from "../store/asset-lake-store";
import type { ImageUrls } from "./image-urls";

/** Read side of the facade: finds stored images and turns them into preset URLs. */
export function createImageDelivery({
  store,
  presets,
  urls,
}: {
  store: AssetLakeStore;
  presets: PresetResolver;
  urls: ImageUrls;
}) {
  async function sourceWithTransform(imageId: string, preset: string) {
    const [image, transform] = await Promise.all([
      store.findImageSource(imageId),
      presets.get(preset),
    ]);
    return { image: requireImage(image, imageId), transform };
  }

  return {
    async findLatestForEntity(query: {
      entity: EntityRef;
      purpose: ImagePurpose;
    }): Promise<AssetLakeImageWithSource | null> {
      const image = await store.findLatestReadyImage(query);
      return image ? { ...toImageResult(image), source: image.source } : null;
    },

    async url(
      imageId: string,
      { preset }: { preset: string },
    ): Promise<string> {
      const { image, transform } = await sourceWithTransform(imageId, preset);
      return urls.buildUrl(image.source, transform);
    },

    async responsive(
      imageId: string,
      { preset, sizes }: { preset: string; sizes?: string },
    ): Promise<ResponsiveImage> {
      const { image, transform } = await sourceWithTransform(imageId, preset);
      return urls.buildResponsive(image.source, transform, {
        sizes,
        lqip: image.lqip,
        dimensions: { width: image.width, height: image.height },
      });
    },
  };
}
