/**
 * Map Supabase `wardrobe_items` row → `data/wardrobe.js` item shape (camelCase).
 */

function normalizeGallery(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map((x) => String(x)).filter(Boolean);
    } catch {
      /* */
    }
  }
  return [];
}

function metaObject(meta) {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) return { ...meta };
  if (typeof meta === "string" && meta.trim()) {
    try {
      const p = JSON.parse(meta);
      if (p && typeof p === "object" && !Array.isArray(p)) return { ...p };
    } catch {
      /* */
    }
  }
  return null;
}

/** @param {Record<string, unknown>} row */
export function cloudRowToSeedItem(row) {
  const id = String(row.id ?? "").trim();
  if (!id) return null;

  const meta = metaObject(row.metadata);
  const cvRaw =
    Array.isArray(row.colourVariants) && row.colourVariants.length
      ? row.colourVariants
      : Array.isArray(row.colorVariants) && row.colorVariants.length
        ? row.colorVariants
        : meta && Array.isArray(meta.colourVariants) && meta.colourVariants.length
          ? meta.colourVariants
          : meta && Array.isArray(meta.colorVariants) && meta.colorVariants.length
            ? meta.colorVariants
            : null;

  const seasonRaw = String(row.season ?? "").trim();
  const season = !seasonRaw || seasonRaw === "All" ? "All-season" : seasonRaw;

  /** @type {Record<string, unknown>} */
  const item = { id };

  const pillar = String(row.pillar ?? "").trim();
  if (pillar) item.pillar = pillar;

  const section = String(row.section ?? "").trim();
  if (section) item.section = section;

  const category = String(row.category ?? "").trim();
  if (category) item.category = category;

  item.brand = String(row.brand ?? "").trim() || "[No brand]";
  item.name = String(row.name ?? "").trim() || "[Untitled]";
  item.season = season;

  const colour = String(row.colour ?? row.color ?? "").trim();
  if (colour) item.colour = colour;

  const colourCode = String(row.colour_code ?? row.colourCode ?? row.color_code ?? row.colorCode ?? "").trim();
  if (colourCode) item.colourCode = colourCode;

  const fabric = String(row.fabric ?? "").trim();
  if (fabric) item.fabric = fabric;

  const weight = String(row.weight ?? "").trim();
  if (weight) item.weight = weight;

  const size = String(row.size ?? "").trim();
  if (size) item.size = size;

  const measuredDimensions = String(row.measured_dimensions ?? row.measuredDimensions ?? "").trim();
  if (measuredDimensions) item.measuredDimensions = measuredDimensions;

  const purchaseDate = String(row.purchase_date ?? row.purchaseDate ?? "").trim();
  if (purchaseDate) item.purchaseDate = purchaseDate;

  const image = String(row.image ?? "").trim();
  if (image) item.image = image;

  const gallery = normalizeGallery(row.gallery);
  if (gallery.length) item.gallery = gallery;

  const notes = String(row.notes ?? "").trim();
  if (notes) item.notes = notes;

  if (cvRaw && cvRaw.length) item.colourVariants = cvRaw;

  if (meta && Object.keys(meta).length) {
    const metaOut = { ...meta };
    if (Array.isArray(metaOut.colorVariants) && !metaOut.colourVariants) {
      metaOut.colourVariants = metaOut.colorVariants;
    }
    delete metaOut.colorVariants;
    if (Object.keys(metaOut).length) item.metadata = metaOut;
  }

  return item;
}

/** @param {Record<string, unknown>[]} items */
export function formatWardrobeJsFile(items, frozenAt) {
  const sorted = [...items].sort((a, b) => {
    const sa = String(a.section ?? "");
    const sb = String(b.section ?? "");
    if (sa !== sb) return sa.localeCompare(sb);
    const ba = String(a.brand ?? "");
    const bb = String(b.brand ?? "");
    if (ba !== bb) return ba.localeCompare(bb);
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });

  const blocks = [];
  let lastSection = null;
  for (const item of sorted) {
    const sec = String(item.section ?? "").trim();
    if (sec && sec !== lastSection) {
      blocks.push(`  // ——— ${sec} ———`);
      lastSection = sec;
    }
    blocks.push(`${JSON.stringify(item, null, 2).replace(/^/gm, "  ")}`);
  }

  return `/**
 * Timeless Wardrobe — frozen catalogue seed (offline fallback + dev).
 *
 * Frozen from Supabase wardrobe_items on ${frozenAt}.
 * Regenerate: npm run db:freeze-catalogue
 *
 * Collection thesis is described in the site header. Each row uses \`category\` (and optional
 * \`season\`) for browsing; \`section\` / \`pillar\` are legacy fields and not shown in the UI.
 *
 * Images: full \`https://…\` public URLs (Supabase \`wardrobe-images\` bucket).
 * Optional \`gallery\`: string[] of extra image URLs; \`image\` is always the cover.
 * Optional \`colourVariants\`: same product in multiple colours — one archive row.
 * Optional \`size\`, \`measuredDimensions\`, and \`purchaseDate\`.
 */

const WARDROBE_ITEMS = [
${blocks.join(",\n\n")}
];
`;
}
