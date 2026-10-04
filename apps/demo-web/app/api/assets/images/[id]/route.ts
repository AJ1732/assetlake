import { getRouteDependencies } from "@/lib/server/dependencies";
import { deleteImage } from "@/lib/server/http/delete-image-handler";
import { withRequestLog } from "@/lib/server/request-log";

// Explicit type rather than the generated RouteContext so tsc passes without .next/types.
type ImageRouteContext = { params: Promise<{ id: string }> };

export const DELETE = withRequestLog(
  "DELETE /api/assets/images/[id]",
  async (request: Request, { params }: ImageRouteContext) =>
    deleteImage(request, (await params).id, getRouteDependencies()),
);
