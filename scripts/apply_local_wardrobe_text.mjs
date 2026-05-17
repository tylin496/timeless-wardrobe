#!/usr/bin/env node
/**
 * Push edited text from data/local/wardrobe-text.json → Supabase wardrobe_items.
 * Preserves existing image + gallery URLs per row.
 *
 *   npm run db:apply-local-text
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { localTextToSupabaseRow, TEXT_LOCAL_SCHEMA } from "./lib/wardrobe-text.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const textPath = path.join(root, "data", "local", "wardrobe-text.json");

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

loadEnvFile();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

if (!fs.existsSync(textPath)) {
  console.error(`Missing ${textPath} — run npm run db:export-wardrobe first.`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(textPath, "utf8"));
if (payload._schema !== TEXT_LOCAL_SCHEMA || !Array.isArray(payload.items)) {
  console.error("Invalid wardrobe-text.json schema.");
  process.exit(1);
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existingRows, error: fetchErr } = await client.from("wardrobe_items").select("*");
if (fetchErr) {
  console.error("Fetch failed:", fetchErr.message);
  process.exit(1);
}

const existingById = new Map((existingRows || []).map((r) => [String(r.id), r]));

const rows = payload.items
  .filter((t) => String(t?.id ?? "").trim())
  .map((t) => localTextToSupabaseRow(t, existingById.get(String(t.id)) || {}));

let updated = 0;
const chunkSize = 50;
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize);
  const { error } = await client.from("wardrobe_items").upsert(chunk, { onConflict: "id" });
  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }
  updated += chunk.length;
  console.error(`Upserted ${updated} / ${rows.length}`);
}

console.log(`Done. Applied text for ${rows.length} wardrobe_items (images preserved from cloud).`);
