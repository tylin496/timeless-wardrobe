# Deployment URLs (read this once)

The repo and brand name are **Timeless Wardrobe** (`timeless-wardrobe`).  
The **Vercel project slug is misspelled**: `timless-wardrobe` (missing **e**). That typo is only on Vercel — not in the GitHub repo name.

## Which URL works?

| URL | Status | Use for |
| --- | --- | --- |
| `https://timless-wardrobe.vercel.app` | **Live** (200) | Primary production, OAuth, canonical, OG |
| `https://timeless-wardrobe.vercel.app` | **404** `DEPLOYMENT_NOT_FOUND` | **Never use** — not linked to any deployment |
| `https://tylin496.github.io/timeless-wardrobe/` | **Live** (200) | GitHub Pages mirror (repo name spelled correctly) |
| `http://127.0.0.1:8787/` | Local dev (`npm run dev`) | Development |

Vercel dashboard project: `tylin/timless-wardrobe` (see GitHub commit status link).

## Single source of truth in code

Set production base URL only here:

- `js/tw-supabase-config.js` → `SITE_ORIGIN: "https://timless-wardrobe.vercel.app"`

Must match:

- Supabase **Authentication → URL Configuration → Site URL**
- Supabase **Redirect URLs** → `https://timless-wardrobe.vercel.app/**`
- HTML `canonical` / `og:*` in `index.html`, `collection.html`, `item.html`

Run before push:

```bash
npm run check:urls
```

## Optional: fix the typo on Vercel

In [Vercel](https://vercel.com) → project **timless-wardrobe** → **Settings → Domains**, you can add a domain alias if Vercel offers `timeless-wardrobe.vercel.app` for your account. Until then, always share and bookmark **timless-wardrobe.vercel.app**.

## What is *not* a URL bug

These intentionally say `timeless-wardrobe` (localStorage keys, npm package name, GitHub repo) — do not change to `timless`:

- `package.json` `"name": "timeless-wardrobe"`
- `app.js` keys like `timeless-wardrobe-outfits-v1`
- JSON `_schema` fields in `data/`
