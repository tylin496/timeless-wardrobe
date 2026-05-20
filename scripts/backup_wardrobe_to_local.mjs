#!/usr/bin/env node
/**
 * Backup Supabase wardrobe images → images/wardrobe/… and freeze catalogue to local paths.
 *
 *   npm run db:backup-to-local
 *
 * Writes:
 *   images/wardrobe/{item-id}/…          — downloaded files (mirrors Storage paths)
 *   data/wardrobe.js                     — catalogue with /images/wardrobe/… URLs
 *   data/wardrobe-catalogue-lock.json    — id manifest (count matches cloud export)
 *   data/wardrobe-hybrid-mode.json       — enables hybrid load in app.js
 *   data/local/wardrobe-full-local.json  — full rows snapshot (optional audit)
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { cloudRowToSeedItem, formatWardrobeJsFile } from "./lib/cloud-to-seed.mjs";
import {
  collectWardrobeImageUrlsFromItem,
  localPublicUrlForStoragePath,
  rewriteItemMediaUrlsToLocal,
  storagePathFromWardrobeImageUrl,
  normalizeFrozenItemLocalMedia,
} from "./lib/wardrobe-image-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const imagesRoot = path.join(root, "images", "wardrobe");
const LOCK_SCHEMA = "timeless-wardrobe-catalogue-lock-v1";
const HYBRID_SCHEMA = "timeless-wardrobe-hybrid-local-v1";

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function downloadToFile(url, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

loadEnvFile();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = Boolean(process.env.DRY_RUN && process.env.DRY_RUN !== "0" && process.env.DRY_RUN !== "false");
const skipExisting = process.env.SKIP_EXISTING !== "0";

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await client.from("wardrobe_items").select("*").order("id");
if (error) {
  console.error("Fetch wardrobe_items failed:", error.message);
  process.exit(1);
}

const rawRows = data || [];
if (!rawRows.length) {
  console.error("No wardrobe_items rows — nothing to backup.");
  process.exit(1);
}

/** @type {Map<string, { url: string, paths: Set<string> }>} */
const downloadsByPath = new Map();

for (const row of rawRows) {
  const seed = cloudRowToSeedItem(row);
  if (!seed) continue;
  for (const { url: imgUrl, path: storagePath } of collectWardrobeImageUrlsFromItem(seed)) {
    if (!storagePath) continue;
    let entry = downloadsByPath.get(storagePath);
    if (!entry) {
      entry = { url: imgUrl, paths: new Set() };
      downloadsByPath.set(storagePath, entry);
    }
    entry.paths.add(storagePath);
  }
}

console.log(`Catalogue rows: ${rawRows.length}`);
console.log(`Unique Storage objects to fetch: ${downloadsByPath.size}`);
if (dryRun) {
  console.log("DRY_RUN=1 — no files or seed written.");
  process.exit(0);
}

fs.mkdirSync(imagesRoot, { recursive: true });

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const [storagePath, { url: imgUrl }] of downloadsByPath) {
  const destPath = path.join(imagesRoot, storagePath);
  if (skipExisting && fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    skipped += 1;
    continue;
  }
  try {
    const bytes = await downloadToFile(imgUrl, destPath);
    downloaded += 1;
    if (downloaded % 25 === 0) {
      console.log(`  … ${downloaded} files (${Math.round(bytes / 1024)} KB latest)`);
    }
  } catch (e) {
    failed += 1;
    console.warn(`  FAIL ${storagePath}:`, e instanceof Error ? e.message : e);
  }
}

console.log(`Downloaded: ${downloaded}, skipped (existing): ${skipped}, failed: ${failed}`);
if (failed > 0) {
  console.warn("Some images failed — re-run after fixing network, or check URLs.");
}

const migratedAt = new Date().toISOString();
const seedItems = rawRows
  .map((r) => cloudRowToSeedItem(r))
  .filter(Boolean)
  .map((item) => normalizeFrozenItemLocalMedia(rewriteItemMediaUrlsToLocal(item)));

const wardrobeJsPath = path.join(root, "data", "wardrobe.js");
if (fs.existsSync(wardrobeJsPath)) {
  const stamp = migratedAt.replace(/[:.]/g, "-").slice(0, 19);
  fs.copyFileSync(wardrobeJsPath, path.join(root, "data", `wardrobe.js.backup-${stamp}`));
}

const jsBody = formatWardrobeJsFile(seedItems, migratedAt);
const jsWithLocalNote = jsBody.replace(
  "Images: full `https://…` public URLs (Supabase `wardrobe-images` bucket).",
  "Images: local files under `/images/wardrobe/` (backed up from Supabase Storage)."
);
fs.writeFileSync(wardrobeJsPath, jsWithLocalNote, "utf8");

const lock = {
  _schema: LOCK_SCHEMA,
  frozenAt: migratedAt,
  count: seedItems.length,
  ids: seedItems.map((i) => String(i.id)),
  source: "local:images/wardrobe + wardrobe.js",
};
fs.writeFileSync(path.join(root, "data", "wardrobe-catalogue-lock.json"), JSON.stringify(lock, null, 2), "utf8");

const hybrid = {
  _schema: HYBRID_SCHEMA,
  enabled: true,
  migratedAt,
  localCatalogueCount: seedItems.length,
  localImageRoot: "/images/wardrobe",
  note: "Frozen catalogue ids load from data/wardrobe.js with local images. New wardrobe_items rows (not in the lock) still load from Supabase until you run db:backup-to-local again.",
};
fs.writeFileSync(path.join(root, "data", "wardrobe-hybrid-mode.json"), JSON.stringify(hybrid, null, 2), "utf8");

const localDir = path.join(root, "data", "local");
fs.mkdirSync(localDir, { recursive: true });
fs.writeFileSync(
  path.join(localDir, "wardrobe-full-local.json"),
  JSON.stringify({ migratedAt, rowCount: seedItems.length, rows: seedItems }, null, 2),
  "utf8"
);

console.log("");
console.log(`Wrote ${seedItems.length} pieces → data/wardrobe.js (local image URLs)`);
console.log(`  data/wardrobe-catalogue-lock.json (${lock.count} ids)`);
console.log(`  data/wardrobe-hybrid-mode.json (hybrid mode ON)`);
console.log(`  images/wardrobe/ (${downloaded + skipped} files on disk)`);
console.log("");
console.log("Next: hard-refresh the site. Existing catalogue uses local files; new Supabase-only rows still sync from cloud.");
