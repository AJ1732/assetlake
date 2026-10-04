import { getRouteDependencies } from "@/lib/server/dependencies";
import { uploadImage } from "@/lib/server/http/upload-image-handler";
import { withRequestLog } from "@/lib/server/request-log";

export const POST = withRequestLog("POST /api/assets/images", (request) =>
  uploadImage(request, getRouteDependencies()),
);
