import { AssetLakeImage } from "@/components/asset-lake-image";
import { HostChip } from "@/components/host-chip";

import type { PlaygroundData } from "./load-playground.server";

export function ProfileCard({
  userId,
  avatar,
}: {
  userId: string;
  avatar: PlaygroundData["avatar"];
}) {
  return (
    <section
      className="panel profile"
      aria-labelledby="profile-title"
      data-testid="profile-card"
    >
      <div className="profile-avatar">
        {avatar ? (
          // Keyed by record id so a new upload mounts a fresh <img> and the CSS crossfade runs.
          <div key={avatar.record.id} className="avatar-swap">
            <AssetLakeImage
              image={avatar.image}
              alt={`Avatar for ${userId}`}
              priority
              className="avatar-image"
            />
          </div>
        ) : (
          <div className="avatar-empty" aria-hidden="true">
            {userId.slice(-2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="profile-meta">
        <p className="eyebrow">Signed in as</p>
        <h2 id="profile-title" className="profile-name font-mono">
          {userId}
        </h2>
        {avatar ? (
          <dl className="profile-facts">
            <div>
              <dt>Served by</dt>
              <dd>
                <HostChip url={avatar.image.src} />
              </dd>
            </div>
            <div>
              <dt>Record</dt>
              <dd className="font-mono text-xs break-all">
                {avatar.record.id}
              </dd>
            </div>
            <div>
              <dt>Original</dt>
              <dd className="font-mono text-xs tabular-nums">
                {avatar.record.width}×{avatar.record.height} ·{" "}
                {avatar.record.mimeType}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No avatar yet. Upload one and it comes back from cdn.sanity.io in
            every preset size.
          </p>
        )}
      </div>
    </section>
  );
}
