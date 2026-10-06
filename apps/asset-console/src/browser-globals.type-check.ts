// The console runs in the browser, so Node globals must not typecheck here. If this stops
// erroring, something put Node types back into tsconfig.json (or a dependency leaks them).
// @ts-expect-error `process` is a Node global.
export type NodeProcess = typeof process;
