/**
 * Shared helpers: wardrobe row ↔ text-only local audit format (no image bodies).
 */

const TEXT_LOCAL_SCHEMA = "timeless-wardrobe-text-local-v1";

/** @param {string} p */
function readFileItemsFromJs(p, fs) {
  const code = fs.readFileSync(p, "utf8");
  const fn = new Function(`${code}\n;return WARDROBE_ITEMS;`);
  const items = fn();
  if (!Array.isArray(items)) throw new Error("WARDROBE_ITEMS not found in wardrobe.js");
  return items;
}

/** @param {unknown} row */
function normalizeGallery(row) {
  const g = row?.gallery;
  if (Array.isArray(g)) return g.map((x) => String(x)).filter(Boolean);
  if (typeof g === "string" && g.trim()) {
    try {
      const p = JSON.parse(g);
      if (Array.isArray(p)) return p.map((x) => String(x)).filter(Boolean);
    } catch {
      /* */
    }
  }
  return [];
}

/** @param {unknown} meta */
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
  return {};
}

/** @param {unknown} v */
function colourVariantsFromMeta(meta) {
  const m = metaObject(meta);
  if (Array.isArray(m.colourVariants) && m.colourVariants.length) return m.colourVariants;
  if (Array.isArray(m.colorVariants) && m.colorVariants.length) return m.colorVariants;
  return [];
}

/** @param {unknown} v */
function stripVariantImages(v) {
  if (!v || typeof v !== "object") return v;
  const o = { ...v };
  delete o.image;
  delete o.gallery;
  if (o.colorVariants && !o.colourVariants) {
    o.colourVariants = o.colorVariants;
  }
  delete o.colorVariants;
  return o;
}

/**
 * Text-only record for local review (camelCase, no image URLs).
 * @param {Record<string, unknown>} row — Supabase or app-shaped row
 */
export function rowToLocalTextRecord(row) {
  const meta = metaObject(row.metadata);
  const cvRaw =
    Array.isArray(row.colourVariants) && row.colourVariants.length
      ? row.colourVariants
      : colourVariantsFromMeta(meta);
  const colourVariants = cvRaw.map((v) => stripVariantImages(v));
  const measurementRows = Array.isArray(meta.measurementRows)
    ? meta.measurementRows.map((r) =>
        r && typeof r === "object"
          ? { label: String(r.label ?? ""), value: String(r.value ?? "") }
          : r
      )
    : [];
  const image = String(row.image ?? "").trim();
  const gallery = normalizeGallery(row);
  return {
    id: String(row.id ?? "").trim(),
    brand: String(row.brand ?? "").trim(),
    name: String(row.name ?? "").trim(),
    pillar: String(row.pillar ?? "").trim(),
    section: String(row.section ?? "").trim(),
    category: String(row.category ?? "").trim(),
    season: String(row.season ?? "").trim(),
    colour: String(row.colour ?? row.color ?? "").trim(),
    colourCode: String(row.colour_code ?? row.colourCode ?? row.color_code ?? row.colorCode ?? "").trim(),
    fabric: String(row.fabric ?? "").trim(),
    weight: String(row.weight ?? "").trim(),
    size: String(row.size ?? "").trim(),
    measuredDimensions: String(row.measured_dimensions ?? row.measuredDimensions ?? "").trim(),
    purchaseDate: String(row.purchase_date ?? row.purchaseDate ?? "").trim(),
    notes: String(row.notes ?? "").trim(),
    price: meta.price != null ? meta.price : row.price ?? null,
    priceCurrency: String(meta.priceCurrency ?? row.priceCurrency ?? "TWD").trim(),
    basicColour: String(meta.basicColour ?? row.basicColour ?? "").trim(),
    measurementRows,
    measurementUnit: String(meta.measurementUnit ?? row.measurementUnit ?? "").trim(),
    colourVariants,
    _media: {
      hasCover: Boolean(image),
      galleryCount: gallery.length,
    },
  };
}

/**
 * @param {ReturnType<typeof rowToLocalTextRecord>} text
 * @param {Record<string, unknown>} [existing] — keep image/gallery from DB when applying text
 */
export function localTextToSupabaseRow(text, existing = {}) {
  const meta = metaObject(existing.metadata);
  if (text.price != null && Number.isFinite(Number(text.price))) {
    meta.price = Number(text.price);
    meta.priceCurrency = String(text.priceCurrency ?? "TWD").trim().toUpperCase() || "TWD";
  }
  if (text.basicColour) meta.basicColour = text.basicColour;
  else delete meta.basicColour;
  if (Array.isArray(text.measurementRows) && text.measurementRows.length) {
    meta.measurementRows = text.measurementRows;
    if (text.measurementUnit === "mm") meta.measurementUnit = "mm";
    else delete meta.measurementUnit;
  } else {
    delete meta.measurementRows;
    delete meta.measurementUnit;
  }
  if (Array.isArray(text.colourVariants) && text.colourVariants.length) {
    meta.colourVariants = text.colourVariants;
    delete meta.colorVariants;
    delete meta.basicColour;
  } else {
    delete meta.colourVariants;
    delete meta.colorVariants;
  }
  const season = String(text.season ?? "").trim();
  return {
    id: String(text.id ?? "").trim(),
    pillar: String(text.pillar ?? "").trim(),
    section: String(text.section ?? "").trim(),
    category: String(text.category ?? "").trim(),
    brand: String(text.brand ?? "").trim(),
    name: String(text.name ?? "").trim(),
    season: !season || season === "All" ? "All-season" : season,
    colour: String(text.colour ?? "").trim(),
    colour_code: String(text.colourCode ?? "").trim(),
    fabric: String(text.fabric ?? "").trim(),
    weight: String(text.weight ?? "").trim(),
    size: String(text.size ?? "").trim(),
    measured_dimensions: String(text.measuredDimensions ?? "").trim(),
    purchase_date: String(text.purchaseDate ?? "").trim(),
    notes: String(text.notes ?? ""),
    image: String(existing.image ?? "").trim(),
    gallery: normalizeGallery(existing),
    metadata: Object.keys(meta).length ? meta : null,
  };
}

/** @param {object[]} cloudText @param {object[]} seedItems */
export function buildAuditReport(cloudText, seedItems) {
  const seedById = new Map(seedItems.map((r) => [String(r.id), rowToLocalTextRecord(r)]));
  const cloudById = new Map(cloudText.map((r) => [String(r.id), r]));
  const onlyCloud = [];
  const onlySeed = [];
  const fieldDiffs = [];

  for (const [id, cloud] of cloudById) {
    if (!seedById.has(id)) onlyCloud.push(id);
    else {
      const seed = seedById.get(id);
      const keys = [
        "brand",
        "name",
        "category",
        "season",
        "colour",
        "notes",
      ];
      const diff = keys.filter((k) => String(cloud[k] ?? "") !== String(seed[k] ?? ""));
      if (diff.length) fieldDiffs.push({ id, fields: diff });
    }
  }
  for (const id of seedById.keys()) {
    if (!cloudById.has(id)) onlySeed.push(id);
  }
  return {
    cloudCount: cloudText.length,
    seedCount: seedItems.length,
    onlyInCloud: onlyCloud,
    onlyInSeed: onlySeed,
    textFieldDiffsVsSeed: fieldDiffs,
  };
}

export function buildTextLocalPayload(items, source = "supabase") {
  return {
    _schema: TEXT_LOCAL_SCHEMA,
    exportedAt: new Date().toISOString(),
    source,
    rowCount: items.length,
    items,
  };
}

export { TEXT_LOCAL_SCHEMA, readFileItemsFromJs };
