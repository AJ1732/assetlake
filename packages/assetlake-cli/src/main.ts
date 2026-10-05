#!/usr/bin/env node
import { run } from "./run";
import { createNodeRuntime } from "./runtime";

const io = {
  stdout: (text: string) => process.stdout.write(text),
  stderr: (text: string) => process.stderr.write(text),
};

process.exitCode = await run(
  process.argv.slice(2),
  process.env,
  io,
  createNodeRuntime(io),
);
