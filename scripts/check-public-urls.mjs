#!/usr/bin/env node
/**
 * Fail if the legacy misspelled Vercel hostname appears outside docs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BAD = "timless-wardrobe.vercel.app";
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".cursor"]);
const SKIP_FILES = new Set(["check-public-urls.mjs"]);
const ALLOW_PATH_SNIPPETS = ["docs/DEPLOYMENT.md", "docs/SUPABASE.md", "README.md"];

/** @param {string} dir */
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const hits = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (SKIP_FILES.has(path.basename(file))) continue;
  if (!/\.(html|js|mjs|md|json|example\.js|txt|css|svg)$/i.test(rel)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(BAD)) continue;
  const allowed = ALLOW_PATH_SNIPPETS.some((s) => rel === s || rel.endsWith(s));
  if (allowed) continue;
  const line = text.split("\n").findIndex((l) => l.includes(BAD)) + 1;
  hits.push(`${rel}:${line || "?"}`);
}

if (hits.length) {
  console.error(`Found forbidden URL "${BAD}" (legacy Vercel typo). Fix or document in allowlist:\n`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}

console.log(`OK — no stray "${BAD}" in source files.`);
