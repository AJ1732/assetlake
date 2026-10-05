import { getApplicationId, getAssetLake } from "@/lib/asset-lake";
import { getCurrentUser, ownerOf } from "@/lib/current-user";
import {
  errorResponse,
  toErrorResponse,
  unauthenticated,
} from "@/lib/http-errors";

// Large files: the browser puts the file in your bucket (presigned PUT), then posts a presigned GET
// URL here. Sanity fetches it; the bytes never pass through this server.
export async function POST(request: Request) {
  const user = getCurrentUser();
  if (!user) return unauthenticated();

  const body: unknown = await request.json().catch(() => null);
  const url = (body as { url?: unknown } | null)?.url;
  if (typeof url !== "string")
    return errorResponse(400, "BAD_REQUEST", 'Send { "url": "https://..." }.');

  try {
    const image = await getAssetLake().images.uploadFromUrl({
      url,
      applicationId: getApplicationId(),
      purpose: "content",
      idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
      ...ownerOf(user),
    });
    return Response.json(image, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
