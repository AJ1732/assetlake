// B04 stub, replaced by B03 at merge
// Accepts any assetlake_session cookie without verifying it. B03 ships the HMAC-signed version.
import "server-only";

import { cookies } from "next/headers";

export interface DemoSession {
  userId: string;
  issuedAt: number;
}

export async function getSession(): Promise<DemoSession | null> {
  const cookieStore = await cookies();
  if (!cookieStore.has("assetlake_session")) return null;
  return { userId: "user-demo-stub0001", issuedAt: Date.now() };
}
