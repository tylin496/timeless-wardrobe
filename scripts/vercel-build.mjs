#!/usr/bin/env node
/**
 * Copy static site assets into `dist/` for Vercel (avoids Output Directory = public 404s).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const heroMediaExtensions = new Set([
  ".avif",
  ".gif",
  ".jpg",
  ".jpeg",
  ".mp4",
  ".png",
  ".webm",
  ".webp",
]);

function buildHomeHeroManifestSource() {
  const heroDir = path.join(root, "images", "heroes");
  let images = [];
  if (fs.existsSync(heroDir)) {
    images = fs
      .readdirSync(heroDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && heroMediaExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => `images/heroes/${entry.name}`)
      .sort((a, b) => a.localeCompare(b, "en"));
  }
  return `window.TW_HOME_HERO_IMAGES = ${JSON.stringify(images, null, 2)};\n`;
}

const rootFiles = [
  "index.html",
  "collection.html",
  "item.html",
  "app.js",
  "styles.css",
  "favicon.png",
  "icon.svg",
  "logo.svg",
  "monogram.png",
  "loading-logo.png",
  "og-image.png",
  "og-image.svg",
];

const rootDirs = ["js", "data", "images"];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, dist, { recursive: true });
}

for (const name of rootFiles) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dist, name));
}

for (const name of rootDirs) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(dist, name), { recursive: true });
}

fs.mkdirSync(path.join(dist, "js"), { recursive: true });
fs.writeFileSync(path.join(dist, "js", "tw-home-hero-manifest.js"), buildHomeHeroManifestSource(), "utf8");

console.log("Vercel static build → dist/");
