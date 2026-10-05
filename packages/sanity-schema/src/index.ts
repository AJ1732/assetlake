import { assetLakeApplication } from "./types/asset-lake-application";
import { assetLakeImage } from "./types/asset-lake-image";
import { assetLakePolicy } from "./types/asset-lake-policy";
import { assetLakePreset } from "./types/asset-lake-preset";

export const schemaTypes = [
  assetLakeApplication,
  assetLakePolicy,
  assetLakePreset,
  assetLakeImage,
];

export {
  assetLakeApplication,
  assetLakeImage,
  assetLakePolicy,
  assetLakePreset,
};
