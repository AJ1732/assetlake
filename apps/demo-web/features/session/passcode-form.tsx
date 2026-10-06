"use client";

import type { ApiFailure } from "@assetlake/core/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { PublicImagesNotice } from "@/components/public-images-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SESSION_ENDPOINT = "/api/session";

async function describeFailure(response: Response): Promise<string> {
  if (response.status === 401)
    return "That passcode did not work. Check it and try again.";
  const body = (await response.json().catch(() => null)) as ApiFailure | null;
  return (
    body?.error?.message ??
    `The server answered ${response.status}. Try again in a moment.`
  );
}

export function PasscodeForm() {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBusy = isSubmitting || isRefreshing;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const passcode = String(
      new FormData(event.currentTarget).get("passcode") ?? "",
    );
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(SESSION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (response.ok) {
        startRefresh(() => router.refresh());
        return;
      }
      setError(await describeFailure(response));
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel passcode" aria-labelledby="passcode-title">
      <h2 id="passcode-title" className="section-title">
        Enter the demo passcode
      </h2>
      <p className="text-sm text-muted-foreground">
        Uploads go through an authenticated backend, so the playground needs a
        session. The passcode is published in the DEV post. A session lasts 24
        hours and allows 5 uploads.
      </p>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="passcode-form"
        noValidate
      >
        <label htmlFor="passcode" className="field-label">
          Demo passcode
        </label>
        <Input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="off"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "passcode-error" : undefined}
        />
        <Button type="submit" disabled={isBusy} className="h-10 px-4 text-sm">
          {isBusy ? "Checking…" : "Enter the playground"}
        </Button>
        <p id="passcode-error" role="alert" className="field-error">
          {error}
        </p>
      </form>
      <PublicImagesNotice />
    </section>
  );
}
