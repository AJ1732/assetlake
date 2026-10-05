import { getAssetLake } from "@/lib/asset-lake";
import { getCurrentUser, ownerOf } from "@/lib/current-user";
import { toErrorResponse, unauthenticated } from "@/lib/http-errors";

type ImageRouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: ImageRouteContext) {
  const user = getCurrentUser();
  if (!user) return unauthenticated();

  try {
    await getAssetLake().images.delete({
      id: (await params).id,
      actorEntity: ownerOf(user).entity,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
