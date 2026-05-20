# Deployment URLs

Production Vercel project: **timeless-wardrobe** → `https://timeless-wardrobe.vercel.app`

## Which URL to use

| URL | Status | Use for |
| --- | --- | --- |
| `https://timeless-wardrobe.vercel.app` | **Live** (200) | Primary production, OAuth, canonical, OG |
| `https://timless-wardrobe.vercel.app` | **404** `DEPLOYMENT_NOT_FOUND` | **Legacy typo — do not use** |
| `https://tylin496.github.io/timeless-wardrobe/` | **Live** (200) | GitHub Pages mirror |
| `http://127.0.0.1:8787/` | Local dev (`npm run dev`) | Development |

Vercel dashboard: `tylin/timeless-wardrobe`

## Single source of truth in code

- `js/tw-supabase-config.js` → `SITE_ORIGIN: "https://timeless-wardrobe.vercel.app"`

Must match:

- Supabase **Authentication → URL Configuration → Site URL**
- Supabase **Redirect URLs** → `https://timeless-wardrobe.vercel.app/**`
- HTML `canonical` / `og:*` in `index.html`, `collection.html`, `item.html`

Run before push:

```bash
npm run check:urls
```

## What is *not* a URL bug

These use `timeless-wardrobe` by design (repo / package name, not the old Vercel typo):

- `package.json` `"name": "timeless-wardrobe"`
- `app.js` keys like `timeless-wardrobe-outfits-v1`
- JSON `_schema` fields in `data/`
