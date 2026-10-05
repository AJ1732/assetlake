import { connection } from "next/server";

import { UploadForm } from "./upload-form";

// The project id and dataset are public (they appear in every image URL); the token never leaves
// the server. Read at request time so the build doesn't need them.
export default async function Page() {
  await connection();
  return (
    <main style={{ maxWidth: 640 }}>
      <h1>AssetLake + Next.js</h1>
      <p>
        Uploads go through this app&apos;s Route Handlers to your Sanity
        project. Images are served from cdn.sanity.io.
      </p>
      <UploadForm
        projectId={process.env.SANITY_PROJECT_ID ?? ""}
        dataset={process.env.SANITY_DATASET ?? ""}
      />
    </main>
  );
}
