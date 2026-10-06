import {
  IDEMPOTENCY_HEADER,
  UPLOAD_FORM_FIELDS,
} from "@assetlake/core/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  buildUploadForm,
  parseUploadResponse,
  UPLOAD_ENDPOINT,
  uploadImage,
  type UploadTransport,
} from "./upload-image";
import { checkUploadLimits } from "./upload-limits";

class FakeTransport implements UploadTransport {
  method = "";
  url = "";
  headers = new Map<string, string>();
  body: FormData | undefined;
  status = 0;
  responseText = "";
  onload: XMLHttpRequest["onload"] = null;
  onerror: XMLHttpRequest["onerror"] = null;
  upload: UploadTransport["upload"] = { onprogress: null, onload: null };

  open(method: string, url: string | URL) {
    this.method = method;
    this.url = String(url);
  }
  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }
  send(body?: Document | XMLHttpRequestBodyInit | null) {
    this.body = body as FormData;
  }

  progress(loaded: number, total: number) {
    fire(this.upload.onprogress, { loaded, total, lengthComputable: true });
  }
  bytesSent() {
    fire(this.upload.onload, {});
  }
  respond(status: number, body: string) {
    this.status = status;
    this.responseText = body;
    fire(this.onload, {});
  }
  failNetwork() {
    fire(this.onerror, {});
  }
}

// The code under test assigns arrow functions, so the DOM handlers' `this` binding is irrelevant.
function fire(handler: unknown, event: Partial<ProgressEvent>) {
  (handler as ((event: ProgressEvent) => void) | null)?.(
    event as ProgressEvent,
  );
}

const png = () =>
  new File([new Uint8Array([137, 80, 78, 71])], "me.png", {
    type: "image/png",
  });

function startUpload(overrides: { alt?: string } = {}) {
  const transport = new FakeTransport();
  const onProgress = vi.fn();
  const onBytesSent = vi.fn();
  const outcome = uploadImage({
    file: png(),
    purpose: "avatar",
    alt: overrides.alt,
    idempotencyKey: "key-123",
    onProgress,
    onBytesSent,
    createTransport: () => transport,
  });
  return { transport, onProgress, onBytesSent, outcome };
}

describe("uploadImage", () => {
  it("POSTs multipart form data with the contract field names and the idempotency key", async () => {
    const { transport, outcome } = startUpload({ alt: "  Me at the lake  " });
    expect(transport.method).toBe("POST");
    expect(transport.url).toBe(UPLOAD_ENDPOINT);
    expect(transport.headers.get(IDEMPOTENCY_HEADER)).toBe("key-123");

    const form = transport.body!;
    expect((form.get(UPLOAD_FORM_FIELDS.file) as File).name).toBe("me.png");
    expect(form.get(UPLOAD_FORM_FIELDS.purpose)).toBe("avatar");
    expect(form.get(UPLOAD_FORM_FIELDS.alt)).toBe("Me at the lake");

    transport.respond(
      201,
      JSON.stringify({ success: true, data: { id: "assetlake-image-1" } }),
    );
    await expect(outcome).resolves.toEqual({
      success: true,
      data: { id: "assetlake-image-1" },
    });
  });

  it("reports progress and the bytes-sent moment", async () => {
    const { transport, onProgress, onBytesSent, outcome } = startUpload();
    transport.progress(50, 200);
    transport.progress(200, 200);
    transport.bytesSent();
    expect(onProgress.mock.calls).toEqual([[25], [100]]);
    expect(onBytesSent).toHaveBeenCalledOnce();
    transport.respond(201, JSON.stringify({ success: true, data: {} }));
    await outcome;
  });

  it("passes an API failure envelope through unchanged", async () => {
    const { transport, outcome } = startUpload();
    const body = {
      success: false,
      error: { code: "RATE_LIMITED", message: "Slow down." },
    };
    transport.respond(429, JSON.stringify(body));
    await expect(outcome).resolves.toEqual(body);
  });

  it("maps a network error to NETWORK_ERROR", async () => {
    const { transport, outcome } = startUpload();
    transport.failNetwork();
    await expect(outcome).resolves.toMatchObject({
      success: false,
      error: { code: "NETWORK_ERROR" },
    });
  });

  it("maps a non-JSON body to INVALID_RESPONSE", async () => {
    const { transport, outcome } = startUpload();
    transport.respond(502, "<html>Bad gateway</html>");
    await expect(outcome).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_RESPONSE" },
    });
  });
});

describe("parseUploadResponse", () => {
  it("rejects a success envelope that arrives with an error status", () => {
    expect(
      parseUploadResponse(500, JSON.stringify({ success: true, data: {} })),
    ).toMatchObject({
      success: false,
      error: { code: "INVALID_RESPONSE" },
    });
  });

  it("rejects JSON that is not an envelope", () => {
    expect(parseUploadResponse(200, "[]")).toMatchObject({
      error: { code: "INVALID_RESPONSE" },
    });
  });
});

describe("buildUploadForm", () => {
  it("omits alt when it is blank", () => {
    expect(
      buildUploadForm(png(), "avatar", { alt: "   " }).has(
        UPLOAD_FORM_FIELDS.alt,
      ),
    ).toBe(false);
  });

  it("asks for review only when the person ticked it", () => {
    expect(
      buildUploadForm(png(), "avatar", { holdForReview: true }).get(
        UPLOAD_FORM_FIELDS.review,
      ),
    ).toBe("on");
    expect(
      buildUploadForm(png(), "avatar").has(UPLOAD_FORM_FIELDS.review),
    ).toBe(false);
  });
});

describe("checkUploadLimits", () => {
  it("accepts JPEG, PNG, and WebP up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"])
      expect(checkUploadLimits({ type, size: 5 * 1024 * 1024 })).toBeNull();
  });

  it("rejects other types and oversized files", () => {
    expect(checkUploadLimits({ type: "image/gif", size: 10 })?.code).toBe(
      "UNSUPPORTED_IMAGE_TYPE",
    );
    expect(
      checkUploadLimits({ type: "image/png", size: 5 * 1024 * 1024 + 1 })?.code,
    ).toBe("FILE_TOO_LARGE");
  });
});
