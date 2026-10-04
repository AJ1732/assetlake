import "server-only";

import { DEMO_APPLICATION_ID, getAssetLake } from "./assetLake";
import { serverEnv as environment } from "./env";
import type { DeleteDependencies } from "./http/deleteImageHandler";
import type { SessionDependencies } from "./http/sessionHandlers";
import type { UploadDependencies } from "./http/uploadImageHandler";
import { createUploadQuota } from "./quota";
import { getSessionCodec } from "./session";
import { systemClock } from "./systemClock";

export type RouteDependencies = UploadDependencies &
  DeleteDependencies &
  SessionDependencies;

let dependencies: RouteDependencies | undefined;

/** Composition root for the Route Handlers. Tests build their own graph instead. */
export function getRouteDependencies(): RouteDependencies {
  if (dependencies) return dependencies;
  const { images } = getAssetLake();
  dependencies = {
    images,
    applicationId: DEMO_APPLICATION_ID,
    sessions: getSessionCodec(),
    quota: createUploadQuota({
      images,
      applicationId: DEMO_APPLICATION_ID,
      dailyCap: environment.ASSETLAKE_DAILY_UPLOAD_CAP,
      clock: systemClock,
    }),
    passcode: environment.ASSETLAKE_DEMO_PASSCODE,
    secureCookies: environment.NODE_ENV === "production",
  };
  return dependencies;
}
