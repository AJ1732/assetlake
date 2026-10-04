import { getRouteDependencies } from "@/lib/server/dependencies";
import { uploadImage } from "@/lib/server/http/uploadImageHandler";
import { withRequestLog } from "@/lib/server/requestLog";

export const POST = withRequestLog("POST /api/assets/images", (request) =>
  uploadImage(request, getRouteDependencies()),
);
