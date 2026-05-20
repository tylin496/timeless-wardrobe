#!/usr/bin/env node
/**
 * Rasterise `og-image.svg` → `og-image.png` (1200×630) for Open Graph / Teams link previews.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "og-image.svg");
const outPath = path.join(root, "og-image.png");

if (!fs.existsSync(svgPath)) {
  console.error("Missing og-image.svg");
  process.exit(1);
}

const sharp = (await import("sharp")).default;

await sharp(svgPath, { density: 150 })
  .resize(1200, 630)
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log("OG image build → og-image.png");
