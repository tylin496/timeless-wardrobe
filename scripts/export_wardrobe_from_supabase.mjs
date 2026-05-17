#!/usr/bin/env node
/**
 * Export all wardrobe_items from Supabase → data/local/ for text review.
 *
 *   npm run db:export-wardrobe
 *
 * Writes:
 *   data/local/wardrobe-text.json   — text fields only (edit this, then db:apply-local-text)
 *   data/local/wardrobe-full.json   — full DB rows
 *   data/local/audit-report.json    — seed vs cloud summary
 *   data/local/wardrobe-review.txt  — human-readable checklist
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  buildAuditReport,
  buildTextLocalPayload,
  readFileItemsFromJs,
  rowToLocalTextRecord,
} from "./lib/wardrobe-text.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const localDir = path.join(root, "data", "local");

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

function textReviewLine(i, n, rec) {
  const head = `[${i}/${n}] ${rec.id}`;
  const title = [rec.brand, rec.name].filter(Boolean).join(" · ") || "(no title)";
  const lines = [
    head,
    `  ${title}`,
    `  category: ${rec.category || "—"} | season: ${rec.season || "—"} | colour: ${rec.colour || "—"}`,
  ];
  if (rec.colourCode) lines.push(`  colour code: ${rec.colourCode}`);
  if (rec.fabric || rec.weight) lines.push(`  fabric: ${rec.fabric || "—"} | weight: ${rec.weight || "—"}`);
  if (rec.size) lines.push(`  size: ${rec.size}`);
  if (rec.measuredDimensions) lines.push(`  measured: ${rec.measuredDimensions}`);
  if (rec.purchaseDate) lines.push(`  purchased: ${rec.purchaseDate}`);
  if (rec.price != null) lines.push(`  price: ${rec.price} ${rec.priceCurrency || "TWD"}`);
  if (rec.notes) lines.push(`  notes: ${rec.notes.replace(/\n/g, " ")}`);
  if (rec.colourVariants?.length) lines.push(`  colour variants: ${rec.colourVariants.length}`);
  lines.push(
    `  images: cover=${rec._media?.hasCover ? "yes" : "no"}, gallery=${rec._media?.galleryCount ?? 0}`
  );
  return lines.join("\n");
}

loadEnvFile();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

fs.mkdirSync(localDir, { recursive: true });

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await client.from("wardrobe_items").select("*").order("brand").order("name");
if (error) {
  console.error("Fetch failed:", error.message);
  process.exit(1);
}

const rawRows = data || [];
const textItems = rawRows.map((r) => rowToLocalTextRecord(r));
const textPayload = buildTextLocalPayload(textItems, "supabase");

const seedPath = path.join(root, "data", "wardrobe.js");
const seedItems = fs.existsSync(seedPath) ? readFileItemsFromJs(seedPath, fs) : [];
const audit = buildAuditReport(textItems, seedItems);

fs.writeFileSync(path.join(localDir, "wardrobe-text.json"), JSON.stringify(textPayload, null, 2), "utf8");
fs.writeFileSync(
  path.join(localDir, "wardrobe-full.json"),
  JSON.stringify({ exportedAt: textPayload.exportedAt, rowCount: rawRows.length, rows: rawRows }, null, 2),
  "utf8"
);
fs.writeFileSync(path.join(localDir, "audit-report.json"), JSON.stringify(audit, null, 2), "utf8");

const reviewLines = [
  `Timeless Wardrobe — text review (${textItems.length} pieces)`,
  `Exported: ${textPayload.exportedAt}`,
  "",
  `Cloud: ${audit.cloudCount} | Seed file: ${audit.seedCount}`,
  `Only in cloud: ${audit.onlyInCloud.length}`,
  `Only in seed (not in cloud): ${audit.onlyInSeed.length}`,
  `Rows with text diffs vs seed: ${audit.textFieldDiffsVsSeed.length}`,
  "",
  "=".repeat(60),
  "",
];
textItems.forEach((rec, idx) => {
  reviewLines.push(textReviewLine(idx + 1, textItems.length, rec));
  reviewLines.push("");
});
fs.writeFileSync(path.join(localDir, "wardrobe-review.txt"), reviewLines.join("\n"), "utf8");

console.log(`Exported ${textItems.length} rows to data/local/`);
console.log(`  wardrobe-text.json   — edit text here, then: npm run db:apply-local-text`);
console.log(`  wardrobe-review.txt  — printable checklist`);
console.log(`  wardrobe-full.json   — full Supabase rows`);
console.log(`  audit-report.json    — ${audit.onlyInSeed.length} seed-only, ${audit.onlyInCloud.length} cloud-only`);
