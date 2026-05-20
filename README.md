# Timeless Wardrobe

Static collection UI for a personal wardrobe: filters, outfit builder, saved looks.

## Quick start

Serve the folder (any static server), open `index.html`. By default data comes from `data/wardrobe.js` and saved outfits from `localStorage`.

Production (Vercel): [timless-wardrobe.vercel.app](https://timless-wardrobe.vercel.app/) — Vercel project slug is **`timless-wardrobe`** (typo: missing “e”). **`timeless-wardrobe.vercel.app` does not exist** (404). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Mirror: [GitHub Pages](https://tylin496.github.io/timeless-wardrobe/). Build: `npm run build` → `dist/`. URL guard: `npm run check:urls`.

## Supabase (optional)

See **[docs/SUPABASE.md](docs/SUPABASE.md)** for schema SQL, env vars, seed import, and security notes. Copy `.env.example` to `.env` for the Node import script; fill `js/tw-supabase-config.js` with the **public** URL and anon key for the browser.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run export:wardrobe-json` | Write `data/wardrobe.json` from `data/wardrobe.js` |
| `npm run db:import-seed` | Upsert `wardrobe_items` via service role |
