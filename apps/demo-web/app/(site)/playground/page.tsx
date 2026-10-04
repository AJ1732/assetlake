import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { PublicImagesNotice } from "@/components/public-images-notice";
import { NetworkProof } from "@/features/network/network-proof";
import { PresetMatrix } from "@/features/presets/preset-matrix";
import { loadPlayground } from "@/features/profile/load-playground.server";
import { ProfileCard } from "@/features/profile/profile-card";
import { PasscodeForm } from "@/features/session/passcode-form";
import { UploadPanel } from "@/features/upload/upload-panel";
import { type DemoSession, getSession } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Change a demo avatar and watch every preset come back from cdn.sanity.io.",
};

export default async function PlaygroundPage() {
  const session = await getSession();

  return (
    <div className="playground">
      <PageHeader
        eyebrow="Playground"
        title="Upload through the app. Read from the CDN."
      >
        <p>
          Change the avatar below. The file goes to this app&apos;s backend,
          which checks it and stores it in Sanity. Everything you then see is
          fetched by your browser straight from cdn.sanity.io.
        </p>
      </PageHeader>

      {session ? <PlaygroundSession session={session} /> : <PasscodeForm />}
    </div>
  );
}

async function PlaygroundSession({ session }: { session: DemoSession }) {
  const data = await loadPlayground(session);
  return (
    <>
      <div className="playground-top">
        <ProfileCard userId={session.userId} avatar={data.avatar} />
        <UploadPanel hasAvatar={data.avatar !== null} />
      </div>
      <PresetMatrix cells={data.presets} error={data.presetsError} />
      <NetworkProof />
      <PublicImagesNotice />
    </>
  );
}
