import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { applicationId, assetLake } from "./asset-lake.ts";
import { getCurrentUser, type User } from "./current-user.ts";
import { toErrorResponse } from "./http-errors.ts";

const app = express();

function authenticate(response: Response): User | undefined {
  const user = getCurrentUser();
  if (!user) {
    response
      .status(401)
      .json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } });
    return undefined;
  }
  response.locals.user = user;
  return user;
}

// Runs before the body parsers, so an anonymous request is refused before its body is buffered.
function requireUser(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  if (authenticate(response)) next();
}

const ownerOf = (user: User) => ({
  entity: { type: "user", id: user.id },
  actorId: user.id,
});
const userOf = (response: Response) => response.locals.user as User;

// Raw bytes: `curl --data-binary @photo.png -H "content-type: image/png"`. Core checks the bytes
// against the declared type and the application's policy before anything reaches Sanity.
app.post(
  "/images",
  requireUser,
  express.raw({ type: "image/*", limit: "5mb" }),
  async (request, response) => {
    if (!Buffer.isBuffer(request.body)) {
      response.status(400).json({
        error: { code: "BAD_REQUEST", message: "Send an image/* body." },
      });
      return;
    }
    const image = await assetLake.images.upload({
      body: new Uint8Array(request.body),
      filename: request.get("x-filename") ?? "upload",
      contentType: request.get("content-type") ?? "",
      applicationId,
      purpose: "content",
      idempotencyKey: request.get("idempotency-key"),
      ...ownerOf(userOf(response)),
    });
    response.status(201).json(image);
  },
);

// Large files: the client puts the file in your bucket (presigned PUT), then sends a presigned GET
// URL here. Sanity fetches it; the bytes never pass through this server.
app.post(
  "/images/from-url",
  requireUser,
  express.json({ limit: "4kb" }),
  async (request, response) => {
    const url: unknown = request.body?.url;
    if (typeof url !== "string") {
      response.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: 'Send { "url": "https://..." }.',
        },
      });
      return;
    }
    const image = await assetLake.images.uploadFromUrl({
      url,
      applicationId,
      purpose: "content",
      idempotencyKey: request.get("idempotency-key"),
      ...ownerOf(userOf(response)),
    });
    response.status(201).json(image);
  },
);

app.get("/images/:id/url", async (request, response) => {
  const preset =
    typeof request.query.preset === "string" ? request.query.preset : "card";
  const url = await assetLake.images.url(request.params.id, { preset });
  response.json({ url });
});

// No requireUser middleware here: with middleware between the path and the handler, Express 5's
// types widen request.params.id to string | string[]. Nothing to parse, so checking inside is free.
app.delete("/images/:id", async (request, response) => {
  const user = authenticate(response);
  if (!user) return;
  await assetLake.images.delete({
    id: request.params.id,
    actorEntity: ownerOf(user).entity,
  });
  response.status(204).end();
});

// Express 5 forwards rejected async handlers here.
app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    const { status, body } = toErrorResponse(error);
    response.status(status).json(body);
  },
);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`AssetLake Express example on http://localhost:${port}`);
});
