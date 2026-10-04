import { assetLakeApplication } from "./types/assetLakeApplication";
import { assetLakeImage } from "./types/assetLakeImage";
import { assetLakePolicy } from "./types/assetLakePolicy";
import { assetLakePreset } from "./types/assetLakePreset";

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
export * from "./constants";
