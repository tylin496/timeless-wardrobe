#!/usr/bin/env node
/**
 * Compile Tailwind + component CSS → root `styles.css` (static deploy + dev).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, "css", "input.css");
const output = path.join(root, "styles.css");
const cli = path.join(root, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs");

if (!fs.existsSync(input)) {
  console.error("Missing css/input.css");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [cli, "-i", input, "-o", output, "--minify"],
  { cwd: root, stdio: "inherit", env: process.env }
);

if (result.status !== 0) process.exit(result.status ?? 1);
console.log("CSS build → styles.css");
