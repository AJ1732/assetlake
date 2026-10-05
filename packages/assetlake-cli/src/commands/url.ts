import type { AssetLake } from "@assetlake/core";

import type { CommandResult } from "../output";

export async function url(
  deps: { assetLake: AssetLake },
  options: { imageId: string; preset: string },
): Promise<CommandResult> {
  const presetUrl = await deps.assetLake.images.url(options.imageId, {
    preset: options.preset,
  });
  return {
    exitCode: 0,
    output: {
      imageId: options.imageId,
      preset: options.preset,
      url: presetUrl,
    },
  };
}
