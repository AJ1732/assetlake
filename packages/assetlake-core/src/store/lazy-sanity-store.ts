import type { AssetLakeConfig } from "../client/config";
import type { AssetLakeStore } from "./asset-lake-store";
import type { SetupStore } from "./setup-store";

type SanityStore = AssetLakeStore & SetupStore;

/**
 * @sanity/client costs about 300 ms to import. Loading it on the first store call keeps it out of
 * everything that injects its own store (tests, the in-memory double) and out of paths that never
 * reach Sanity. Every store method is already async, so callers see no difference.
 */
export function createLazySanityStore(config: AssetLakeConfig): SanityStore {
  let loading: Promise<SanityStore> | undefined;

  function load(): Promise<SanityStore> {
    loading ??= import("./sanity-store")
      .then(({ createSanityStore, createSanityWriteClient }) =>
        createSanityStore(createSanityWriteClient(config)),
      )
      .catch((error: unknown) => {
        loading = undefined;
        throw error;
      });
    return loading;
  }

  function forward<Name extends keyof SanityStore>(
    name: Name,
  ): SanityStore[Name] {
    const call = async (...parameters: unknown[]) => {
      const store = await load();
      return (store[name] as (...parameters: unknown[]) => unknown)(
        ...parameters,
      );
    };
    return call as SanityStore[Name];
  }

  // A typed literal: a new store method fails typecheck until it is forwarded here.
  return {
    findApplicationPolicy: forward("findApplicationPolicy"),
    findPresetBySlug: forward("findPresetBySlug"),
    listPresets: forward("listPresets"),
    findImage: forward("findImage"),
    findImageSource: forward("findImageSource"),
    findLatestReadyImage: forward("findLatestReadyImage"),
    countImagesSince: forward("countImagesSince"),
    countImagesForEntity: forward("countImagesForEntity"),
    uploadImageAsset: forward("uploadImageAsset"),
    uploadImageAssetFromUrl: forward("uploadImageAssetFromUrl"),
    createImage: forward("createImage"),
    updateImageStatus: forward("updateImageStatus"),
    deleteImage: forward("deleteImage"),
    deleteAsset: forward("deleteAsset"),
    ensureSetup: forward("ensureSetup"),
    findMissingSetup: forward("findMissingSetup"),
  };
}
