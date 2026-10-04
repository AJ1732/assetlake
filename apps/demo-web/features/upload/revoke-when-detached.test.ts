import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { revokeWhenDetached } from "./use-image-upload";

const URL_A = "blob:http://localhost:3000/a";
const URL_B = "blob:http://localhost:3000/b";

describe("revokeWhenDetached", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the URL when StrictMode detaches and re-attaches the same element", () => {
    const node = { isConnected: true, src: URL_A };
    revokeWhenDetached(node, URL_A)();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("revokes when the element leaves the document", () => {
    const node = { isConnected: true, src: URL_A };
    const cleanup = revokeWhenDetached(node, URL_A);
    node.isConnected = false;
    cleanup();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(URL_A);
  });

  it("revokes the old URL when the element now shows a new one", () => {
    const node = { isConnected: true, src: URL_A };
    const cleanup = revokeWhenDetached(node, URL_A);
    node.src = URL_B;
    cleanup();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(URL_A);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(URL_B);
  });
});
