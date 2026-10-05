import { resolveSanityProject } from "./project";

// Static process.env reads, not the whole object: Sanity's Vite build defines only the
// SANITY_STUDIO_* variables it finds referenced by name.
export const studioProject = resolveSanityProject(
  {
    SANITY_STUDIO_PROJECT_ID: process.env.SANITY_STUDIO_PROJECT_ID,
    SANITY_STUDIO_DATASET: process.env.SANITY_STUDIO_DATASET,
  },
  { projectId: "SANITY_STUDIO_PROJECT_ID", dataset: "SANITY_STUDIO_DATASET" },
);
