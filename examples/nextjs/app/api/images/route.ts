import { getApplicationId, getAssetLake } from "@/lib/asset-lake";
import { getCurrentUser, ownerOf } from "@/lib/current-user";
import {
  errorResponse,
  toErrorResponse,
  unauthenticated,
} from "@/lib/http-errors";

// multipart/form-data with a "file" field. Core checks the bytes against the declared type and the
// application's policy before anything reaches Sanity.
export async function POST(request: Request) {
  const user = getCurrentUser();
  if (!user) return unauthenticated();

  const file = (await request.formData()).get("file");
  if (!(file instanceof File))
    return errorResponse(400, "BAD_REQUEST", 'Send a "file" field.');

  try {
    const image = await getAssetLake().images.upload({
      body: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      contentType: file.type,
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
