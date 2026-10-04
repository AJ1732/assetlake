import { cn } from "cn";

export function PublicImagesNotice({ className }: { className?: string }) {
  return (
    <p className={cn("notice", className)}>
      <strong>Public images only.</strong> A Sanity image asset is readable by
      anyone who has its URL, so AssetLake is for avatars, covers, and other
      images meant to be seen.
    </p>
  );
}
