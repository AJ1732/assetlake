import { AssetLakeError } from "../errors/asset-lake-error";

export function requireImage<Image>(image: Image | null, id: string): Image {
  if (!image)
    throw new AssetLakeError("IMAGE_NOT_FOUND", `Image ${id} does not exist.`);
  return image;
}
