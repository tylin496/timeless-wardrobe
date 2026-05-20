/**
 * Local wardrobe image paths — mirror Supabase `wardrobe-images` object layout under `/images/wardrobe/`.
 */

export const WARDROBE_IMAGE_BUCKET = "wardrobe-images";
export const LOCAL_WARDROBE_IMAGE_ROOT = "/images/wardrobe";

/** @param {string} u */
export function storagePathFromWardrobeImageUrl(u) {
  const s = String(u ?? "").trim().split("?")[0];
  if (!s || !/^https?:\/\//i.test(s)) return "";
  const esc = WARDROBE_IMAGE_BUCKET.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`/storage/v1/(?:object/public|render/image/public)/${esc}/(.+)$`, "i");
  const m = s.match(re);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** @param {string} storagePath */
export function localPublicUrlForStoragePath(storagePath) {
  const p = String(storagePath ?? "")
    .trim()
    .replace(/^\/+/, "");
  if (!p) return "";
  return `${LOCAL_WARDROBE_IMAGE_ROOT}/${p}`;
}

/** @param {string} url */
export function rewriteWardrobeUrlToLocal(url) {
  const path = storagePathFromWardrobeImageUrl(url);
  if (!path) return String(url ?? "").trim();
  return localPublicUrlForStoragePath(path);
}

/** @param {unknown} item */
export function collectWardrobeImageUrlsFromItem(item) {
  if (!item || typeof item !== "object") return [];
  const out = [];
  const seen = new Set();
  const add = (u) => {
    const path = storagePathFromWardrobeImageUrl(u);
    if (!path || seen.has(path)) return;
    seen.add(path);
    out.push({ url: String(u).trim().split("?")[0], path });
  };
  add(item.image);
  const gallery = item.gallery;
  if (Array.isArray(gallery)) {
    for (const u of gallery) add(u);
  }
  const variants = item.colourVariants || item.colorVariants;
  if (Array.isArray(variants)) {
    for (const v of variants) {
      if (!v || typeof v !== "object") continue;
      add(v.image);
      add(v.previewImage);
      if (Array.isArray(v.gallery)) {
        for (const u of v.gallery) add(u);
      }
    }
  }
  const meta = item.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const mcv = meta.colourVariants || meta.colorVariants;
    if (Array.isArray(mcv)) {
      for (const v of mcv) {
        if (!v || typeof v !== "object") continue;
        add(v.image);
        add(v.previewImage);
        if (Array.isArray(v.gallery)) {
          for (const u of v.gallery) add(u);
        }
      }
    }
  }
  return out;
}

/** @param {Record<string, unknown>} item */
export function rewriteItemMediaUrlsToLocal(item) {
  const out = { ...item };
  if (out.image) out.image = rewriteWardrobeUrlToLocal(out.image);
  if (Array.isArray(out.gallery)) {
    out.gallery = out.gallery.map((u) => rewriteWardrobeUrlToLocal(u)).filter(Boolean);
  }
  const rewriteVariant = (v) => {
    if (!v || typeof v !== "object") return v;
    const nv = { ...v };
    if (nv.image) nv.image = rewriteWardrobeUrlToLocal(nv.image);
    if (nv.previewImage) nv.previewImage = rewriteWardrobeUrlToLocal(nv.previewImage);
    if (Array.isArray(nv.gallery)) {
      nv.gallery = nv.gallery.map((u) => rewriteWardrobeUrlToLocal(u)).filter(Boolean);
    }
    return nv;
  };
  if (Array.isArray(out.colourVariants)) {
    out.colourVariants = out.colourVariants.map(rewriteVariant);
  }
  if (Array.isArray(out.colorVariants)) {
    out.colourVariants = out.colorVariants.map(rewriteVariant);
    delete out.colorVariants;
  }
  if (out.metadata && typeof out.metadata === "object" && !Array.isArray(out.metadata)) {
    const meta = { ...out.metadata };
    if (Array.isArray(meta.colourVariants)) {
      meta.colourVariants = meta.colourVariants.map(rewriteVariant);
    }
    if (Array.isArray(meta.colorVariants)) {
      meta.colourVariants = meta.colorVariants.map(rewriteVariant);
      delete meta.colorVariants;
    }
    out.metadata = meta;
  }
  return out;
}

/**
 * After id migration, Supabase may still point at legacy Storage paths. Prefer on-disk
 * `main/cover.png` or variant covers under the canonical item folder.
 * @param {Record<string, unknown>} item
 */
export function normalizeFrozenItemLocalMedia(item) {
  const out = { ...item };
  const id = String(out.id ?? "").trim();
  const img = String(out.image ?? "").trim();

  const variantRows = () => {
    const a = Array.isArray(out.colourVariants) ? out.colourVariants : [];
    if (a.length) return a;
    const meta = out.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const m = meta.colourVariants || meta.colorVariants;
      if (Array.isArray(m)) return m;
    }
    return [];
  };

  const variantCover = (key) => {
    const v = variantRows().find((row) => row && String(row.key ?? "") === key);
    return v && typeof v === "object" ? String(v.image ?? "").trim() : "";
  };

  if (id === "pleated-trousers" && /uniqlo-tuck-trousers/i.test(img)) {
    out.image = variantCover("grey") || `${LOCAL_WARDROBE_IMAGE_ROOT}/pleated-trousers/variants/grey/cover.png`;
  }
  if (id === "signet-ring" && /1778698092039-cover-edit/i.test(img)) {
    out.image = `${LOCAL_WARDROBE_IMAGE_ROOT}/signet-ring/main/cover.png`;
  }
  if (id === "wedding-bands" && /1778704141467-cover-edit/i.test(img)) {
    out.image = `${LOCAL_WARDROBE_IMAGE_ROOT}/wedding-bands/main/cover.png`;
  }
  return out;
}
