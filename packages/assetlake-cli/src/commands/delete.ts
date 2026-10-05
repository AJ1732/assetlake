import type { AssetLake } from "@assetlake/core";

import type { CommandResult } from "../output";
import { toEntity } from "./entity";

// Owner-only, like core (B11 decision D2): no flags means the CLI's own uploads.
export async function deleteImage(
  deps: { assetLake: AssetLake },
  options: { imageId: string; entityType?: string; entityId?: string },
): Promise<CommandResult> {
  await deps.assetLake.images.delete({
    id: options.imageId,
    actorEntity: toEntity(options),
  });
  return {
    exitCode: 0,
    output: { event: "IMAGE_DELETED", imageId: options.imageId },
  };
}
