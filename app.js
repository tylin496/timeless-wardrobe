(function () {
  const STORAGE_KEY = "timeless-wardrobe-outfits-v1";
  const STYLING_BOARD_DRAFT_KEY = "timeless-wardrobe-styling-board-draft-v1";
  const MAX_OUTFIT_ITEMS = 16;
  const OUTFIT_STORAGE_VERSION = 2;
  const STYLING_BOARD_DRAFT_VERSION = 1;

  /** Split archive rows merged into one id — remap saved outfit lines. */
  const LEGACY_OUTFIT_ITEM_TO_SLOT = new Map([
    ["uniqlo-ocbd-shirt-blue", { itemId: "uniqlo-ocbd-shirt", colourKey: "blue" }],
    ["uniqlo-ocbd-shirt-white", { itemId: "uniqlo-ocbd-shirt", colourKey: "white" }],
    ["uniqlo-ocbd-shirt-pink-stripe", { itemId: "uniqlo-ocbd-shirt", colourKey: "pink-stripe" }],
    ["uniqlo-ocbd-shirt-blue-striped", { itemId: "uniqlo-ocbd-shirt", colourKey: "blue-striped" }],
    ["uniqlo-tuck-trousers-grey", { itemId: "uniqlo-tuck-trousers", colourKey: "grey" }],
    ["uniqlo-tuck-trousers-beige", { itemId: "uniqlo-tuck-trousers", colourKey: "beige" }],
  ]);

  function itemColourCode(item) {
    if (!item || typeof item !== "object") return "";
    return String(item.colourCode ?? item.colorCode ?? item.colour_code ?? item.color_code ?? "").trim();
  }

  /** Broad colour families — archive colour chips + optional per-item / per-variant override. */
  const BASIC_COLOUR_FAMILY_KEYS = ["blue", "brown", "red", "white", "black", "beige", "gold", "silver", "green", "grey"];

  /**
   * Stored in `item.basicColour` or `metadata.basicColour`: piece opts out of broad-colour buckets —
   * no inference from colour text / hex, excluded from archive colour chips and colour filter matches.
   */
  const BASIC_COLOUR_CLASSIFICATION_OMIT = "__omit__";

  function itemOmitsBasicColourClassification(item) {
    if (!item || typeof item !== "object") return false;
    const meta =
      item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata : null;
    const raw = String(item.basicColour ?? meta?.basicColour ?? "")
      .trim()
      .toLowerCase();
    return raw === BASIC_COLOUR_CLASSIFICATION_OMIT;
  }

  function normalizeStoredBasicColourKey(raw) {
    const v = String(raw ?? "")
      .trim()
      .toLowerCase();
    if (v === "platinum") return "silver";
    return BASIC_COLOUR_FAMILY_KEYS.includes(v) ? v : "";
  }

  /** Uploaded swatch (`previewImage` / `swatchImage`). When set and displayable, grid swatches show it before hex fill, colour-code text, or variant cover. */
  function variantSwatchImageUrl(v) {
    if (!v || typeof v !== "object") return "";
    return String(v.previewImage ?? v.swatchImage ?? "").trim();
  }

  /**
   * Optional `colourVariants` on a wardrobe row (legacy JSON may use `colorVariants`).
   * @returns {{ key: string, label: string, colour: string, colourCode: string, image: string, previewImage: string, gallery: string[], notes: string, basicColour?: string }[] | null}
   */
  function getItemColourVariants(item) {
    let raw = null;
    if (Array.isArray(item?.colourVariants) && item.colourVariants.length) raw = item.colourVariants;
    else if (Array.isArray(item?.colorVariants) && item.colorVariants.length) raw = item.colorVariants;
    else if (
      item?.metadata &&
      typeof item.metadata === "object" &&
      Array.isArray(item.metadata.colourVariants) &&
      item.metadata.colourVariants.length
    )
      raw = item.metadata.colourVariants;
    else if (
      item?.metadata &&
      typeof item.metadata === "object" &&
      Array.isArray(item.metadata.colorVariants) &&
      item.metadata.colorVariants.length
    )
      raw = item.metadata.colorVariants;
    if (!raw) return null;
    const out = [];
    for (const v of raw) {
      if (!v || typeof v !== "object") continue;
      const key = String(v.key ?? "").trim();
      const image = String(v.image ?? "").trim();
      if (!key || !image) continue;
      const bc = normalizeStoredBasicColourKey(v.basicColour ?? v.colourFamily);
      /** @type {{ key: string, label: string, colour: string, colourCode: string, image: string, previewImage: string, gallery: string[], notes: string, basicColour?: string }} */
      const row = {
        key,
        label: String(v.label ?? v.colour ?? v.color ?? key).trim() || key,
        colour: String(v.colour ?? v.color ?? "").trim(),
        colourCode: String(v.colourCode ?? v.colorCode ?? v.colour_code ?? v.color_code ?? "").trim(),
        image,
        previewImage: String(v.previewImage ?? v.swatchImage ?? "").trim(),
        gallery: Array.isArray(v.gallery) ? v.gallery.map((x) => String(x ?? "").trim()).filter(Boolean) : [],
        notes: v.notes != null ? String(v.notes) : "",
      };
      if (bc) row.basicColour = bc;
      out.push(row);
    }
    return out.length ? out : null;
  }

  /** First `#rgb` / `#rrggbb` in colour code, colour name, or label for grid swatches. */
  function extractSwatchHexFromVariant(v) {
    const pools = [
      String(v?.colourCode ?? v?.colorCode ?? v?.colour_code ?? v?.color_code ?? "").trim(),
      String(v?.colour ?? v?.color ?? "").trim(),
      String(v?.label ?? "").trim(),
    ];
    for (const p of pools) {
      const m = p.match(/#([0-9a-fA-F]{6})\b|#([0-9a-fA-F]{3})\b/);
      if (!m) continue;
      const raw = m[0];
      let h = raw.slice(1);
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      return `#${h.toLowerCase()}`;
    }
    return "";
  }

  /** Small swatch beside item-edit colour code inputs (parses `#rgb` / `#rrggbb` from code, name, or label). */
  function syncItemEditColourCodePreviewEl(previewEl, sources) {
    if (!(previewEl instanceof HTMLElement)) return;
    const hex = extractSwatchHexFromVariant({
      colourCode: String(sources?.colourCode ?? "").trim(),
      colour: String(sources?.colour ?? "").trim(),
      label: String(sources?.label ?? "").trim(),
    });
    previewEl.classList.toggle("item-edit-colour-code-preview--filled", Boolean(hex));
    previewEl.classList.toggle("item-edit-colour-code-preview--empty", !hex);
    if (hex) {
      previewEl.style.backgroundColor = hex;
      if (hexFillLuminance(hex) < 0.28) {
        previewEl.style.boxShadow =
          "inset 0 0 0 1px rgba(255, 255, 255, 0.38), 0 0 0 1px rgba(255, 255, 255, 0.22)";
      } else {
        previewEl.style.boxShadow = "inset 0 0 0 1px rgba(0, 0, 0, 0.18)";
      }
      previewEl.setAttribute("title", hex);
    } else {
      previewEl.style.backgroundColor = "";
      previewEl.style.boxShadow = "";
      previewEl.removeAttribute("title");
    }
  }

  function createItemEditColourCodePreview() {
    const preview = document.createElement("span");
    preview.className = "item-edit-colour-code-preview item-edit-colour-code-preview--empty";
    preview.setAttribute("aria-hidden", "true");
    return preview;
  }

  /**
   * @param {{ input: HTMLInputElement, preview: HTMLElement, colourInput?: HTMLInputElement | null, labelInput?: HTMLInputElement | null }} opts
   */
  function wireItemEditColourCodePreview(opts) {
    const input = opts?.input;
    const preview = opts?.preview;
    if (!(input instanceof HTMLInputElement) || !(preview instanceof HTMLElement)) return;
    const colourInput = opts?.colourInput instanceof HTMLInputElement ? opts.colourInput : null;
    const labelInput = opts?.labelInput instanceof HTMLInputElement ? opts.labelInput : null;
    const run = () => {
      syncItemEditColourCodePreviewEl(preview, {
        colourCode: input.value,
        colour: colourInput?.value ?? "",
        label: labelInput?.value ?? "",
      });
    };
    input.addEventListener("input", run);
    colourInput?.addEventListener("input", run);
    labelInput?.addEventListener("input", run);
    run();
  }

  /** Relative luminance 0–1 for `#rrggbb` (sRGB). */
  function hexFillLuminance(hex) {
    const s = String(hex ?? "").trim();
    const m = /^#([0-9a-f]{6})$/i.exec(s);
    if (!m) return 1;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /** Refined swatch fills for archive grid tray (editorial, not literal product hues). */
  const LUXURY_SWATCH_HEX = {
    blue: "#1f3554",
    brown: "#6d4c3b",
    white: "#ede8e0",
    black: "#121212",
    beige: "#c9b896",
    grey: "#8c9093",
    green: "#4d5a45",
    red: "#6b2d3b",
    gold: "#a68b4b",
    silver: "#9ea2a8",
  };

  /**
   * When a variant has no uploaded swatch / embedded hex, map `basicColour` or colour words to a tray swatch.
   * @param {{ basicColour?: string, label?: string, colour?: string, color?: string }} v
   * @returns {string} `#rrggbb` or ""
   */
  function luxurySwatchHexFromVariant(v) {
    if (!v || typeof v !== "object") return "";
    const bc = normalizeStoredBasicColourKey(v.basicColour ?? v.colourFamily);
    if (bc && LUXURY_SWATCH_HEX[bc]) return LUXURY_SWATCH_HEX[bc];
    const text = `${String(v.label ?? "").trim()} ${String(v.colour ?? v.color ?? "").trim()}`.toLowerCase();
    /** @type {[RegExp, keyof typeof LUXURY_SWATCH_HEX][]} */
    const rules = [
      [/\b(silver|platinum|chrome)\b/i, "silver"],
      [/\b(gold|champagne)\b/i, "gold"],
      [/\b(navy|indigo|denim)\b/i, "blue"],
      [/\b(blue)\b/i, "blue"],
      [/\b(brown|chocolate|cognac|espresso|caramel)\b/i, "brown"],
      [/\b(tan)\b/i, "beige"],
      [/\b(white|ivory|cream|off[\s-]?white)\b/i, "white"],
      [/\b(black|noir)\b/i, "black"],
      [/\b(beige|sand|camel|stone|taupe|oat)\b/i, "beige"],
      [/\b(grey|gray|charcoal|graphite|slate)\b/i, "grey"],
      [/\b(olive|sage|hunter|forest|moss)\b/i, "green"],
      [/\b(green)\b/i, "green"],
      [/\b(wine|burgundy|bordeaux|merlot|maroon)\b/i, "red"],
      [/\b(red|rose|pink)\b/i, "red"],
    ];
    for (const [re, key] of rules) {
      if (re.test(text)) return LUXURY_SWATCH_HEX[key];
    }
    return "";
  }

  /** One line of human-readable colour info (label, text colour, hex) for captions under swatches. */
  function variantCaptionText(v) {
    if (!v || typeof v !== "object") return "";
    const label = String(v.label ?? "").trim();
    const col = String(v.colour ?? v.color ?? "").trim();
    const hex = extractSwatchHexFromVariant(v);
    const parts = [];
    if (label) parts.push(label);
    if (col && col.toLowerCase() !== label.toLowerCase()) parts.push(col);
    if (hex) {
      const hexShort = hex.toLowerCase();
      const already = parts.some((p) => p.toLowerCase().includes(hexShort));
      if (!already) parts.push(hex);
    }
    return parts.join(" · ") || String(v.key ?? "").trim() || "Colour";
  }

  /**
   * Colour dots for `colourVariants`. When `heroImg` + `heroHost` are set, tap switches the main photo to that variant’s cover (`image`).
   * On the archive grid, use the card’s “+” to add to an outfit. When `addToOutfitOnPick` is true (e.g. item detail page), tap also adds that colour to the outfit if eligible.
   * If only `outfitPick` is set (no hero), tap adds the colour to the outfit.
   * @param {HTMLElement} mountEl
   * @param {object} item
   * @param {{ outfitPick?: boolean, heroImg?: HTMLImageElement | null, heroHost?: HTMLElement | null, addToOutfitOnPick?: boolean, showHeroGallery?: boolean, gridCaption?: "compact", gridColourTray?: boolean, heroInitialColourKey?: string }} [opts]
   * `heroInitialColourKey` — when set (e.g. archive colour filter), marks that variant active and matches hero if it already shows that cover.
   * `gridCaption: "compact"` — archive grid only: short caption for multi-colour rows (swatches carry the rest).
   * `gridColourTray` — archive grid only: translucent bottom tray on the card image (requires 2+ variants).
   */
  function mountVariantSwatchStrip(mountEl, item, opts = {}) {
    const variants = getItemColourVariants(item);
    if (!variants?.length) return;
    const gridColourTray = Boolean(opts.gridColourTray);
    if (gridColourTray && variants.length <= 1) return;
    const heroImg = opts.heroImg ?? null;
    const heroHost = opts.heroHost ?? null;
    const addToOutfitOnPick = Boolean(opts.addToOutfitOnPick);
    const showHeroGallery = opts.showHeroGallery !== false;
    const outfitPick = Boolean(opts.outfitPick) && itemEligibleForOutfit(item);
    const gridCaption = opts.gridCaption;
    const heroInitialColourKey = String(opts.heroInitialColourKey ?? "").trim();
    const interactive = Boolean(heroImg) || outfitPick;

    const block = document.createElement("div");
    block.className =
      "card__swatch-block" + (gridColourTray ? " card__swatch-block--tray" : "");
    const sw = document.createElement("div");
    sw.className = "card__swatches";
    sw.setAttribute("role", "group");
    sw.setAttribute("aria-label", "Available colours");

    function applyVariantHero(colourKey) {
      if (!heroImg || !heroHost) return;
      const projected = itemProjectionForOutfitSlot(item, { itemId: String(item.id), colourKey: String(colourKey) });
      heroHost.querySelector(".card__gallery-strip")?.remove();
      wireCoverImageWithFallbacks(heroImg, projected, {
        host: heroHost,
        coverRenderWidth: ARCHIVE_GRID_CARD_RENDER.width,
        coverRenderHeight: ARCHIVE_GRID_CARD_RENDER.height,
        coverRenderQuality: ARCHIVE_GRID_CARD_RENDER.quality,
        coverRenderResize: ARCHIVE_GRID_CARD_RENDER.resize,
        onResolved(url) {
          heroImg.dataset.coverSrc = url;
          const ti = heroHost.querySelector(".card__gallery-strip .card__gallery-thumb.is-active img");
          if (ti) ti.src = url;
        },
      });
      if (showHeroGallery && itemGalleryList(projected).length) {
        mountHeroGalleryStrip(heroHost, heroImg, projected);
      }
      heroImg.alt = imageAltForItem(projected);
      sw.querySelectorAll(".card__swatch").forEach((node) => {
        const nk = /** @type {HTMLElement} */ (node).dataset.variantKey;
        node.classList.toggle("is-active", nk === String(colourKey));
      });
    }

    variants.forEach((v, idx) => {
      const lbl = String(v.label ?? v.colour ?? v.color ?? "").trim() || `Colour ${idx + 1}`;
      const colourText = String(v.colour ?? v.color ?? "").trim();
      const hex = extractSwatchHexFromVariant(v);
      const el = interactive ? document.createElement("button") : document.createElement("span");
      if (interactive) {
        /** @type {HTMLButtonElement} */ (el).type = "button";
      }
      el.dataset.variantKey = String(v.key);
      el.className = "card__swatch" + (interactive ? " card__swatch--pick" : "");
      const tip = [lbl, colourText].filter(Boolean).join(" · ");
      if (heroImg) {
        if (addToOutfitOnPick && outfitPick) {
          el.title = tip + " — Show this colour’s cover and add it to the outfit";
          el.setAttribute("aria-label", `Show cover and add ${lbl} to outfit`);
        } else {
          el.title =
            tip +
            (outfitPick ? " — Show this colour’s cover (use + on the photo to add to outfit)" : " — Show this colour’s cover");
          el.setAttribute("aria-label", `Show cover for ${lbl}`);
        }
      } else {
        el.title = tip + (outfitPick ? " — Add this colour to outfit" : "");
        el.setAttribute("aria-label", outfitPick ? `Add ${lbl} to outfit` : lbl);
      }
      const vu = String(variantSwatchImageUrl(v) ?? "").trim();
      const showPreview = vu && isDisplayableCloudImageUrl(vu);
      const fillHex = hex || luxurySwatchHexFromVariant(v);

      if (showPreview) {
        const si = document.createElement("img");
        si.src = withWardrobeImageCacheBust(vu, item);
        si.alt = "";
        si.setAttribute("aria-hidden", "true");
        el.appendChild(si);
      } else if (fillHex) {
        el.style.backgroundColor = fillHex;
        if (hexFillLuminance(fillHex) < 0.28) {
          el.style.boxShadow =
            "inset 0 0 0 1px rgba(255, 255, 255, 0.38), 0 0 0 1px rgba(255, 255, 255, 0.22)";
        } else {
          el.style.boxShadow = "inset 0 0 0 1px rgba(0, 0, 0, 0.2)";
        }
      } else {
        const fallback = String(v.image ?? "").trim();
        if (fallback && isDisplayableCloudImageUrl(fallback)) {
          const si = document.createElement("img");
          si.src = withWardrobeImageCacheBust(fallback, item);
          si.alt = "";
          si.setAttribute("aria-hidden", "true");
          el.appendChild(si);
        }
      }
      if (interactive) {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (heroImg) applyVariantHero(v.key);
          if (outfitPick && (addToOutfitOnPick || !heroImg)) {
            pushOutfitSlot({ itemId: String(item.id), colourKey: String(v.key) });
          }
        });
      }
      sw.appendChild(el);
    });

    if (heroImg && heroHost) {
      let initialKey = "";
      if (heroInitialColourKey && variants.some((vv) => String(vv.key) === heroInitialColourKey)) {
        initialKey = heroInitialColourKey;
      }
      if (!initialKey) {
        const mainImg = String(item.image ?? "").trim();
        initialKey =
          String(variants.find((vv) => String(vv.image ?? "").trim() === mainImg)?.key ?? variants[0]?.key ?? "");
      }
      if (initialKey) {
        sw.querySelectorAll(".card__swatch").forEach((node) => {
          if (/** @type {HTMLElement} */ (node).dataset.variantKey === String(initialKey)) {
            node.classList.add("is-active");
          }
        });
      }
    }

    block.appendChild(sw);
    if (!gridColourTray) {
      const cap = document.createElement("p");
      cap.className = "card__swatch-caption";
      if (gridCaption === "compact" && variants.length > 1) {
        cap.textContent = `${variants.length} colours`;
        cap.classList.add("card__swatch-caption--compact");
      } else {
        cap.textContent = variants.map(variantCaptionText).join(" · ");
      }
      block.appendChild(cap);
    }
    if (gridColourTray) {
      sw.classList.add("card__swatches--tray");
      const tray = document.createElement("div");
      tray.className = "card__colour-tray";
      const inner = document.createElement("div");
      inner.className = "card__colour-tray__inner";
      inner.appendChild(block);
      tray.appendChild(inner);
      mountEl.appendChild(tray);
    } else {
      mountEl.appendChild(block);
    }
  }

  /** Shallow row shaped for cover / gallery resolution for one outfit slot. */
  function itemProjectionForOutfitSlot(item, slot) {
    const vars = getItemColourVariants(item);
    if (!vars || !slot?.colourKey) return item;
    const v = vars.find((x) => x.key === slot.colourKey);
    if (!v) return item;
    const baseId = String(item.id ?? "");
    const vColour = String(v.colour ?? v.color ?? "").trim();
    const vCode = String(v.colourCode ?? "").trim();
    const vGal = Array.isArray(v.gallery) ? v.gallery : [];
    const itemGal = Array.isArray(item.gallery) ? item.gallery : [];
    return {
      ...item,
      image: v.image,
      colour: vColour || item.colour,
      colourCode: vCode || itemColourCode(item),
      gallery: vGal.length ? vGal : itemGal,
      __coverCacheKey: `${baseId}::${slot.colourKey}`,
    };
  }

  function outfitSlotKey(slot) {
    const id = String(slot?.itemId ?? "").trim();
    const ck = String(slot?.colourKey ?? slot?.colorKey ?? "").trim();
    return `${id}::${ck}`;
  }

  function normalizeOutfitSlot(raw) {
    if (raw == null) return null;
    if (typeof raw === "string") {
      const itemId = raw.trim();
      if (!itemId) return null;
      const leg = LEGACY_OUTFIT_ITEM_TO_SLOT.get(itemId);
      if (leg) return { itemId: leg.itemId, colourKey: leg.colourKey };
      return { itemId };
    }
    if (typeof raw === "object" && raw.itemId != null) {
      let itemId = String(raw.itemId).trim();
      let colourKey = String(raw.colourKey ?? raw.colorKey ?? "").trim();
      const leg = LEGACY_OUTFIT_ITEM_TO_SLOT.get(itemId);
      if (leg) {
        itemId = leg.itemId;
        if (!colourKey) colourKey = String(leg.colourKey ?? "").trim();
      }
      if (!itemId) return null;
      return colourKey ? { itemId, colourKey } : { itemId };
    }
    return null;
  }

  function outfitSlotsFromRecord(o) {
    if (!o) return [];
    if (Array.isArray(o.slots) && o.slots.length) {
      return o.slots.map(normalizeOutfitSlot).filter(Boolean);
    }
    if (Array.isArray(o.itemIds)) {
      return o.itemIds.map(normalizeOutfitSlot).filter(Boolean);
    }
    return [];
  }

  function normalizeSavedOutfitRecord(o) {
    if (!o || typeof o.id !== "string" || typeof o.name !== "string") return null;
    const slots = outfitSlotsFromRecord(o);
    return {
      id: o.id,
      name: o.name,
      notes: typeof o.notes === "string" ? o.notes : "",
      createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
      slots,
    };
  }

  const CUSTOM_ITEMS_KEY = "timeless-wardrobe-custom-items-v1";
  /** Merged on top of each `wardrobeBase` row with matching `id` (this browser only). */
  const ITEM_ARCHIVE_OVERRIDES_KEY = "timeless-wardrobe-archive-overrides-v1";
  /** Seed / Supabase row ids removed from the grid in this browser only (not deleted from disk or cloud). */
  const ARCHIVE_HIDDEN_IDS_KEY = "timeless-wardrobe-archive-hidden-v1";
  const SEASON_NAV_STORAGE_KEY = "timeless-wardrobe-season-nav-v1";
  /** Same-tab return from `item.html` → restore main list scroll (short TTL avoids stale jumps). */
  const ARCHIVE_SCROLL_RESTORE_KEY = "timeless-wardrobe-archive-scroll-v1";
  /** Same-tab return → restore category / season / type / search (same TTL as scroll). */
  const ARCHIVE_BROWSE_RESTORE_KEY = "timeless-wardrobe-archive-browse-v1";
  /** After item save + full navigation, pin the saved row so a stale cloud read cannot revert new images. */
  const WARDROBE_SAVE_PIN_KEY = "timeless-wardrobe-save-pin-v1";
  const WARDROBE_SAVE_PIN_TTL_MS = 3 * 60 * 1000;
  /** Full wardrobe text snapshot for offline review (browser localStorage). */
  const WARDROBE_TEXT_LOCAL_KEY = "timeless-wardrobe-text-local-v1";
  const TW_ADMIN_MODE_STORAGE_KEY = "adminMode";

  /** Local dev hosts (`npm run dev` uses 127.0.0.1). */
  function isTwLocalDevHost() {
    try {
      const h = globalThis.location.hostname;
      return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
    } catch {
      return false;
    }
  }

  function isTwAdminMode() {
    if (isTwLocalDevHost()) return true;
    try {
      if (new URLSearchParams(globalThis.location.search).get("admin") === "true") return true;
    } catch {
      /* */
    }
    try {
      if (localStorage.getItem(TW_ADMIN_MODE_STORAGE_KEY) === "true") return true;
    } catch {
      /* private mode */
    }
    return false;
  }

  function applyTwAdminModeUi() {
    const on = isTwAdminMode();
    document.documentElement.classList.toggle("tw-admin-mode", on);
    if (document.body) document.body.classList.toggle("tw-admin-mode", on);
    document.querySelectorAll(".tw-admin-only").forEach((el) => {
      if (on) el.removeAttribute("hidden");
      else el.setAttribute("hidden", "");
    });
    if (!on) {
      const addDlg = document.getElementById("add-item-dialog");
      if (addDlg?.open) {
        try {
          addDlg.close();
        } catch {
          /* */
        }
      }
      exitItemDetailEditIfOpen();
    }
  }

  function exitItemDetailEditIfOpen() {
    if (!document.getElementById("item-detail-edit-form")) return;
    const mount = itemDetailMountRoot();
    const it = itemById.get(detailItemId);
    if (!mount || !it) return;
    renderItemDetailContent(mount, it, { edit: false });
    replaceItemPageUrl(it.id, false);
  }

  function setTwAdminMode(enabled) {
    const on = Boolean(enabled);
    try {
      if (on) localStorage.setItem(TW_ADMIN_MODE_STORAGE_KEY, "true");
      else localStorage.removeItem(TW_ADMIN_MODE_STORAGE_KEY);
    } catch {
      /* */
    }
    applyTwAdminModeUi();
    if (on) {
      installLocalDataRiskBanner();
      installWardrobeTextLocalExportActions();
      initAddItemForm();
    }
    if (typeof showToast === "function") {
      showToast(on ? "Admin mode on — management tools visible." : "Admin mode off — public view.");
    }
  }

  function initTwAdminMode() {
    try {
      const p = new URLSearchParams(globalThis.location.search);
      if (p.get("admin") === "true") {
        localStorage.setItem(TW_ADMIN_MODE_STORAGE_KEY, "true");
      }
    } catch {
      /* */
    }
    applyTwAdminModeUi();
    console.log("isAdmin:", isTwAdminMode());
    if (document.body.dataset.twAdminShortcutWired === "1") return;
    document.body.dataset.twAdminShortcutWired = "1";
    document.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (e.key !== "A" && e.key !== "a") return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.closest("input, textarea, select, [contenteditable='true']") || t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setTwAdminMode(!isTwAdminMode());
    });
  }

  /** Homepage hero landing (`index.html`); logo and “Timeless Wardrobe” breadcrumb root. */
  const SITE_HOME_URL = "/";
  const ARCHIVE_PAGE_PATH = "/archive.html";
  const ARCHIVE_HOME_MAIN_URL = ARCHIVE_PAGE_PATH;
  const ARCHIVE_SCROLL_TTL_MS = 20 * 60 * 1000;

  const ARCHIVE_SORT_MODE_KEY = "timeless-wardrobe-archive-sort-v1";
  /** User hid the “browser-only storage” banner; clearing this key shows it again. */
  const LOCAL_DATA_RISK_BANNER_DISMISSED_KEY = "timeless-wardrobe-dismiss-local-risk-v1";
  const PRICE_CURRENCY_CODES = ["TWD", "USD", "JPY", "CNY"];
  const ARCHIVE_SORT_MODES = ["price-asc", "price-desc", "date-desc", "date-asc"];
  const ARCHIVE_DEFAULT_SORT_MODE = "date-desc";
  /** Basic colour archive filter: uses stored `basicColour` only when set; otherwise infers from colour / fabric / codes. */
  const BASIC_COLOUR_FILTER_KEY = "timeless-wardrobe-basic-colour-v1";

  /** Approximate FX vs USD — display + cross-currency sort only (not live rates). */
  const FX_TO_USD = { USD: 1, TWD: 0.031, JPY: 0.0067, CNY: 0.14 };

  function loadPersistedArchiveSortMode() {
    try {
      const v = String(localStorage.getItem(ARCHIVE_SORT_MODE_KEY) || "").trim();
      if (ARCHIVE_SORT_MODES.includes(v)) return v;
      if (v === "date-asc") return "date-asc";
      if (v === "archive" || v === "brand-asc" || v === "brand-desc") return ARCHIVE_DEFAULT_SORT_MODE;
    } catch {
      /* */
    }
    return ARCHIVE_DEFAULT_SORT_MODE;
  }

  function persistArchiveSortMode(v) {
    const ok = ARCHIVE_SORT_MODES.includes(v) ? v : ARCHIVE_DEFAULT_SORT_MODE;
    try {
      localStorage.setItem(ARCHIVE_SORT_MODE_KEY, ok);
    } catch {
      /* */
    }
    return ok;
  }

  function syncArchiveSortChipUi() {
    const drawer = document.getElementById("archive-filter-drawer");
    if (!drawer) return;
    drawer.querySelectorAll("[data-archive-sort]").forEach((btn) => {
      const on = String(btn.getAttribute("data-archive-sort") ?? "").trim() === archiveSortMode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncArchiveFilterDrawerDoneLabel(n) {
    if (!document.body.classList.contains("archive-ui--filter-drawer")) return;
    const doneBtn = document.getElementById("archive-filter-drawer-done");
    if (!doneBtn) return;
    const c = Number.isFinite(Number(n)) ? Number(n) : applyFilters(items).length;
    doneBtn.textContent = c > 0 ? `Done (${c})` : "Done";
  }

  function loadPersistedBasicColourFilter() {
    try {
      const v = String(localStorage.getItem(BASIC_COLOUR_FILTER_KEY) || "")
        .trim()
        .toLowerCase();
      if (!v) return "";
      if (BASIC_COLOUR_FAMILY_KEYS.includes(v)) return v;
    } catch {
      /* */
    }
    return "";
  }

  function persistBasicColourFilter(raw) {
    const v = String(raw ?? "")
      .trim()
      .toLowerCase();
    const ok = BASIC_COLOUR_FAMILY_KEYS.includes(v) ? v : "";
    try {
      if (ok) localStorage.setItem(BASIC_COLOUR_FILTER_KEY, ok);
      else localStorage.removeItem(BASIC_COLOUR_FILTER_KEY);
    } catch {
      /* */
    }
    return ok;
  }

  function basicColourLabelEn(key) {
    if (!key) return "All";
    return key.slice(0, 1).toUpperCase() + key.slice(1);
  }

  /**
   * @param {HTMLSelectElement | null} sel
   * @param {string} selectedKey
   */
  function fillBasicColourSelectOptions(sel, selectedKey) {
    if (!sel) return;
    const rawSel = String(selectedKey ?? "").trim();
    const wantOmit = rawSel.toLowerCase() === BASIC_COLOUR_CLASSIFICATION_OMIT;
    const want = normalizeStoredBasicColourKey(rawSel);
    sel.textContent = "";
    const oOmit = document.createElement("option");
    oOmit.value = BASIC_COLOUR_CLASSIFICATION_OMIT;
    oOmit.textContent = "None (not filtered by colour)";
    sel.appendChild(oOmit);
    const o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "Auto (from name / code / hex)";
    sel.appendChild(o0);
    for (const k of BASIC_COLOUR_FAMILY_KEYS) {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = basicColourLabelEn(k);
      if (!wantOmit && k === want) o.selected = true;
      sel.appendChild(o);
    }
    if (wantOmit) oOmit.selected = true;
    else if (!want) o0.selected = true;
  }

  const BASIC_COLOUR_SWATCH_HEX = {
    blue: "#3f67c8",
    brown: "#7b5835",
    red: "#b73a3a",
    white: "#f4f4f1",
    black: "#1b1b1b",
    beige: "#d1bfa3",
    gold: "#c9a227",
    silver: "#b8babf",
    green: "#4f7b56",
    grey: "#8d8e95",
  };

  /**
   * Parse price from form strings or JSON (supports `12.34` and `12,34` as decimal comma).
   * @param {unknown} raw
   * @returns {number | null}
   */
  function parsePriceAmountFlexible(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "number") {
      if (!Number.isFinite(raw) || raw < 0) return null;
      return raw;
    }
    const t = String(raw).trim();
    if (!t) return null;
    let s = t.replace(/\s/g, "");
    if (/^\d+[.,]\d+$/.test(s)) {
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }

  let archiveSortMode = loadPersistedArchiveSortMode();
  /** Archive list prices are converted to TWD for totals, sort, and card display. */
  const archiveDisplayCurrency = "TWD";
  let basicColourFilter = loadPersistedBasicColourFilter();
  /** @type {Set<string>} */
  let selectedBrandFilters = new Set();

  /**
   * Flatten optional price from top-level or `metadata` into `item.price` / `item.priceCurrency`.
   * Amount is stored in `priceCurrency` units (static FX is only used when converting for display/sort).
   * @param {object} item
   */
  function normalizeItemPriceFields(item) {
    if (!item || typeof item !== "object") return item;
    const meta = item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata : null;
    const raw =
      item.price !== undefined && item.price !== null && item.price !== ""
        ? item.price
        : meta && meta.price !== undefined && meta.price !== null && meta.price !== ""
          ? meta.price
          : null;
    let price = parsePriceAmountFlexible(raw);
    if (!Number.isFinite(price) || price < 0) price = null;
    let cur = String(item.priceCurrency ?? item.price_currency ?? (meta && meta.priceCurrency) ?? "").trim().toUpperCase();
    if (!cur || !PRICE_CURRENCY_CODES.includes(cur)) cur = "TWD";
    const out = { ...item, priceCurrency: cur };
    if (price != null) out.price = price;
    else delete out.price;
    return out;
  }

  /** Default measurement row labels for new pieces (editable). */
  const DEFAULT_MEASUREMENT_LABELS = ["Shoulder", "Chest", "Waist", "Sleeve", "Back Length"];

  function parseMeasurementUnitInput(raw) {
    return String(raw ?? "").trim().toLowerCase() === "mm" ? "mm" : "cm";
  }

  /**
   * @param {object} item
   * @returns {"cm" | "mm"}
   */
  function getMeasurementUnit(item) {
    if (!item || typeof item !== "object") return "cm";
    const top = String(item.measurementUnit ?? "").trim().toLowerCase();
    if (top === "mm") return "mm";
    const meta =
      item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata : null;
    const fromMeta = String(meta?.measurementUnit ?? meta?.measurement_unit ?? "").trim().toLowerCase();
    if (fromMeta === "mm") return "mm";
    return "cm";
  }

  /**
   * @param {unknown} raw
   * @returns {{ label: string, value: string }[]}
   */
  function cleanMeasurementRows(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const x of raw) {
      if (!x || typeof x !== "object") continue;
      const label = String(/** @type {any} */ (x).label ?? /** @type {any} */ (x).name ?? "").trim();
      const value = String(/** @type {any} */ (x).value ?? /** @type {any} */ (x).cm ?? "").trim();
      if (label || value) out.push({ label, value });
    }
    return out;
  }

  /**
   * @param {string} s
   * @returns {{ label: string, value: string }[]}
   */
  function parseLegacyMeasuredDimensions(s) {
    const t = String(s ?? "").trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t);
      if (Array.isArray(p)) return cleanMeasurementRows(p);
    } catch {
      /* */
    }
    const lines = t.split(/\r?\n/).map((x) => String(x).trim()).filter(Boolean);
    if (!lines.length) return [];
    const parsed = [];
    for (const line of lines) {
      const m = line.match(/^(.+?)\s*[:：]\s*(.*)$/);
      if (m) parsed.push({ label: m[1].trim(), value: m[2].trim() });
      else parsed.push({ label: "", value: line });
    }
    if (parsed.length === 1) {
      const a = parsed[0];
      if (!a.label && a.value && !a.value.includes(":") && !a.value.includes("：")) {
        return [{ label: "Measurements", value: a.value }];
      }
    }
    return cleanMeasurementRows(parsed);
  }

  /**
   * Prefer structured `metadata.measurementRows`, then top-level rows, then legacy text column.
   * @param {object} item
   * @returns {{ label: string, value: string }[]}
   */
  function getMeasurementRows(item) {
    if (!item || typeof item !== "object") return [];
    const meta =
      item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata : null;
    if (meta && Array.isArray(meta.measurementRows) && meta.measurementRows.length)
      return cleanMeasurementRows(meta.measurementRows);
    if (Array.isArray(item.measurementRows) && item.measurementRows.length)
      return cleanMeasurementRows(item.measurementRows);
    return parseLegacyMeasuredDimensions(String(item.measuredDimensions ?? item.measured_dimensions ?? "").trim());
  }

  /**
   * @param {{ label: string, value: string }[]} rows
   * @param {"cm" | "mm"} [unit]
   */
  function measurementRowsToSummaryString(rows, unit = "cm") {
    const u = parseMeasurementUnitInput(unit);
    return cleanMeasurementRows(rows)
      .filter((r) => String(r.value ?? "").trim())
      .map((r) => {
        const L = String(r.label ?? "").trim();
        const V = String(r.value ?? "").trim();
        if (L && V) return `${L}: ${V} ${u}`;
        if (L) return L;
        return V ? `${V} ${u}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  /**
   * @param {{ label: string, value: string }[]} rows
   * @param {{ defaultsForEmpty?: boolean }} opts
   */
  function resolveInitialMeasurementRowsForEditor(rows, opts = {}) {
    const cleaned = cleanMeasurementRows(Array.isArray(rows) ? rows : []);
    if (cleaned.length) return cleaned;
    if (opts.defaultsForEmpty) return DEFAULT_MEASUREMENT_LABELS.map((label) => ({ label, value: "" }));
    return [{ label: "", value: "" }];
  }

  /**
   * @param {HTMLElement | null} container
   */
  function readMeasurementRowsFromEditor(container) {
    if (!container) return [];
    const dyn = container.querySelector(".measured-dims-dynamic") || container;
    const out = [];
    for (const row of dyn.querySelectorAll(".measured-dims-row[data-tw-meas-row]")) {
      const label = row.querySelector(".measured-dims-row__label")?.value?.trim() ?? "";
      const value = row.querySelector(".measured-dims-row__value")?.value?.trim() ?? "";
      if (value) out.push({ label, value });
    }
    return out;
  }

  /**
   * @param {HTMLElement} container
   * @param {{ label: string, value: string }[]} rowsToShow
   * @param {{ unitSelectId: string, initialUnit?: string }} opts
   */
  function mountMeasurementRowsEditor(container, rowsToShow, opts) {
    const unitSelectId = String(opts?.unitSelectId ?? "").trim();
    const initialUnit = parseMeasurementUnitInput(opts?.initialUnit ?? "cm");
    container.innerHTML = "";
    const block = document.createElement("div");
    block.className = "measured-dims-block";

    const dyn = document.createElement("div");
    dyn.className = "measured-dims-dynamic";

    let unitSel = /** @type {HTMLSelectElement | null} */ (null);
    if (unitSelectId) {
      const unitRow = document.createElement("div");
      unitRow.className = "measured-dims-unit-row";
      const unitLab = document.createElement("label");
      unitLab.className = "measured-dims-unit-field";
      const unitLabSpan = document.createElement("span");
      unitLabSpan.className = "measured-dims-unit-label";
      unitLabSpan.textContent = "Unit";
      unitSel = document.createElement("select");
      unitSel.id = unitSelectId;
      unitSel.setAttribute("aria-label", "Measurement unit");
      for (const u of ["cm", "mm"]) {
        const o = document.createElement("option");
        o.value = u;
        o.textContent = u;
        if (u === initialUnit) o.selected = true;
        unitSel.appendChild(o);
      }
      unitLab.appendChild(unitLabSpan);
      unitLab.appendChild(unitSel);
      unitRow.appendChild(unitLab);
      block.appendChild(unitRow);
    }

    function syncValuePlaceholders() {
      const u = unitSel ? parseMeasurementUnitInput(unitSel.value) : "cm";
      for (const inp of dyn.querySelectorAll(".measured-dims-row__value")) {
        /** @type {HTMLInputElement} */ (inp).placeholder = u;
      }
    }

    unitSel?.addEventListener("change", syncValuePlaceholders);

    function appendRow(label = "", value = "") {
      const row = document.createElement("div");
      row.className = "measured-dims-row";
      row.dataset.twMeasRow = "1";
      const labIn = document.createElement("input");
      labIn.type = "text";
      labIn.className = "measured-dims-row__label";
      labIn.maxLength = 80;
      labIn.placeholder = "Label";
      labIn.autocomplete = "off";
      labIn.value = label;
      const valIn = document.createElement("input");
      valIn.type = "text";
      valIn.className = "measured-dims-row__value";
      valIn.maxLength = 80;
      valIn.placeholder = unitSel ? parseMeasurementUnitInput(unitSel.value) : "cm";
      valIn.autocomplete = "off";
      valIn.value = value;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn btn--small btn--ghost measured-dims-row__remove";
      rm.setAttribute("aria-label", "Remove this row");
      rm.textContent = "Remove";
      rm.addEventListener("click", () => {
        row.remove();
        if (!dyn.querySelector(".measured-dims-row")) appendRow("", "");
      });
      row.appendChild(labIn);
      row.appendChild(valIn);
      row.appendChild(rm);
      dyn.appendChild(row);
    }

    for (const r of rowsToShow) appendRow(String(r.label ?? "").trim(), String(r.value ?? "").trim());

    const toolbar = document.createElement("div");
    toolbar.className = "measured-dims-toolbar";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn--small btn--ghost";
    addBtn.textContent = "Add row";
    addBtn.addEventListener("click", () => {
      appendRow("", "");
      syncValuePlaceholders();
    });
    toolbar.appendChild(addBtn);
    block.appendChild(dyn);
    block.appendChild(toolbar);
    container.appendChild(block);
    syncValuePlaceholders();
  }

  function resetAddItemMeasurementBlock() {
    const el = document.getElementById("add-item-measured-dims-block");
    if (!el) return;
    mountMeasurementRowsEditor(el, resolveInitialMeasurementRowsForEditor([], { defaultsForEmpty: false }), {
      unitSelectId: "add-item-measurement-unit",
      initialUnit: "cm",
    });
    const hid = document.getElementById("add-item-measured-dimensions");
    if (hid) hid.value = "";
  }

  /**
   * @param {object} item
   */
  function formatMeasurementRowsBrief(item) {
    const rows = getMeasurementRows(item).filter((r) => String(r.value ?? "").trim());
    if (!rows.length) {
      const leg = String(item.measuredDimensions ?? "").trim();
      return leg || "";
    }
    const u = getMeasurementUnit(item);
    return rows
      .map((r) => {
        const L = String(r.label ?? "").trim();
        const V = String(r.value ?? "").trim();
        if (L && V) return `${L} ${V} ${u}`;
        return L || (V ? `${V} ${u}` : "");
      })
      .filter(Boolean)
      .join(" · ");
  }

  /**
   * @param {HTMLElement} body
   * @param {object} item
   */
  function appendMeasurementDisplaySection(body, item) {
    const rows = getMeasurementRows(item).filter((r) => String(r.value ?? "").trim());
    const hasRows = rows.length > 0;
    const legacy = String(item.measuredDimensions ?? "").trim();
    if (!hasRows && !legacy) return;

    const sec = document.createElement("section");
    sec.className = "item-detail__measurements";
    const uDisp = getMeasurementUnit(item);
    const h = document.createElement("h3");
    h.className = "item-detail__measurements-title";
    h.textContent = `Measurements (${uDisp})`;
    sec.appendChild(h);
    const dl = document.createElement("dl");
    dl.className = "item-detail__measurements-dl";
    if (hasRows) {
      for (const r of rows) {
        const L = String(r.label ?? "").trim();
        const V = String(r.value ?? "").trim();
        if (!L && !V) continue;
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = L || "—";
        dd.textContent = V ? `${V} ${uDisp}` : "—";
        dl.appendChild(dt);
        dl.appendChild(dd);
      }
    } else {
      const dt = document.createElement("dt");
      dt.textContent = "Notes";
      const dd = document.createElement("dd");
      dd.className = "item-detail__measurements-legacy";
      dd.textContent = legacy;
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    if (!dl.children.length) return;
    sec.appendChild(dl);
    body.appendChild(sec);
  }

  /**
   * Flatten structured measurements onto the item for UI / sorting.
   * @param {object} item
   */
  function normalizeMeasurementFields(item) {
    if (!item || typeof item !== "object") return item;
    const rows = getMeasurementRows(item).filter((r) => String(r.value ?? "").trim());
    const out = { ...item };
    if (rows.length) {
      out.measurementRows = rows;
      out.measurementUnit = getMeasurementUnit(item);
    } else {
      delete out.measurementRows;
      delete out.measurementUnit;
    }
    return out;
  }

  /** Price + optional structured measurements (see `metadata.measurementRows`). */
  function normalizeItemDerivedFields(item) {
    return normalizeMeasurementFields(normalizeItemPriceFields(item));
  }

  function convertPriceAmount(amount, fromC, toC) {
    if (!Number.isFinite(amount)) return null;
    const a = String(fromC ?? "TWD").toUpperCase();
    const b = String(toC ?? "TWD").toUpperCase();
    const fa = FX_TO_USD[a] ?? 1;
    const ta = FX_TO_USD[b] ?? 1;
    return (amount * fa) / ta;
  }

  /**
   * Display-only rounding for archive / cards / spend total.
   * Currencies without minor units (0 fraction digits, e.g. JPY/KRW/TWD) are half-up rounded on screen.
   * `item.price` storage stays unchanged.
   */
  function formatMoneyInCurrency(amount, currencyCode) {
    if (!Number.isFinite(amount)) return "";
    const raw = String(currencyCode ?? "TWD").trim();
    const code = /^[A-Za-z]{3}/.test(raw) ? raw.slice(0, 3).toUpperCase() : "TWD";
    let fractionDigits = 2;
    try {
      const resolved = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
      }).resolvedOptions();
      if (Number.isFinite(resolved.maximumFractionDigits)) {
        fractionDigits = resolved.maximumFractionDigits;
      }
    } catch {
      fractionDigits = code === "TWD" ? 0 : 2;
    }
    const roundedAmount = fractionDigits === 0 ? Math.round(Number(amount)) : Number(amount);

    if (code === "TWD") {
      try {
        return new Intl.NumberFormat("zh-TW", {
          style: "currency",
          currency: "TWD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Math.round(roundedAmount));
      } catch {
        return `NT$${Math.round(roundedAmount).toLocaleString("zh-TW")}`;
      }
    }

    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        minimumFractionDigits: 0,
        maximumFractionDigits: fractionDigits,
      }).format(roundedAmount);
    } catch {
      if (fractionDigits === 0) return `${code} ${Math.round(roundedAmount)}`;
      const scale = 10 ** Math.min(3, Math.max(1, fractionDigits));
      return `${code} ${Math.round(roundedAmount * scale) / scale}`;
    }
  }

  /** Stored `item.price` is per colourway; multiply for spend / sort when `colourVariants` exist. */
  function archivePriceColourVariantCount(item) {
    const vars = getItemColourVariants(item);
    return vars?.length ? vars.length : 1;
  }

  function formattedArchivePriceLine(item, opts = {}) {
    const brief = Boolean(opts?.brief);
    const p = item?.price;
    if (!Number.isFinite(Number(p))) return "";
    const from = String(item?.priceCurrency ?? "TWD").toUpperCase();
    const convertedUnit = convertPriceAmount(Number(p), from, archiveDisplayCurrency);
    if (!Number.isFinite(convertedUnit)) return "";
    const n = archivePriceColourVariantCount(item);
    const convertedTotal = convertedUnit * n;

    const unitShown = formatMoneyInCurrency(convertedUnit, archiveDisplayCurrency);
    const totalShown = formatMoneyInCurrency(convertedTotal, archiveDisplayCurrency);

    if (n <= 1) {
      if (from !== archiveDisplayCurrency) {
        const raw = formatMoneyInCurrency(Number(p), from);
        if (brief) return unitShown;
        return `${unitShown} (${raw})`;
      }
      return unitShown;
    }

    if (from !== archiveDisplayCurrency) {
      const rawUnit = formatMoneyInCurrency(Number(p), from);
      const rawTotalFmt = formatMoneyInCurrency(Number(p) * n, from);
      if (brief) return totalShown;
      return `${totalShown} (${n} × ${unitShown}; ${rawTotalFmt} = ${n} × ${rawUnit})`;
    }

    if (brief) return totalShown;
    return `${totalShown} (${n} × ${unitShown})`;
  }

  function purchaseDateSortMs(item) {
    const s = String(item?.purchaseDate ?? "").trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) return null;
    const t = new Date(`${m[1]}T12:00:00`).getTime();
    return Number.isNaN(t) ? null : t;
  }

  function priceSortComparableInDisplayCurrency(item) {
    const p = item?.price;
    if (!Number.isFinite(Number(p))) return null;
    const from = String(item?.priceCurrency ?? "TWD").toUpperCase();
    const unit = convertPriceAmount(Number(p), from, archiveDisplayCurrency);
    if (!Number.isFinite(unit)) return null;
    const v = unit * archivePriceColourVariantCount(item);
    return Number.isFinite(v) ? v : null;
  }

  /** Sum price in current display currency for a list. */
  function sumPriceInDisplayCurrency(list) {
    let total = 0;
    for (const it of list || []) {
      const v = priceSortComparableInDisplayCurrency(it);
      if (Number.isFinite(v)) total += v;
    }
    return total;
  }

  /** Seed / Supabase rows only — merged with local + file custom rows into `items`. */
  /** @type {object[]} */
  let wardrobeBase = [];

  /**
   * `"cloud"` — `wardrobeBase` came from a full `wardrobe_items` fetch (edits mirror rows in that table).
   * `"seed"` — bundled `data/wardrobe.js`; cloud may still hold `custom-*` rows and any mirrored catalogue edits.
   */
  let wardrobeCatalogueSource = /** @type {"seed" | "cloud"} */ ("seed");

  /** Data pipeline mode: `cloud` = Supabase-backed single source; `local` = browser/file fallback. */
  let storageMode = /** @type {"cloud" | "local"} */ ("local");

  function isCloudModeActive() {
    return storageMode === "cloud" && isSupabaseReady();
  }

  /** All rows last loaded from Supabase `wardrobe_items` (not only `custom-*`). */
  /** @type {object[]} */
  let cloudBackedCustomItems = [];

  /** Custom rows from `data/custom-items.json` (same shape as localStorage custom list). */
  /** @type {object[]} */
  let fileBackedCustomItems = [];


  /** Top-level archive category (filter + add-item). */
  const SLOT_CLOTHING = "Clothing";
  const SLOT_ACCESSORIES = "Accessories";
  const SLOT_WATCHES = "Watches";
  const SLOT_FRAGRANCE = "Fragrance";

  const SLOT_OPTIONS = [
    SLOT_CLOTHING,
    SLOT_ACCESSORIES,
    SLOT_WATCHES,
    SLOT_FRAGRANCE,
  ];

  /**
   * When a row has no specific record type, pick the first real `category` seen in seed for that browse tab
   * (stable sort by `RECORD_CATEGORY_RANK`). If seed has none for a tab, use a safe static leaf.
   */
  const STATIC_RECORD_FALLBACK_BY_SLOT = {
    [SLOT_CLOTHING]: "Tops",
    [SLOT_ACCESSORIES]: "Hats",
    [SLOT_WATCHES]: "Everyday",
    [SLOT_FRAGRANCE]: "Day",
  };

  /** Legacy `category` values that only encoded browse tab — mapped for `itemSlot()` and migration off storage. */
  const LEGACY_UNSPEC_CATEGORY_TO_SLOT = {
    "Unspecified clothing": SLOT_CLOTHING,
    "Unspecified accessories": SLOT_ACCESSORIES,
    "Unspecified footwear": SLOT_ACCESSORIES,
    "Unspecified watches": SLOT_WATCHES,
    "Unspecified Jewellery": SLOT_ACCESSORIES,
    "Unspecified perfume": SLOT_FRAGRANCE,
  };

  /** @type {Record<string, string>} First concrete record-type per browse slot from seed (recomputed in `mergeWardrobeFromSources`). */
  let slotRecordFallbackCategory = {};

  function categoryDisplayLabel(slot) {
    if (slot === SLOT_CLOTHING) return "Clothing";
    if (slot === SLOT_WATCHES) return "Watches";
    if (slot === SLOT_FRAGRANCE) return "Fragrance";
    return slot;
  }

  /** Seed / DB `category` → short browse label in drill-down grid. */
  const RECORD_CATEGORY_LABELS = {
    Jackets: "Tailoring",
    Tailoring: "Tailoring",
    Outerwear: "Outerwear",
    "Mid Layer": "Layering",
    "Inner Layer": "Layering",
    Layering: "Layering",
    Shirts: "Tops",
    Bottoms: "Trousers",
    Trousers: "Trousers",
    Tops: "Tops",
    Footwear: "Footwear",
    Fragrance: "Fragrance",
    Day: "Day",
    Daywear: "Day",
    Evening: "Evening",
    Jewellery: "Jewellery",
    Necklace: "Jewellery",
    Bracelet: "Jewellery",
    Ring: "Jewellery",
    Beater: "Beater",
    "Dress watch": "Dress watch",
    "Dive watch": "Dive watch",
    Everyday: "Everyday",
    Watches: "Watches",
    Accessories: "Accessories",
    "Small accessories": "Small Accessories",
    Bags: "Bags",
    Hats: "Caps & Hats",
    Eyewear: "Eyewear",
    Sunglasses: "Eyewear",
    Glasses: "Eyewear",
  };

  function friendlyRecordCategory(raw) {
    const r = String(raw ?? "").trim();
    if (!r) return "";
    return RECORD_CATEGORY_LABELS[r] || r;
  }

  function recordTypeDisplayLabel(raw) {
    return friendlyRecordCategory(raw) || String(raw ?? "").trim();
  }

  /** Same browse label (e.g. Mid Layer + Inner Layer → Layering). */
  function recordTypeDrillKeysEquivalent(a, b) {
    const aa = String(a ?? "").trim();
    const bb = String(b ?? "").trim();
    if (!aa || !bb) return aa === bb;
    if (aa === bb) return true;
    return recordTypeDisplayLabel(aa).toLowerCase() === recordTypeDisplayLabel(bb).toLowerCase();
  }

  /**
   * One drill key per display label; keeps lowest `RECORD_CATEGORY_RANK` raw key as canonical.
   * @returns {{ raw: string, label: string }[]}
   */
  function collapseRecordTypeKeysByDisplayLabel(keys, browseSlot) {
    const sorted = sortRecordTypeKeysForSlot(browseSlot, [...new Set(keys.filter(Boolean))]);
    const byLabel = new Map();
    for (const raw of sorted) {
      const label = recordTypeDisplayLabel(raw);
      const norm = label.toLowerCase();
      if (!norm || byLabel.has(norm)) continue;
      byLabel.set(norm, { raw, label });
    }
    return [...byLabel.values()].sort((a, b) => {
      const ra = RECORD_CATEGORY_RANK[a.raw] ?? 800;
      const rb = RECORD_CATEGORY_RANK[b.raw] ?? 800;
      if (ra !== rb) return ra - rb;
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
  }

  /** For clipboard export: keep paste small — omit base64 bodies. */
  function summarizeUrlForPlaintext(u) {
    const s = String(u ?? "").trim();
    if (!s) return "(none)";
    if (s.startsWith("data:")) return `[embedded image, ${s.length} characters — omitted]`;
    return s;
  }

  function buildItemPlainTextSnapshot(item) {
    if (!item) return "";
    const lines = [];
    lines.push("Timeless Wardrobe — wardrobe piece (plain text export)");
    lines.push("=".repeat(48));
    lines.push(`ID: ${item.id ?? ""}`);
    lines.push(`Brand: ${String(item.brand ?? "").trim()}`);
    lines.push(`Name: ${String(item.name ?? "").trim()}`);
    lines.push(`Name (display line): ${displayNameWithoutLeadingColour(item)}`);
    lines.push(`Browse category: ${categoryDisplayLabel(itemSlot(item))}`);
    lines.push(`Record category: ${recordCategoryForDrill(item, itemSlot(item))}`);
    lines.push(`Season: ${seasonUiLabel(item.season)}`);
    lines.push(`Colour: ${String(item.colour ?? "").trim()}`);
    lines.push(`Fabric: ${String(item.fabric ?? "").trim()}`);
    lines.push(`Weight / specs: ${String(item.weight ?? "").trim()}`);
    lines.push(`Size: ${String(item.size ?? "").trim()}`);
    {
      const rows = getMeasurementRows(item).filter((r) => String(r.value ?? "").trim());
      if (rows.length) {
        const u = getMeasurementUnit(item);
        lines.push(`Measurements (${u}):`);
        for (const r of rows) {
          const L = String(r.label ?? "").trim();
          const V = String(r.value ?? "").trim();
          if (L || V) lines.push(`  ${L || "—"}: ${V ? `${V} ${u}` : "—"}`);
        }
      } else {
        lines.push(`Measured dimensions: ${String(item.measuredDimensions ?? "").trim() || "(none)"}`);
      }
    }
    {
      const pd = String(item.purchaseDate ?? "").trim();
      lines.push(`Purchase date: ${pd ? formatPurchaseDateForDisplay(pd) : "(none)"}`);
    }
    {
      const p = item?.price;
      if (Number.isFinite(Number(p))) {
        const cur = String(item?.priceCurrency ?? "TWD").toUpperCase();
        const n = archivePriceColourVariantCount(item);
        const total = Number(p) * n;
        lines.push(
          n > 1
            ? `Price: ${formatMoneyInCurrency(total, cur)} (${n} × ${formatMoneyInCurrency(Number(p), cur)} per colour)`
            : `Price: ${formatMoneyInCurrency(Number(p), cur)}`
        );
      } else {
        lines.push("Price: (none)");
      }
    }
    lines.push(`Outfit-eligible: ${itemEligibleForOutfit(item) ? "yes" : "no"}`);
    lines.push("");
    lines.push(`Cover image: ${summarizeUrlForPlaintext(item.image)}`);
    const gals = itemGalleryList(item);
    lines.push(`Gallery images (${gals.length}):`);
    if (!gals.length) lines.push("  (none)");
    else gals.forEach((u, i) => lines.push(`  ${i + 1}. ${summarizeUrlForPlaintext(u)}`));
    lines.push("");
    lines.push("Notes:");
    lines.push(String(item.notes ?? "").trim() || "(none)");
    if (item.metadata != null && item.metadata !== "") {
      lines.push("");
      lines.push("Metadata (raw):");
      try {
        lines.push(typeof item.metadata === "string" ? item.metadata : JSON.stringify(item.metadata));
      } catch {
        lines.push(String(item.metadata));
      }
    }
    lines.push("");
    lines.push("-- end --");
    return lines.join("\n");
  }

  async function copyItemPlainTextForAi(item) {
    const text = buildItemPlainTextSnapshot(item);
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied plain text to clipboard.");
    } catch (err) {
      console.warn(err);
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        showToast("Copied plain text to clipboard.");
      } catch {
        showToast("Could not copy automatically.");
      }
    }
  }

  /** Previously saved Chinese clothing slots → Clothing (典藏·配件 handled in `itemSlot`). */
  const LEGACY_SLOT_LABEL = {
    "冬·上裝": SLOT_CLOTHING,
    "冬·上装": SLOT_CLOTHING,
    "冬·下裝": SLOT_CLOTHING,
    "冬·下装": SLOT_CLOTHING,
    "冬·夹克": SLOT_CLOTHING,
    "冬·外層（非夹克）": SLOT_CLOTHING,
    "夏·上裝": SLOT_CLOTHING,
    "夏·上装": SLOT_CLOTHING,
    "夏·下裝": SLOT_CLOTHING,
    "夏·下装": SLOT_CLOTHING,
  };

  /** Old English granular slots → Clothing (non-archive rows). */
  const LEGACY_ENGLISH_GRANULAR_SLOT = {
    "Winter · Upper": SLOT_CLOTHING,
    "Winter · Lower": SLOT_CLOTHING,
    "Winter · Jacket": SLOT_CLOTHING,
    "Winter · Outer (non-jacket)": SLOT_CLOTHING,
    "Summer · Upper": SLOT_CLOTHING,
    "Summer · Lower": SLOT_CLOTHING,
  };

  /** Disambiguate former “archive accessories” bucket using record `category` only. */
  function inferAccessoryBucket(item) {
    const cat = String(item.category ?? "").trim();
    if (
      cat === "Watches" ||
      cat === "Beater" ||
      cat === "Dress watch" ||
      cat === "Dive watch" ||
      cat === "潛水錶" ||
      cat === "Everyday" ||
      cat === "Sports watch"
    ) {
      return SLOT_WATCHES;
    }
    if (cat === "Fragrance" || cat === "Day" || cat === "Daywear" || cat === "Evening") return SLOT_FRAGRANCE;
    if (
      cat === "Jewellery" ||
      cat === "Jewellery" ||
      cat === "Necklace" ||
      cat === "Bracelet" ||
      cat === "Ring" ||
      cat === "項鏈" ||
      cat === "手鏈" ||
      cat === "戒指"
    )
      return SLOT_ACCESSORIES;
    if (cat === "Footwear") return SLOT_ACCESSORIES;
    if (cat === "Future") return SLOT_ACCESSORIES;
    return SLOT_ACCESSORIES;
  }

  function itemSlot(item) {
    if (!item) return SLOT_CLOTHING;
    const rawCat = String(item.category ?? "").trim();
    const season = String(item.season ?? "");

    if (Object.prototype.hasOwnProperty.call(LEGACY_UNSPEC_CATEGORY_TO_SLOT, rawCat)) {
      return LEGACY_UNSPEC_CATEGORY_TO_SLOT[rawCat];
    }

    if (rawCat === "Small accessories") return SLOT_ACCESSORIES;
    if (
      rawCat === "Bags" ||
      rawCat === "Hats" ||
      rawCat === "帽子" ||
      rawCat === "Eyewear" ||
      rawCat === "Sunglasses" ||
      rawCat === "Glasses" ||
      rawCat === "Eyeglasses"
    ) {
      return SLOT_ACCESSORIES;
    }

    if (rawCat === "Clothing (incl. shoes)") return SLOT_CLOTHING;

    if (LEGACY_SLOT_LABEL[rawCat]) return LEGACY_SLOT_LABEL[rawCat];
    if (rawCat === "典藏·配件" || rawCat === "Archive · Accessories") return inferAccessoryBucket(item);
    if (Object.prototype.hasOwnProperty.call(LEGACY_ENGLISH_GRANULAR_SLOT, rawCat)) {
      return LEGACY_ENGLISH_GRANULAR_SLOT[rawCat];
    }
    if (SLOT_OPTIONS.includes(rawCat)) return rawCat;

    if (rawCat === "Footwear") return SLOT_ACCESSORIES;
    if (rawCat === "Watches") return SLOT_WATCHES;
    if (
      rawCat === "Beater" ||
      rawCat === "Dress watch" ||
      rawCat === "Dive watch" ||
      rawCat === "潛水錶" ||
      rawCat === "Everyday" ||
      rawCat === "Sports watch"
    ) {
      return SLOT_WATCHES;
    }
    if (rawCat === "Fragrance" || rawCat === "Day" || rawCat === "Daywear" || rawCat === "Evening")
      return SLOT_FRAGRANCE;
    if (
      rawCat === "Jewellery" ||
      rawCat === "Jewellery" ||
      rawCat === "Necklace" ||
      rawCat === "Bracelet" ||
      rawCat === "Ring" ||
      rawCat === "Eyewear" ||
      rawCat === "Sunglasses" ||
      rawCat === "Glasses" ||
      rawCat === "Eyeglasses" ||
      rawCat === "項鏈" ||
      rawCat === "手鏈" ||
      rawCat === "戒指"
    ) {
      return SLOT_ACCESSORIES;
    }
    if (rawCat === "Future") return SLOT_ACCESSORIES;

    if (season === "S/S" || season === "A/W") return SLOT_CLOTHING;
    return SLOT_CLOTHING;
  }

  function computeSlotRecordFallbackCategories(seedRows) {
    const out = /** @type {Record<string, string>} */ ({});
    for (const slot of SLOT_OPTIONS) {
      const names = new Set();
      for (const row of seedRows) {
        if (!row || row.id == null) continue;
        const c = String(row.category ?? "").trim();
        if (!c) continue;
        if (Object.prototype.hasOwnProperty.call(LEGACY_UNSPEC_CATEGORY_TO_SLOT, c)) continue;
        const probe = { ...row, category: c };
        if (itemSlot(probe) !== slot) continue;
        if (SLOT_OPTIONS.includes(c)) continue;
        if (c === "Clothing" || c === "Accessories") continue;
        names.add(c);
      }
      const arr = [...names].sort(
        (a, b) =>
          (RECORD_CATEGORY_RANK[a] ?? 800) - (RECORD_CATEGORY_RANK[b] ?? 800) ||
          a.localeCompare(b, undefined, { sensitivity: "base" })
      );
      if (arr.length) {
        const homonym = slot === SLOT_WATCHES ? SLOT_WATCHES : slot === SLOT_FRAGRANCE ? SLOT_FRAGRANCE : "";
        if (homonym) {
          const leaf = arr.find((k) => k !== homonym);
          out[slot] = leaf ?? STATIC_RECORD_FALLBACK_BY_SLOT[slot] ?? arr[0];
        } else {
          out[slot] = arr[0];
        }
      }
    }
    return out;
  }

  function defaultRecordCategoryForSlot(slot) {
    const s = String(slot ?? "").trim();
    return (
      slotRecordFallbackCategory[s] ||
      STATIC_RECORD_FALLBACK_BY_SLOT[s] ||
      STATIC_RECORD_FALLBACK_BY_SLOT[SLOT_CLOTHING]
    );
  }

  /** Outfit builder: clothing, shoes, watches, and accessories — jewellery and perfume stay archive-only. */
  function itemEligibleForOutfit(item) {
    if (!item) return false;
    const s = itemSlot(item);
    return s === SLOT_CLOTHING || s === SLOT_WATCHES || s === SLOT_ACCESSORIES;
  }

  /** Browse column order when viewing All (or a main tab without a record-type drill). */
  const BROWSE_SLOT_RANK = {
    [SLOT_CLOTHING]: 0,
    [SLOT_ACCESSORIES]: 1,
    [SLOT_WATCHES]: 2,
    [SLOT_FRAGRANCE]: 5,
  };

  /**
   * Clothing record types: outer shells → mid/inner upper body → bottoms (`RECORD_CATEGORY_RANK`).
   * Other browse tabs use the same rank map where applicable; unknown labels sort last (800).
   */
  const RECORD_CATEGORY_RANK = {
    Outerwear: 0,
    Jackets: 1,
    Tailoring: 1,
    "Mid Layer": 2,
    "Inner Layer": 3,
    Layering: 2,
    Shirts: 4,
    Tops: 5,
    Bottoms: 6,
    Trousers: 6,
    Footwear: 7,
    Beater: 54,
    "Dress watch": 50,
    Everyday: 51,
    "Dive watch": 52,
    Watches: 55,
    Fragrance: 9,
    Day: 10,
    Daywear: 10,
    Evening: 11,
    Jewellery: 14,
    Necklace: 14,
    Bracelet: 14,
    Ring: 14,
    Accessories: 13,
    "Small accessories": 13,
    Bags: 12,
    Footwear: 13,
    Eyewear: 15,
    Sunglasses: 15,
    Glasses: 15,
    Hats: 16,
  };

  /** Record types always listed in add/edit `<select>` for these slots (even with zero items). */
  const KNOWN_RECORD_TYPES_BY_SLOT = {
    [SLOT_ACCESSORIES]: ["Bags", "Footwear", "Jewellery", "Eyewear", "Hats"],
    [SLOT_WATCHES]: ["Dress watch", "Everyday", "Dive watch", "Beater"],
    [SLOT_FRAGRANCE]: ["Day", "Evening"],
  };

  function browseSlotRank(item) {
    const k = itemSlot(item);
    return Object.prototype.hasOwnProperty.call(BROWSE_SLOT_RANK, k) ? BROWSE_SLOT_RANK[k] : 99;
  }

  function recordCategoryRank(item) {
    const c = recordCategoryForDrill(item, itemSlot(item));
    if (!c) return 999;
    if (Object.prototype.hasOwnProperty.call(RECORD_CATEGORY_RANK, c)) return RECORD_CATEGORY_RANK[c];
    return 800;
  }

  /** When not drilling to a single record type, sort by slot + garment category, not seed file order. */
  function compareByTaxonomy(a, b) {
    const sDiff = browseSlotRank(a) - browseSlotRank(b);
    if (sDiff !== 0) return sDiff;
    const rDiff = recordCategoryRank(a) - recordCategoryRank(b);
    if (rDiff !== 0) return rDiff;
    const ca = String(recordCategoryForDrill(a, itemSlot(a)) ?? "");
    const cb = String(recordCategoryForDrill(b, itemSlot(b)) ?? "");
    return ca.localeCompare(cb, undefined, { sensitivity: "base" });
  }

  function sanitizeCurrentOutfit() {
    currentOutfitSlots = currentOutfitSlots.filter((slot) => {
      const it = itemById.get(slot.itemId);
      return it && itemEligibleForOutfit(it);
    });
  }

  /** @type {any} */
  let supabaseClient = null;

  function initSupabaseClientFromConfig() {
    const cfg = globalThis.APP_CONFIG || {};
    const url = String(cfg.SUPABASE_URL || "").trim();
    const key = String(cfg.SUPABASE_ANON_KEY || "").trim();

    if (!url || !key) {
      console.warn("Supabase config missing — APP_CONFIG.SUPABASE_URL or APP_CONFIG.SUPABASE_ANON_KEY is empty. Running local-only mode.");
      return null;
    }

    if (!globalThis.supabase?.createClient) {
      console.warn("Supabase JS SDK not loaded — make sure the Supabase CDN script is loaded before app.js.");
      return null;
    }

    try {
      const client = globalThis.supabase.createClient(url, key);
      console.info("Supabase client initialized.");
      return client;
    } catch (err) {
      console.warn("Could not initialize Supabase client.", err);
      return null;
    }
  }

  supabaseClient = initSupabaseClientFromConfig();
  globalThis.__WARDROBE_SUPABASE_DEBUG__ = () => ({
    hasAppConfig: Boolean(globalThis.APP_CONFIG),
    hasSupabaseUrl: Boolean(String(globalThis.APP_CONFIG?.SUPABASE_URL || "").trim()),
    hasSupabaseAnonKey: Boolean(String(globalThis.APP_CONFIG?.SUPABASE_ANON_KEY || "").trim()),
    hasSupabaseSdk: Boolean(globalThis.supabase?.createClient),
    hasClient: Boolean(supabaseClient),
    isReady: isSupabaseReady(),
    wardrobeItemsUpsertSpelling: "uk-first-us-fallback",
  });

  const WARDROBE_TABLE = "wardrobe_items";
  const WARDROBE_IMAGE_BUCKET = "wardrobe-images";

  function isSupabaseReady() {
    return Boolean(supabaseClient?.from && supabaseClient?.storage?.from);
  }

  /** Postgres `jsonb` / drivers sometimes return gallery as a JSON string instead of an array. */
  function normalizeGalleryFromDb(raw) {
    if (Array.isArray(raw)) {
      return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
    }
    if (typeof raw === "string" && raw.trim()) {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) {
          return p.map((x) => String(x ?? "").trim()).filter(Boolean);
        }
      } catch {
        /* ignore */
      }
    }
    return [];
  }

  function normalizeCloudItemRow(row) {
    if (!row || typeof row !== "object") return null;
    const id = String(row.id ?? "").trim();
    if (!id) return null;
    const brandRaw = String(row.brand ?? "").trim();
    const nameRaw = String(row.name ?? "").trim();
    const brand = brandRaw || "[No brand]";
    const name = nameRaw || "[Untitled]";
    const meta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : null;
    const cvFromMeta =
      meta && Array.isArray(meta.colourVariants) && meta.colourVariants.length
        ? meta.colourVariants
        : meta && Array.isArray(meta.colorVariants) && meta.colorVariants.length
          ? meta.colorVariants
          : null;
    const colourVariants =
      Array.isArray(row.colourVariants) && row.colourVariants.length
        ? row.colourVariants
        : Array.isArray(row.colorVariants) && row.colorVariants.length
          ? row.colorVariants
          : cvFromMeta && cvFromMeta.length
            ? cvFromMeta
            : null;
    const out = {
      ...row,
      id,
      brand,
      name,
      category: String(row.category ?? "").trim(),
      season: normalizeStoredItemSeason(row.season),
      colour: String(row.colour ?? row.color ?? "").trim(),
      colourCode: String(row.colour_code ?? row.color_code ?? "").trim(),
      fabric: String(row.fabric ?? "").trim(),
      weight: String(row.weight ?? "").trim(),
      size: String(row.size ?? "").trim(),
      measuredDimensions: String(row.measured_dimensions ?? row.measuredDimensions ?? "").trim(),
      purchaseDate: String(row.purchase_date ?? row.purchaseDate ?? "").trim(),
      image: String(row.image ?? "").trim(),
      gallery: normalizeGalleryFromDb(row.gallery),
      notes: String(row.notes ?? ""),
      metadata: row.metadata ?? null,
      __source: "supabase",
    };
    if (colourVariants) out.colourVariants = colourVariants;
    const ts =
      String(row.updated_at ?? row.updatedAt ?? "").trim() || String(row.created_at ?? row.createdAt ?? "").trim();
    if (ts) out.updatedAt = ts;
    return normalizeItemDerivedFields(out);
  }

  /** Strip legacy variant keys inside `metadata` before writing JSONB. */
  function sanitizeWardrobeMetadataForPostgres(meta) {
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
    const m = /** @type {Record<string, unknown>} */ ({ ...meta });
    if (Array.isArray(m.colourVariants) && m.colourVariants.length) {
      delete m.colorVariants;
    } else if (Array.isArray(m.colorVariants) && m.colorVariants.length) {
      m.colourVariants = m.colorVariants;
      delete m.colorVariants;
    } else {
      delete m.colourVariants;
      delete m.colorVariants;
    }
    return Object.keys(m).length ? m : null;
  }

  /**
   * Normalise any in-memory item (edit save merges `…prev`) so `itemToCloudRow` does not see stray `color` / camelCase DB keys.
   * @param {object} item
   */
  function coerceLooseWardrobeItemForCloudWrite(item) {
    if (!item || typeof item !== "object") return /** @type {any} */ ({});
    const x = /** @type {Record<string, unknown>} */ ({ ...item });
    delete x.__source;
    const ct = String(x.colour ?? x.color ?? "").trim();
    x.colour = ct;
    delete x.color;
    x.colourCode = itemColourCode(/** @type {any} */ (x));
    delete x.colorCode;
    delete x.color_code;
    delete x.colour_code;
    if (!Array.isArray(x.colourVariants) || !x.colourVariants.length) {
      if (Array.isArray(x.colorVariants) && x.colorVariants.length) x.colourVariants = x.colorVariants;
    }
    delete x.colorVariants;
    return /** @type {any} */ (x);
  }

  /** PostgREST column allowlist for `wardrobe_items` upsert (British spelling). */
  const WARDROBE_ITEMS_UPSERT_KEYS_UK = [
    "id",
    "pillar",
    "section",
    "category",
    "brand",
    "name",
    "season",
    "colour",
    "colour_code",
    "fabric",
    "weight",
    "size",
    "measured_dimensions",
    "purchase_date",
    "image",
    "gallery",
    "notes",
    "metadata",
  ];

  /** Same row shape with American column names (legacy DBs PostgREST still exposes). */
  const WARDROBE_ITEMS_UPSERT_KEYS_US = [
    "id",
    "pillar",
    "section",
    "category",
    "brand",
    "name",
    "season",
    "color",
    "color_code",
    "fabric",
    "weight",
    "size",
    "measured_dimensions",
    "purchase_date",
    "image",
    "gallery",
    "notes",
    "metadata",
  ];

  /**
   * PostgREST error: missing colour column on wardrobe_items (wrong spelling vs cache).
   * @param {unknown} err
   * @returns {"" | "colour" | "colour_code" | "color" | "color_code"}
   */
  function missingWardrobeItemsColourColumnFromPostgrest(err) {
    const d = formatSupabaseUserMessage(err);
    const m = d.match(/Could not find the '(colour|colour_code|color|color_code)' column of 'wardrobe_items'/i);
    return m ? /** @type {"colour" | "colour_code" | "color" | "color_code"} */ (m[1].toLowerCase()) : "";
  }

  /**
   * @param {Record<string, unknown>} raw from {@link itemToCloudRow}
   * @param {"uk" | "us"} spelling
   */
  function pickWardrobeItemsUpsertPayload(raw, spelling = "uk") {
    const keys = spelling === "us" ? WARDROBE_ITEMS_UPSERT_KEYS_US : WARDROBE_ITEMS_UPSERT_KEYS_UK;
    const o = /** @type {Record<string, unknown>} */ ({});
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(raw, k)) o[k] = raw[k];
    }
    if (spelling === "us") {
      delete o.colour;
      delete o.colour_code;
    } else {
      delete o.color;
      delete o.color_code;
    }
    return o;
  }

  /**
   * @param {object} item
   * @param {"uk" | "us"} spelling DB column spelling PostgREST expects for this upsert.
   */
  function itemToCloudRow(item, spelling = "uk") {
    const meta =
      item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? { ...item.metadata } : {};
    if (Array.isArray(item.colourVariants) && item.colourVariants.length) {
      meta.colourVariants = item.colourVariants;
      delete meta.basicColour;
    } else {
      delete meta.colourVariants;
      delete meta.colorVariants;
      const rawBc = String(item.basicColour ?? meta.basicColour ?? "")
        .trim()
        .toLowerCase();
      if (rawBc === BASIC_COLOUR_CLASSIFICATION_OMIT) {
        meta.basicColour = BASIC_COLOUR_CLASSIFICATION_OMIT;
      } else {
        const bc = normalizeStoredBasicColourKey(item.basicColour ?? meta.basicColour);
        if (bc) meta.basicColour = bc;
        else delete meta.basicColour;
      }
    }
    const pNum = parsePriceAmountFlexible(item.price != null ? item.price : meta?.price);
    if (Number.isFinite(pNum) && pNum >= 0) {
      meta.price = pNum;
      meta.priceCurrency = String(item.priceCurrency ?? "TWD").trim().toUpperCase() || "TWD";
    } else {
      delete meta.price;
      delete meta.priceCurrency;
    }
    const mSrc =
      Array.isArray(item.measurementRows) && item.measurementRows.length
        ? item.measurementRows
        : Array.isArray(meta.measurementRows) && meta.measurementRows.length
          ? meta.measurementRows
          : null;
    const mrows = cleanMeasurementRows(mSrc || []);
    if (mrows.length) {
      meta.measurementRows = mrows;
    } else {
      delete meta.measurementRows;
    }
    const mu = parseMeasurementUnitInput(item.measurementUnit ?? meta.measurementUnit);
    if (mrows.length) {
      if (mu === "mm") meta.measurementUnit = "mm";
      else delete meta.measurementUnit;
    } else {
      delete meta.measurementUnit;
    }
    const metadataOut = sanitizeWardrobeMetadataForPostgres(meta);
    const colourText = String(item.colour ?? item.color ?? "").trim();
    const codeText = itemColourCode(item);
    const measuredSummary = mrows.length
      ? measurementRowsToSummaryString(mrows, mu)
      : String(item.measuredDimensions ?? item.measured_dimensions ?? "").trim();
    const base = {
      id: String(item.id ?? "").trim(),
      pillar: String(item.pillar ?? "").trim(),
      section: String(item.section ?? "").trim(),
      category: String(item.category ?? "").trim(),
      brand: String(item.brand ?? "").trim(),
      name: String(item.name ?? "").trim(),
      season: normalizeStoredItemSeason(item.season),
      fabric: String(item.fabric ?? "").trim(),
      weight: String(item.weight ?? "").trim(),
      size: String(item.size ?? "").trim(),
      measured_dimensions: measuredSummary,
      purchase_date: String(item.purchaseDate ?? item.purchase_date ?? "").trim(),
      image: String(item.image ?? "").trim(),
      gallery: Array.isArray(item.gallery) ? item.gallery : [],
      notes: String(item.notes ?? ""),
      metadata: metadataOut,
    };
    if (spelling === "us") {
      return { ...base, color: colourText, color_code: codeText };
    }
    return { ...base, colour: colourText, colour_code: codeText };
  }

  /** Canonical DB row for `wardrobe_items` upsert (coerce → cloud row → allowlist only). */
  function wardrobeItemsStrictUpsertRowFromItem(item, spelling = "uk") {
    const coerced = coerceLooseWardrobeItemForCloudWrite(item);
    return pickWardrobeItemsUpsertPayload(itemToCloudRow(coerced, spelling), spelling);
  }

  function safeStorageSegment(value, fallback = "item") {
    const cleaned = String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return cleaned || fallback;
  }

  function fileExtensionFromFile(file) {
    const name = String(file?.name ?? "").trim();
    const m = name.match(/\.([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
    const type = String(file?.type ?? "").toLowerCase();
    if (type.includes("png")) return "png";
    if (type.includes("webp")) return "webp";
    if (type.includes("gif")) return "gif";
    return "jpg";
  }

  /**
   * Readable object path under `wardrobe-images` (Supabase Storage file browser).
   * `{itemId}/` = one wardrobe row; `main/` = row cover + gallery; `variants/` = per colour key.
   *
   * @param {string} itemId
   * @param {File} file
   * @param {{ type: "main_cover" } | { type: "main_gallery", index: number } | { type: "variant_cover", key: string } | { type: "variant_preview", key: string }} slot
   * @returns {string} object path (no bucket prefix)
   */
  function wardrobeImageStorageObjectPath(itemId, file, slot) {
    const root = safeStorageSegment(itemId);
    const ext = fileExtensionFromFile(file);
    if (!slot || slot.type === "main_cover") {
      return `${root}/main/cover.${ext}`;
    }
    if (slot.type === "main_gallery") {
      const n = Math.min(99, Math.max(1, Math.floor(Number(slot.index) || 1)));
      return `${root}/main/gallery/${String(n).padStart(2, "0")}.${ext}`;
    }
    if (slot.type === "variant_cover" || slot.type === "variant_preview") {
      const vk = safeStorageSegment(String(slot.key ?? "").trim(), "variant");
      const role = slot.type === "variant_preview" ? "preview" : "cover";
      return `${root}/variants/${vk}/${role}.${ext}`;
    }
    return `${root}/main/cover.${ext}`;
  }

  /**
   * @param {File} file
   * @param {string} itemId
   * @param {{ type: "main_cover" } | { type: "main_gallery", index: number } | { type: "variant_cover", key: string } | { type: "variant_preview", key: string }} slot
   */
  async function uploadWardrobeImageFileToCloud(file, itemId, slot = /** @type {const} */ ({ type: "main_cover" })) {
    if (!isSupabaseReady()) throw new Error("Supabase is not ready.");
    if (!file) return "";
    const path = wardrobeImageStorageObjectPath(itemId, file, slot);

    const { error } = await supabaseClient.storage.from(WARDROBE_IMAGE_BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: true,
      contentType: file.type || `image/${fileExtensionFromFile(file)}`,
    });
    if (error) {
      const where =
        slot?.type === "main_cover"
          ? "main cover"
          : slot?.type === "main_gallery"
            ? `main gallery #${Math.max(1, Math.floor(Number(slot.index) || 1))}`
            : slot?.type === "variant_cover"
              ? `variant cover (${String(slot.key ?? "").trim() || "unknown key"})`
              : slot?.type === "variant_preview"
                ? `variant preview (${String(slot.key ?? "").trim() || "unknown key"})`
                : "image";
      const detail = formatSupabaseUserMessage(error);
      throw new Error(
        `Supabase Storage upload failed at ${where} [${WARDROBE_IMAGE_BUCKET}/${path}]${detail ? `: ${detail}` : ""}`
      );
    }

    const { data } = supabaseClient.storage.from(WARDROBE_IMAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || "";
  }

  /** Bust browser/CDN cache for Supabase Storage wardrobe images (same path after upsert). */
  function wardrobeImageCacheBustToken(item) {
    if (!item || typeof item !== "object") return "";
    const o = /** @type {any} */ (item);
    if (typeof o.__displayNonce === "number" && Number.isFinite(o.__displayNonce)) {
      return String(Math.floor(o.__displayNonce));
    }
    const u = String(o.updatedAt ?? o.updated_at ?? "").trim();
    if (u) return u.slice(0, 120);
    const c = String(o.createdAt ?? o.created_at ?? "").trim();
    if (c) return c.slice(0, 120);
    return "";
  }

  function withWardrobeImageCacheBust(url, item) {
    const raw = String(url ?? "").trim();
    if (!raw) return "";
    if (!storagePathFromWardrobeImageUrl(raw)) return raw;
    const token = wardrobeImageCacheBustToken(item);
    if (!token) return raw;
    try {
      const u = new URL(raw);
      u.searchParams.set("cb", token);
      return u.href;
    } catch {
      const sep = raw.includes("?") ? "&" : "?";
      return `${raw}${sep}cb=${encodeURIComponent(token)}`;
    }
  }

  function clearCoverResolutionCacheForItem(itemId) {
    const sid = String(itemId ?? "").trim();
    if (!sid) return;
    for (const k of [...coverResolutionCache.keys()]) {
      if (k === sid || k.startsWith(`${sid}::`)) coverResolutionCache.delete(k);
    }
  }

  function stampWardrobeItemMediaNonce(row, nonce = Date.now()) {
    const o = /** @type {any} */ (row);
    if (!o || typeof o !== "object") return nonce;
    const t = typeof nonce === "number" && Number.isFinite(nonce) ? Math.floor(nonce) : Date.now();
    o.__displayNonce = t;
    clearCoverResolutionCacheForItem(String(o.id ?? ""));
    return t;
  }

  /** Stable key for cover + gallery URLs (path only — ignores `cb` query). */
  function wardrobeMediaUrlSignature(item) {
    if (!item || typeof item !== "object") return "";
    const parts = [String(item.image ?? "").trim().split("?")[0]];
    for (const u of itemGalleryList(item)) parts.push(String(u).split("?")[0]);
    return parts.filter(Boolean).join("|");
  }

  /** Keep cache-bust nonce only when media URLs are unchanged; new uploads at the same path need a fresh nonce. */
  function carryForwardMediaNonce(fromRow, toRow) {
    const next = { ...toRow };
    const sameMedia = wardrobeMediaUrlSignature(fromRow) === wardrobeMediaUrlSignature(toRow);
    const n = fromRow?.__displayNonce;
    if (sameMedia && typeof n === "number" && Number.isFinite(n)) {
      /** @type {any} */ (next).__displayNonce = Math.floor(n);
      return next;
    }
    stampWardrobeItemMediaNonce(next, Date.now());
    return next;
  }

  /** Ensure Supabase Storage URLs get a `cb` token when loading edit / detail views. */
  function ensureItemMediaCacheBust(item) {
    if (!item || typeof item !== "object") return item;
    const o = /** @type {any} */ (item);
    if (typeof o.__displayNonce === "number" && Number.isFinite(o.__displayNonce)) return item;
    const ts = String(o.updatedAt ?? o.updated_at ?? "").trim();
    const nonce = ts ? Date.parse(ts) || Date.now() : Date.now();
    stampWardrobeItemMediaNonce(o, nonce);
    return o;
  }

  /** Persist a just-saved row across `item.html` → archive navigation (cloud list can lag). */
  function pinWardrobeSaveToSession(row) {
    const id = String(row?.id ?? "").trim();
    if (!id) return;
    try {
      sessionStorage.setItem(
        WARDROBE_SAVE_PIN_KEY,
        JSON.stringify({ t: Date.now(), row: { ...row, id } })
      );
    } catch {
      /* private mode / disabled storage */
    }
  }

  /** @returns {object | null} */
  function consumePinnedWardrobeSaveFromSession() {
    try {
      const raw = sessionStorage.getItem(WARDROBE_SAVE_PIN_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(WARDROBE_SAVE_PIN_KEY);
      const o = JSON.parse(raw);
      const t = Number(o?.t);
      if (!Number.isFinite(t) || Date.now() - t > WARDROBE_SAVE_PIN_TTL_MS) return null;
      const row = o?.row;
      if (!row || typeof row !== "object" || row.id == null) return null;
      return normalizeItemDerivedFields({ ...row, id: String(row.id) });
    } catch {
      return null;
    }
  }

  /**
   * Prefer freshly saved media over a cloud row that may still be stale (read-after-write lag).
   * @param {object | null | undefined} pinned
   * @param {object} cloudRow
   */
  function mergeCloudWardrobeRowWithPinnedSave(pinned, cloudRow) {
    if (!pinned || pinned.id == null) return { ...cloudRow };
    const id = String(pinned.id);
    if (String(cloudRow?.id ?? "") !== id) return { ...cloudRow };
    const merged = normalizeItemDerivedFields({
      ...cloudRow,
      ...pinned,
      id,
      image: String(pinned.image ?? cloudRow.image ?? "").trim(),
      gallery: Array.isArray(pinned.gallery)
        ? [...pinned.gallery]
        : Array.isArray(cloudRow.gallery)
          ? [...cloudRow.gallery]
          : undefined,
      colourVariants: Array.isArray(pinned.colourVariants)
        ? pinned.colourVariants
        : cloudRow.colourVariants,
    });
    const out = carryForwardMediaNonce(pinned, merged);
    if (typeof /** @type {any} */ (pinned).__displayNonce === "number") {
      /** @type {any} */ (out).__displayNonce = Math.floor(/** @type {any} */ (pinned).__displayNonce);
    }
    return out;
  }

  function storagePathFromWardrobeImageUrl(url) {
    const s = String(url ?? "").trim().split("?")[0];
    if (!s || !/^https?:\/\//i.test(s)) return "";
    const esc = WARDROBE_IMAGE_BUCKET.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `/storage/v1/(?:object/public|render/image/public)/${esc}/(.+)$`,
      "i"
    );
    const m = s.match(re);
    if (!m) return "";
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }

  /**
   * Request a resized wardrobe image via Supabase Storage image rendering (no-op for non-bucket URLs).
   * Uses imgproxy-style `zoom` when provided (>1) for a tighter centre crop before fitting `width`×`height`.
   * @see https://supabase.com/docs/guides/storage/serving/image-transformations
   * @param {string} url
   * @param {number} width
   * @param {number} height
   * @param {{ zoom?: number, quality?: number }} [transformOpts]
   * @returns {string}
   */
  function withSupabaseWardrobeImageRenderSize(url, width, height, transformOpts) {
    const raw = String(url ?? "").trim();
    if (!raw || !storagePathFromWardrobeImageUrl(raw)) return raw;
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    let u;
    try {
      u = new URL(raw);
    } catch {
      return raw;
    }
    const bucket = WARDROBE_IMAGE_BUCKET;
    const objectNeedle = `/storage/v1/object/public/${bucket}/`;
    const renderNeedle = `/storage/v1/render/image/public/${bucket}/`;
    if (u.pathname.includes(objectNeedle)) {
      u.pathname = u.pathname.replace(objectNeedle, renderNeedle);
    } else if (!u.pathname.includes(renderNeedle)) {
      return raw;
    }
    u.searchParams.set("width", String(w));
    u.searchParams.set("height", String(h));
    const resizeMode = transformOpts?.resize === "contain" ? "contain" : "cover";
    u.searchParams.set("resize", resizeMode);

    const quality = transformOpts?.quality;
    if (typeof quality === "number" && Number.isFinite(quality)) {
      const q = Math.min(100, Math.max(20, Math.round(quality)));
      u.searchParams.set("quality", String(q));
    }

    const zoom = transformOpts?.zoom;
    if (typeof zoom === "number" && Number.isFinite(zoom) && zoom > 1 && zoom <= 3) {
      u.searchParams.set("zoom", String(zoom));
    }

    return withWardrobeImageCacheBust(u.href, /** @type {any} */ (transformOpts?.item));
  }

  async function deleteWardrobeImageUrlFromCloud(url) {
    if (!isSupabaseReady()) return false;
    const path = storagePathFromWardrobeImageUrl(url);
    if (!path) return false;
    const { error } = await supabaseClient.storage.from(WARDROBE_IMAGE_BUCKET).remove([path]);
    if (error) {
      console.warn("Could not delete wardrobe image from Supabase Storage.", error);
      return false;
    }
    return true;
  }

  async function deleteWardrobeItemImagesFromCloud(item) {
    if (!item || !isSupabaseReady()) return;
    const urls = [];
    const seen = new Set();
    function add(u) {
      const s = String(u ?? "").trim();
      if (!s || seen.has(s)) return;
      seen.add(s);
      urls.push(s);
    }
    add(item.image);
    for (const u of itemGalleryList(item)) {
      add(u);
    }
    const variants = getItemColourVariants(item);
    if (variants) {
      for (const v of variants) {
        add(v.image);
        add(v.previewImage);
        for (const u of v.gallery || []) add(u);
      }
    }
    const cloudUrls = urls.filter(storagePathFromWardrobeImageUrl);
    if (!cloudUrls.length) return;
    await Promise.allSettled(cloudUrls.map(deleteWardrobeImageUrlFromCloud));
  }

  /** Public URLs in our `wardrobe-images` bucket referenced by a row (cover, gallery, colour variants). */
  function collectSupabaseWardrobeImageUrls(item) {
    if (!item) return [];
    const out = [];
    const seen = new Set();
    function add(u) {
      const s = String(u ?? "").trim();
      if (!s || seen.has(s)) return;
      if (!storagePathFromWardrobeImageUrl(s)) return;
      seen.add(s);
      out.push(s);
    }
    add(item.image);
    for (const u of itemGalleryList(item)) add(u);
    const variants = getItemColourVariants(item);
    if (variants) {
      for (const v of variants) {
        add(v.image);
        add(v.previewImage);
        for (const u of v.gallery || []) add(u);
      }
    }
    return out;
  }

  /** After a successful save, remove Storage objects that the row no longer references. */
  async function deleteSupabaseImagesNoLongerUsed(prevItem, nextItem, nextItemAlt) {
    if (!isSupabaseReady()) return;
    const keep = new Set([
      ...collectSupabaseWardrobeImageUrls(nextItem),
      ...(nextItemAlt ? collectSupabaseWardrobeImageUrls(nextItemAlt) : []),
    ]);
    const drop = collectSupabaseWardrobeImageUrls(prevItem).filter((u) => !keep.has(u));
    if (!drop.length) return;
    await Promise.allSettled(drop.map((u) => deleteWardrobeImageUrlFromCloud(u)));
  }

  async function loadWardrobeItemsFromCloud() {
    if (!isSupabaseReady()) return [];
    const { data, error } = await supabaseClient
      .from(WARDROBE_TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("Could not load Supabase wardrobe items.", error);
      return [];
    }
    const rawRows = data || [];
    console.info("[wardrobe_items] Supabase raw row count:", rawRows.length);
    const normalized = rawRows
      .map((row) => {
        const out = normalizeCloudItemRow(row);
        if (!out) {
          const id = row && typeof row === "object" ? String(row.id ?? "").trim() : "";
          console.warn("[wardrobe_items] dropped row (normalizeCloudItemRow):", id || "(no id)", row);
        }
        return out;
      })
      .filter(Boolean);
    console.info("[wardrobe_items] after normalize:", normalized.length);
    if (rawRows.length !== normalized.length) {
      console.warn(
        `[wardrobe_items] ${rawRows.length - normalized.length} row(s) dropped — usually empty id/brand/name in DB`
      );
    }
    return normalized;
  }

  /**
   * Supabase is canonical: push any rows that still exist only outside cloud
   * (seed catalogue + browser/file custom rows) into `wardrobe_items`.
   * Skips any id listed in `archive_hidden_ids` so user-deleted catalogue rows are not revived by deferred backfill.
   * @param {object[]} cloudRows current rows fetched from Supabase (or a snapshot thereof)
   * @returns {Promise<{ synced: number, failed: number }>}
   */
  async function syncMissingRowsToSupabase(cloudRows) {
    if (!isSupabaseReady()) return { synced: 0, failed: 0 };
    const cloudIds = new Set((cloudRows || []).map((r) => String(r?.id ?? "").trim()).filter(Boolean));
    const buriedIds = loadArchiveHiddenIds();

    /** @type {Map<string, object>} */
    const candidatesById = new Map();
    const pushCandidate = (row) => {
      if (!row || typeof row !== "object") return;
      const id = String(row.id ?? "").trim();
      if (!id || cloudIds.has(id) || buriedIds.has(id) || candidatesById.has(id)) return;
      candidatesById.set(id, normalizeItemDerivedFields({ ...row }));
    };

    for (const row of seedItemsFromScript()) pushCandidate(row);
    for (const row of await loadFileBackedCustomItems()) pushCandidate(row);
    for (const row of loadLocalStorageCustomOnly()) pushCandidate(row);

    let synced = 0;
    let failed = 0;
    for (const row of candidatesById.values()) {
      try {
        const saved = await saveWardrobeItemToCloud(row);
        cloudIds.add(String(saved.id ?? "").trim());
        synced += 1;
      } catch (e) {
        failed += 1;
        console.warn("syncMissingRowsToSupabase failed for row:", row?.id, e);
      }
    }
    return { synced, failed };
  }

  /** Upsert one custom row to `wardrobe_items` and return the normalized row from Postgres. */
  async function saveWardrobeItemToCloud(item) {
    if (!isSupabaseReady()) throw new Error("Supabase is not ready.");
    /** Prefer British columns; if PostgREST / DB only exposes American names, retry once. */
    const spellings = /** @type {const} */ (["uk", "us"]);
    let lastErr = /** @type {any} */ (null);
    for (const sp of spellings) {
      const row = wardrobeItemsStrictUpsertRowFromItem(item, sp);
      const { data, error } = await supabaseClient.from(WARDROBE_TABLE).upsert(row, { onConflict: "id" }).select("*").single();
      if (!error) {
        const norm = normalizeCloudItemRow(data);
        if (!norm) throw new Error("Supabase returned an invalid wardrobe row.");
        return norm;
      }
      lastErr = error;
      const missing = missingWardrobeItemsColourColumnFromPostgrest(error);
      const tryAlternate =
        (sp === "uk" && (missing === "colour" || missing === "colour_code")) ||
        (sp === "us" && (missing === "color" || missing === "color_code"));
      if (tryAlternate) continue;
      throw error;
    }
    throw lastErr;
  }

  /** @type {object[]} */
  let items = [];

  /** Increments whenever `mergeWardrobeFromSources()` rebuilds rows (invalidates main grid structural cache). */
  let wardrobeRevision = 0;

  /** Pre-built normalized search haystacks (`id` → text), rebuilt in `mergeWardrobeFromSources()`. */
  /** @type {Map<string, string>} */
  let wardrobeSearchIndex = new Map();

  /** Memoised filtered + sorted archive list for the main grid. */
  let archiveSortedCacheKey = "";
  /** @type {object[] | null} */
  let archiveSortedCache = null;

  const GRID_DENSE_ANIMATION_THRESHOLD = 40;

  /** Document-level dismiss listeners for the mobile filters panel (installed once). */
  let filtersMenuDismissListenersInstalled = false;

  /** After a cover loads, remember the working URL for gallery / outfit UI. */
  const coverResolutionCache = new Map();

  /** @type {Map<string, object>} */
  const itemById = new Map();

  function rebuildItemIndex() {
    itemById.clear();
    for (const i of items) itemById.set(i.id, i);
  }

  function normalizeCustomItemRows(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x) =>
          x &&
          typeof x.id === "string" &&
          typeof x.brand === "string" &&
          typeof x.name === "string" &&
          (x.image == null || typeof x.image === "string")
      )
      .map((x) => ({
        ...x,
        image: String(x.image ?? "").trim(),
        season: normalizeStoredItemSeason(x.season),
        colourCode: String(x.colourCode ?? x.colorCode ?? x.colour_code ?? x.color_code ?? "").trim(),
      }));
  }

  function loadLocalStorageCustomOnly() {
    try {
      const raw = localStorage.getItem(CUSTOM_ITEMS_KEY);
      if (!raw) return [];
      return normalizeCustomItemRows(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  /** Remove custom rows with these ids from `localStorage` only (does not change `cloudBackedCustomItems`). */
  function stripCustomIdsFromLocalStorage(ids) {
    const drop = new Set((ids || []).map((x) => String(x ?? "").trim()).filter(Boolean));
    if (!drop.size) return false;
    try {
      const cur = loadLocalStorageCustomOnly();
      const next = cur.filter((r) => r && !drop.has(String(r.id)));
      if (next.length === cur.length) return false;
      localStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  /** Write only browser-local custom rows to `data/custom-items.json` when dev API is up (no cloud dump). */
  async function mirrorLocalCustomItemsToProjectFile() {
    return await syncCustomItemsToProjectFile(loadLocalStorageCustomOnly());
  }

  /** Local custom rows for local mode, or cloud rows only for cloud mode. */
  function loadCustomItems() {
    const cloudRows = Array.isArray(cloudBackedCustomItems) ? cloudBackedCustomItems : [];
    const fromLs = loadLocalStorageCustomOnly();
    const fileRows = fileBackedCustomItems;

    if (isCloudModeActive()) {
      return [...cloudRows];
    }

    const localIds = new Set(fromLs.map((r) => String(r.id)));
    const fileOnly = fileRows.filter((r) => r && r.id != null && !localIds.has(String(r.id)));
    return [...fromLs, ...fileOnly];
  }

  async function syncCustomItemsToProjectFile(rows) {
    try {
      const res = await fetch("/api/custom-items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      if (!res.ok) return false;
      fileBackedCustomItems = normalizeCustomItemRows(rows);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Persist browser-only custom rows (no Supabase): `localStorage` + optional `data/custom-items.json` via dev server.
   * When Supabase is on, canonical custom pieces live in `wardrobe_items`; drop the local duplicate list to save quota.
   * @param {unknown[]} rows
   * @returns {Promise<boolean>} without Supabase: `true` if project JSON was written; with Supabase: `true` after clearing redundant local cache.
   */
  async function commitCustomItems(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (isSupabaseReady()) {
      try {
        localStorage.removeItem(CUSTOM_ITEMS_KEY);
      } catch {
        /* ignore */
      }
      return true;
    }
    try {
      localStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify(list));
    } catch (e) {
      throw e;
    }
    return await syncCustomItemsToProjectFile(list);
  }

  function downloadCustomItemsJsonForRepo() {
    const rows = loadCustomItems();
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    const u = URL.createObjectURL(blob);
    a.href = u;
    a.download = "custom-items.json";
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(u);
    showToast("Save as data/custom-items.json in the project to version custom pieces.");
  }

  /** Text-only row for local audit (no image URLs). */
  function itemToLocalTextRecord(item) {
    if (!item || item.id == null) return null;
    const meta =
      item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
        ? { ...item.metadata }
        : {};
    const mrows = getMeasurementRows(item)
      .filter((r) => String(r.label ?? "").trim() || String(r.value ?? "").trim())
      .map((r) => ({ label: String(r.label ?? ""), value: String(r.value ?? "") }));
    const cv = getItemColourVariants(item);
    const colourVariants = cv
      ? cv.map((v) => ({
          key: v.key,
          label: v.label,
          colour: v.colour,
          colourCode: v.colourCode,
          notes: v.notes,
          basicColour: v.basicColour,
        }))
      : [];
    const pNum = parsePriceAmountFlexible(item.price != null ? item.price : meta?.price);
    const image = String(item.image ?? "").trim();
    const gallery = itemGalleryList(item);
    return {
      id: String(item.id),
      brand: String(item.brand ?? "").trim(),
      name: String(item.name ?? "").trim(),
      pillar: String(item.pillar ?? "").trim(),
      section: String(item.section ?? "").trim(),
      category: String(item.category ?? "").trim(),
      season: String(item.season ?? "").trim(),
      colour: String(item.colour ?? "").trim(),
      colourCode: itemColourCode(item),
      fabric: String(item.fabric ?? "").trim(),
      weight: String(item.weight ?? "").trim(),
      size: String(item.size ?? "").trim(),
      measuredDimensions: String(item.measuredDimensions ?? "").trim(),
      purchaseDate: String(item.purchaseDate ?? "").trim(),
      notes: String(item.notes ?? "").trim(),
      price: Number.isFinite(pNum) ? pNum : null,
      priceCurrency: String(item.priceCurrency ?? meta.priceCurrency ?? "TWD").trim(),
      basicColour: String(item.basicColour ?? meta.basicColour ?? "").trim(),
      measurementRows: mrows,
      measurementUnit: getMeasurementUnit(item),
      colourVariants,
      _media: { hasCover: Boolean(image), galleryCount: gallery.length },
    };
  }

  function buildWardrobeTextLocalPayload() {
    const rows = getAllWardrobeItems().map(itemToLocalTextRecord).filter(Boolean);
    return {
      _schema: WARDROBE_TEXT_LOCAL_KEY,
      exportedAt: new Date().toISOString(),
      source: wardrobeCatalogueSource,
      rowCount: rows.length,
      items: rows,
    };
  }

  function persistAllWardrobeTextToLocalStorage() {
    const payload = buildWardrobeTextLocalPayload();
    try {
      localStorage.setItem(WARDROBE_TEXT_LOCAL_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn(e);
      showToast("Could not save to localStorage — storage may be full.");
      return;
    }
    showToast(`Saved text for ${payload.rowCount} pieces to localStorage (${WARDROBE_TEXT_LOCAL_KEY}).`);
  }

  function downloadWardrobeTextLocalJson() {
    const payload = buildWardrobeTextLocalPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    const u = URL.createObjectURL(blob);
    a.href = u;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `timeless-wardrobe-text-local-${stamp}.json`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(u);
    showToast(`Downloaded text for ${payload.rowCount} pieces — edit in data/local/ or apply with npm run db:apply-local-text.`);
  }

  /**
   * One-file snapshot of browser-only state (custom rows, archive overrides, hidden ids, outfits, UI prefs).
   * Does not replace Supabase sync — use when cloud is off or as an extra safety copy.
   */
  function downloadBrowserWardrobeBackupJson() {
    const textLocal = buildWardrobeTextLocalPayload();
    const payload = {
      _schema: "timeless-wardrobe-browser-backup-v1",
      exportedAt: new Date().toISOString(),
      supabaseConfigured: Boolean(isSupabaseReady()),
      wardrobeItemsText: textLocal.items,
      wardrobeTextLocal: textLocal,
      customItems: loadCustomItems(),
      archiveOverrides: loadArchiveOverrides(),
      archiveHiddenIds: [...loadArchiveHiddenIds()],
      outfits: {
        version: OUTFIT_STORAGE_VERSION,
        outfits: savedOutfits.map((o) => ({
          id: o.id,
          name: o.name,
          notes: String(o.notes ?? ""),
          createdAt: o.createdAt,
          slots: o.slots,
        })),
      },
      seasonNav: readSeasonNavFromLocalStorage(),
      archiveSortMode: loadPersistedArchiveSortMode(),
      displayCurrency: "TWD",
      basicColourFilter: loadPersistedBasicColourFilter(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    const u = URL.createObjectURL(blob);
    a.href = u;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `timeless-wardrobe-browser-backup-${stamp}.json`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(u);
    showToast(
      "Backup downloaded — store it outside the browser (cloud drive or git). Clearing site data will not remove that file."
    );
  }

  /** @type {boolean} */
  let localDataRiskBannerWired = false;

  function installLocalDataRiskBanner() {
    if (!isTwAdminMode()) return;
    if (localDataRiskBannerWired) return;
    localDataRiskBannerWired = true;

    const el = document.getElementById("local-data-risk-banner");
    const refreshVisibility = () => {
      if (!el) return;
      if (isSupabaseReady()) {
        el.hidden = true;
        return;
      }
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(LOCAL_DATA_RISK_BANNER_DISMISSED_KEY) === "1";
      } catch {
        /* private mode */
      }
      el.hidden = dismissed;
    };

    refreshVisibility();

    document.getElementById("local-data-backup-json")?.addEventListener("click", () => {
      downloadBrowserWardrobeBackupJson();
    });
    document.getElementById("local-data-risk-dismiss")?.addEventListener("click", () => {
      try {
        localStorage.setItem(LOCAL_DATA_RISK_BANNER_DISMISSED_KEY, "1");
      } catch {
        /* */
      }
      refreshVisibility();
    });
    document.getElementById("data-note-backup-json")?.addEventListener("click", () => {
      downloadBrowserWardrobeBackupJson();
    });
  }

  /** @type {boolean} */
  let wardrobeTextLocalExportWired = false;

  function installWardrobeTextLocalExportActions() {
    if (!isTwAdminMode()) return;
    if (wardrobeTextLocalExportWired) return;
    wardrobeTextLocalExportWired = true;
    document.getElementById("data-note-text-to-localstorage")?.addEventListener("click", () => {
      persistAllWardrobeTextToLocalStorage();
    });
    document.getElementById("data-note-download-text-json")?.addEventListener("click", () => {
      downloadWardrobeTextLocalJson();
    });
    document.getElementById("local-data-text-to-localstorage")?.addEventListener("click", () => {
      persistAllWardrobeTextToLocalStorage();
    });
    document.getElementById("local-data-download-text-json")?.addEventListener("click", () => {
      downloadWardrobeTextLocalJson();
    });
  }

  /** Push merged custom rows (browser + file) into `data/custom-items.json` when `npm run dev` is running. */
  async function pullBrowserCustomItemsIntoProjectFile() {
    const rows = isSupabaseReady() ? loadLocalStorageCustomOnly() : loadCustomItems();
    let synced = false;
    try {
      if (isSupabaseReady()) {
        synced = await syncCustomItemsToProjectFile(rows);
      } else {
        synced = await commitCustomItems(rows);
      }
    } catch (e) {
      console.warn(e);
      showToast("Could not update browser storage — check space or privacy settings.");
      return;
    }
    if (synced) {
      mergeWardrobeFromSources();
      if (document.getElementById("grid")) {
        initFilters();
        onOutfitChange();
        renderGrid();
      }
      showToast("Browser custom pieces are now saved in data/custom-items.json.");
    } else {
      showToast("Start the app with npm run dev from the project folder, then try again.");
    }
  }

  function readSeasonNavFromLocalStorage() {
    try {
      const v = localStorage.getItem(SEASON_NAV_STORAGE_KEY);
      return normalizeSeasonNavToken(v);
    } catch {
      /* private mode / disabled */
    }
    return null;
  }

  function normalizeSeason(value) {
    if (value == null || value === "") return null;
    const v = String(value).toLowerCase().trim();
    if (v === "ss" || v === "s/s" || v.includes("spring") || v.includes("summer")) return "SS";
    if (v === "aw" || v === "a/w" || v.includes("autumn") || v.includes("winter")) return "AW";
    if (v.includes("all")) return "ALL";
    return null;
  }

  function normalizeSeasonNavToken(raw) {
    const normalized = normalizeSeason(raw);
    return normalized === "SS" || normalized === "AW" ? normalized : null;
  }

  function seasonNavQueryToken(season) {
    if (season === "SS") return "SS";
    if (season === "AW") return "AW";
    return "";
  }

  function isArchiveLocation() {
    const path = String(globalThis.location?.pathname ?? "");
    return path === "/archive" || path === "/archive.html";
  }

  function readSeasonNavFromUrl() {
    if (!isArchiveLocation()) return null;
    try {
      return normalizeSeasonNavToken(new URLSearchParams(globalThis.location.search).get("season"));
    } catch {
      return null;
    }
  }

  function archiveUrlHasSeasonParam() {
    if (!isArchiveLocation()) return false;
    try {
      return new URLSearchParams(globalThis.location.search).has("season");
    } catch {
      return false;
    }
  }

  function loadPersistedSeasonNav() {
    if (isArchiveLocation()) return readSeasonNavFromUrl();
    return readSeasonNavFromLocalStorage();
  }

  /** Season strip (A/W · S/S · All) stays in localStorage only — ephemeral UI, not synced to Supabase. */
  function persistSeasonNav() {
    try {
      if (seasonNavFilter) localStorage.setItem(SEASON_NAV_STORAGE_KEY, seasonNavFilter);
      else localStorage.removeItem(SEASON_NAV_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /** In-memory archive state; persisted to Supabase when configured (else localStorage). */
  /** @type {Record<string, object>} */
  let archiveOverridesState = {};
  /** @type {Set<string>} */
  let archiveHiddenState = new Set();

  function readArchiveOverridesFromLocalStorageRaw() {
    try {
      const raw = localStorage.getItem(ITEM_ARCHIVE_OVERRIDES_KEY);
      if (!raw) return {};
      const p = JSON.parse(raw);
      return p && typeof p === "object" && !Array.isArray(p) ? p : {};
    } catch {
      return {};
    }
  }

  function readArchiveHiddenIdsFromLocalStorageRaw() {
    try {
      const raw = localStorage.getItem(ARCHIVE_HIDDEN_IDS_KEY);
      if (!raw) return [];
      const p = JSON.parse(raw);
      if (!Array.isArray(p)) return [];
      return p.map((x) => String(x));
    } catch {
      return [];
    }
  }

  function installArchiveStateFromPayload(overrides, hiddenIds) {
    archiveOverridesState =
      overrides && typeof overrides === "object" && !Array.isArray(overrides) ? { ...overrides } : {};
    archiveHiddenState = new Set(Array.isArray(hiddenIds) ? hiddenIds.map((x) => String(x)) : []);
  }

  function applySeasonNavFromLocalStorage() {
    seasonNavFilter = isArchiveLocation() ? readSeasonNavFromUrl() : readSeasonNavFromLocalStorage();
  }

  function hydrateArchiveStateFromLocalStorageOnly() {
    installArchiveStateFromPayload(
      readArchiveOverridesFromLocalStorageRaw(),
      readArchiveHiddenIdsFromLocalStorageRaw()
    );
    applySeasonNavFromLocalStorage();
  }

  async function flushWardrobeAppStateToSupabase() {
    if (!isSupabaseReady()) return;
    const row = {
      id: "default",
      archive_overrides: archiveOverridesState,
      archive_hidden_ids: [...archiveHiddenState],
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseClient.from("wardrobe_app_state").upsert(row, { onConflict: "id" });
    if (error) throw error;
  }

  async function hydrateArchiveAndSeasonState() {
    if (!isSupabaseReady()) {
      hydrateArchiveStateFromLocalStorageOnly();
      return;
    }

    const lsOv = readArchiveOverridesFromLocalStorageRaw();
    const lsH = readArchiveHiddenIdsFromLocalStorageRaw();

    const { data, error } = await supabaseClient
      .from("wardrobe_app_state")
      .select("archive_overrides, archive_hidden_ids")
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      console.warn("wardrobe_app_state:", error);
      hydrateArchiveStateFromLocalStorageOnly();
      return;
    }

    if (!data) {
      installArchiveStateFromPayload(lsOv, lsH);
      applySeasonNavFromLocalStorage();
      try {
        await flushWardrobeAppStateToSupabase();
        localStorage.removeItem(ITEM_ARCHIVE_OVERRIDES_KEY);
        localStorage.removeItem(ARCHIVE_HIDDEN_IDS_KEY);
      } catch (e) {
        console.warn("wardrobe_app_state bootstrap insert:", e);
      }
      return;
    }

    let overrides =
      data.archive_overrides && typeof data.archive_overrides === "object" && !Array.isArray(data.archive_overrides)
        ? { ...data.archive_overrides }
        : {};
    let hidden = Array.isArray(data.archive_hidden_ids) ? data.archive_hidden_ids.map((x) => String(x)) : [];
    let migrated = false;

    if (!Object.keys(overrides).length && Object.keys(lsOv).length) {
      overrides = { ...lsOv };
      migrated = true;
    }
    if (!hidden.length && lsH.length) {
      hidden = [...lsH];
      migrated = true;
    }

    installArchiveStateFromPayload(overrides, hidden);
    applySeasonNavFromLocalStorage();

    if (migrated) {
      try {
        await flushWardrobeAppStateToSupabase();
        localStorage.removeItem(ITEM_ARCHIVE_OVERRIDES_KEY);
        localStorage.removeItem(ARCHIVE_HIDDEN_IDS_KEY);
      } catch (e) {
        console.warn("Migrate archive state to Supabase failed.", e);
      }
    } else if (Object.keys(lsOv).length || lsH.length) {
      try {
        localStorage.removeItem(ITEM_ARCHIVE_OVERRIDES_KEY);
        localStorage.removeItem(ARCHIVE_HIDDEN_IDS_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  function loadArchiveOverrides() {
    return { ...archiveOverridesState };
  }

  async function saveArchiveOverrides(map) {
    archiveOverridesState = map && typeof map === "object" && !Array.isArray(map) ? { ...map } : {};
    if (!isSupabaseReady()) {
      try {
        localStorage.setItem(ITEM_ARCHIVE_OVERRIDES_KEY, JSON.stringify(archiveOverridesState));
      } catch (e) {
        const q = /** @type {any} */ (e);
        if (q?.name === "QuotaExceededError" || q?.code === 22) {
          const ex = /** @type {any} */ (new Error("quota"));
          ex.archiveOverrides = true;
          throw ex;
        }
        throw e;
      }
      return;
    }
    await flushWardrobeAppStateToSupabase();
  }

  /**
   * Full in-memory row for cloud upsert when editing a catalogue (non-custom) piece.
   * @param {object} prev
   * @param {Record<string, unknown>} patch same shape as archive override patch
   */
  function mergeArchivePatchIntoFullItem(prev, patch) {
    if (!prev || typeof prev !== "object") return /** @type {any} */ ({});
    const id = String(prev.id ?? "").trim();
    const out = /** @type {Record<string, unknown>} */ ({ ...prev });
    for (const k of Object.keys(patch)) {
      if (k === "metadata") continue;
      out[k] = patch[k];
    }
    out.id = id;
    if (Object.prototype.hasOwnProperty.call(patch, "metadata")) {
      if (patch.metadata == null) delete out.metadata;
      else out.metadata = patch.metadata;
    }
    return /** @type {any} */ (out);
  }

  function loadArchiveHiddenIds() {
    return new Set(archiveHiddenState);
  }

  async function saveArchiveHiddenIds(set) {
    archiveHiddenState = new Set(set);
    if (!isSupabaseReady()) {
      try {
        localStorage.setItem(ARCHIVE_HIDDEN_IDS_KEY, JSON.stringify([...archiveHiddenState]));
      } catch (e) {
        throw e;
      }
      return;
    }
    await flushWardrobeAppStateToSupabase();
  }

  /** Full merged catalogue for curated picks — never `applyFilters()` / active browse state. */
  function getAllWardrobeItems() {
    return Array.isArray(items) ? items.slice() : [];
  }

  function mergeWardrobeFromSources() {
    const ov = loadArchiveOverrides();
    const hiddenArchive = loadArchiveHiddenIds();
    const mergedBase = wardrobeBase
      .filter((row) => {
        if (!row || row.id == null) return false;
        return !hiddenArchive.has(String(row.id));
      })
      .map((row, idx) => {
        if (!row || row.id == null) return row;
        const id = String(row.id);
        const patch = ov[id];
        const base = patch && typeof patch === "object" ? { ...row, ...patch, id } : { ...row };
        return { ...base, __archiveOrdinal: idx };
      });
    slotRecordFallbackCategory = computeSlotRecordFallbackCategories(mergedBase);
    const mergedList = isCloudModeActive() ? [...mergedBase] : [...loadCustomItems(), ...mergedBase];
    items = mergedList.map((row) => {
      let row2 = row;
      let cat = String(row2.category ?? "").trim();
      if (Object.prototype.hasOwnProperty.call(LEGACY_UNSPEC_CATEGORY_TO_SLOT, cat)) {
        const slotForOld = LEGACY_UNSPEC_CATEGORY_TO_SLOT[cat];
        row2 = {
          ...row2,
          category:
            slotRecordFallbackCategory[slotForOld] || STATIC_RECORD_FALLBACK_BY_SLOT[slotForOld] || "Tops",
        };
      }
      const slot = itemSlot(row2);
      const canon = recordCategoryForDrill(row2, slot);
      const raw = String(row2.category ?? "").trim();
      if (raw === canon) return normalizeItemDerivedFields(row2);
      return normalizeItemDerivedFields({ ...row2, category: canon });
    });
    rebuildItemIndex();
    rebuildWardrobeSearchIndex();
    coverResolutionCache.clear();
    wardrobeRevision += 1;
    archiveSortedCacheKey = "";
    archiveSortedCache = null;
    syncHeaderSearchFeaturedSubcategoryCards();
  }

  function rebuildWardrobeSearchIndex() {
    const next = new Map();
    for (const row of items) {
      if (!row || row.id == null) continue;
      next.set(String(row.id), buildItemSearchHaystackNorm(row));
    }
    wardrobeSearchIndex = next;
  }

  function invalidateArchiveSortedCache() {
    archiveSortedCacheKey = "";
    archiveSortedCache = null;
  }

  function buildArchiveSortedCacheKey() {
    return [
      wardrobeRevision,
      seasonNavFilter,
      categoryNavFilter,
      String(subcategoryFilter ?? "").trim(),
      String(archiveSubmittedSearchNorm ?? "").trim(),
      String(archiveSearchWithinRecordCategory ?? "").trim(),
      archiveSearchBrowseAllSlots ? "1" : "0",
      basicColourFilter,
      [...selectedBrandFilters].sort().join("\x1f"),
      archiveSortMode,
      archiveDisplayCurrency,
    ].join("\x1e");
  }

  /** Filtered then sorted archive rows — one pass per filter state (memoised). */
  function getArchiveSortedDataset() {
    const key = buildArchiveSortedCacheKey();
    if (key === archiveSortedCacheKey && archiveSortedCache) return archiveSortedCache;
    const filtered = applyFilters(items);
    archiveSortedCache = [...filtered].sort(compareGridItems);
    archiveSortedCacheKey = key;
    return archiveSortedCache;
  }

  /** Main nav labels — never surface as a “Popular” tile title (redundant with header tabs). */
  const POPULAR_CATEGORY_BANNED_TITLE_LOWER = new Set(["clothing", "accessories", "watches", "fragrance"]);

  function isBannedPopularCategoryTitleLabel(raw) {
    const t = String(raw ?? "").trim().toLowerCase();
    if (!t) return true;
    if (POPULAR_CATEGORY_BANNED_TITLE_LOWER.has(t)) return true;
    return SLOT_OPTIONS.some((s) => s.toLowerCase() === t);
  }

  /** Fisher–Yates shuffle (mutates `arr`). */
  function shuffleArrayInPlace(arr) {
    const a = /** @type {unknown[]} */ (arr);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  /** Prefer a dominant `subcategory` / `section` from the pool when it is editorial and not a nav tab name. */
  function popularBrowseCardTitleFromPool(drillKey, pool) {
    const counts = new Map();
    for (const it of pool) {
      const sub = String(/** @type {any} */ (it).subcategory ?? "").trim();
      const sec = String(/** @type {any} */ (it).section ?? "").trim();
      const lab = sub || sec;
      if (!lab || isBannedPopularCategoryTitleLabel(lab)) continue;
      counts.set(lab, (counts.get(lab) ?? 0) + 1);
    }
    const n = pool.length;
    let best = "";
    let bestC = 0;
    for (const [lab, c] of counts) {
      if (c > bestC && c >= Math.max(2, Math.ceil(n * 0.45))) {
        best = lab;
        bestC = c;
      }
    }
    if (best) return best;
    const fr = friendlyRecordCategory(drillKey) || String(drillKey ?? "").trim();
    if (fr && !isBannedPopularCategoryTitleLabel(fr)) return fr;
    return String(drillKey ?? "").trim();
  }

  function scorePopularBrowseCoverStrength(it) {
    const c = buildCoverCandidates(it);
    let s = c.length * 45;
    const img = String(it?.image ?? "").trim();
    if (isDisplayableCloudImageUrl(img)) s += 22;
    s += Math.min(28, Math.floor(img.length / 12));
    const vars = getItemColourVariants(it);
    if (vars?.length) s += Math.min(18, vars.length * 4);
    const name = String(it?.name ?? "").trim();
    if (name.length >= 14) s += 8;
    return s;
  }

  /** Pick a strong real cover from `pool`, biased to better imagery but not always the first row. */
  function pickStrongPopularBrowseCoverItem(pool) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    const withCover = pool.filter((it) => buildCoverCandidates(it).length > 0);
    const source = withCover.length ? withCover : pool;
    if (source.length === 1) return source[0];
    const scored = source.map((it) => ({ it, s: scorePopularBrowseCoverStrength(it) }));
    scored.sort((a, b) => b.s - a.s);
    const topN = Math.min(5, Math.max(2, Math.ceil(source.length * 0.4)));
    const top = scored.slice(0, topN).map((x) => x.it);
    return top[Math.floor(Math.random() * top.length)] ?? source[0];
  }

  /**
   * Search overlay “Popular categories”: four subcategory drill rows from real wardrobe data only
   * (never main nav tab names). Filter uses `recordCategoryForDrill` / `subcategoryFilter`; titles prefer
   * dominant `item.subcategory` / `item.section` when present.
   */
  function syncHeaderSearchFeaturedSubcategoryCards() {
    const gridHost = document.getElementById("site-header-search-featured-subcats");
    if (!gridHost) return;

    const popularCoverW = 480;
    const popularCoverH = 640;
    const popularCoverQuality = 88;
    const mainHref = ARCHIVE_HOME_MAIN_URL;

    /** @type {{ slot: string, sub: string, pool: object[], score: number, coverN: number }[]} */
    const candidates = [];
    const seenKeys = new Set();
    for (const slot of SLOT_OPTIONS) {
      const keys = drillSubcategoryKeysFromPool(slot, items);
      for (const { raw: dk, label } of collapseRecordTypeKeysByDisplayLabel(keys, slot)) {
        if (!dk || isBannedPopularCategoryTitleLabel(dk) || isBannedPopularCategoryTitleLabel(label)) continue;
        const k = `${slot}\0${label.toLowerCase()}`;
        if (seenKeys.has(k)) continue;
        seenKeys.add(k);
        const pool = poolItemsMatchingRecordTypeDrill(items, slot, dk);
        if (!pool.length) continue;
        const withCover = pool.filter((it) => buildCoverCandidates(it).length > 0);
        const coverN = withCover.length;
        const score = pool.length * 12 + coverN * 18 + (coverN >= 2 ? 8 : 0);
        candidates.push({ slot, sub: dk, pool, score, coverN });
      }
    }

    const randomizeOrder = !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    candidates.sort((a, b) => b.score - a.score);
    const tier = Math.min(24, Math.max(4, candidates.length));
    const shortlist = candidates.slice(0, tier);
    if (randomizeOrder) shuffleArrayInPlace(shortlist);
    const picks = shortlist.slice(0, 4);

    gridHost.replaceChildren();
    if (!picks.length) return;

    for (const row of picks) {
      const title = popularBrowseCardTitleFromPool(row.sub, row.pool);
      const galleryPick = pickRandomHeaderSearchGalleryFromPool(row.pool);
      const pick = galleryPick?.item ?? pickStrongPopularBrowseCoverItem(row.pool);

      const a = document.createElement("a");
      a.href = mainHref;
      a.className = "site-header__search-category-card";
      a.setAttribute("role", "listitem");
      a.setAttribute("data-category-jump", row.slot);
      a.setAttribute("data-subcategory-jump", row.sub);
      const ariaSlot = categoryDisplayLabel(row.slot) || row.slot;
      a.setAttribute("aria-label", `Browse ${title} in ${ariaSlot}`);

      const media = document.createElement("div");
      media.className = "site-header__search-category-card__media";
      media.setAttribute("aria-hidden", "true");
      media.classList.remove("site-header__search-category-card__media--missing");

      if (pick) {
        const img = document.createElement("img");
        img.className = "site-header__search-category-card__img";
        img.alt = "";
        img.decoding = "async";
        img.loading = "lazy";
        img.draggable = false;
        media.appendChild(img);
        wireCoverImageWithFallbacks(img, pick, {
          host: media,
          missingClass: "site-header__search-category-card__media--missing",
          preferredUrl: galleryPick?.url,
          coverRenderWidth: popularCoverW,
          coverRenderHeight: popularCoverH,
          coverRenderQuality: popularCoverQuality,
          coverRenderResize: "cover",
        });
      } else {
        media.classList.add("site-header__search-category-card__media--missing");
      }

      const titleEl = document.createElement("span");
      titleEl.className = "site-header__search-category-card__title";
      titleEl.textContent = title;

      const cta = document.createElement("span");
      cta.className = "site-header__search-category-card__cta";
      cta.textContent = "Browse Now";

      a.appendChild(media);
      a.appendChild(titleEl);
      a.appendChild(cta);
      gridHost.appendChild(a);
    }
    syncCategoryTabUI();
  }

  function editorialHeroVisualScore(item) {
    const slot = itemSlot(item);
    const rec = String(recordCategoryForDrill(item, slot) ?? "").toLowerCase();
    const sub = String(item.subcategory ?? item.section ?? "").toLowerCase();
    const nm = String(item.name ?? "").toLowerCase();
    const blob = `${rec} ${sub} ${nm}`;
    let s = 0;
    for (const k of [
      "outerwear",
      "coat",
      "jacket",
      "blazer",
      "suit",
      "tailor",
      "watch",
      "jewel",
      "bracelet",
      "loafer",
      "derby",
      "oxford",
      "boot",
      "fragrance",
      "sunglass",
    ]) {
      if (blob.includes(k)) s += 3;
    }
    if (buildCoverCandidates(item).length) s += 8;
    return s;
  }

  /** Homepage hero pool — images + MP4/WebM (sessionStorage picks first slide). */
  const FALLBACK_HOME_HERO_IMAGES = [
    "images/heroes/hero-country-classics.png",
    "images/heroes/hero-editorial-01.png",
    "images/heroes/hero-editorial-02.png",
  ];
  const HOME_HERO_IMAGES =
    Array.isArray(globalThis.TW_HOME_HERO_IMAGES) && globalThis.TW_HOME_HERO_IMAGES.length
      ? globalThis.TW_HOME_HERO_IMAGES
      : FALLBACK_HOME_HERO_IMAGES;
  const HOME_HERO_STORAGE_KEY = "heroMedia-v2";
  const HOME_HERO_VIDEO_EXT = /\.(mp4|webm)(\?|#|$)/i;

  function isHomeHeroVideoPath(src) {
    return HOME_HERO_VIDEO_EXT.test(String(src ?? "").trim());
  }

  function homeHeroMediaUrl(src) {
    const path = String(src ?? "").trim();
    if (!path) return "";
    const encoded = path
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    const bust = globalThis.TW_DEV_ASSET?.bustKnownUrl?.(encoded);
    return bust || encoded;
  }

  function scheduleDevLocalImageCacheBust(/** @type {HTMLImageElement | HTMLVideoElement | null} */ el, /** @type {string} */ rawPath) {
    const dev = globalThis.TW_DEV_ASSET;
    if (!dev?.isLocalDev || !dev.bustUrl || !(el instanceof HTMLImageElement)) return;
    const raw = String(rawPath ?? "").trim();
    if (!raw || /^https?:\/\//i.test(raw)) return;
    void dev.bustUrl(raw).then((next) => {
      if (next && el.src !== next) el.src = next;
    });
  }

  function homeHeroVideoMime(path) {
    return /\.webm(\?|#|$)/i.test(String(path ?? "")) ? "video/webm" : "video/mp4";
  }

  function pickHomeHeroImagePath() {
    try {
      const cached = sessionStorage.getItem(HOME_HERO_STORAGE_KEY);
      if (cached && HOME_HERO_IMAGES.includes(cached)) return cached;
    } catch {
      /* private mode / blocked storage */
    }
    const hero = HOME_HERO_IMAGES[Math.floor(Math.random() * HOME_HERO_IMAGES.length)];
    try {
      sessionStorage.setItem(HOME_HERO_STORAGE_KEY, hero);
    } catch {
      /* ignore */
    }
    return hero;
  }

  function ensureHomeHeroPreloadLink() {
    if (!document.body?.classList.contains("home-page")) return;
    const hero = pickHomeHeroImagePath();
    const href = homeHeroMediaUrl(hero);
    if (!href || document.querySelector(`link[data-tw-hero-preload="${CSS.escape(hero)}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = isHomeHeroVideoPath(hero) ? "video" : "image";
    link.href = href;
    if (!isHomeHeroVideoPath(hero)) link.setAttribute("fetchpriority", "high");
    link.dataset.twHeroPreload = hero;
    document.head.appendChild(link);
  }

  function mountEditorialHomeHeroCatalogFallback(heroHost) {
    heroHost.replaceChildren();
    const heroItems = pickEditorialHeroBackdropItems(items, 3);
    const ordered =
      heroItems.length <= 1
        ? heroItems.slice()
        : [...heroItems.slice(1).reverse(), heroItems[0]];
    ordered.forEach((it, i) => {
      const layer = document.createElement("div");
      layer.className = "ed-lp__hero-layer";
      const isBackStack = i < ordered.length - 1;
      if (isBackStack) layer.dataset.edHeroStack = String(i + 1);
      const img = document.createElement("img");
      img.className = "ed-lp__hero-layer-img";
      img.alt = "";
      img.decoding = "async";
      img.loading = i === ordered.length - 1 ? "eager" : "lazy";
      layer.appendChild(img);
      wireCoverImageWithFallbacks(img, it, {
        host: layer,
        missingClass: "ed-lp__hero-layer--missing",
        coverRenderWidth: 1536,
        coverRenderHeight: 1024,
        coverRenderQuality: 86,
      });
      heroHost.appendChild(layer);
    });
  }

  /** Random first slide (session), then remaining hero assets in catalog order. */
  function orderedHomeHeroImagePaths() {
    const first = pickHomeHeroImagePath();
    const rest = HOME_HERO_IMAGES.filter((p) => p !== first);
    return [first, ...rest];
  }

  function preloadHomeHeroImage(src) {
    const path = String(src ?? "").trim();
    if (!path) return;
    const url = homeHeroMediaUrl(path);
    try {
      if (isHomeHeroVideoPath(path)) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.src = url;
        video.load();
        return;
      }
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      scheduleDevLocalImageCacheBust(img, path);
    } catch {
      /* ignore */
    }
  }

  function createHomeHeroSlideMedia(src, { eager = false, priority = "low" } = {}) {
    const url = homeHeroMediaUrl(src);
    if (isHomeHeroVideoPath(src)) {
      const video = document.createElement("video");
      video.className = "ed-lp__hero-layer-img ed-lp__hero-layer-video";
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = eager;
      video.controls = false;
      video.preload = eager ? "auto" : "metadata";
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("disablepictureinpicture", "");
      video.disablePictureInPicture = true;
      const source = document.createElement("source");
      source.src = url;
      source.type = homeHeroVideoMime(src);
      video.appendChild(source);
      return video;
    }
    const img = document.createElement("img");
    img.className = "ed-lp__hero-layer-img";
    img.alt = "";
    img.src = url;
    scheduleDevLocalImageCacheBust(img, src);
    img.fetchPriority = priority;
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    return img;
  }

  function playHomeHeroVideo(video) {
    if (!video) return;
    const attempt = () => {
      video.play().catch(() => {});
    };
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) attempt();
    else {
      video.addEventListener("loadeddata", attempt, { once: true });
      video.addEventListener("canplay", attempt, { once: true });
    }
  }

  function syncHomeHeroSlideMedia(slides, activeIndex) {
    slides.forEach((slide, i) => {
      const video = slide.querySelector("video.ed-lp__hero-layer-video");
      if (!video) return;
      if (i === activeIndex) playHomeHeroVideo(video);
      else {
        video.pause();
        try {
          video.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    });
  }

  const HERO_SLIDE_MOTION_CLASSES = [
    "is-prep-enter-next",
    "is-prep-enter-prev",
    "is-exit-next",
    "is-exit-prev",
    "is-no-transition",
  ];

  function repairHomeHeroSlideVisibility(slides, preferredIndex = 0) {
    if (!slides.length) return;
    let index = slides.findIndex((s) => s.classList.contains("is-active"));
    if (index < 0) index = preferredIndex;
    slides.forEach((slide, i) => {
      slide.classList.remove(...HERO_SLIDE_MOTION_CLASSES);
      slide.classList.toggle("is-active", i === index);
      slide.setAttribute("aria-hidden", i === index ? "false" : "true");
    });
  }

  function initEditorialHomeHeroCarousel(slideCount) {
    const carouselUi = document.getElementById("ed-lp-hero-carousel");
    const heroHost = document.getElementById("ed-lp-hero-layers");
    const dotsHost = document.getElementById("ed-lp-hero-dots");
    if (!heroHost || slideCount < 1) return;

    const slides = [...heroHost.querySelectorAll(".ed-lp__hero-slide")];
    const n = slides.length;
    if (n < 1) return;

    if (carouselUi) carouselUi.hidden = n < 2;
    if (n < 2) {
      repairHomeHeroSlideVisibility(slides, 0);
      syncHomeHeroSlideMedia(slides, slides.findIndex((s) => s.classList.contains("is-active")) || 0);
      return;
    }

    if (heroHost.dataset.twHeroCarouselWired === "1") {
      repairHomeHeroSlideVisibility(slides);
      syncHomeHeroSlideMedia(slides, slides.findIndex((s) => s.classList.contains("is-active")) || 0);
      return;
    }
    heroHost.dataset.twHeroCarouselWired = "1";

    let index = slides.findIndex((s) => s.classList.contains("is-active"));
    if (index < 0) index = 0;

    let autoplayTimer = 0;
    let slideAnimTimer = 0;
    let animating = false;
    const reduceMotion = Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    const HERO_SLIDE_MS = 780;

    const slideMotionClasses = HERO_SLIDE_MOTION_CLASSES;

    const autoplayMs = () => 6000 + Math.floor(Math.random() * 2001);

    const syncHeroSlideUi = () => {
      slides.forEach((slide, i) => {
        const on = i === index;
        slide.setAttribute("aria-hidden", on ? "false" : "true");
      });
      dotsHost?.querySelectorAll(".ed-lp__hero-dot").forEach((dot, i) => {
        const on = i === index;
        dot.classList.toggle("is-active", on);
        dot.setAttribute("aria-selected", on ? "true" : "false");
        dot.setAttribute("tabindex", on ? "0" : "-1");
      });
      syncHomeHeroSlideMedia(slides, index);
      const nextPath = String(slides[index]?.dataset.heroSrc ?? "").trim();
      if (nextPath) preloadHomeHeroImage(nextPath);
    };

    const resetSlideMotionClasses = () => {
      slides.forEach((slide) => slide.classList.remove(...slideMotionClasses));
    };

    const finishSlideTransition = () => {
      if (slideAnimTimer) {
        clearTimeout(slideAnimTimer);
        slideAnimTimer = 0;
      }
      if (!animating) return;
      animating = false;
      slides.forEach((slide, i) => {
        slide.classList.remove(...slideMotionClasses);
        slide.classList.toggle("is-active", i === index);
      });
    };

    const setActiveInstant = (targetIndex) => {
      index = ((targetIndex % n) + n) % n;
      slides.forEach((slide, i) => {
        slide.classList.remove(...slideMotionClasses);
        slide.classList.toggle("is-active", i === index);
      });
      syncHeroSlideUi();
    };

    const directionFor = (from, to) => {
      if (from === to) return 1;
      const forward = (to - from + n) % n;
      const backward = (from - to + n) % n;
      return forward <= backward ? 1 : -1;
    };

    const goTo = (targetIndex, direction) => {
      const to = ((targetIndex % n) + n) % n;
      if (to === index) return;
      if (animating) return;

      if (reduceMotion) {
        setActiveInstant(to);
        return;
      }

      const from = index;
      const forward = direction === 1 || direction === -1 ? direction > 0 : directionFor(from, to);
      const outgoing = slides[from];
      const incoming = slides[to];

      animating = true;
      if (slideAnimTimer) {
        clearTimeout(slideAnimTimer);
        slideAnimTimer = 0;
      }

      slides.forEach((slide, i) => {
        if (i === from || i === to) return;
        slide.classList.remove("is-active", ...slideMotionClasses);
      });

      outgoing.classList.remove(...slideMotionClasses);
      incoming.classList.remove(...slideMotionClasses);

      incoming.classList.add("is-no-transition", forward ? "is-prep-enter-next" : "is-prep-enter-prev");
      void incoming.offsetWidth;
      incoming.classList.remove("is-no-transition");

      outgoing.classList.remove("is-active");
      outgoing.classList.add(forward ? "is-exit-next" : "is-exit-prev");
      incoming.classList.remove("is-prep-enter-next", "is-prep-enter-prev");
      incoming.classList.add("is-active");

      index = to;
      syncHeroSlideUi();

      const onTransitionEnd = (e) => {
        if (e.target !== incoming) return;
        incoming.removeEventListener("transitionend", onTransitionEnd);
        finishSlideTransition();
      };
      incoming.addEventListener("transitionend", onTransitionEnd);
      slideAnimTimer = setTimeout(() => {
        incoming.removeEventListener("transitionend", onTransitionEnd);
        finishSlideTransition();
      }, HERO_SLIDE_MS + 80);
    };

    const clearAutoplay = () => {
      if (!autoplayTimer) return;
      clearTimeout(autoplayTimer);
      autoplayTimer = 0;
    };

    const scheduleAutoplay = () => {
      clearAutoplay();
      if (reduceMotion || n < 2) return;
      autoplayTimer = setTimeout(() => {
        autoplayTimer = 0;
        goTo(index + 1, 1);
        scheduleAutoplay();
      }, autoplayMs());
    };

    const step = (delta, { manual = false } = {}) => {
      goTo(index + delta, delta > 0 ? 1 : -1);
      if (manual) scheduleAutoplay();
    };

    if (dotsHost) {
      dotsHost.replaceChildren();
      slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "ed-lp__hero-dot";
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-label", `View photograph ${i + 1} of ${n}`);
        dot.addEventListener("click", () => {
          goTo(i, directionFor(index, i));
          scheduleAutoplay();
        });
        dotsHost.appendChild(dot);
      });
    }

    carouselUi?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("#ed-lp-hero-prev")) {
        e.preventDefault();
        step(-1, { manual: true });
        return;
      }
      if (t.closest("#ed-lp-hero-next")) {
        e.preventDefault();
        step(1, { manual: true });
      }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    const onHeroTouchStart = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    };
    const onHeroTouchEnd = (e) => {
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) < 48) return;
      if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) step(1, { manual: true });
      else step(-1, { manual: true });
    };
    const heroSwipeSurface = document.querySelector(".ed-lp__hero") || heroHost;
    heroSwipeSurface.addEventListener("touchstart", onHeroTouchStart, { passive: true });
    heroSwipeSurface.addEventListener("touchend", onHeroTouchEnd, { passive: true });

    setActiveInstant(index);
    scheduleAutoplay();
  }

  function mountEditorialHomeHeroLayers(heroHost, paths = orderedHomeHeroImagePaths()) {
    if (heroHost.dataset.twHeroCarouselMounted === "1") {
      initEditorialHomeHeroCarousel(paths.length);
      return;
    }

    heroHost.replaceChildren();
    let firstError = false;
    const usablePaths = paths.filter((p) => String(p ?? "").trim());

    usablePaths.forEach((src, i) => {
      const slide = document.createElement("div");
      slide.className = "ed-lp__hero-slide" + (i === 0 ? " is-active" : "");
      slide.dataset.heroSlide = String(i);
      slide.dataset.heroSrc = src;
      slide.setAttribute("aria-hidden", i === 0 ? "false" : "true");

      const media = createHomeHeroSlideMedia(src, {
        eager: i === 0,
        priority: i === 0 ? "high" : "low",
      });

      const onFirstSlideMediaError = () => {
        if (i !== 0 || firstError) return;
        firstError = true;
        heroHost.dataset.twHeroCarouselMounted = "";
        heroHost.dataset.twHeroCarouselWired = "";
        const tail = usablePaths.slice(1);
        if (tail.length) {
          mountEditorialHomeHeroLayers(heroHost, tail);
          return;
        }
        mountEditorialHomeHeroCatalogFallback(heroHost);
        const carouselUi = document.getElementById("ed-lp-hero-carousel");
        if (carouselUi) carouselUi.hidden = true;
      };

      media.addEventListener("error", onFirstSlideMediaError, { once: true });

      slide.appendChild(media);
      heroHost.appendChild(slide);
      if (i > 0) preloadHomeHeroImage(src);
    });

    if (!usablePaths.length) {
      mountEditorialHomeHeroCatalogFallback(heroHost);
      return;
    }

    heroHost.dataset.twHeroCarouselMounted = "1";
    initEditorialHomeHeroCarousel(usablePaths.length);
    syncHomeHeroSlideMedia([...heroHost.querySelectorAll(".ed-lp__hero-slide")], 0);
  }

  function pickEditorialHeroBackdropItems(pool, maxN) {
    const withCover = pool.filter((it) => buildCoverCandidates(it).length > 0);
    const base = withCover.length ? withCover : pool.slice();
    const ranked = [...base].sort((a, b) => editorialHeroVisualScore(b) - editorialHeroVisualScore(a));
    const slice = ranked.slice(0, Math.min(48, Math.max(12, ranked.length)));
    shuffleArrayInPlace(slice);
    const use = Math.min(maxN, Math.max(1, slice.length));
    return slice.slice(0, use);
  }

  const RECENTLY_VIEWED_STORAGE_KEY = "twRecentlyViewed-v1";
  const RECENTLY_VIEWED_MAX = 12;

  /** @param {string} itemId */
  function recordRecentlyViewedItem(itemId) {
    const id = String(itemId ?? "").trim();
    if (!id) return;
    let ids = [];
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
      if (raw) ids = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    if (!Array.isArray(ids)) ids = [];
    ids = ids.filter((x) => String(x) !== id);
    ids.unshift(id);
    ids = ids.slice(0, RECENTLY_VIEWED_MAX);
    try {
      localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* private mode / quota */
    }
  }

  /** @param {object[]} pool @returns {object[]} */
  function getRecentlyViewedItemsFromPool(pool) {
    let ids = [];
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
      if (raw) ids = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    if (!Array.isArray(ids)) return [];
    const byId = new Map(
      (Array.isArray(pool) ? pool : [])
        .map((it) => [String(it?.id ?? "").trim(), it])
        .filter(([k]) => k)
    );
    const out = [];
    for (const id of ids) {
      const it = byId.get(String(id));
      if (it) out.push(it);
    }
    return out;
  }

  /** @param {object[]} pool @param {number} [fallbackN] */
  function resolveHomeRecentlyViewedItems(pool, fallbackN = 8) {
    const viewed = getRecentlyViewedItemsFromPool(pool);
    if (viewed.length) return viewed;
    return pickRecentAcquisitionItems(pool, fallbackN);
  }

  function pickRecentAcquisitionItems(pool, n) {
    const dated = pool
      .filter((it) => purchaseDateSortMs(it) != null)
      .sort(
        (a, b) =>
          /** @type {number} */ (purchaseDateSortMs(b)) - /** @type {number} */ (purchaseDateSortMs(a))
      );
    const out = dated.slice(0, n);
    if (out.length >= n) return out;
    const rest = pool.filter((it) => !out.includes(it));
    shuffleArrayInPlace(rest);
    for (const it of rest) {
      out.push(it);
      if (out.length >= n) break;
    }
    return out.slice(0, n);
  }

  function itemSeasonToken(item) {
    return String(item?.season ?? "").trim();
  }

  function itemSeasonalEntryBlob(item) {
    const slot = itemSlot(item);
    const rec = recordCategoryForDrill(item, slot);
    const label = friendlyRecordCategory(rec);
    return `${item?.name ?? ""} ${item?.fabric ?? ""} ${item?.category ?? ""} ${rec} ${label} ${item?.section ?? ""}`.toLowerCase();
  }

  function itemMatchesSeasonalKeywords(item, keywords) {
    const blob = itemSeasonalEntryBlob(item);
    return keywords.some((k) => blob.includes(String(k).toLowerCase()));
  }

  function itemMatchesSeasonalSection(item, sectionName) {
    const sec = String(sectionName ?? "").trim().toLowerCase();
    if (sec === "tailoring") return isTailoringSeasonalItem(item);
    if (sec === "outerwear") return isOuterwearSeasonalItem(item);
    if (sec === "tops") return isTopsSeasonalItem(item);
    if (sec === "shoes" || sec === "footwear") return isFootwearSeasonalItem(item);
    if (sec === "layering") return isLayeringSeasonalItem(item);
    if (sec === "bags") return isBagsSeasonalItem(item);
    if (sec === "eyewear") return isEyewearSeasonalItem(item);
    const raw = String(item?.category ?? "").trim().toLowerCase();
    const label = friendlyRecordCategory(recordCategoryForDrill(item, itemSlot(item))).toLowerCase();
    return raw === sec || label === sec;
  }

  function isTailoringSeasonalItem(item) {
    const raw = String(item?.category ?? "").trim();
    if (raw === "Jackets") return true;
    if (friendlyRecordCategory(recordCategoryForDrill(item, itemSlot(item))) === "Tailoring") return true;
    if (isOuterwearSeasonalItem(item)) return false;
    return itemMatchesSeasonalKeywords(item, ["Tweed", "Blazer", "Jacket"]);
  }

  function isOuterwearSeasonalItem(item) {
    const raw = String(item?.category ?? "").trim();
    if (raw === "Outerwear") return true;
    return friendlyRecordCategory(recordCategoryForDrill(item, itemSlot(item))) === "Outerwear";
  }

  function isTopsSeasonalItem(item) {
    const raw = String(item?.category ?? "").trim();
    if (raw === "Tops" || raw === "Shirts") return true;
    const label = friendlyRecordCategory(recordCategoryForDrill(item, itemSlot(item)));
    return label === "Tops";
  }

  function isFootwearSeasonalItem(item) {
    const raw = String(item?.category ?? "").trim();
    if (raw === "Footwear") return true;
    if (friendlyRecordCategory(recordCategoryForDrill(item, itemSlot(item))) === "Footwear") return true;
    return itemMatchesSeasonalKeywords(item, ["Sandal", "Sandals", "Loafer", "Shoe", "Espadrille"]);
  }

  function isLayeringSeasonalItem(item) {
    const raw = String(item?.category ?? "").trim();
    if (raw === "Mid Layer" || raw === "Inner Layer" || raw === "Layering") return true;
    return friendlyRecordCategory(recordCategoryForDrill(item, itemSlot(item))) === "Layering";
  }

  function isBagsSeasonalItem(item) {
    const label = friendlyRecordCategory(recordCategoryForDrill(item, itemSlot(item)));
    return label === "Bags" || String(item?.category ?? "").trim() === "Bags";
  }

  function isEyewearSeasonalItem(item) {
    const label = friendlyRecordCategory(recordCategoryForDrill(item, itemSlot(item)));
    return (
      label === "Eyewear" ||
      ["Sunglasses", "Glasses", "Eyeglasses"].includes(String(item?.category ?? "").trim())
    );
  }

  function isJewellerySeasonalItem(item) {
    const label = friendlyRecordCategory(recordCategoryForDrill(item, itemSlot(item)));
    return label === "Jewellery" || String(item?.category ?? "").trim() === "Jewellery";
  }

  /** Strict season tag only — no All-season or cross-season pieces on seasonal cards. */
  function itemMatchesStrictSeasonForSeasonalCard(item, seasonToken) {
    return itemSeasonToken(item) === seasonToken;
  }

  /** @param {"A/W" | "S/S"} seasonToken */
  function seasonalCardCategoryAllowed(item, seasonToken) {
    const slot = itemSlot(item);
    if (slot === SLOT_FRAGRANCE || isJewellerySeasonalItem(item)) return false;

    if (seasonToken === "A/W") {
      if (slot === SLOT_WATCHES) return true;
      if (isOuterwearSeasonalItem(item)) return true;
      if (isTailoringSeasonalItem(item)) return true;
      if (isLayeringSeasonalItem(item)) return true;
      if (isFootwearSeasonalItem(item)) return true;
      if (isBagsSeasonalItem(item)) return true;
      return false;
    }

    if (seasonToken === "S/S") {
      if (slot === SLOT_WATCHES) return true;
      if (isTopsSeasonalItem(item)) return true;
      if (isFootwearSeasonalItem(item)) return true;
      if (isBagsSeasonalItem(item)) return true;
      if (isEyewearSeasonalItem(item)) return true;
      if (slot === SLOT_ACCESSORIES) {
        const raw = String(item?.category ?? "").trim();
        if (["Hats", "Belts", "Scarves"].includes(raw)) return true;
      }
      return false;
    }

    return false;
  }

  /**
   * @param {object} item
   * @param {{ preferredKeywords?: string[] }} config
   */
  function seasonalCardPreferredScore(item, config = {}) {
    let s = 8;
    for (const kw of config.preferredKeywords || []) {
      if (itemMatchesSeasonalKeywords(item, [kw])) s += 14;
    }
    if (buildCoverCandidates(item).length > 0) s += 6;
    if (buildCoverCandidates(item).some((u) => isLikelySeasonalCutoutImageUrl(u))) s += 10;
    return s;
  }

  /** @param {object[]} pool @param {number} count @param {(item: object) => number} scoreFn */
  function weightedSampleWithoutReplacement(pool, count, scoreFn) {
    const bag = pool.map((it) => ({ it, w: Math.max(1, scoreFn(it)) }));
    const out = [];
    for (let n = 0; n < count && bag.length; n++) {
      const total = bag.reduce((sum, row) => sum + row.w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < bag.length; idx++) {
        r -= bag[idx].w;
        if (r <= 0) break;
      }
      const pick = bag.splice(Math.max(0, Math.min(idx, bag.length - 1)), 1)[0];
      if (pick) out.push(pick.it);
    }
    return out;
  }

  const SEASONAL_CARD_AW_CONFIG = {
    preferredKeywords: ["Barbour", "Tweed", "Balmacaan", "Harrington", "Brogue", "Boot", "BB58"],
  };

  const SEASONAL_CARD_SS_CONFIG = {
    preferredKeywords: ["Linen", "Knit", "Polo", "Tote", "GAT", "Sunglass", "Cartier", "Tank"],
  };

  /** @type {{ aw: string, ss: string }} */
  let lastSeasonalCardCompositionSig = { aw: "", ss: "" };
  let seasonalCardRefreshTimer = 0;

  /** @param {"A/W" | "S/S"} seasonToken @param {{ preferredKeywords?: string[] }} config */
  function buildSeasonalCardPool(seasonToken, config) {
    return getAllWardrobeItems().filter((it) => {
      if (!itemMatchesStrictSeasonForSeasonalCard(it, seasonToken)) return false;
      if (!seasonalCardCategoryAllowed(it, seasonToken)) return false;
      const covers = buildCoverCandidates(it);
      return covers.some((u) => isLikelySeasonalCutoutImageUrl(u));
    });
  }

  function seasonalCardCompositionSig(items) {
    return items
      .map((it) => String(it?.id ?? ""))
      .filter(Boolean)
      .sort()
      .join("|");
  }

  /** @param {"aw" | "ss"} sigKey @param {"A/W" | "S/S"} seasonToken @param {{ preferredKeywords?: string[] }} config */
  function pickRandomSeasonalCardComposition(sigKey, seasonToken, config) {
    const pool = buildSeasonalCardPool(seasonToken, config);
    if (!pool.length) return [];

    const maxCount = Math.min(4, pool.length);
    const minCount = Math.min(2, maxCount);
    const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

    let picked = [];
    let attempts = 0;
    const prevSig = lastSeasonalCardCompositionSig[sigKey];
    do {
      picked = weightedSampleWithoutReplacement(pool, count, (it) => seasonalCardPreferredScore(it, config));
      attempts += 1;
    } while (seasonalCardCompositionSig(picked) === prevSig && attempts < 12 && pool.length > count);

    lastSeasonalCardCompositionSig[sigKey] = seasonalCardCompositionSig(picked);
    return picked;
  }

  /** Editorial still-life slots (% of card); order shuffled at mount. */
  const SEASONAL_STILL_LAYOUTS = {
    2: [
      { x: 6, y: 4, w: 54, z: 1, rot: -3, scale: 1.04 },
      { x: 38, y: 10, w: 52, z: 2, rot: 2.5, scale: 0.98 },
    ],
    3: [
      { x: 4, y: 2, w: 46, z: 1, rot: -4, scale: 1.02 },
      { x: 32, y: 8, w: 44, z: 2, rot: 3, scale: 1 },
      { x: 52, y: 0, w: 40, z: 3, rot: -1.5, scale: 0.96 },
    ],
    4: [
      { x: 2, y: 0, w: 40, z: 1, rot: -5, scale: 1.03 },
      { x: 26, y: 6, w: 38, z: 2, rot: 2, scale: 0.97 },
      { x: 48, y: 2, w: 36, z: 3, rot: -2, scale: 1.01 },
      { x: 62, y: 12, w: 34, z: 4, rot: 4, scale: 0.94 },
    ],
  };

  /** @param {HTMLElement | null} host @param {object[]} items */
  function mountSeasonalCardStillLife(host, items) {
    if (!host) return;
    host.replaceChildren();
    if (!items.length) {
      host.classList.add("ed-lp__season-media--missing");
      return;
    }
    host.classList.remove("ed-lp__season-media--missing");

    const still = document.createElement("div");
    still.className = "ed-lp__season-still";
    const n = Math.min(4, Math.max(2, items.length));
    const layouts = SEASONAL_STILL_LAYOUTS[n] || SEASONAL_STILL_LAYOUTS[4];
    const pieces = items.slice(0, n);
    shuffleArrayInPlace(pieces);
    const displayPlans = assignSeasonalCardDisplayPlans(pieces);

    displayPlans.forEach((plan, i) => {
      const item = plan.item;
      const layout = layouts[i % layouts.length];
      const piece = document.createElement("div");
      piece.className = "ed-lp__season-piece";
      const jitter = () => (Math.random() - 0.5) * 5;
      piece.style.setProperty("--piece-x", `${layout.x + jitter() * 0.4}%`);
      piece.style.setProperty("--piece-y", `${layout.y + jitter() * 0.35}%`);
      piece.style.setProperty("--piece-w", `${layout.w * (0.96 + Math.random() * 0.08)}%`);
      piece.style.setProperty("--piece-z", String(layout.z));
      piece.style.setProperty("--piece-rot", `${layout.rot + jitter()}deg`);
      piece.style.setProperty("--piece-scale", String(layout.scale * (0.94 + Math.random() * 0.1)));

      const img = document.createElement("img");
      img.className = "ed-lp__season-piece-img";
      img.alt = "";
      img.loading = i === 0 ? "eager" : "lazy";
      img.decoding = "async";
      piece.appendChild(img);
      still.appendChild(piece);
      wireHomeEditorialCardImage(img, item, plan.displaySrc, { host: piece, missingClass: null });
    });

    host.appendChild(still);
  }

  function refreshHomeSeasonalCards() {
    const awMedia = document.getElementById("ed-lp-season-aw-media");
    const ssMedia = document.getElementById("ed-lp-season-ss-media");
    if (!awMedia && !ssMedia) return;
    mountSeasonalCardStillLife(
      awMedia,
      pickRandomSeasonalCardComposition("aw", "A/W", SEASONAL_CARD_AW_CONFIG)
    );
    mountSeasonalCardStillLife(
      ssMedia,
      pickRandomSeasonalCardComposition("ss", "S/S", SEASONAL_CARD_SS_CONFIG)
    );
  }

  function startSeasonalCardAutoRefresh() {
    if (seasonalCardRefreshTimer) return;
    seasonalCardRefreshTimer = globalThis.setInterval(() => {
      if (!document.body.classList.contains("home-page")) return;
      if (document.hidden) return;
      refreshHomeSeasonalCards();
    }, 90_000);
  }

  function buildItemDetailHrefFromId(id) {
    const u = new URL("item.html", globalThis.location.href);
    u.searchParams.set("id", String(id));
    return u.toString();
  }

  /** Homepage curated grids only — archive PLP always uses cover. */
  function homeEditorialCoverSrc(item) {
    const candidates = buildCoverCandidates(item);
    return candidates[0] || String(item?.image ?? "").trim();
  }

  /** Season still-life tiles need isolated product art — not lifestyle gallery frames. */
  function isLikelySeasonalCutoutImageUrl(url) {
    const u = String(url ?? "").toLowerCase();
    if (!isDisplayableCloudImageUrl(url)) return false;
    const cutoutHints = [
      "cutout",
      "isolate",
      "isolated",
      "packshot",
      "pack-shot",
      "ghost",
      "nobg",
      "no-bg",
      "transparent",
      "flat-lay",
      "flatlay",
    ];
    if (cutoutHints.some((h) => u.includes(h))) return true;
    if (/\.png($|\?|#)/i.test(u)) return true;
    const lifestyleHints = [
      "on-body",
      "onbody",
      "worn",
      "wearing",
      "outfit",
      "lookbook",
      "lifestyle",
      "editorial",
      "street",
      "mirror",
      "styled",
      "full",
      "fit",
    ];
    if (lifestyleHints.some((h) => u.includes(h))) return false;
    return false;
  }

  /** Cover-only display pick for seasonal cards (never `item.gallery`). */
  function seasonalCardDisplaySrc(item) {
    const candidates = buildCoverCandidates(item);
    const cutouts = candidates.filter((u) => isLikelySeasonalCutoutImageUrl(u));
    if (cutouts.length) {
      return cutouts[Math.floor(Math.random() * cutouts.length)];
    }
    return homeEditorialCoverSrc(item);
  }

  /**
   * Season cards: one cover/cutout URL per piece, no gallery mixing.
   * @param {object[]} items
   * @returns {{ item: object, displaySrc: string }[]}
   */
  function assignSeasonalCardDisplayPlans(items) {
    const list = Array.isArray(items) ? items : [];
    /** @type {Set<string>} */
    const usedUrls = new Set();
    return list.map((item) => {
      const candidates = buildCoverCandidates(item).filter((u) => isLikelySeasonalCutoutImageUrl(u));
      const pool = candidates.length
        ? candidates
        : [homeEditorialCoverSrc(item)].filter(Boolean);
      let displaySrc = pool.find((u) => !usedUrls.has(u)) || pool[0] || "";
      if (!displaySrc) displaySrc = seasonalCardDisplaySrc(item);
      if (displaySrc) usedUrls.add(displaySrc);
      return { item, displaySrc };
    });
  }

  /** Prefer on-body / outfit / detail gallery frames over duplicate cutouts. */
  function scoreHomeEditorialGalleryUrl(url, coverUrl) {
    const u = String(url ?? "").toLowerCase();
    if (!url || url === coverUrl) return -100;
    let s = 12;
    const positive = [
      "on-body",
      "onbody",
      "worn",
      "wearing",
      "outfit",
      "lookbook",
      "styled",
      "style",
      "detail",
      "close-up",
      "closeup",
      "macro",
      "texture",
      "angle",
      "lifestyle",
      "editorial",
      "street",
      "mirror",
      "full",
      "fit",
    ];
    const negative = [
      "cutout",
      "isolate",
      "packshot",
      "pack-shot",
      "ghost",
      "flat-lay",
      "flatlay",
      "product-only",
      "white-bg",
      "transparent",
    ];
    for (const k of positive) {
      if (u.includes(k)) s += 9;
    }
    for (const k of negative) {
      if (u.includes(k)) s -= 20;
    }
    if (/\.png($|\?)/i.test(u) && !positive.some((k) => u.includes(k))) s -= 5;
    return s;
  }

  /** @param {string[]} candidates @param {string} coverUrl */
  function pickWeightedHomeEditorialGalleryUrl(candidates, coverUrl) {
    const scored = candidates
      .map((url) => ({ url, score: Math.max(1, scoreHomeEditorialGalleryUrl(url, coverUrl)) }))
      .sort((a, b) => b.score - a.score);
    const top = scored.slice(0, Math.min(5, scored.length));
    if (!top.length) return candidates[0] || "";
    const total = top.reduce((sum, row) => sum + row.score, 0);
    let r = Math.random() * total;
    for (const row of top) {
      r -= row.score;
      if (r <= 0) return row.url;
    }
    return top[0].url;
  }

  function homeEditorialGalleryPool(item) {
    const cover = homeEditorialCoverSrc(item);
    return itemGalleryList(item).filter((u) => u && u !== cover && isDisplayableCloudImageUrl(u));
  }

  /**
   * Whole section uses one mode — never mix cutout covers with lifestyle gallery in the same row.
   * @param {object[]} items
   */
  function pickHomeEditorialSectionMode(items) {
    const list = Array.isArray(items) ? items : [];
    if (list.length < 2) return "cover";
    const withGallery = list.filter((it) => homeEditorialGalleryPool(it).length > 0);
    if (withGallery.length >= Math.max(2, Math.ceil(list.length * 0.5))) return "gallery";
    return "cover";
  }

  /**
   * @param {object[]} items
   * @param {{ mode?: "cover" | "gallery", galleryMax?: number }} [options]
   * @returns {{ mode: "cover" | "gallery", plans: { item: object, displaySrc: string, displayKind: "cover" | "gallery" }[] }}
   */
  function assignHomeSectionDisplayPlans(items, options = {}) {
    const list = Array.isArray(items) ? items : [];
    let mode = options.mode === "gallery" || options.mode === "cover" ? options.mode : pickHomeEditorialSectionMode(list);

    let working = list;
    if (mode === "gallery") {
      working = list.filter((it) => homeEditorialGalleryPool(it).length > 0);
      if (working.length < 2) {
        mode = "cover";
        working = list;
      }
    }

    if (mode === "gallery" && typeof options.galleryMax === "number" && options.galleryMax > 0) {
      working = working.slice(0, options.galleryMax);
    }

    /** @type {Set<string>} */
    const usedUrls = new Set();

    const plans = working.map((item) => {
      const cover = homeEditorialCoverSrc(item);
      let displaySrc = cover;
      let displayKind = /** @type {"cover" | "gallery"} */ ("cover");

      if (mode === "gallery") {
        const galleryPool = homeEditorialGalleryPool(item);
        const available = galleryPool.filter((u) => !usedUrls.has(u));
        const pickFrom = available.length ? available : galleryPool;
        displaySrc = pickWeightedHomeEditorialGalleryUrl(pickFrom, cover) || cover;
        displayKind = "gallery";
      }

      if (usedUrls.has(displaySrc)) {
        if (mode === "gallery") {
          const alt = homeEditorialGalleryPool(item).find((u) => !usedUrls.has(u));
          if (alt) displaySrc = alt;
        } else if (cover && !usedUrls.has(cover)) {
          displaySrc = cover;
        }
      }

      if (displaySrc) usedUrls.add(displaySrc);
      return { item, displaySrc, displayKind };
    });

    return { mode, plans };
  }

  /** @param {HTMLElement | null} host @param {"cover" | "gallery"} mode */
  function syncHomeEditorialProductGridLayout(host, mode) {
    if (!host) return;
    host.classList.toggle("ed-lp__product-grid--gallery", mode === "gallery");
    host.dataset.displayMode = mode;
  }

  /**
   * @param {HTMLElement | null} host
   * @param {object[]} items
   * @param {{ galleryMax?: number }} [options]
   */
  function mountHomeEditorialProductSection(host, items, options = {}) {
    if (!host) return;
    const section = assignHomeSectionDisplayPlans(items, options);
    syncHomeEditorialProductGridLayout(host, section.mode);
    host.replaceChildren();
    for (const plan of section.plans) {
      host.appendChild(buildEditorialHomeProductCard(plan.item, plan.displaySrc, plan.displayKind));
    }
  }

  const HOME_DIVISION_RAIL_SLOTS = [SLOT_CLOTHING, SLOT_ACCESSORIES, SLOT_WATCHES, SLOT_FRAGRANCE];

  /**
   * Random pieces per browse division — gallery frames only.
   * @param {object[]} pool
   * @param {{ perDivision?: number, maxTotal?: number }} [options]
   */
  function pickHomeDivisionRailPlans(pool, options = {}) {
    const perDivision = typeof options.perDivision === "number" ? options.perDivision : 3;
    const maxTotal = typeof options.maxTotal === "number" ? options.maxTotal : 14;
    const list = Array.isArray(pool) ? pool : [];
    /** @type {Set<string>} */
    const reservedItemIds =
      options.excludeItemIds instanceof Set
        ? options.excludeItemIds
        : new Set(
            (Array.isArray(options.excludeItemIds) ? options.excludeItemIds : [])
              .map((id) => String(id ?? "").trim())
              .filter(Boolean)
          );
    /** @type {{ item: object, displaySrc: string, slot: string }[]} */
    const plans = [];
    /** @type {Set<string>} */
    const usedItemIds = new Set(reservedItemIds);
    /** @type {Set<string>} */
    const usedUrls = new Set();

    for (const slot of HOME_DIVISION_RAIL_SLOTS) {
      const candidates = list.filter((it) => {
        const id = String(it?.id ?? "").trim();
        if (!id || usedItemIds.has(id)) return false;
        if (itemSlot(it) !== slot) return false;
        return homeEditorialGalleryPool(it).length > 0;
      });
      shuffleArrayInPlace(candidates);
      for (const item of candidates.slice(0, Math.max(1, perDivision))) {
        const galleryPool = homeEditorialGalleryPool(item);
        const available = galleryPool.filter((u) => !usedUrls.has(u));
        const pickFrom = available.length ? available : galleryPool;
        const displaySrc =
          pickWeightedHomeEditorialGalleryUrl(pickFrom, homeEditorialCoverSrc(item)) || pickFrom[0] || "";
        if (!displaySrc) continue;
        const id = String(item.id ?? "").trim();
        usedItemIds.add(id);
        usedUrls.add(displaySrc);
        plans.push({ item, displaySrc, slot });
      }
    }

    shuffleArrayInPlace(plans);
    return plans.slice(0, maxTotal);
  }

  /** @param {{ item: object, displaySrc: string, slot: string }} plan */
  function buildHomeDivisionRailCard(plan) {
    const { item, displaySrc, slot } = plan;
    const recKey = recordCategoryForDrill(item, slot);
    const label = friendlyRecordCategory(recKey) || recordTypeDisplayLabel(recKey) || categoryDisplayLabel(slot);

    const a = document.createElement("a");
    a.href = buildItemDetailHrefFromId(item.id);
    a.draggable = false;
    a.className = "ed-lp__division-rail-card";
    a.setAttribute("role", "listitem");
    a.setAttribute(
      "aria-label",
      `${displayNameWithoutLeadingColour(item)} — ${label} in ${categoryDisplayLabel(slot)}`
    );

    const media = document.createElement("div");
    media.className = "ed-lp__division-rail-media";
    const img = document.createElement("img");
    img.className = "ed-lp__division-rail-img";
    img.alt = imageAltForItem(item);
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    media.appendChild(img);
    wireHomeEditorialCardImage(img, item, displaySrc, {
      host: media,
      missingClass: "ed-lp__division-rail-media--missing",
      coverRenderWidth: 512,
      coverRenderHeight: 640,
      coverRenderQuality: 86,
      coverRenderResize: "cover",
    });

    const cap = document.createElement("span");
    cap.className = "ed-lp__division-rail-label";
    cap.textContent = String(label).trim().toUpperCase();

    a.appendChild(media);
    a.appendChild(cap);
    return a;
  }

  /** @param {HTMLElement} scroller */
  function prepareHomeHorizontalRailScroller(scroller) {
    scroller.querySelectorAll("img").forEach((img) => {
      img.setAttribute("draggable", "false");
    });
    scroller.querySelectorAll("a").forEach((link) => {
      link.setAttribute("draggable", "false");
    });
  }

  /** @param {HTMLElement | null} scroller */
  function wireHomeHorizontalRailScroller(scroller) {
    if (!scroller) return;
    prepareHomeHorizontalRailScroller(scroller);
    const section = scroller.closest("[data-ed-lp-horizontal-rail]");
    const track = section?.querySelector(".ed-lp__rail-progress");
    const thumb = section?.querySelector(".ed-lp__rail-progress-bar");
    if (scroller.dataset.horizontalRailWired === "1") return;
    scroller.dataset.horizontalRailWired = "1";

    scroller.addEventListener(
      "dragstart",
      (e) => {
        e.preventDefault();
      },
      true
    );

    let trackDragActive = false;
    /** @type {number | null} */
    let trackDragPointerId = null;
    let scrollerDragActive = false;
    /** @type {number | null} */
    let scrollerDragPointerId = null;
    let scrollerDragStartX = 0;
    let scrollerDragStartScroll = 0;
    let scrollerDragMoved = false;
    /** When true, wait for drag threshold before capture (keeps link clicks working). */
    let scrollerDragDeferCapture = false;

    function scrollMax() {
      return Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    }

    /** @param {number} ratio 0–1 */
    function scrollToRatio(ratio) {
      const max = scrollMax();
      scroller.scrollLeft = Math.max(0, Math.min(max, ratio * max));
    }

    function scrollRatio() {
      const max = scrollMax();
      return max > 0 ? scroller.scrollLeft / max : 0;
    }

    /** @param {number} clientX */
    function ratioFromClientX(clientX) {
      if (!(track instanceof HTMLElement) || !(thumb instanceof HTMLElement)) return 0;
      const rect = track.getBoundingClientRect();
      const thumbW = thumb.offsetWidth;
      const travel = Math.max(1, rect.width - thumbW);
      const x = clientX - rect.left - thumbW / 2;
      return Math.max(0, Math.min(1, x / travel));
    }

    function syncThumb() {
      if (!(thumb instanceof HTMLElement) || !(track instanceof HTMLElement) || scroller.scrollWidth <= 0) return;
      const thumbFrac = Math.max(0.12, scroller.clientWidth / scroller.scrollWidth);
      const travel = 1 - thumbFrac;
      const offset = scrollMax() > 0 ? scrollRatio() * travel : 0;
      thumb.style.width = `${thumbFrac * 100}%`;
      thumb.style.transform = `translateY(-50%) translateX(${offset * 100}%)`;
    }

    function syncUi() {
      const max = scrollMax();
      const canScroll = max > 4;
      if (track instanceof HTMLElement) {
        track.hidden = !canScroll;
        const pct = Math.round(scrollRatio() * 100);
        track.setAttribute("aria-valuenow", String(pct));
        track.setAttribute("aria-valuetext", `${pct}%`);
      }
      if (!trackDragActive) syncThumb();
    }

    function endScrollerDrag() {
      if (!scrollerDragActive) return;
      scrollerDragActive = false;
      scrollerDragDeferCapture = false;
      scroller.classList.remove("is-dragging");
      if (scrollerDragPointerId != null) {
        try {
          scroller.releasePointerCapture(scrollerDragPointerId);
        } catch {
          /* ignore */
        }
        scrollerDragPointerId = null;
      }
      if (scrollerDragMoved) {
        const blockClick = (/** @type {MouseEvent} */ ev) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
        };
        scroller.addEventListener("click", blockClick, { capture: true, once: true });
      }
      scrollerDragMoved = false;
      syncUi();
    }

    scroller.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || trackDragActive || e.pointerType === "touch") return;
      const link =
        e.target instanceof Element ? /** @type {HTMLAnchorElement | null} */ (e.target.closest("a")) : null;
      const dragFromLink = !!(link && scroller.contains(link));

      scrollerDragActive = true;
      scrollerDragMoved = false;
      scrollerDragDeferCapture = dragFromLink;
      scrollerDragStartX = e.clientX;
      scrollerDragStartScroll = scroller.scrollLeft;
      scrollerDragPointerId = e.pointerId;

      if (!dragFromLink) {
        e.preventDefault();
        scroller.classList.add("is-dragging");
        scroller.setPointerCapture(e.pointerId);
      }
    });

    scroller.addEventListener("pointermove", (e) => {
      if (!scrollerDragActive) return;
      const dx = e.clientX - scrollerDragStartX;
      if (!scrollerDragMoved && Math.abs(dx) > 3) {
        scrollerDragMoved = true;
        if (scrollerDragDeferCapture && scrollerDragPointerId != null) {
          scrollerDragDeferCapture = false;
          scroller.classList.add("is-dragging");
          try {
            scroller.setPointerCapture(scrollerDragPointerId);
          } catch {
            /* ignore */
          }
        }
      }
      if (!scrollerDragMoved) return;
      e.preventDefault();
      scroller.scrollLeft = scrollerDragStartScroll - dx;
      syncThumb();
      syncUi();
    });

    scroller.addEventListener("pointerup", endScrollerDrag);
    scroller.addEventListener("pointercancel", endScrollerDrag);
    scroller.addEventListener("lostpointercapture", endScrollerDrag);

    scroller.addEventListener("scroll", syncUi, { passive: true });
    window.addEventListener("resize", syncUi);

    if (track instanceof HTMLElement && thumb instanceof HTMLElement) {
      const endTrackDrag = () => {
        trackDragActive = false;
        track.classList.remove("is-dragging");
        thumb.classList.remove("is-dragging");
        if (trackDragPointerId != null) {
          try {
            track.releasePointerCapture(trackDragPointerId);
          } catch {
            /* ignore */
          }
          trackDragPointerId = null;
        }
        syncThumb();
        syncUi();
      };

      const onTrackPointerMove = (/** @type {PointerEvent} */ e) => {
        if (!trackDragActive) return;
        scrollToRatio(ratioFromClientX(e.clientX));
        syncThumb();
        syncUi();
      };

      track.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        trackDragActive = true;
        track.classList.add("is-dragging");
        thumb.classList.add("is-dragging");
        trackDragPointerId = e.pointerId;
        track.setPointerCapture(e.pointerId);
        scrollToRatio(ratioFromClientX(e.clientX));
        syncThumb();
        syncUi();
        e.preventDefault();
      });

      track.addEventListener("pointermove", onTrackPointerMove);
      track.addEventListener("pointerup", endTrackDrag);
      track.addEventListener("pointercancel", endTrackDrag);
      track.addEventListener("lostpointercapture", endTrackDrag);
    }

    syncUi();
  }

  /** @param {object[]} pool @param {{ excludeItemIds?: Iterable<string> | Set<string> }} [options] */
  function mountHomeDivisionRail(pool, options = {}) {
    const scroller = document.getElementById("ed-lp-division-rail");
    if (!scroller) return;
    const plans = pickHomeDivisionRailPlans(pool, options);
    scroller.replaceChildren();
    for (const plan of plans) {
      scroller.appendChild(buildHomeDivisionRailCard(plan));
    }
    wireHomeHorizontalRailScroller(scroller);
  }

  /** @param {object} item */
  function buildHomeRecentlyViewedCard(item) {
    const a = document.createElement("a");
    a.href = buildItemDetailHrefFromId(item.id);
    a.draggable = false;
    a.className = "ed-lp__viewed-card";
    a.setAttribute("role", "listitem");
    a.setAttribute("aria-label", `${String(item.brand ?? "").trim() || "—"} — ${displayNameWithoutLeadingColour(item)}`);

    const media = document.createElement("div");
    media.className = "ed-lp__viewed-card-media";
    const img = document.createElement("img");
    img.className = "ed-lp__viewed-card-img";
    img.alt = imageAltForItem(item);
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    media.appendChild(img);
    wireHomeEditorialCardImage(img, item, homeEditorialCoverSrc(item), {
      host: media,
      missingClass: "ed-lp__viewed-card-media--missing",
      coverRenderWidth: 640,
      coverRenderHeight: 853,
      coverRenderQuality: 86,
      coverRenderResize: "contain",
    });

    const body = document.createElement("div");
    body.className = "ed-lp__viewed-card-body";
    const brand = document.createElement("p");
    brand.className = "ed-lp__viewed-card-brand";
    brand.textContent = String(item.brand ?? "").trim() || "—";
    const title = document.createElement("p");
    title.className = "ed-lp__viewed-card-title";
    title.textContent = displayNameWithoutLeadingColour(item);
    const price = document.createElement("p");
    price.className = "ed-lp__viewed-card-price";
    const priceLine = formattedArchivePriceLine(item, { brief: true });
    if (priceLine) price.textContent = priceLine;
    else price.hidden = true;
    body.appendChild(brand);
    body.appendChild(title);
    if (!price.hidden) body.appendChild(price);

    a.appendChild(media);
    a.appendChild(body);
    return a;
  }

  /** @param {object[]} pool */
  function mountHomeRecentlyViewedRail(pool) {
    const section = document.getElementById("ed-lp-viewed-rail");
    const scroller = document.getElementById("ed-lp-recently-viewed");
    if (!section || !scroller) return;

    const list = resolveHomeRecentlyViewedItems(pool, 10).filter((it) => buildCoverCandidates(it).length > 0);
    if (!list.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    scroller.replaceChildren();
    for (const item of list) {
      scroller.appendChild(buildHomeRecentlyViewedCard(item));
    }
    wireHomeHorizontalRailScroller(scroller);
  }

  /**
   * @param {HTMLImageElement} img
   * @param {object} item
   * @param {string} displaySrc
   * @param {Parameters<typeof wireCoverImageWithFallbacks>[2]} wireOpts
   */
  function wireHomeEditorialCardImage(img, item, displaySrc, wireOpts) {
    img.classList.remove("is-loaded");
    const row = displaySrc ? { ...item, image: displaySrc } : item;
    const userResolved = wireOpts?.onResolved;
    wireCoverImageWithFallbacks(img, row, {
      ...wireOpts,
      onResolved: (url) => {
        img.classList.add("is-loaded");
        userResolved?.(url);
      },
    });
    if (img.complete && img.naturalWidth > 0) img.classList.add("is-loaded");
  }

  /** @param {object} item @param {string} [displaySrc] @param {"cover" | "gallery"} [displayKind] */
  function buildEditorialHomeProductCard(item, displaySrc, displayKind = "cover") {
    const slot = itemSlot(item);
    const recKey = recordCategoryForDrill(item, slot);
    const isGallery = displayKind === "gallery";
    const a = document.createElement("a");
    a.href = buildItemDetailHrefFromId(item.id);
    a.className = `ed-lp__pcard ed-lp__pcard--${isGallery ? "gallery" : "cover"}`;
    a.setAttribute("role", "listitem");
    const media = document.createElement("div");
    media.className = "ed-lp__pcard-media";
    const img = document.createElement("img");
    img.className = "ed-lp__pcard-img";
    img.alt = imageAltForItem(item);
    img.loading = "lazy";
    img.decoding = "async";
    media.appendChild(img);
    wireHomeEditorialCardImage(img, item, displaySrc || homeEditorialCoverSrc(item), {
      host: media,
      missingClass: "ed-lp__pcard-media--missing",
      coverRenderWidth: isGallery ? 840 : ARCHIVE_GRID_CARD_RENDER.width,
      coverRenderHeight: isGallery ? 1050 : ARCHIVE_GRID_CARD_RENDER.height,
      coverRenderQuality: isGallery ? 88 : ARCHIVE_GRID_CARD_RENDER.quality,
      coverRenderResize: isGallery ? "cover" : ARCHIVE_GRID_CARD_RENDER.resize,
    });
    const body = document.createElement("div");
    body.className = "ed-lp__pcard-body";
    const brand = document.createElement("p");
    brand.className = "ed-lp__pcard-brand";
    brand.textContent = String(item.brand ?? "").trim() || "—";
    const title = document.createElement("h3");
    title.className = "ed-lp__pcard-title";
    title.textContent = displayNameWithoutLeadingColour(item);
    const meta = document.createElement("p");
    meta.className = "ed-lp__pcard-meta";
    const fr = friendlyRecordCategory(recKey) || recKey;
    meta.textContent = `${fr} · ${categoryDisplayLabel(slot)}`;
    body.appendChild(brand);
    body.appendChild(title);
    body.appendChild(meta);
    a.appendChild(media);
    a.appendChild(body);
    return a;
  }

  /** Homepage: solid brand masthead; transparent nav over primary hero until scroll / overlays. */
  function teardownHomeHeroHeader() {
    const teardown = initHomeHeroHeader._teardown;
    if (typeof teardown === "function") teardown();
    initHomeHeroHeader._teardown = null;
    initHomeHeroHeader._wired = false;
  }

  function initHomeHeroHeader() {
    if (!document.body.classList.contains("home-page")) {
      teardownHomeHeroHeader();
      return;
    }
    const hero = document.querySelector(".site-home-stage .ed-lp__hero") || document.querySelector(".ed-lp__hero");
    const siteHeader = document.querySelector(".site-header");
    const shell = document.querySelector(".site-header-shell--home-overlay") || document.querySelector(".site-header-shell");
    if (!hero || !siteHeader || !shell) return;

    const syncHeights = () => {
      syncBrandSignatureBarHeight();
      const navH = siteHeader.offsetHeight;
      const shellH = shell.offsetHeight;
      document.body.style.setProperty("--home-header-nav-height", `${navH}px`);
      document.body.style.setProperty("--home-header-shell-height", `${shellH}px`);
    };

    let homeHeaderRowHover = false;
    const brandNavRow = document.querySelector(".site-header__brand-nav");

    const shouldUseSolidHeader = () => {
      if (!isFiltersNarrowViewport() && homeHeaderRowHover) return true;
      if (document.body.classList.contains("archive-ui--header-search-open")) return true;
      if (document.body.classList.contains("archive-ui--header-submenu-open")) return true;
      if (document.body.classList.contains("archive-ui--styling-board")) return true;
      const heroBottom = hero.getBoundingClientRect().bottom;
      return heroBottom <= siteHeader.offsetHeight + 4;
    };

    const update = () => {
      syncHeights();
      if (isFiltersNarrowViewport()) homeHeaderRowHover = false;
      const solid = shouldUseSolidHeader();
      siteHeader.classList.toggle("site-header--overlay", !solid);
      siteHeader.classList.toggle("site-header--solid", solid);
    };

    const onHomeHeaderRowEnter = () => {
      if (isFiltersNarrowViewport()) return;
      homeHeaderRowHover = true;
      update();
    };

    const onHomeHeaderRowLeave = (e) => {
      if (isFiltersNarrowViewport()) return;
      const to = e.relatedTarget;
      if (to instanceof Element && brandNavRow?.contains(to)) return;
      homeHeaderRowHover = false;
      update();
    };

    if (initHomeHeroHeader._wired) {
      update();
      return;
    }
    initHomeHeroHeader._wired = true;

    update();

    brandNavRow?.addEventListener("mouseenter", onHomeHeaderRowEnter);
    brandNavRow?.addEventListener("mouseleave", onHomeHeaderRowLeave);
    /** @type {ResizeObserver | null} */
    let ro = null;
    const utilityBar = document.querySelector(".site-utility-bar");
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(shell);
      ro.observe(siteHeader);
      ro.observe(hero);
      utilityBar && ro.observe(utilityBar);
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    const mo = new MutationObserver(update);
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    initHomeHeroHeader._teardown = () => {
      homeHeaderRowHover = false;
      brandNavRow?.removeEventListener("mouseenter", onHomeHeaderRowEnter);
      brandNavRow?.removeEventListener("mouseleave", onHomeHeaderRowLeave);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
      mo.disconnect();
      document.body.style.removeProperty("--home-header-nav-height");
      document.body.style.removeProperty("--home-header-shell-height");
    };
  }

  function mountHomePageHero() {
    if (!document.body.classList.contains("home-page")) return;
    const heroHost = document.getElementById("ed-lp-hero-layers");
    if (!heroHost) return;
    mountEditorialHomeHeroLayers(heroHost);
    initHomeHeroHeader();
  }

  function renderEditorialLandingPage() {
    if (!document.body.classList.contains("home-page")) return;
    mountHomePageHero();
    const root = document.getElementById("main");
    if (!root?.classList.contains("ed-lp")) return;

    const highHost = document.getElementById("ed-lp-highlights");
    const pool = items.filter((it) => buildCoverCandidates(it).length > 0);
    const hlPool = pool.length ? pool : items.slice();
    shuffleArrayInPlace(hlPool);
    const highlightItems = hlPool.slice(0, 8);
    if (highHost) {
      mountHomeEditorialProductSection(highHost, highlightItems, { galleryMax: 4 });
    }

    /** @type {Set<string>} */
    const highlightItemIds = new Set(
      highlightItems.map((it) => String(it?.id ?? "").trim()).filter(Boolean)
    );
    mountHomeDivisionRail(items, { excludeItemIds: highlightItemIds });

    mountHomeRecentlyViewedRail(items);

    refreshHomeSeasonalCards();
    startSeasonalCardAutoRefresh();
    syncCategoryTabUI();
  }

  function wireEditorialLandingPageArchiveLinks() {
    const main = document.getElementById("main");
    if (!main?.classList.contains("ed-lp") || main.dataset.edArchiveWired === "1") return;
    main.dataset.edArchiveWired = "1";
    main.addEventListener("click", (e) => {
      const link = /** @type {HTMLElement | null} */ (e.target.closest("a[data-ed-archive='1']"));
      if (!link || !main.contains(link)) return;
      e.preventDefault();

      const isSeasonalEntry =
        link.dataset.edSeasonalEntry === "1" || link.classList.contains("ed-lp__season-tile");
      const seasonOnly = String(link.getAttribute("data-season-filter") ?? "").trim();
      if (isSeasonalEntry && (seasonOnly === "A/W" || seasonOnly === "S/S")) {
        if (!document.getElementById("grid")) {
          navigateToArchiveSeason(seasonOnly);
          return;
        }
        enterSeasonalCollection(seasonOnly);
        renderGrid();
        syncToolbarActiveFilterChips();
        scrollArchiveViewportTop();
        return;
      }

      const jump = String(link.getAttribute("data-category-jump") ?? "").trim();
      const sub = String(link.getAttribute("data-subcategory-jump") ?? "").trim();
      const season = String(link.getAttribute("data-season-filter") ?? "").trim();
      const selectedSeason = normalizeSeasonNavToken(season);
      const clearsSeason = normalizeSeason(season) === "ALL";
      if (selectedSeason || clearsSeason) {
        if (!document.getElementById("grid") && selectedSeason) {
          navigateToArchiveSeason(season);
          return;
        }
        seasonNavFilter = selectedSeason;
        try {
          persistSeasonNav();
        } catch {
          /* ignore */
        }
        replaceArchiveSeasonQuery(seasonNavFilter);
        syncSeasonTabUI();
      }
      clearArchiveKeywordColourNarrowing();
      if (archiveSubmittedSearchNorm) exitArchiveSearchPlpRestoreBrowse({ skipRestore: true });
      categoryNavFilter = resolveCategoryJump(jump);
      subcategoryFilter = sub;
      noteArchiveSearchUserChoseMainSlotFilter();
      syncCategoryTabUI();
      syncFilterSearchClearVisibility();
      if (!document.getElementById("grid")) {
        validateSubcategoryFilter();
        writeArchiveBrowseRestoreSnapshot();
        navigateToArchiveMain();
        return;
      }
      validateSubcategoryFilter();
      renderCategoryDrill();
      renderGrid();
      scrollArchiveViewportTop();
    });
  }

  /** @type {{ itemId: string, colourKey?: string }[]} */
  let currentOutfitSlots = [];

  /** @type {{ id: string, name: string, slots: { itemId: string, colourKey?: string }[], createdAt: string }[]} */
  let savedOutfits = [];

  /** When set, the next "Save outfit" updates this saved row instead of creating a new one. */
  let editingSavedOutfitId = null;

  let toastTimer = null;

  /** @type {Element | null} */
  let archiveFilterDrawerFocusReturn = null;
  let archiveFilterDrawerOpenRaf = 0;

  /** @type {boolean} */
  let useCloudOutfits = false;
  let spendTotalAnimRaf = 0;
  let spendTotalAnimToken = 0;
  let spendTotalCurrentValue = 0;
  let stylingBoardDrawerOpen = false;
  let stylingBoardDrawerOpenRaf = 0;
  let stylingBoardDrawerFocusReturn = /** @type {Element | null} */ (null);

  /** Active main-nav slot filter (`itemSlot()`). Empty string = all slots — default archive view. */
  let categoryNavFilter = "";

  /** Top nav underline while desktop mega menu is open (hover); cleared when panel closes. */
  let headerNavOpenSlot = "";

  /** Top strip: "All", "S/S", or "A/W" — narrows archive before category tabs (persisted in localStorage). */
  let seasonNavFilter = loadPersistedSeasonNav();

  /** Within main category: filter by seed `category` (e.g. Jackets); empty = all types. */
  let subcategoryFilter = "";

  /**
   * When false: no record-type drill under the archive toolbar, no header hover mega-menu, and mobile skips the
   * expandable type list — top-level taps jump straight to the full slot grid. Inline `data-subcategory-jump` links and
   * the subcategory filter chip still work.
   */
  const ARCHIVE_RECORD_TYPE_SUBNAV_ENABLED = true;

  /** Item id currently shown on the item page (for edit / delete actions). */
  let detailItemId = null;

  const els = {
    grid: document.getElementById("grid"),
    emptyWrap: document.getElementById("empty-wrap"),
    emptyMsg: document.getElementById("empty-state-msg"),
    emptyReset: document.getElementById("empty-reset-filters"),
    count: document.getElementById("filter-count"),
    categoryChip: document.getElementById("filter-category-chip"),
    categoryChipText: document.getElementById("filter-category-chip-text"),
    searchChip: document.getElementById("filter-search-chip"),
    searchChipText: document.getElementById("filter-search-chip-text"),
    colourChip: document.getElementById("filter-colour-chip"),
    colourChipText: document.getElementById("filter-colour-chip-text"),
    subcategoryChip: document.getElementById("filter-subcategory-chip"),
    subcategoryChipText: document.getElementById("filter-subcategory-chip-text"),
    search: document.getElementById("filter-search"),
    searchClear: document.getElementById("filter-search-clear"),
    outfitStrip: document.getElementById("outfit-strip"),
    outfitEmpty: document.getElementById("outfit-empty"),
    outfitName: document.getElementById("outfit-name"),
    outfitNotes: document.getElementById("outfit-notes"),
    outfitSave: document.getElementById("outfit-save"),
    outfitClear: document.getElementById("outfit-clear"),
    outfitToast: document.getElementById("outfit-toast"),
    savedList: document.getElementById("saved-outfits-list"),
    savedEmpty: document.getElementById("saved-outfits-empty"),
    spendTotal: document.getElementById("filter-spend-total"),
  };

  let itemDetailDelegatesInstalled = false;
  let itemDetailPageKeyboardInstalled = false;
  let itemPageBackNavInstalled = false;

  function itemDetailMountRoot() {
    return document.getElementById("item-detail-root");
  }

  /** Standalone item.html: prefer browser back so the archive tab (and in-memory filters) is restored when possible. */
  function installItemPageBackNavigation() {
    if (itemPageBackNavInstalled) return;
    const back = document.querySelector(".site-header__archive-back, .item-page-header__back");
    if (!back) return;
    itemPageBackNavInstalled = true;
    back.addEventListener("click", (e) => {
      if (globalThis.history.length > 1) {
        e.preventDefault();
        globalThis.history.back();
      }
    });
  }

  /**
   * item.html hero zoom in-place (inside media frame), with pointer pan.
   * @param {HTMLElement} media
   * @param {HTMLImageElement} heroImg
   */
  function wireInlineItemHeroZoom(media, heroImg) {
    if (!(media instanceof HTMLElement) || !(heroImg instanceof HTMLImageElement)) return;
    media.classList.add("item-detail__media--zoomable");
    heroImg.classList.add("item-detail__hero-img--zoomable");
    heroImg.tabIndex = 0;
    heroImg.title = "Click to zoom, move mouse to inspect details";

    const setOriginFromEvent = (ev) => {
      const rect = media.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      const px = Math.max(0, Math.min(100, x));
      const py = Math.max(0, Math.min(100, y));
      heroImg.style.setProperty("--hero-zoom-x", `${px}%`);
      heroImg.style.setProperty("--hero-zoom-y", `${py}%`);
    };

    const openZoom = () => {
      media.classList.add("item-detail__media--zoomed");
      heroImg.classList.add("item-detail__hero-img--zoomed");
      heroImg.title = "Click to zoom out";
    };
    const closeZoom = () => {
      media.classList.remove("item-detail__media--zoomed");
      heroImg.classList.remove("item-detail__hero-img--zoomed");
      heroImg.style.removeProperty("--hero-zoom-x");
      heroImg.style.removeProperty("--hero-zoom-y");
      heroImg.title = "Click to zoom, move mouse to inspect details";
    };
    const toggleZoom = () => {
      if (media.classList.contains("item-detail__media--zoomed")) closeZoom();
      else openZoom();
    };

    heroImg.addEventListener("click", (ev) => {
      ev.preventDefault();
      toggleZoom();
    });
    heroImg.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggleZoom();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        closeZoom();
      }
    });
    media.addEventListener("pointermove", (ev) => {
      if (!media.classList.contains("item-detail__media--zoomed")) return;
      setOriginFromEvent(ev);
    });
  }

  function itemDetailIsPageRoot(root) {
    return root?.classList?.contains("item-detail__root--page") ?? false;
  }

  /** Scroll and focus for standalone item.html (not dialog). */
  function afterItemDetailPageRender(root, edit) {
    if (!itemDetailIsPageRoot(root)) return;
    globalThis.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (!edit) return;
    queueMicrotask(() => {
      document.getElementById("item-edit-brand")?.focus();
    });
  }

  function sortRecordTypeKeysForSlot(_browseSlot, keys) {
    const arr = [...new Set(keys.filter(Boolean))];
    arr.sort((a, b) => {
      const ra = RECORD_CATEGORY_RANK[a] ?? 800;
      const rb = RECORD_CATEGORY_RANK[b] ?? 800;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    return arr;
  }

  function normalizeSearch(s) {
    return s.trim().toLowerCase();
  }

  function extractHexDigitsFromColourText(s) {
    const out = [];
    const re = /#([0-9a-f]{3})\b|#([0-9a-f]{6})\b/gi;
    let m;
    const str = String(s ?? "");
    while ((m = re.exec(str))) {
      let h = (m[1] || m[2] || "").toLowerCase();
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      if (/^[0-9a-f]{6}$/.test(h)) out.push(h);
    }
    return out;
  }

  function hexRgbToBasicFamily(hex6) {
    if (!/^[0-9a-f]{6}$/i.test(hex6)) return null;
    const r = parseInt(hex6.slice(0, 2), 16) / 255;
    const g = parseInt(hex6.slice(2, 4), 16) / 255;
    const b = parseInt(hex6.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let s = 0;
    if (d > 1e-5) s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let hh = 0;
    if (d > 1e-5) {
      if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) hh = ((b - r) / d + 2) / 6;
      else hh = ((r - g) / d + 4) / 6;
    }
    if (l > 0.93 && s < 0.09) return "white";
    if (l < 0.11) return "black";
    if (s < 0.11 && l > 0.15 && l < 0.88) return "grey";
    if (hh < 0.03 || hh > 0.97) return "red";
    if (hh < 0.085) return "brown";
    if (hh < 0.17) return "beige";
    if (hh < 0.52) return "green";
    if (hh < 0.78) return "blue";
    return "red";
  }

  /**
   * Map one text segment (already lowercased is ok) to basic families. Hex codes in the string win first.
   * @param {string} segment
   * @returns {Set<string>}
   */
  function basicFamiliesFromColourSegment(segment) {
    const fams = new Set();
    const raw = String(segment ?? "").trim();
    if (!raw) return fams;
    for (const hx of extractHexDigitsFromColourText(raw)) {
      const f = hexRgbToBasicFamily(hx);
      if (f) fams.add(f);
    }
    const t = raw.toLowerCase();
    const textOnly = t.replace(/#[0-9a-f]{3,6}\b/gi, " ");
    if (!textOnly.trim() && fams.size) return fams;

    const specific = [
      [/navy|steel\s*blue|steel-blue|powder\s+blue|air\s*force|indigo|denim|azure|cobalt|sapphire|teal|turquoise|aqua|aquamarine|blue|丹寧|天藍|藍色|藍/, "blue"],
      [/brown|chocolate|espresso|mocha|cognac|mahogany|tobacco|chestnut|camel(?!\s*hair)|hazel\b|咖|咖啡色|咖啡|棕|褐色/, "brown"],
      [/yellow\s*gold|rose\s*gold|white\s*gold|\by\.?\s*g\.?\b|\byg\b|\b18k\b|\b14k\b|\b9k\b|\bgold\b|pvd\s*gold|黃金/, "gold"],
      [/\bplatinum\b|\bpt950\b|950\s*pt|sterling|925|\bsilver\b(?!\s*[-–]?\s*(?:grey|gray))|\bargent\b|白金|鉑金|銀(?!灰)/, "silver"],
      [/burgundy|maroon|wine|oxblood|scarlet|crimson|ruby|brick|terracotta|coral|salmon|magenta|fuchsia|rose(?!\s*gold)|pink|burgundy|red|紅|紅色|酒紅|玫瑰|粉|珊瑚/, "red"],
      [/white|ivory|optic\s*white|snow\b(?!\s*wash)|off\s*-?\s*white|cream(?!\s*cotton)|ecru|奶白|雪白|米白|白色|白/, "white"],
      [/black|noir|jet\b|ink\b|黑色|黑/, "black"],
      [/beige|tan\b|khaki|sand|oat|latte|natural(?!\s*waist)|bone|stone-wash|camel|khaki|米色|卡其|駝|奶茶|駝色/, "beige"],
      [/olive|sage|mint|moss|hunter|emerald|jade|forest|green|橄欖|橄欖綠|墨綠|草綠|綠|綠色/, "green"],
      [/grey|gray|charcoal|graphite|pewter|slate|heather|melange|anthracite|ash|銀灰|灰色|灰/, "grey"],
    ];
    for (const [re, fam] of specific) {
      if (re.test(textOnly)) {
        fams.add(fam);
        return fams;
      }
    }
    if (/orange|tangerine|mustard|yellow|lemon|marigold|柑橘|橙|黃|芥/.test(textOnly)) {
      fams.add("beige");
      return fams;
    }
    if (/violet|purple|lavender|plum|eggplant|aubergine|薰衣草|紫/.test(textOnly)) {
      fams.add("blue");
      return fams;
    }
    return fams;
  }

  /** User-picked broad colour(s) from item / metadata / variants (normalized keys). */
  /** @returns {Set<string>} */
  function explicitItemBasicColourFamilies(item) {
    const s = new Set();
    if (!item || typeof item !== "object") return s;
    const meta =
      item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata : null;
    const top = normalizeStoredBasicColourKey(item.basicColour ?? meta?.basicColour);
    if (top) s.add(top);
    const vars = getItemColourVariants(item);
    if (vars) {
      for (const v of vars) {
        const vb = normalizeStoredBasicColourKey(v.basicColour);
        if (vb) s.add(vb);
      }
    }
    return s;
  }

  /** @param {Set<string>} fams */
  function addRawChunksToBasicColourFamilySet(raw, fams) {
    const s = String(raw ?? "").trim();
    if (!s) return;
    const chunks = s
      .split(/[,/&·+]|\/+|\s+-\s+|\s+and\s+|\s+·\s+|[／、]/i)
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
    const parts = chunks.length ? chunks : [s];
    for (const p of parts) {
      for (const f of basicFamiliesFromColourSegment(p)) fams.add(f);
    }
  }

  /** Inferred families from colour / fabric / codes only (no stored `basicColour`). */
  /** @returns {Set<string>} */
  function inferItemBasicColourFamiliesFromContent(item) {
    const fams = new Set();
    addRawChunksToBasicColourFamilySet(item?.colour, fams);
    addRawChunksToBasicColourFamilySet(item?.fabric, fams);
    addRawChunksToBasicColourFamilySet(itemColourCode(item), fams);
    const vars = getItemColourVariants(item);
    if (vars) {
      for (const v of vars) {
        addRawChunksToBasicColourFamilySet(v.label, fams);
        addRawChunksToBasicColourFamilySet(v.colour || v.color, fams);
        addRawChunksToBasicColourFamilySet(v.colourCode || v.colorCode, fams);
      }
    }
    return fams;
  }

  /**
   * Families used for archive colour chips and filter. If the user set broad colour anywhere
   * (item, metadata, or a variant), only those keys are used; otherwise text/hex inference.
   * @returns {Set<string>}
   */
  function inferItemBasicColourFamilies(item) {
    if (itemOmitsBasicColourClassification(item)) return new Set();
    const explicit = explicitItemBasicColourFamilies(item);
    if (explicit.size > 0) return new Set(explicit);
    return inferItemBasicColourFamiliesFromContent(item);
  }

  /**
   * Broad-colour families for one colour variant (stored `basicColour` or text inferred from that row only).
   * @returns {Set<string>}
   */
  function colourFamiliesForVariantFields(v) {
    const fams = new Set();
    if (!v || typeof v !== "object") return fams;
    const vb = normalizeStoredBasicColourKey(v.basicColour);
    if (vb) {
      fams.add(vb);
      return fams;
    }
    addRawChunksToBasicColourFamilySet(v.label, fams);
    addRawChunksToBasicColourFamilySet(v.colour, fams);
    addRawChunksToBasicColourFamilySet(v.color, fams);
    addRawChunksToBasicColourFamilySet(v.colourCode, fams);
    addRawChunksToBasicColourFamilySet(v.colorCode, fams);
    return fams;
  }

  /** First variant whose families include `bucket` (e.g. active archive colour filter). */
  function firstVariantKeyMatchingBasicColourBucket(item, bucket) {
    if (!bucket) return "";
    const vars = getItemColourVariants(item);
    if (!vars?.length) return "";
    for (const v of vars) {
      if (colourFamiliesForVariantFields(v).has(bucket)) return String(v.key);
    }
    return "";
  }

  function itemMatchesBasicColourFilter(item, bucket) {
    if (!bucket) return true;
    const fams = inferItemBasicColourFamilies(item);
    if (fams.size === 0) return false;
    return fams.has(bucket);
  }

  /**
   * Colour chips reflect the same pool as the main grid: global search hits only when a keyword is active,
   * otherwise season/category/drill (excluding the colour filter itself).
   * @returns {Set<string>}
   */
  function availableBasicColourFamiliesForCurrentContext() {
    const submitted = String(archiveSubmittedSearchNorm ?? "").trim();
    if (submitted) {
      let pool = items.filter((it) => itemMatchesSearch(it, submitted));
      const wc = String(archiveSearchWithinRecordCategory ?? "").trim();
      if (wc) pool = pool.filter((it) => itemMatchesArchiveSearchWithinRecordCategory(it, wc));
      const f = getFilters();
      const out = new Set();
      for (const item of pool) {
        if (!itemPassesSeasonNav(item, f.seasonNav)) continue;
        if (!archiveSearchBrowseAllSlots && f.category && itemSlot(item) !== f.category) continue;
        if (f.subcategory && !itemMatchesDrillSubcategory(item, f.category, f.subcategory)) continue;
        for (const fam of inferItemBasicColourFamilies(item)) out.add(fam);
      }
      return out;
    }
    const q = effectiveArchiveKeywordSearchNorm();
    if (q) {
      const out = new Set();
      for (const item of items) {
        if (!itemMatchesSearch(item, q)) continue;
        for (const fam of inferItemBasicColourFamilies(item)) out.add(fam);
      }
      return out;
    }
    const f = getFilters();
    const out = new Set();
    for (const item of items) {
      if (!itemPassesSeasonNav(item, f.seasonNav)) continue;
      if (f.category && itemSlot(item) !== f.category) continue;
      if (f.subcategory && !itemMatchesDrillSubcategory(item, f.category, f.subcategory)) continue;
      if (!itemMatchesBasicColourFilter(item, f.basicColour)) continue;
      for (const fam of inferItemBasicColourFamilies(item)) out.add(fam);
    }
    return out;
  }

  /** @returns {Map<string, number>} */
  function basicColourFamilyCountsForCurrentContext() {
    const submitted = String(archiveSubmittedSearchNorm ?? "").trim();
    if (submitted) {
      let pool = items.filter((it) => itemMatchesSearch(it, submitted));
      const wc = String(archiveSearchWithinRecordCategory ?? "").trim();
      if (wc) pool = pool.filter((it) => itemMatchesArchiveSearchWithinRecordCategory(it, wc));
      const f = getFilters();
      const out = new Map();
      for (const item of pool) {
        if (!itemPassesSeasonNav(item, f.seasonNav)) continue;
        if (!archiveSearchBrowseAllSlots && f.category && itemSlot(item) !== f.category) continue;
        if (f.subcategory && !itemMatchesDrillSubcategory(item, f.category, f.subcategory)) continue;
        for (const fam of inferItemBasicColourFamilies(item)) {
          out.set(fam, (out.get(fam) ?? 0) + 1);
        }
      }
      return out;
    }
    const q = effectiveArchiveKeywordSearchNorm();
    if (q) {
      const out = new Map();
      for (const item of items) {
        if (!itemMatchesSearch(item, q)) continue;
        for (const fam of inferItemBasicColourFamilies(item)) {
          out.set(fam, (out.get(fam) ?? 0) + 1);
        }
      }
      return out;
    }
    const f = getFilters();
    const out = new Map();
    for (const item of items) {
      if (!itemPassesSeasonNav(item, f.seasonNav)) continue;
      if (f.category && itemSlot(item) !== f.category) continue;
      if (f.subcategory && !itemMatchesDrillSubcategory(item, f.category, f.subcategory)) continue;
      if (!itemMatchesBasicColourFilter(item, f.basicColour)) continue;
      for (const fam of inferItemBasicColourFamilies(item)) {
        out.set(fam, (out.get(fam) ?? 0) + 1);
      }
    }
    return out;
  }

  function splitSearchQueryTokens(q) {
    const n = normalizeSearch(String(q ?? ""));
    if (!n) return [];
    return n.split(/\s+/).filter(Boolean);
  }

  /** @param {unknown} item */
  function formatItemKeywordsForSearch(item) {
    const kw = item && typeof item === "object" ? /** @type {any} */ (item).keywords : null;
    if (kw == null) return "";
    if (Array.isArray(kw)) {
      return kw
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .join(" ");
    }
    return String(kw).trim();
  }

  function formatItemTagsForSearch(item) {
    const tags = item && typeof item === "object" ? /** @type {any} */ (item).tags : null;
    if (tags == null) return "";
    if (Array.isArray(tags)) {
      return tags
        .map((x) => {
          if (typeof x === "string") return x.trim();
          if (x && typeof x === "object") {
            return String(
              /** @type {any} */ (x).label ??
                /** @type {any} */ (x).name ??
                /** @type {any} */ (x).tag ??
                /** @type {any} */ (x).slug ??
                ""
            ).trim();
          }
          return "";
        })
        .filter(Boolean)
        .join(" ");
    }
    if (typeof tags === "string") return tags.trim();
    return "";
  }

  /**
   * Rough singular/plural fragments for substring match (e.g. bag↔bags, watch↔watches).
   * @param {string} token already normalizeSearch'd
   */
  function searchTokenInflectionFragments(token) {
    const t = normalizeSearch(token);
    const out = new Set();
    if (!t) return [];
    out.add(t);
    const add = (x) => {
      const u = normalizeSearch(String(x ?? ""));
      if (u.length >= 2) out.add(u);
    };
    if (t.length < 2) return [...out];

    if (t.endsWith("ies") && t.length > 4) add(t.slice(0, -3) + "y");
    if (/(?:ch|sh|x|z|s)es$/i.test(t) && t.length > 4) add(t.slice(0, -2));
    if (t.endsWith("s") && !t.endsWith("ss") && t.length > 3) add(t.slice(0, -1));

    if (!t.endsWith("s")) {
      add(t + "s");
      if (/(?:ch|sh|x|z)$/i.test(t)) add(t + "es");
    }
    return [...out];
  }

  function searchTokenMatchesHaystackNorm(hay, token) {
    const t = normalizeSearch(token);
    if (!t) return true;
    for (const frag of searchTokenInflectionFragments(t)) {
      if (frag && hay.includes(frag)) return true;
    }
    return false;
  }

  /** @param {unknown} item */
  function buildItemSearchHaystackNorm(item) {
    if (!item || typeof item !== "object") return "";
    const slot = itemSlot(/** @type {any} */ (item));
    const rawCat = String(/** @type {any} */ (item).category ?? "").trim();
    const hay = [
      /** @type {any} */ (item).name,
      /** @type {any} */ (item).brand,
      formatItemKeywordsForSearch(item),
      /** @type {any} */ (item).category,
      /** @type {any} */ (item).section,
      /** @type {any} */ (item).pillar,
      /** @type {any} */ (item).description,
      /** @type {any} */ (item).notes,
      formatItemTagsForSearch(item),
      slot,
      categoryDisplayLabel(slot),
      friendlyRecordCategory(String(rawCat)),
      /** @type {any} */ (item).season,
      /** @type {any} */ (item).colour,
      itemColourCode(/** @type {any} */ (item)),
      /** @type {any} */ (item).fabric,
      /** @type {any} */ (item).weight,
      /** @type {any} */ (item).size,
      /** @type {any} */ (item).measuredDimensions,
      formatMeasurementRowsBrief(/** @type {any} */ (item)),
      ...getMeasurementRows(/** @type {any} */ (item)).flatMap((r) => [r.label, r.value]),
      /** @type {any} */ (item).purchaseDate,
      ...(Number.isFinite(Number(/** @type {any} */ (item).price))
        ? [String(/** @type {any} */ (item).price), String(/** @type {any} */ (item).priceCurrency ?? "")]
        : []),
      ...(getItemColourVariants(/** @type {any} */ (item))?.map((v) =>
        [v.label, v.colour, v.color, v.colourCode, v.key].filter(Boolean).join(" ")
      ) ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay;
  }

  function itemMatchesSearch(item, q) {
    const raw = normalizeSearch(String(q ?? ""));
    if (!raw) return true;
    const id = item && typeof item === "object" && item.id != null ? String(item.id) : "";
    const hay = (id && wardrobeSearchIndex.get(id)) || buildItemSearchHaystackNorm(item);
    const tokens = splitSearchQueryTokens(raw);
    if (!tokens.length) return true;
    for (const tok of tokens) {
      if (!searchTokenMatchesHaystackNorm(hay, tok)) return false;
    }
    return true;
  }

  /**
   * While the header search overlay is open, keyword matching for `#grid` stays frozen so typing only updates
   * results inside the overlay (luxury modal behaviour).
   */
  let headerSearchOverlayArchiveSearchFrozen = false;
  /** @type {string} */
  let headerSearchOpenArchiveSearchNorm = "";
  /** Raw trimmed query at overlay open — drives the toolbar chip while frozen. */
  let headerSearchOverlayOpeningQueryRaw = /** @type {string | null} */ (null);
  let headerSearchOverlayUiDebounceTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);

  /** Committed keyword search for the main archive grid (Ralph Lauren–style PLP). Empty when browsing. */
  let archiveSubmittedSearchNorm = "";
  let archiveSubmittedSearchRaw = "";
  /** Raw `recordCategoryForDrill` token; empty means “All” within the current keyword hit pool. */
  let archiveSearchWithinRecordCategory = "";
  /** After first submit from browse: show hits across every slot until the user picks a main category tab. */
  let archiveSearchBrowseAllSlots = false;
  /** Snapshot of browse filters taken when entering submitted search from browse (restored on CLEAR). */
  let archiveSearchReturnSnapshot = /** @type {{ seasonNav: string; category: string; subcategory: string; basicColour: string } | null} */ (
    null
  );

  function effectiveArchiveKeywordSearchNorm() {
    if (headerSearchOverlayArchiveSearchFrozen) return headerSearchOpenArchiveSearchNorm;
    return archiveSubmittedSearchNorm;
  }

  /** Committed archive keyword search (main PLP), not header overlay typing. */
  function isArchiveSearchResultsMode() {
    return Boolean(String(archiveSubmittedSearchNorm ?? "").trim());
  }

  function normalizeSearchResultFilterKey(label) {
    return String(label ?? "").trim().toLowerCase();
  }

  function searchResultFilterLabelForItem(item) {
    const slot = itemSlot(item);
    const raw = String(recordCategoryForDrill(item, slot) ?? "").trim();
    if (!raw) return "";
    return friendlyRecordCategory(raw) || raw;
  }

  function itemMatchesArchiveSearchWithinRecordCategory(item, filterKey) {
    const want = normalizeSearchResultFilterKey(filterKey);
    if (!want) return true;
    return normalizeSearchResultFilterKey(searchResultFilterLabelForItem(item)) === want;
  }

  function searchResultFilterDisplayLabelFromKey(normKey) {
    const key = String(normKey ?? "").trim();
    if (!key) return "";
    const q = String(archiveSubmittedSearchNorm ?? "").trim();
    if (q) {
      for (const it of items) {
        if (!itemMatchesSearch(it, q)) continue;
        const lbl = searchResultFilterLabelForItem(it);
        if (normalizeSearchResultFilterKey(lbl) === key) return lbl;
      }
    }
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function cancelHeaderSearchOverlayUiDebounce() {
    if (headerSearchOverlayUiDebounceTimer != null) {
      clearTimeout(headerSearchOverlayUiDebounceTimer);
      headerSearchOverlayUiDebounceTimer = null;
    }
  }

  function resetHeaderSearchOverlayResultsDom() {
    const browse = document.getElementById("site-header-search-browse");
    const pane = document.getElementById("site-header-search-results-pane");
    const gridEl = document.getElementById("site-header-search-results-grid");
    const emptyEl = document.getElementById("site-header-search-results-empty");
    if (browse) browse.hidden = false;
    if (pane) pane.hidden = true;
    if (gridEl) gridEl.replaceChildren();
    if (emptyEl) emptyEl.hidden = true;
  }

  function isHeaderSearchWrapOpen() {
    return document.getElementById("site-header-search-wrap")?.classList.contains("is-open") ?? false;
  }

  function relocateFilterSearchFieldIntoHeaderOverlayPillWrap() {
    const host =
      document.querySelector(".site-header__search-row.site-header__search-field--rl") ||
      document.querySelector(".site-header__search-field--rl") ||
      document.querySelector(".site-header__search-pill-wrap");
    const field = document.querySelector(".filters__search-field");
    if (!host || !field) return;
    const slot =
      host.querySelector(".site-header__search-input-label") ||
      host.querySelector(".site-header__search-pill-wrap") ||
      host;
    if (field.parentElement === slot) return;
    slot.appendChild(field);
    const closeBtn = host.querySelector("#site-header-search-close, .site-header__search-close");
    if (closeBtn && closeBtn.parentElement === host) host.appendChild(closeBtn);
  }

  function relocateFilterSearchFieldIntoPlpAnchor() {
    const anchor = document.getElementById("archive-search-results-plp-field-anchor");
    const field = document.querySelector(".filters__search-field");
    if (!anchor || !field) return;
    if (field.parentElement === anchor) return;
    anchor.appendChild(field);
  }

  function syncFilterSearchFieldDomPlacement() {
    if (isHeaderSearchWrapOpen()) relocateFilterSearchFieldIntoHeaderOverlayPillWrap();
    else if (archiveSubmittedSearchNorm) relocateFilterSearchFieldIntoPlpAnchor();
    else relocateFilterSearchFieldIntoHeaderOverlayPillWrap();
  }

  function exitArchiveSearchPlpRestoreBrowse(options = {}) {
    const skipRestore = Boolean(options.skipRestore);
    cancelSearchGridDebounce();
    cancelHeaderSearchOverlayUiDebounce();
    archiveSubmittedSearchNorm = "";
    archiveSubmittedSearchRaw = "";
    archiveSearchWithinRecordCategory = "";
    archiveSearchBrowseAllSlots = false;
    document.body.classList.remove("archive-ui--search-results-plp");
    if (!skipRestore && archiveSearchReturnSnapshot) {
      const s = archiveSearchReturnSnapshot;
      seasonNavFilter = normalizeSeasonNavToken(s.seasonNav);
      categoryNavFilter = s.category;
      subcategoryFilter = s.subcategory;
      basicColourFilter = persistBasicColourFilter(s.basicColour || "");
      archiveSearchReturnSnapshot = null;
      try {
        persistSeasonNav();
      } catch {
        /* ignore */
      }
      syncSeasonTabUI();
      syncCategoryTabUI();
      validateSubcategoryFilter();
      renderCategoryDrill();
      syncBasicColourFilterChipUi();
    } else {
      archiveSearchReturnSnapshot = null;
    }
    if (els.search) els.search.value = "";
    resetHeaderSearchOverlayResultsDom();
    syncFilterSearchFieldDomPlacement();
    syncFilterSearchClearVisibility();
    syncSearchKeywordChip();
  }

  function submitArchiveSearchFromInput() {
    cancelSearchGridDebounce();
    cancelHeaderSearchOverlayUiDebounce();
    const raw = String(els.search?.value ?? "").trim();
    const norm = normalizeSearch(raw);

    if (isHeaderSearchWrapOpen()) {
      dismissHeaderSubmenuDom();
      forceCloseHeaderSearchOverlay({ submitted: Boolean(norm) });
    }

    if (!document.getElementById("grid")) {
      if (norm) {
        try {
          writeArchiveBrowseRestoreSnapshot({ search: raw });
        } catch {
          /* ignore */
        }
      }
      validateSubcategoryFilter();
      navigateToArchiveMain();
      return;
    }


    if (!norm) {
      if (archiveSubmittedSearchNorm) exitArchiveSearchPlpRestoreBrowse();
      syncFilterSearchClearVisibility();
      syncFilterSearchFieldDomPlacement();
      renderGrid();
      return;
    }

    const firstEntryFromBrowse = !archiveSubmittedSearchNorm;
    if (firstEntryFromBrowse) {
      archiveSearchReturnSnapshot = {
        seasonNav: seasonNavFilter,
        category: categoryNavFilter,
        subcategory: subcategoryFilter,
        basicColour: basicColourFilter,
      };
      seasonNavFilter = null;
      try {
        persistSeasonNav();
      } catch {
        /* ignore */
      }
      syncSeasonTabUI();
      subcategoryFilter = "";
      basicColourFilter = persistBasicColourFilter("");
      archiveSearchBrowseAllSlots = true;
      categoryNavFilter = "";
      syncCategoryTabUI();
      validateSubcategoryFilter();
    } else {
      archiveSearchWithinRecordCategory = "";
    }

    invalidateArchiveSortedCache();
    archiveSubmittedSearchNorm = norm;
    archiveSubmittedSearchRaw = raw;
    document.body.classList.remove("archive-ui--search-results-plp");
    renderCategoryDrill();
    syncFilterSearchFieldDomPlacement();
    syncArchiveSearchResultsPlpUi();
    syncFilterSearchClearVisibility();
    syncSearchKeywordChip();
    renderGrid();
    scrollArchiveViewportTop();
  }

  function syncArchiveSearchResultCategoryPills(pillsEl) {
    if (!pillsEl) return;
    pillsEl.replaceChildren();
    const q = String(archiveSubmittedSearchNorm ?? "").trim();
    if (!q) return;

    const hits = items.filter((it) => itemMatchesSearch(it, q));
    /** normKey → display label (first seen wins; "Tops" and "tops" merge) */
    const byKey = new Map();
    for (const it of hits) {
      const label = searchResultFilterLabelForItem(it);
      if (!label) continue;
      const key = normalizeSearchResultFilterKey(label);
      if (!byKey.has(key)) byKey.set(key, label);
    }
    const entries = [...byKey.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const activeKey = normalizeSearchResultFilterKey(archiveSearchWithinRecordCategory);

    function appendPill(label, filterKey, active) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "archive-search-results-plp__pill" + (active ? " is-active" : "");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", active ? "true" : "false");
      if (!filterKey) b.dataset.searchResultAll = "1";
      else b.dataset.searchResultCategory = filterKey;
      b.textContent = label;
      pillsEl.appendChild(b);
    }

    appendPill("All", "", !activeKey);
    for (const [key, label] of entries) {
      appendPill(label, key, activeKey === key);
    }
  }

  /** Archive PLP: count + spend always share a row with Filter & Sort (chips on the row below). */
  function syncArchiveCountLinePlacement() {
    const summary = document.querySelector(".items-toolbar__archive-summary--under-title");
    const controlBar = document.querySelector(
      ".items-toolbar > .items-toolbar__actions > .items-toolbar__control-bar"
    );
    if (!summary || !controlBar || !document.body.classList.contains("archive-page")) return;
    if (summary.parentElement !== controlBar) {
      controlBar.insertBefore(summary, controlBar.firstChild);
    }
  }

  function syncArchiveSearchResultsPlpUi() {
    const wrap = document.getElementById("archive-search-results-plp");
    const heading = document.getElementById("archive-search-results-heading");
    const pills = document.getElementById("archive-search-results-pills");
    if (wrap) wrap.hidden = true;
    if (heading) heading.replaceChildren();
    if (pills) pills.replaceChildren();
    syncToolbarActiveFilterChips();
    syncArchiveCountLinePlacement();
  }

  function noteArchiveSearchUserChoseMainSlotFilter() {
    if (archiveSubmittedSearchNorm) archiveSearchBrowseAllSlots = false;
  }

  /**
   * Header search overlay: match keywords against the full merged `items` list only (no season/category/colour/drill).
   */
  function listWardrobeItemsMatchingSearchIgnoringUiFilters(liveQueryRaw) {
    const q = normalizeSearch(String(liveQueryRaw ?? ""));
    if (!q) return [];
    const out = [];
    for (const it of items) {
      if (itemMatchesSearch(it, q)) out.push(it);
    }
    return out.sort(compareGridItems);
  }

  function createHeaderSearchOverlayResultLink(item) {
    const a = document.createElement("a");
    a.className = "site-header__search-result-card";
    const detailUrl = new URL("item.html", globalThis.location.href);
    detailUrl.searchParams.set("id", String(item.id));
    a.href = detailUrl.toString();
    const slot = itemSlot(item);
    const rec = recordCategoryForDrill(item, slot);
    const sectionLine = [categoryDisplayLabel(slot), friendlyRecordCategory(rec) || rec].filter(Boolean).join(" · ");

    const media = document.createElement("div");
    media.className = "site-header__search-result-card__media";
    const img = document.createElement("img");
    img.className = "site-header__search-result-card__img";
    img.alt = imageAltForItem(item);
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    wireCoverImageWithFallbacks(img, item, {
      host: media,
      missingClass: "site-header__search-result-card__media--missing",
      coverRenderWidth: 300,
      coverRenderHeight: 400,
      coverRenderQuality: 82,
      coverRenderResize: "contain",
    });
    media.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "site-header__search-result-card__meta";
    const brand = document.createElement("p");
    brand.className = "site-header__search-result-card__brand";
    brand.textContent = String(item.brand ?? "").trim();
    const name = document.createElement("p");
    name.className = "site-header__search-result-card__name";
    name.textContent = displayNameWithoutLeadingColour(item);
    meta.appendChild(brand);
    meta.appendChild(name);
    if (sectionLine) {
      const sec = document.createElement("p");
      sec.className = "site-header__search-result-card__section";
      sec.textContent = sectionLine;
      meta.appendChild(sec);
    }
    a.appendChild(media);
    a.appendChild(meta);
    return a;
  }

  function syncHeaderSearchOverlayResultsPane() {
    resetHeaderSearchOverlayResultsDom();
    queueMicrotask(() => syncSearchOverlayBackdropTop());
  }

  function flushHeaderSearchOverlayUiDebounceIfPending() {
    cancelHeaderSearchOverlayUiDebounce();
  }

  /** Basic colour archive filter: enabled on the archive grid (all category tabs + “All”); hidden on `item.html`. */
  function allowArchiveBasicColourFilter() {
    return Boolean(document.getElementById("grid"));
  }

  function getFilters() {
    const allowColour = allowArchiveBasicColourFilter();
    return {
      seasonNav: seasonNavFilter,
      category: categoryNavFilter,
      subcategory: subcategoryFilter,
      search: effectiveArchiveKeywordSearchNorm(),
      basicColour: allowColour ? basicColourFilter : "",
    };
  }

  /** Category / record-type drill / search / colour — not the season tab. */
  function narrowingFiltersActive() {
    const allowColour = allowArchiveBasicColourFilter();
    const cat = String(categoryNavFilter ?? "").trim();
    return Boolean(
      cat ||
        String(subcategoryFilter ?? "").trim() ||
        effectiveArchiveKeywordSearchNorm() ||
        String(archiveSearchWithinRecordCategory ?? "").trim() ||
        (allowColour && basicColourFilter) ||
        selectedBrandFilters.size > 0
    );
  }

  function describeNarrowingFiltersForUiSansSearch() {
    const bits = [];
    const cat = String(categoryNavFilter ?? "").trim();
    if (cat) bits.push(categoryDisplayLabel(cat));
    const sub = String(subcategoryFilter ?? "").trim();
    if (sub) bits.push(friendlyRecordCategory(sub) || sub);
    if (allowArchiveBasicColourFilter() && basicColourFilter) bits.push(basicColourLabelEn(basicColourFilter));
    if (selectedBrandFilters.size > 0) {
      const brands = [...selectedBrandFilters].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      if (brands.length === 1) bits.push(brands[0]);
      else bits.push(`${brands.length} brands`);
    }
    return bits.join(" · ");
  }

  function hideLegacyFilterCountRowChips() {
    const unified = document.getElementById("items-toolbar-active-filter-chips");
    if (!unified || document.body.classList.contains("archive-ui--search-results-plp")) return false;
    for (const key of ["searchChip", "categoryChip", "colourChip", "subcategoryChip"]) {
      const btn = els[key];
      const textEl = els[`${key}Text`];
      if (textEl) textEl.textContent = "";
      if (btn) {
        btn.hidden = true;
        btn.removeAttribute("aria-label");
      }
    }
    return true;
  }

  function syncSearchKeywordChip() {
    const btn = els.searchChip;
    const textEl = els.searchChipText;
    if (!btn || !textEl) return;
    if (hideLegacyFilterCountRowChips()) return;
    if (archiveSubmittedSearchNorm && !isHeaderSearchWrapOpen()) {
      textEl.textContent = "";
      btn.hidden = true;
      btn.removeAttribute("aria-label");
      return;
    }
    const rawQ =
      headerSearchOverlayArchiveSearchFrozen && headerSearchOverlayOpeningQueryRaw != null
        ? headerSearchOverlayOpeningQueryRaw
        : (els.search?.value?.trim() ?? "");
    if (rawQ) {
      textEl.textContent = rawQ;
      btn.hidden = false;
      btn.setAttribute("aria-label", `Remove search “${rawQ}”`);
    } else {
      textEl.textContent = "";
      btn.hidden = true;
      btn.removeAttribute("aria-label");
    }
  }

  function syncCategoryFilterChip() {
    const btn = els.categoryChip;
    const textEl = els.categoryChipText;
    if (!btn || !textEl) return;
    if (hideLegacyFilterCountRowChips()) return;
    const cat = String(categoryNavFilter ?? "").trim();
    if (cat) {
      const label = categoryDisplayLabel(cat) || cat;
      textEl.textContent = label;
      btn.hidden = false;
      btn.setAttribute("aria-label", `Remove category filter “${label}”`);
    } else {
      textEl.textContent = "";
      btn.hidden = true;
      btn.removeAttribute("aria-label");
    }
  }

  function syncColourFilterChip() {
    const btn = els.colourChip;
    const textEl = els.colourChipText;
    if (!btn || !textEl) return;
    if (hideLegacyFilterCountRowChips()) return;
    const allowColour = allowArchiveBasicColourFilter();
    if (allowColour && basicColourFilter) {
      const label = basicColourLabelEn(basicColourFilter);
      textEl.textContent = label;
      btn.hidden = false;
      btn.setAttribute("aria-label", `Remove colour filter “${label}”`);
    } else {
      textEl.textContent = "";
      btn.hidden = true;
      btn.removeAttribute("aria-label");
    }
  }

  function syncSubcategoryFilterChip() {
    const btn = els.subcategoryChip;
    const textEl = els.subcategoryChipText;
    if (!btn || !textEl) return;
    if (hideLegacyFilterCountRowChips()) return;
    const raw = String(subcategoryFilter ?? "").trim();
    if (raw) {
      const label = friendlyRecordCategory(raw) || raw;
      textEl.textContent = label;
      btn.hidden = false;
      btn.setAttribute("aria-label", `Remove subcategory filter “${label}”`);
    } else {
      textEl.textContent = "";
      btn.hidden = true;
      btn.removeAttribute("aria-label");
    }
  }

  /** RL-style removable chips below category / search pills (does not replace filter logic). */
  function syncToolbarActiveFilterChips() {
    const browseHost = document.getElementById("items-toolbar-active-filter-chips");
    const searchHost = document.getElementById("archive-search-results-active-chips");
    if (!browseHost && !searchHost) return;

    function renderChipRow(host, defs, { onClearAll } = {}) {
      if (!host) return;
      host.replaceChildren();
      for (const def of defs) {
        const row = document.createElement("div");
        row.className = "items-toolbar__active-chip";
        row.setAttribute("role", "group");
        const lab = document.createElement("span");
        lab.className = "items-toolbar__active-chip__text";
        lab.textContent = def.label;
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "items-toolbar__active-chip__remove";
        rm.setAttribute("aria-label", def.removeLabel || `Remove ${def.label}`);
        rm.innerHTML =
          "<svg width=\"10\" height=\"10\" viewBox=\"0 0 10 10\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M1.25 1.25 8.75 8.75M8.75 1.25 1.25 8.75\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\"/></svg>";
        rm.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          def.onRemove();
        });
        row.appendChild(lab);
        row.appendChild(rm);
        host.appendChild(row);
      }
      if (defs.length > 1 && typeof onClearAll === "function") {
        const clearAll = document.createElement("button");
        clearAll.type = "button";
        clearAll.className = "items-toolbar__active-chips-clear";
        clearAll.textContent = "Clear All";
        clearAll.setAttribute("aria-label", "Clear all active filters");
        clearAll.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClearAll();
        });
        host.appendChild(clearAll);
      }
      const show = defs.length > 0;
      host.hidden = !show;
    }

    const submitted = String(archiveSubmittedSearchNorm ?? "").trim();
    const searchPlp = Boolean(submitted) && document.body.classList.contains("archive-ui--search-results-plp");

    const searchDefs = [];
    if (searchPlp && searchHost) {
      const wc = String(archiveSearchWithinRecordCategory ?? "").trim();
      if (wc) {
        const label = searchResultFilterDisplayLabelFromKey(wc);
        searchDefs.push({
          label,
          removeLabel: `Remove ${label} filter`,
          onRemove() {
            archiveSearchWithinRecordCategory = "";
            syncArchiveSearchResultsPlpUi();
            renderGrid();
          },
        });
      }
      renderChipRow(searchHost, searchDefs, {
        onClearAll() {
          archiveSearchWithinRecordCategory = "";
          resetAllArchiveFilters();
        },
      });
    } else if (searchHost) {
      searchHost.replaceChildren();
      searchHost.hidden = true;
    }

    const browseDefs = [];

    const season = normalizeSeasonNavToken(seasonNavFilter);
    if (season) {
      const label = season === "SS" ? "S/S" : "A/W";
      browseDefs.push({
        label,
        removeLabel: `Remove ${label} season filter`,
        onRemove() {
          seasonNavFilter = null;
          try {
            persistSeasonNav();
          } catch {
            /* ignore */
          }
          syncSeasonTabUI();
          replaceArchiveSeasonQuery(seasonNavFilter);
          renderGrid();
        },
      });
    }

    const cat = String(categoryNavFilter ?? "").trim();
    if (cat) {
      const catLabel = categoryDisplayLabel(cat) || cat;
      browseDefs.push({
        label: catLabel,
        removeLabel: `Remove category filter “${catLabel}”`,
        onRemove() {
          withPreservedArchiveScroll(() => {
            categoryNavFilter = "";
            subcategoryFilter = "";
            syncCategoryTabUI();
            renderCategoryDrill();
            syncFiltersMenuForViewport();
            renderGrid();
          });
        },
      });
    }

    const sub = String(subcategoryFilter ?? "").trim();
    if (sub) {
      const label = friendlyRecordCategory(sub) || sub;
      browseDefs.push({
        label,
        removeLabel: `Remove ${label} filter`,
        onRemove() {
          withPreservedArchiveScroll(() => {
            subcategoryFilter = "";
            validateSubcategoryFilter();
            renderCategoryDrill();
            syncFiltersMenuForViewport();
            renderGrid();
          });
        },
      });
    }

    const brandKeys = [...selectedBrandFilters].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    for (const brand of brandKeys) {
      browseDefs.push({
        label: brand,
        removeLabel: `Remove brand filter “${brand}”`,
        onRemove() {
          toggleBrandFilter(brand);
          syncArchiveBrandFilterChipUi();
          renderGrid();
        },
      });
    }

    if (!searchPlp) {
      const submittedNorm = String(archiveSubmittedSearchNorm ?? "").trim();
      if (submittedNorm) {
        const rawQ = archiveSubmittedSearchRaw || submittedNorm;
        browseDefs.push({
          label: rawQ,
          removeLabel: `Remove search “${rawQ}”`,
          onRemove() {
            clearArchiveKeywordSearchThenRender();
          },
        });
      }
    }

    const allowColour = allowArchiveBasicColourFilter();
    if (allowColour && basicColourFilter) {
      const label = basicColourLabelEn(basicColourFilter);
      browseDefs.push({
        label,
        removeLabel: `Remove colour filter ${label}`,
        onRemove() {
          basicColourFilter = persistBasicColourFilter("");
          syncBasicColourFilterChipUi();
          renderGrid();
        },
      });
    }

    const clearAllActiveFilters = () => resetAllArchiveFilters();

    if (searchPlp) {
      if (browseHost) {
        browseHost.replaceChildren();
        browseHost.hidden = true;
      }
    } else {
      renderChipRow(browseHost, browseDefs, { onClearAll: clearAllActiveFilters });
    }
    hideLegacyFilterCountRowChips();
  }

  function clearArchiveKeywordSearchThenRender(options = {}) {
    const { focusInput = true } = options;
    if (!els.search) return;
    cancelSearchGridDebounce();
    cancelHeaderSearchOverlayUiDebounce();
    if (archiveSubmittedSearchNorm) {
      exitArchiveSearchPlpRestoreBrowse();
    } else {
      els.search.value = "";
    }
    syncFilterSearchClearVisibility();
    syncFilterSearchFieldDomPlacement();
    renderGrid();
    if (focusInput) els.search.focus();
  }

  function countItemsForCurrentSeasonTab() {
    return items.filter((it) => itemPassesSeasonNav(it, seasonNavFilter)).length;
  }

  /** Clears basic colour narrowing only (search text is managed by commit / CLEAR). */
  function clearArchiveKeywordColourNarrowing() {
    cancelSearchGridDebounce();
    basicColourFilter = persistBasicColourFilter("");
  }

  /**
   * Exit search / PLP and strip category, colour, and in-progress search UI.
   * Does not change season tab or sort — use `enterSeasonalCollection` for seasonal entry tiles.
   */
  function clearArchiveBrowseFiltersForSeasonalEntry() {
    cancelSearchGridDebounce();
    cancelHeaderSearchOverlayUiDebounce();
    archiveSubmittedSearchNorm = "";
    archiveSubmittedSearchRaw = "";
    archiveSearchWithinRecordCategory = "";
    archiveSearchBrowseAllSlots = false;
    archiveSearchReturnSnapshot = null;
    document.body.classList.remove("archive-ui--search-results-plp");
    if (els.search) els.search.value = "";
    resetHeaderSearchOverlayResultsDom();
    basicColourFilter = persistBasicColourFilter("");
    clearBrandFilters();
    categoryNavFilter = "";
    subcategoryFilter = "";
    forceCloseHeaderSearchOverlay();
    syncFilterSearchClearVisibility();
    syncFilterSearchFieldDomPlacement();
    syncSearchKeywordChip();
    syncBasicColourFilterChipUi();
    syncCategoryFilterChip();
    syncColourFilterChip();
    syncSubcategoryFilterChip();
  }

  /**
   * Homepage seasonal tiles → archive: fresh browse with only A/W or S/S active (one chip).
   * @param {"A/W" | "S/S"} seasonToken
   */
  function enterSeasonalCollection(seasonToken) {
    const selectedSeason = normalizeSeasonNavToken(seasonToken);
    if (!selectedSeason) return;
    clearArchiveBrowseFiltersForSeasonalEntry();
    seasonNavFilter = selectedSeason;
    try {
      persistSeasonNav();
    } catch {
      /* ignore */
    }
    replaceArchiveSeasonQuery(seasonNavFilter);
    archiveSortMode = persistArchiveSortMode(ARCHIVE_DEFAULT_SORT_MODE);
    syncArchiveSortChipUi();
    syncSeasonTabUI();
    syncCategoryTabUI();
    validateSubcategoryFilter();
    renderCategoryDrill();
    syncFiltersMenuForViewport();
    document.body.classList.remove("archive-ui--nav-folded");
    closeArchiveFilterDrawer();
    collapseFiltersMenuPanel();
  }

  /** Persist a clean archive snapshot for seasonal entry navigation (no inherited filters). */
  function writeSeasonalEntryBrowseRestoreSnapshot(seasonToken) {
    writeArchiveBrowseRestoreSnapshot({
      seasonNav: normalizeSeasonNavToken(seasonToken) || null,
      category: "",
      subcategory: "",
      search: "",
      basicColour: "",
    });
  }

  function archiveSeasonHref(seasonToken) {
    const normalized = normalizeSeasonNavToken(seasonToken);
    const query = seasonNavQueryToken(normalized);
    return query ? `${ARCHIVE_PAGE_PATH}?season=${query}` : ARCHIVE_HOME_MAIN_URL;
  }

  function navigateToArchiveSeason(seasonToken) {
    const href = archiveSeasonHref(seasonToken);
    try {
      globalThis.location.assign(href);
    } catch {
      globalThis.location.href = href;
    }
  }

  function replaceArchiveSeasonQuery(seasonToken) {
    if (!isArchiveLocation()) return;
    const normalized = normalizeSeasonNavToken(seasonToken);
    try {
      const u = new URL(globalThis.location.href);
      const query = seasonNavQueryToken(normalized);
      if (query) u.searchParams.set("season", query);
      else u.searchParams.delete("season");
      globalThis.history.replaceState(null, "", `${u.pathname}${u.search}`);
    } catch {
      /* ignore */
    }
  }

  function resetNarrowingFilters() {
    clearArchiveKeywordColourNarrowing();
    clearBrandFilters();
    if (archiveSubmittedSearchNorm) exitArchiveSearchPlpRestoreBrowse({ skipRestore: true });
    categoryNavFilter = "";
    subcategoryFilter = "";
    syncBasicColourFilterChipUi();
    syncCategoryTabUI();
    validateSubcategoryFilter();
    renderCategoryDrill();
    syncFiltersMenuForViewport();
    renderGrid();
    collapseFiltersMenuPanel();
  }

  /** Archive “reset view”: season All, all slots, no narrowing filters; sort returns to default. */
  function resetAllArchiveFilters() {
    seasonNavFilter = null;
    persistSeasonNav();
    replaceArchiveSeasonQuery(seasonNavFilter);
    syncSeasonTabUI();
    archiveSortMode = persistArchiveSortMode(ARCHIVE_DEFAULT_SORT_MODE);
    syncArchiveSortChipUi();
    document.body.classList.remove("archive-ui--nav-folded");
    closeArchiveFilterDrawer();
    resetNarrowingFilters();
  }

  /** Normalized season tags on a piece (`SS` | `AW` | `ALL`). */
  function normalizedItemSeasonTags(item) {
    const raw = item?.season;
    const seasons = Array.isArray(raw) ? raw : [raw];
    return seasons
      .map((s) => normalizeStoredItemSeason(s ?? ""))
      .map(normalizeSeason)
      .filter(Boolean);
  }

  /** Season tab: null shows everything; SS/AW match themselves plus all-season pieces. */
  function itemPassesSeasonNav(item, nav) {
    const selectedSeason = normalizeSeasonNavToken(nav);
    if (!selectedSeason) return true;
    const normalized = normalizedItemSeasonTags(item);
    // Legacy archive: blank / unknown season tags behave like all-season.
    if (!normalized.length) return true;
    return normalized.includes(selectedSeason) || normalized.includes("ALL");
  }

  /** UI / export: blank, `All-season`, or `All` → label "All seasons". */
  function seasonUiLabel(raw) {
    const normalized = normalizeSeason(raw);
    if (normalized === "SS") return "Spring / Summer";
    if (normalized === "AW") return "A/W";
    return "All seasons";
  }

  /** Stored value for “all seasons” on a piece; matches add/edit season `<select>` default. */
  const DEFAULT_STORED_SEASON = "All-season";

  /** Empty or legacy `All` → `All-season` for DB / JSON rows. */
  function normalizeStoredItemSeason(raw) {
    const s = String(raw ?? "").trim();
    if (!s || s === "All") return DEFAULT_STORED_SEASON;
    return s;
  }

  /** Display `purchaseDate` (often ISO YYYY-MM-DD) for cards and detail. */
  function formatPurchaseDateForDisplay(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const split = /^(\d{4}-\d{2}-\d{2})(?:\s*[·•]\s*(.+))?$/;
    const m = s.match(split);
    if (m) {
      try {
        const d = new Date(`${m[1]}T12:00:00`);
        if (!Number.isNaN(d.getTime())) {
          const pretty = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
          const note = m[2] != null ? String(m[2]).trim() : "";
          return note ? `${pretty} · ${note}` : pretty;
        }
      } catch {
        /* fall through */
      }
    }
    return s;
  }

  /** Split stored `purchaseDate` (ISO date, optional note) for date picker + text note fields. */
  function splitPurchaseDateForForm(stored) {
    const s = String(stored ?? "").trim();
    if (!s) return { date: "", note: "" };
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) return { date: "", note: s };
    const datePart = m[1];
    let rest = s.slice(datePart.length).trim();
    if (rest.startsWith("T")) {
      rest = rest.replace(/^T[\d:.+\-Z]+/i, "").trim();
    }
    rest = rest.replace(/^[·•\-\s]+/, "").replace(/^\((.*)\)$/, "$1").trim();
    return { date: datePart, note: rest };
  }

  /** Combine date picker + optional note back into one stored string. */
  function joinPurchaseDateFromForm(date, note) {
    const d = String(date ?? "").trim();
    const n = String(note ?? "").trim();
    if (d && n) return `${d} · ${n}`;
    if (d) return d;
    return n;
  }

  function poolItemsForDrillSubcategories(opts = {}) {
    const respectCategory = opts.respectCategory !== false;
    let pool = items;
    pool = pool.filter((i) => itemPassesSeasonNav(i, seasonNavFilter));
    if (respectCategory && categoryNavFilter) pool = pool.filter((i) => itemSlot(i) === categoryNavFilter);
    return pool;
  }

  /**
   * Legacy watch `category` cleanup: only the tab-only label folds to the generic key; concrete subtypes stay distinct.
   * @param {string} raw
   */
  function mapRemovedWatchRecordTypesToConcrete(raw) {
    const r = String(raw ?? "").trim();
    if (r === "Watches") return "Watches";
    if (r === "Sports watch") return "Everyday";
    return r;
  }

  /**
   * Legacy jewellery record types removed from the UI — fold into concrete drill keys.
   * @param {string} raw
   */
  function mapJewelleryFutureToConcreteDrillKey(raw) {
    const r = String(raw ?? "").trim();
    if (r === "Future") return "Jewellery";
    if (r === "Jewellery" || r === "Jewellery") return "Jewellery";
    if (r === "Necklace" || r === "Bracelet" || r === "Ring") return "Jewellery";
    return r;
  }

  /**
   * Stable record-type key for drill chips, filtering, and display under `browseSlot`.
   * Empty category or tab-only `category` maps to the first concrete type for that tab from seed (see `slotRecordFallbackCategory`).
   */
  function recordCategoryForDrill(item, browseSlot) {
    const slot = String(browseSlot ?? "").trim() || itemSlot(item);
    let raw = String(item?.category ?? "").trim();

    if (slot === SLOT_ACCESSORIES) {
      if (raw === "項鏈" || raw === "手鏈" || raw === "戒指") raw = "Jewellery";
      if (raw === "Sunglasses" || raw === "Glasses" || raw === "Eyeglasses") raw = "Eyewear";
      raw = mapJewelleryFutureToConcreteDrillKey(raw);
      if (raw === "Footwear") return "Footwear";
      if (raw === "Small accessories" || raw === "帽子") return "Hats";
      if (
        raw === "Watches" ||
        raw === "Everyday" ||
        raw === "Beater" ||
        raw === "Dress watch" ||
        raw === "Dive watch" ||
        raw === "潛水錶"
      ) {
        return "Hats";
      }
    }
    if (slot === SLOT_WATCHES) {
      if (raw === "潛水錶") raw = "Dive watch";
      raw = mapRemovedWatchRecordTypesToConcrete(raw);
    }
    if (slot === SLOT_FRAGRANCE && raw === "Daywear") raw = "Day";

    if (!raw) return defaultRecordCategoryForSlot(slot);

    const broadClothing = slot === SLOT_CLOTHING && (raw === slot || raw === "Clothing");
    const broadAccessories = slot === SLOT_ACCESSORIES && (raw === slot || raw === "Accessories");
    if (broadClothing || broadAccessories) return defaultRecordCategoryForSlot(slot);

    return raw;
  }

  function itemMatchesDrillSubcategory(item, browseCategory, sub) {
    if (!sub) return true;
    const itemKey = recordCategoryForDrill(item, browseCategory);
    return recordTypeDrillKeysEquivalent(itemKey, sub);
  }

  /** Items in `browseSlot` matching a record-type drill key (alias-aware). */
  function poolItemsMatchingRecordTypeDrill(pool, browseSlot, subKey) {
    const slot = String(browseSlot ?? "").trim();
    const sub = String(subKey ?? "").trim();
    return pool.filter((it) => {
      if (itemSlot(it) !== slot) return false;
      return itemMatchesDrillSubcategory(it, slot, sub);
    });
  }

  /** Drop record-type keys that duplicate the browse tab name (`Watches`, `Fragrance`). */
  function omitHomonymousSlotRecordKeys(browseSlot, keys) {
    const slot = String(browseSlot ?? "").trim();
    if (!slot || !Array.isArray(keys)) return Array.isArray(keys) ? keys : [];
    return keys.filter((k) => {
      const key = String(k ?? "").trim();
      if (!key) return false;
      if (slot === SLOT_WATCHES && key === SLOT_WATCHES) return false;
      if (slot === SLOT_FRAGRANCE && key === SLOT_FRAGRANCE) return false;
      return true;
    });
  }

  /**
   * Distinct record-type keys for the type drill / edit dropdown under `browseSlot`.
   */
  function drillSubcategoryKeysFromPool(browseSlot, pool) {
    const slot = String(browseSlot ?? "").trim();
    if (!slot) return [];
    return omitHomonymousSlotRecordKeys(
      slot,
      sortRecordTypeKeysForSlot(
        slot,
        pool
          .filter((i) => itemSlot(i) === slot)
          .map((i) => recordCategoryForDrill(i, slot))
          .filter(Boolean)
      )
    );
  }

  /**
   * Header mega menu + mobile type list: pool-derived keys plus slot fallbacks (no per-slot layout exceptions).
   * @returns {{ raw: string, label: string }[]}
   */
  function megaMenuSubcategoryEntriesForSlot(browseSlot, pool) {
    const slot = String(browseSlot ?? "").trim();
    if (!slot || !SLOT_OPTIONS.includes(slot)) return [];
    const fall = defaultRecordCategoryForSlot(slot);
    let keys = drillSubcategoryKeysFromPool(slot, pool);
    const knownExtra = KNOWN_RECORD_TYPES_BY_SLOT[slot];
    if (knownExtra?.length) keys = sortRecordTypeKeysForSlot(slot, [...keys, ...knownExtra]);
    if (slot === SLOT_ACCESSORIES) {
      keys = keys.filter((k) => k && !["Jewellery", "Jewellery", "Future"].includes(k));
      keys = keys.filter(
        (k) => k && !["Everyday", "Watches", "Beater", "Dress watch", "Dive watch"].includes(k)
      );
      if (!keys.includes("Jewellery")) keys.push("Jewellery");
      keys = sortRecordTypeKeysForSlot(slot, keys);
    }
    if (!keys.includes(fall)) keys = sortRecordTypeKeysForSlot(slot, [fall, ...keys]);

    const entries = collapseRecordTypeKeysByDisplayLabel(keys, slot);
    return [{ raw: "", label: SUBCATEGORY_ALL_LABEL }, ...entries];
  }

  /** Mobile drawer: “All Clothing”, “All Accessories”, etc. */
  function mobileNavSubcategoryAllLabel(browseSlot) {
    const cat = categoryDisplayLabel(String(browseSlot ?? "").trim()) || String(browseSlot ?? "").trim();
    return cat ? `All ${cat}` : SUBCATEGORY_ALL_LABEL;
  }

  /** @returns {{ raw: string, label: string }[]} */
  function mobileNavSubcategoryEntriesForSlot(browseSlot, pool) {
    const entries = megaMenuSubcategoryEntriesForSlot(browseSlot, pool);
    if (!entries.length) return entries;
    const allLabel = mobileNavSubcategoryAllLabel(browseSlot);
    return entries.map((entry, index) =>
      index === 0 && entry.raw === "" ? { ...entry, label: allLabel } : entry
    );
  }

  function subcategoryFilterMatchesEntry(raw, subF) {
    const key = String(raw ?? "").trim();
    const active = String(subF ?? "").trim();
    return key ? recordTypeDrillKeysEquivalent(active, key) : !active;
  }

  /** Legacy Chinese `category` / drill keys saved before English migration. */
  function legacyZhRecordCategoryToEn(raw) {
    const r = String(raw ?? "").trim();
    if (r === "Daywear") return "Day";
    if (r === "項鏈" || r === "手鏈" || r === "戒指") return "Jewellery";
    if (r === "潛水錶") return "Watches";
    if (r === "Small accessories") return "Hats";
    if (r === "帽子") return "Hats";
    return r;
  }

  /**
   * Populate record-type `<select>`: keys from the pool plus `preferKey` when valid; always includes the section fallback.
   */
  function fillItemEditRecordTypeSelect(selectEl, browseSlot, preferKey) {
    const slot = String(browseSlot ?? "").trim() || SLOT_CLOTHING;
    let prev = legacyZhRecordCategoryToEn(preferKey);
    if (slot === SLOT_ACCESSORIES) {
      prev = mapJewelleryFutureToConcreteDrillKey(prev);
    }
    if (slot === SLOT_WATCHES) prev = mapRemovedWatchRecordTypesToConcrete(prev);
    const pool = items.filter((i) => itemSlot(i) === slot);
    const fall = defaultRecordCategoryForSlot(slot);
    let keys = drillSubcategoryKeysFromPool(slot, pool);
    const knownExtra = KNOWN_RECORD_TYPES_BY_SLOT[slot];
    if (knownExtra?.length) keys = sortRecordTypeKeysForSlot(slot, [...keys, ...knownExtra]);
    if (slot === SLOT_ACCESSORIES) {
      keys = keys.filter((k) => k && !["Jewellery", "Jewellery", "Future"].includes(k));
      keys = keys.filter((k) => k && !["Everyday", "Watches", "Beater", "Dress watch", "Dive watch"].includes(k));
      if (!keys.includes("Jewellery")) keys.push("Jewellery");
      keys = sortRecordTypeKeysForSlot(slot, keys);
    }
    if (!keys.includes(fall)) keys = sortRecordTypeKeysForSlot(slot, [fall, ...keys]);
    if (prev && !keys.includes(prev)) {
      const probe = { category: prev, season: "" };
      if (itemSlot(probe) === slot && prev !== slot && !SLOT_OPTIONS.includes(prev)) {
        keys = sortRecordTypeKeysForSlot(slot, [...keys, prev]);
      }
    }
    selectEl.innerHTML = "";
    const collapsed = collapseRecordTypeKeysByDisplayLabel(keys, slot);
    for (const { raw, label } of collapsed) {
      const o = document.createElement("option");
      o.value = raw;
      o.textContent = label;
      selectEl.appendChild(o);
    }
    const canonKeys = collapsed.map((e) => e.raw);
    const pick =
      prev && canonKeys.find((k) => recordTypeDrillKeysEquivalent(k, prev))
        ? canonKeys.find((k) => recordTypeDrillKeysEquivalent(k, prev))
        : fall;
    selectEl.value = pick;
  }

  /**
   * Pick a stored `category` that belongs in `browseSlot`, preferring the form’s record-type value.
   * Avoids hard save failures when the two fields drift (legacy rows, racey UI, or odd imports).
   */
  function resolveCategoryForBrowseSlot(browseSlot, recordPick, season, baseItem) {
    const slot = String(browseSlot ?? "").trim();
    const sn = String(season ?? "").trim();
    const base = baseItem && typeof baseItem === "object" ? baseItem : {};
    let pref = legacyZhRecordCategoryToEn(String(recordPick ?? "").trim());
    if (slot === SLOT_ACCESSORIES) pref = mapJewelleryFutureToConcreteDrillKey(pref);
    if (slot === SLOT_WATCHES) pref = mapRemovedWatchRecordTypesToConcrete(pref);

    const tryCat = (cat) => {
      const c = String(cat ?? "").trim();
      if (!c) return false;
      return itemSlot({ ...base, category: c, season: sn }) === slot;
    };

    if (pref && tryCat(pref)) return pref;
    const d = defaultRecordCategoryForSlot(slot);
    if (tryCat(d)) return d;
    const known = KNOWN_RECORD_TYPES_BY_SLOT[slot];
    if (known) {
      for (const k of known) {
        if (tryCat(k)) return k;
      }
    }
    const poolKeys = drillSubcategoryKeysFromPool(
      slot,
      items.filter((i) => itemSlot(i) === slot)
    );
    for (const k of poolKeys) {
      if (tryCat(k)) return k;
    }
    return d;
  }

  function validateSubcategoryFilter() {
    let sub = String(subcategoryFilter ?? "").trim();
    const subEn = legacyZhRecordCategoryToEn(sub);
    if (subEn !== sub) {
      subcategoryFilter = subEn;
      sub = subEn;
    }
    if (!sub) return;
    if (!categoryNavFilter) {
      subcategoryFilter = "";
      return;
    }
    if (categoryNavFilter === SLOT_ACCESSORIES) {
      const j = mapJewelleryFutureToConcreteDrillKey(sub);
      if (j !== sub) {
        subcategoryFilter = j;
        sub = j;
      }
    }
    if (categoryNavFilter === SLOT_WATCHES) {
      const w = mapRemovedWatchRecordTypesToConcrete(sub);
      if (w !== sub) {
        subcategoryFilter = w;
        sub = w;
      }
    }
    const seasonalPool = poolItemsForDrillSubcategories();
    if (!seasonalPool.length) {
      subcategoryFilter = "";
      return;
    }
    const allowed = drillSubcategoryKeysFromPool(categoryNavFilter, seasonalPool);
    const collapsed = collapseRecordTypeKeysByDisplayLabel(allowed, categoryNavFilter);
    const match = collapsed.find((e) => recordTypeDrillKeysEquivalent(e.raw, sub));
    if (!match) {
      subcategoryFilter = "";
      return;
    }
    subcategoryFilter = match.raw;
  }

  /** Avoid `aria-hidden` + focused descendant (Chrome blocks and UX breaks); call before hiding `#category-drill`. */
  function blurActiveElementIfInsideCategoryDrill() {
    const drill = document.getElementById("category-drill");
    if (!drill) return;
    const ae = document.activeElement;
    if (ae instanceof HTMLElement && drill.contains(ae)) {
      ae.blur();
    }
  }

  function ensureArchiveSlotTypeStrip() {
    const drill = document.getElementById("category-drill");
    if (!drill) return null;
    let strip = document.getElementById("archive-slot-type-strip");
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "archive-slot-type-strip";
      strip.className = "category-drill__grid category-drill__grid--slots";
      strip.setAttribute("role", "tablist");
      strip.setAttribute("aria-label", "Collection type");
      const subGrid = document.getElementById("category-drill-grid");
      if (subGrid) drill.insertBefore(strip, subGrid);
      else drill.appendChild(strip);
    }
    return strip;
  }

  function renderArchiveSlotTypeStrip() {
    const drill = document.getElementById("category-drill");
    const strip = ensureArchiveSlotTypeStrip();
    if (!drill || !strip) return;

    const cat = String(categoryNavFilter ?? "").trim();
    strip.replaceChildren();

    function appendSlot(value, label) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "category-drill__choice category-drill__choice--slot";
      if (!value) b.classList.add("category-drill__choice--all");
      b.setAttribute("data-slot-filter", value);
      b.setAttribute("role", "tab");
      const active = value ? cat === value : !cat;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
      b.textContent = label;
      strip.appendChild(b);
    }

    appendSlot("", ARCHIVE_ALL_TYPES_LABEL);
    for (const slot of SLOT_OPTIONS) {
      appendSlot(slot, categoryDisplayLabel(slot));
    }

    drill.hidden = false;
    drill.removeAttribute("aria-hidden");
  }

  let lastCategoryDrillStructureKey = "";

  function categoryDrillStructureKey(slot, typeEntries, subF) {
    return [slot, subF, ...typeEntries.map((e) => `${e.raw}\t${e.label}`)].join("\0");
  }

  function syncCategoryDrillActiveStates(grid, subF) {
    grid.querySelectorAll(".category-drill__choice[data-subcategory]").forEach((btn) => {
      const raw = String(btn.dataset.subcategory ?? "");
      btn.classList.toggle("is-active", subcategoryFilterMatchesEntry(raw, subF));
    });
  }

  function renderCategoryDrill() {
    const drill = document.getElementById("category-drill");
    const grid = document.getElementById("category-drill-grid");
    if (!drill || !grid) return;
    grid.classList.add("category-drill__grid", "category-drill__grid--subtypes");

    validateSubcategoryFilter();

    if (isArchiveSearchResultsMode()) {
      blurActiveElementIfInsideCategoryDrill();
      drill.hidden = true;
      grid.hidden = true;
      grid.innerHTML = "";
      return;
    }

    if (!ARCHIVE_RECORD_TYPE_SUBNAV_ENABLED) {
      blurActiveElementIfInsideCategoryDrill();
      drill.hidden = true;
      grid.hidden = true;
      grid.innerHTML = "";
      return;
    }

    const slot = String(categoryNavFilter ?? "").trim();

    /** All Types landing: no duplicate slot/type pills — use header + mega menu. */
    if (!slot) {
      blurActiveElementIfInsideCategoryDrill();
      drill.hidden = true;
      drill.setAttribute("aria-hidden", "true");
      grid.innerHTML = "";
      grid.hidden = true;
      lastCategoryDrillStructureKey = "";
      document.getElementById("archive-slot-type-strip")?.remove();
      return;
    }

    document.getElementById("archive-slot-type-strip")?.remove();
    drill.hidden = false;
    drill.removeAttribute("aria-hidden");

    const seasonalPool = poolItemsForDrillSubcategories();
    if (!seasonalPool.length) {
      subcategoryFilter = "";
      grid.innerHTML = "";
      grid.hidden = true;
      drill.hidden = true;
      drill.setAttribute("aria-hidden", "true");
      return;
    }

    const typeEntries = megaMenuSubcategoryEntriesForSlot(slot, seasonalPool);
    const specificTypes = typeEntries.filter((e) => String(e.raw ?? "").trim());

    /** No sub-type strip when there is nothing beyond “All” (slot-only browse is enough). */
    if (!specificTypes.length) {
      subcategoryFilter = "";
      grid.innerHTML = "";
      grid.hidden = true;
      drill.hidden = true;
      drill.setAttribute("aria-hidden", "true");
      lastCategoryDrillStructureKey = "";
      return;
    }

    const subF = String(subcategoryFilter ?? "").trim();
    const structureKey = categoryDrillStructureKey(slot, typeEntries, subF);
    if (structureKey === lastCategoryDrillStructureKey && grid.childElementCount > 0) {
      syncCategoryDrillActiveStates(grid, subF);
      drill.hidden = false;
      drill.removeAttribute("aria-hidden");
      grid.hidden = false;
      return;
    }
    lastCategoryDrillStructureKey = structureKey;

    grid.innerHTML = "";
    grid.hidden = false;

    function appendChoice(rawValue, label) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "category-drill__choice";
      if (subcategoryFilterMatchesEntry(rawValue, subF)) b.classList.add("is-active");
      b.dataset.subcategory = String(rawValue ?? "");
      b.textContent = label;
      grid.appendChild(b);
    }

    for (const { raw, label } of typeEntries) {
      appendChoice(raw, label);
    }

    if (grid.childElementCount <= 0) {
      subcategoryFilter = "";
      grid.hidden = true;
    }
  }

  /** Season, slot, drill, basic colour, and brand — no live keyword typing (keywords are commit-only). */
  function applyArchiveUiFilters(list, opts = {}) {
    const skipBrand = Boolean(opts.skipBrandFilter);
    const f = getFilters();
    return list.filter((item) => {
      if (!itemPassesSeasonNav(item, f.seasonNav)) return false;
      if (!archiveSearchBrowseAllSlots && f.category && itemSlot(item) !== f.category) return false;
      if (f.subcategory && !itemMatchesDrillSubcategory(item, f.category, f.subcategory)) return false;
      if (!itemMatchesBasicColourFilter(item, f.basicColour)) return false;
      if (!skipBrand && selectedBrandFilters.size > 0) {
        const brand = String(item?.brand ?? "").trim();
        if (!selectedBrandFilters.has(brand)) return false;
      }
      return true;
    });
  }

  /** Pool for brand filter chips — same constraints as the grid, excluding the brand filter itself. */
  function poolItemsForBrandFilterOptions() {
    const committed = String(archiveSubmittedSearchNorm ?? "").trim();
    if (committed) {
      let pool = items.filter((item) => itemMatchesSearch(item, committed));
      const wc = String(archiveSearchWithinRecordCategory ?? "").trim();
      if (wc) pool = pool.filter((item) => itemMatchesArchiveSearchWithinRecordCategory(item, wc));
      return applyArchiveUiFilters(pool, { skipBrandFilter: true });
    }
    return applyArchiveUiFilters(items, { skipBrandFilter: true });
  }

  function brandKeyForItem(item) {
    return String(item?.brand ?? "").trim();
  }

  /** @returns {string[]} */
  function availableBrandsForCurrentContext() {
    const seen = new Set();
    const out = [];
    for (const item of poolItemsForBrandFilterOptions()) {
      const key = brandKeyForItem(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return out;
  }

  /** @returns {Map<string, number>} */
  function brandCountsForCurrentContext() {
    const out = new Map();
    for (const item of poolItemsForBrandFilterOptions()) {
      const key = brandKeyForItem(item);
      if (!key) continue;
      out.set(key, (out.get(key) ?? 0) + 1);
    }
    return out;
  }

  function toggleBrandFilter(brand) {
    const key = String(brand ?? "").trim();
    if (!key) return;
    const next = new Set(selectedBrandFilters);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selectedBrandFilters = next;
    invalidateArchiveSortedCache();
  }

  function clearBrandFilters() {
    if (!selectedBrandFilters.size) return;
    selectedBrandFilters = new Set();
    invalidateArchiveSortedCache();
  }

  /**
   * Visible archive list for the main grid. Submitted search matches on the full `items` root, then optional
   * within-result record-type pill, then season / slot / drill / colour filters apply only within that pool.
   */
  function applyFilters(list) {
    const committed = String(archiveSubmittedSearchNorm ?? "").trim();
    if (committed) {
      let pool = items.filter((item) => itemMatchesSearch(item, committed));
      const wc = String(archiveSearchWithinRecordCategory ?? "").trim();
      if (wc) pool = pool.filter((item) => itemMatchesArchiveSearchWithinRecordCategory(item, wc));
      return applyArchiveUiFilters(pool);
    }
    return applyArchiveUiFilters(list);
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Title line: when a descriptive colour is set and the name repeats it at the start, strip it (colour lives in specs).
   * Does not strip when the leading colour is the first half of a compound material (e.g. Camel Hair, Navy Wool).
   */
  /** Archive card meta line — single-colour rows only; multi-variant cards use the swatch tray. */
  function colourLabelForItem(item) {
    const variants = getItemColourVariants(item);
    if (variants?.length > 1) return "";
    if (variants?.length === 1) {
      const v = variants[0];
      const col = String(v.colour ?? v.color ?? "").trim();
      const label = String(v.label ?? "").trim();
      return col || label || String(item?.colour ?? "").trim();
    }
    return String(item?.colour ?? "").trim();
  }

  function displayNameWithoutLeadingColour(item) {
    const name = String(item?.name ?? "").trim();
    const col = String(item?.colour ?? "").trim();
    if (!name || !col) return name;
    const re = new RegExp("^" + escapeRegExp(col) + "\\s+", "i");
    const stripped = name.replace(re, "").trim();
    if (stripped.length < 2) return name;
    const firstAfter = stripped.split(/\s+/)[0] || "";
    /** If stripping would leave this as the first token, we likely split a two-word material (Camel Hair, …). */
    const compoundMaterialContinuations = new Set([
      "hair",
      "wool",
      "cashmere",
      "silk",
      "linen",
      "cotton",
      "leather",
      "suede",
      "twill",
      "denim",
      "mesh",
    ]);
    if (firstAfter && compoundMaterialContinuations.has(firstAfter.toLowerCase())) return name;
    return stripped;
  }

  function imageAltForItem(item) {
    const dn = displayNameWithoutLeadingColour(item);
    const col = String(item?.colour ?? "").trim();
    if (col) {
      return `${item.brand} — ${dn} (${col})`;
    }
    return `${item.brand} — ${dn}`;
  }

  function specParts(item, opts = {}) {
    const forGrid = Boolean(opts.forGridCard);
    const parts = [];
    const vars = getItemColourVariants(item);
    if (vars?.length) {
      if (!forGrid) {
        parts.push(`${vars.length} colours: ${vars.map((v) => v.label).join(", ")}`);
      }
    } else {
      if (item.colour) parts.push(item.colour);
    }
    if (forGrid) {
      const w = String(item.weight ?? "").trim();
      if (w) parts.push(w);
    } else {
      if (item.fabric) parts.push(item.fabric);
      if (item.weight) parts.push(item.weight);
    }
    return parts;
  }

  /** Native tooltip for grid cards — full fabric/weight/size/measure/date/price without cluttering the layout. */
  function buildCardNativeTitleSummary(item) {
    const bits = [];
    const brand = String(item?.brand ?? "").trim();
    const name = displayNameWithoutLeadingColour(item);
    if (brand) bits.push(brand);
    if (name) bits.push(name);
    for (const p of specParts(item)) bits.push(p);
    if (item.fabric) bits.push(String(item.fabric).trim());
    if (item.weight) bits.push(String(item.weight).trim());
    if (item.size) bits.push(String(item.size).trim());
    const mb = formatMeasurementRowsBrief(item);
    if (mb) bits.push(mb);
    if (item.purchaseDate) bits.push(formatPurchaseDateForDisplay(item.purchaseDate));
    const pl = formattedArchivePriceLine(item);
    if (pl) bits.push(pl);
    let s = bits.filter(Boolean).join(" · ");
    if (s.length > 480) s = s.slice(0, 477) + "…";
    return s;
  }

  /** Extra images only (not the main `image` URL). */
  function itemGalleryList(item) {
    const raw = item?.gallery;
    let arr = [];
    if (Array.isArray(raw)) arr = raw.map((x) => String(x)).filter(Boolean);
    else if (raw && typeof raw === "string") {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) arr = p.map((x) => String(x)).filter(Boolean);
      } catch {
        /* ignore */
      }
    }
    const main = String(item?.image ?? "").trim();
    return arr.filter((u) => u && u !== main);
  }

  function isDisplayableCloudImageUrl(u) {
    const s = String(u ?? "").trim();
    if (!s) return false;
    if (s.startsWith("data:") || s.startsWith("blob:") || /^https?:\/\//i.test(s)) return true;
    return /^(?:\/)?images\//i.test(s);
  }

  /**
   * Ordered URLs to try for the cover: primary plus gallery / variant images (https, data, or blob only).
   */
  function buildCoverCandidates(item) {
    const primary = String(item?.image ?? "").trim();
    const out = [];
    const seen = new Set();
    function add(u) {
      const x = String(u ?? "").trim();
      if (!x || seen.has(x)) return;
      seen.add(x);
      out.push(x);
    }

    if (!primary) {
      for (const u of itemGalleryList(item)) {
        if (isDisplayableCloudImageUrl(u)) add(u);
      }
      const vars = getItemColourVariants(item);
      if (vars) {
        for (const v of vars) {
          const u = String(v?.image ?? "").trim();
          if (isDisplayableCloudImageUrl(u)) add(u);
        }
      }
      return out.map((u) => withWardrobeImageCacheBust(u, item));
    }

    if (!isDisplayableCloudImageUrl(primary)) {
      for (const u of itemGalleryList(item)) {
        if (isDisplayableCloudImageUrl(u)) add(u);
      }
      const vars = getItemColourVariants(item);
      if (vars) {
        for (const v of vars) {
          const u = String(v?.image ?? "").trim();
          if (isDisplayableCloudImageUrl(u)) add(u);
        }
      }
      return out.map((u) => withWardrobeImageCacheBust(u, item));
    }

    add(primary);
    for (const u of itemGalleryList(item)) {
      if (isDisplayableCloudImageUrl(u)) add(u);
    }
    const vars = getItemColourVariants(item);
    if (vars) {
      for (const v of vars) {
        const u = String(v?.image ?? "").trim();
        if (isDisplayableCloudImageUrl(u)) add(u);
      }
    }
    return out.map((u) => withWardrobeImageCacheBust(u, item));
  }

  /** Header search category tiles: pick a random visible cover (not always archive sort order). */
  function pickRandomHeaderSearchPreviewItem(pool) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    const withCover = pool.filter((it) => buildCoverCandidates(it).length > 0);
    const source = withCover.length ? withCover : pool;
    const idx = Math.floor(Math.random() * source.length);
    return source[idx] ?? null;
  }

  /** Search megamenu tiles: prefer a random extra gallery frame from the subcategory pool. */
  function pickRandomHeaderSearchGalleryFromPool(pool) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    /** @type {{ item: object, url: string }[]} */
    const entries = [];
    for (const it of pool) {
      for (const u of itemGalleryList(it)) {
        if (isDisplayableCloudImageUrl(u)) entries.push({ item: it, url: String(u).trim() });
      }
    }
    if (!entries.length) return null;
    if (!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      shuffleArrayInPlace(entries);
    }
    return entries[Math.floor(Math.random() * entries.length)] ?? entries[0] ?? null;
  }

  function effectiveCoverSrc(item) {
    const cacheKey =
      item?.__coverCacheKey != null
        ? String(item.__coverCacheKey)
        : item?.id != null
          ? String(item.id)
          : "";

    if (cacheKey && coverResolutionCache.has(cacheKey)) {
      return coverResolutionCache.get(cacheKey);
    }

    const src = String(item?.image ?? "").trim();
    if (!isDisplayableCloudImageUrl(src)) return "";
    return withWardrobeImageCacheBust(src, item);
  }

  const ARCHIVE_GRID_CARD_RENDER = Object.freeze({
    width: 600,
    height: 800,
    quality: 82,
    resize: "contain",
  });

  const ITEM_DETAIL_GALLERY_RENDER = Object.freeze({
    width: 900,
    height: 1200,
    quality: 86,
    resize: "contain",
  });

  /**
   * Supabase transform (cover/contain) for card / gallery frames; plain URL when no frame size.
   * @param {string} url
   * @param {object} item
   * @param {{ width?: number, height?: number, quality?: number, resize?: "cover" | "contain", zoom?: number } | null} [frame]
   */
  function wardrobeImageForFrame(url, item, frame) {
    const bust = withWardrobeImageCacheBust(String(url ?? "").trim(), item);
    if (!bust || !isDisplayableCloudImageUrl(bust)) return "";
    if (!frame?.width || !frame?.height) return bust;
    return withSupabaseWardrobeImageRenderSize(bust, frame.width, frame.height, {
      item,
      resize: frame.resize === "contain" ? "contain" : "cover",
      quality: frame.quality,
      zoom: typeof frame.zoom === "number" && frame.zoom > 1 && frame.zoom <= 3 ? frame.zoom : undefined,
    });
  }

  /**
   * Try `buildCoverCandidates` in order until one loads. Optionally cache working URL on `item.id`.
   * @param {{ host?: HTMLElement, missingClass?: string | null, onResolved?: (url: string) => void, onExhausted?: () => void, preferredUrl?: string, coverRenderWidth?: number, coverRenderHeight?: number, coverRenderZoom?: number, coverRenderQuality?: number, coverRenderResize?: "cover" | "contain" }} [opts]
   */
  function wireCoverImageWithFallbacks(img, item, opts) {
    const prevAbort = /** @type {(() => void) | undefined} */ (/** @type {any} */ (img).__twCoverWireAbort);
    if (typeof prevAbort === "function") {
      try {
        prevAbort();
      } catch {
        /* ignore */
      }
    }

    const host = opts?.host;
    const missingClass = opts?.missingClass !== undefined ? opts.missingClass : "card__media--missing";
    const onResolved = opts?.onResolved;
    const onExhausted = opts?.onExhausted;
    let candidates = buildCoverCandidates(item);
    const preferredRaw = String(opts?.preferredUrl ?? "").trim();
    if (preferredRaw && isDisplayableCloudImageUrl(preferredRaw)) {
      const bust = withWardrobeImageCacheBust(preferredRaw, item);
      const prefKey = bust.split("?")[0];
      candidates = [
        bust,
        ...candidates.filter((u) => String(u).split("?")[0] !== prefKey),
      ];
    }
    const rw = opts?.coverRenderWidth;
    const rh = opts?.coverRenderHeight;
    if (typeof rw === "number" && typeof rh === "number" && rw > 0 && rh > 0) {
      const z = opts?.coverRenderZoom;
      const q = opts?.coverRenderQuality;
      const resize =
        opts?.coverRenderResize === "contain" || opts?.coverRenderResize === "cover"
          ? opts.coverRenderResize
          : "contain";
      const expanded = [];
      const seenExpanded = new Set();
      const pushCandidate = (u) => {
        const x = String(u ?? "").trim();
        if (!x || seenExpanded.has(x)) return;
        seenExpanded.add(x);
        expanded.push(x);
      };
      for (const u of candidates) {
        const rendered = withSupabaseWardrobeImageRenderSize(u, rw, rh, {
          item,
          resize,
          zoom: typeof z === "number" && z > 1 && z <= 3 ? z : undefined,
          quality: typeof q === "number" && q >= 20 ? q : undefined,
        });
        pushCandidate(rendered);
        if (rendered !== u) pushCandidate(u);
      }
      candidates = expanded;
    }
    if (!candidates.length) {
      /** @type {any} */ (img).__twCoverWireAbort = undefined;
      if (host && missingClass) host.classList.add(missingClass);
      onExhausted?.();
      img.removeAttribute("src");
      return;
    }

    let idx = 0;
    let done = false;
    function cacheKeyForItem() {
      const base =
        item?.__coverCacheKey != null
          ? String(item.__coverCacheKey)
          : item?.id != null
            ? String(item.id)
            : "";
      if (!base) return "";
      const tw = opts?.coverRenderWidth;
      const th = opts?.coverRenderHeight;
      if (typeof tw === "number" && typeof th === "number" && tw > 0 && th > 0) {
        const zz = opts?.coverRenderZoom;
        const qq = opts?.coverRenderQuality;
        let tag = `${tw}x${th}`;
        if (typeof zz === "number" && zz > 1 && Number.isFinite(zz)) tag += `z${Math.round(zz * 100)}`;
        if (typeof qq === "number" && qq >= 20 && Number.isFinite(qq)) tag += `q${Math.round(qq)}`;
        const rs =
          opts?.coverRenderResize === "cover"
            ? "cover"
            : opts?.coverRenderResize === "contain"
              ? "contain"
              : "contain";
        tag += `r${rs === "contain" ? "c" : "v"}`;
        return `${base}::render${tag}`;
      }
      return base;
    }
    function cleanup() {
      if (done) return;
      done = true;
      img.removeEventListener("error", onErr);
      img.removeEventListener("load", onLoad);
      /** @type {any} */ (img).__twCoverWireAbort = undefined;
    }
    function finishFail() {
      cleanup();
      const ck = cacheKeyForItem();
      if (ck) coverResolutionCache.delete(ck);
      if (host && missingClass) host.classList.add(missingClass);
      onExhausted?.();
      img.removeAttribute("src");
    }
    function finishSuccess() {
      cleanup();
      if (host && missingClass) host.classList.remove(missingClass);
      const url = img.currentSrc || img.src;
      const ck = cacheKeyForItem();
      if (ck) coverResolutionCache.set(ck, url);
      onResolved?.(url);
    }
    function tryNext() {
      idx += 1;
      if (idx >= candidates.length) {
        finishFail();
        return;
      }
      img.src = candidates[idx];
    }
    function onLoad() {
      if (!img.naturalWidth && !img.naturalHeight) {
        tryNext();
        return;
      }
      finishSuccess();
    }
    function onErr() {
      tryNext();
    }

    img.addEventListener("load", onLoad);
    img.addEventListener("error", onErr);
    img.src = candidates[0];
    if (img.complete && img.naturalWidth > 0) {
      finishSuccess();
      return;
    }

    /** @type {any} */ (img).__twCoverWireAbort = () => {
      cleanup();
    };
  }

  /** Thumbnail strip to swap the hero `img` (grid card or detail dialog). */
  function mountHeroGalleryStrip(mediaEl, heroImgEl, item, opts = {}) {
    const extras = itemGalleryList(item).filter(isDisplayableCloudImageUrl);
    if (!extras.length) return;

    const inArchiveGrid = Boolean(mediaEl.closest("#grid"));
    const frame =
      opts.coverFrame ??
      (inArchiveGrid ? ARCHIVE_GRID_CARD_RENDER : ITEM_DETAIL_GALLERY_RENDER);

    function heroFrameSrc(url) {
      return wardrobeImageForFrame(url, item, frame) || withWardrobeImageCacheBust(url, item);
    }

    const strip = document.createElement("div");
    strip.className = "card__gallery-strip";
    strip.setAttribute("role", "tablist");
    strip.setAttribute("aria-label", "Switch photo");

    function setActive(btn) {
      strip.querySelectorAll(".card__gallery-thumb").forEach((b) => b.classList.remove("is-active"));
      if (btn) btn.classList.add("is-active");
    }

    const mainBtn = document.createElement("button");
    mainBtn.type = "button";
    mainBtn.className = "card__gallery-thumb is-active";
    mainBtn.title = "Cover";
    const mainTi = document.createElement("img");
    const firstCover = buildCoverCandidates(item)[0] ?? "";
    if (firstCover) mainTi.src = heroFrameSrc(firstCover);
    mainTi.alt = "";
    mainTi.draggable = false;
    mainBtn.appendChild(mainTi);
    mainBtn.addEventListener("click", () => {
      const cached = String(heroImgEl.dataset.coverSrc ?? "").trim();
      const src = cached || heroFrameSrc(effectiveCoverSrc(item) || firstCover);
      if (src) heroImgEl.src = src;
      else heroImgEl.removeAttribute("src");
      heroImgEl.alt = imageAltForItem(item);
      setActive(mainBtn);
    });
    strip.appendChild(mainBtn);

    extras.forEach((url, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card__gallery-thumb";
      btn.title = `Photo ${i + 2}`;
      const ti = document.createElement("img");
      ti.src = heroFrameSrc(url);
      ti.alt = "";
      ti.draggable = false;
      btn.appendChild(ti);
      btn.addEventListener("click", () => {
        heroImgEl.src = heroFrameSrc(url);
        heroImgEl.alt = `${item.brand} — ${displayNameWithoutLeadingColour(item)} (detail)`;
        setActive(btn);
      });
      strip.appendChild(btn);
    });

    mediaEl.appendChild(strip);
  }

  function showToast(msg) {
    const toastEl = els.outfitToast || document.getElementById("outfit-toast");
    if (!toastEl) return;
    const text = String(msg ?? "").trim();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    toastEl.textContent = text;
    if (text) {
      toastEl.hidden = false;
      toastTimer = setTimeout(() => {
        toastEl.textContent = "";
        toastEl.hidden = true;
        toastTimer = null;
      }, 3800);
    } else {
      toastEl.hidden = true;
    }
  }

  /** @type {string | null} */
  let pendingOutfitVariantItemId = null;

  function loadSavedOutfitsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.outfits)) return [];
      const list = [];
      for (const o of data.outfits) {
        const n = normalizeSavedOutfitRecord(o);
        if (n) list.push(n);
      }
      return list;
    } catch {
      return [];
    }
  }

  /** Keep local notes when cloud rows predate the `outfits.notes` column. */
  function mergeSavedOutfitNotesFromLocalCache(cloudOutfits) {
    const local = loadSavedOutfitsFromStorage();
    if (!local.length) return cloudOutfits;
    const notesById = new Map(local.map((o) => [o.id, String(o.notes ?? "")]));
    return cloudOutfits.map((o) => {
      const cloudNotes = String(o.notes ?? "").trim();
      if (cloudNotes) return o;
      const cached = notesById.get(o.id);
      return cached ? { ...o, notes: cached } : o;
    });
  }

  function persistSavedOutfitsCache() {
    const payload = {
      version: OUTFIT_STORAGE_VERSION,
      outfits: savedOutfits.map((o) => ({
        id: o.id,
        name: o.name,
        notes: String(o.notes ?? ""),
        createdAt: o.createdAt,
        slots: o.slots,
      })),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota / private mode */
    }
  }

  function normalizeStylingBoardDraftSlot(raw) {
    if (!raw || typeof raw !== "object") return null;
    const itemId = String(raw.itemId ?? "").trim();
    if (!itemId) return null;
    const ck = String(raw.colourKey ?? raw.colorKey ?? "").trim();
    return ck ? { itemId, colourKey: ck } : { itemId };
  }

  function loadStylingBoardDraft() {
    try {
      const raw = localStorage.getItem(STYLING_BOARD_DRAFT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.slots)) return null;
      const slots = [];
      for (const s of data.slots) {
        const n = normalizeStylingBoardDraftSlot(s);
        if (n) slots.push(n);
      }
      return {
        slots,
        name: typeof data.name === "string" ? data.name : "",
        notes: typeof data.notes === "string" ? data.notes : "",
        editingSavedOutfitId:
          typeof data.editingSavedOutfitId === "string" && data.editingSavedOutfitId.trim()
            ? data.editingSavedOutfitId.trim()
            : null,
      };
    } catch {
      return null;
    }
  }

  function persistStylingBoardDraft() {
    const payload = {
      version: STYLING_BOARD_DRAFT_VERSION,
      slots: currentOutfitSlots.map((s) =>
        s.colourKey ? { itemId: s.itemId, colourKey: s.colourKey } : { itemId: s.itemId }
      ),
      name: String(els.outfitName?.value ?? ""),
      notes: String(els.outfitNotes?.value ?? ""),
      editingSavedOutfitId: editingSavedOutfitId || null,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STYLING_BOARD_DRAFT_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  function clearStylingBoardDraft() {
    try {
      localStorage.removeItem(STYLING_BOARD_DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  function restoreStylingBoardDraft() {
    const draft = loadStylingBoardDraft();
    if (!draft) return false;
    currentOutfitSlots = draft.slots.filter((slot) => {
      const it = itemById.get(slot.itemId);
      return it && itemEligibleForOutfit(it);
    });
    if (els.outfitName) els.outfitName.value = draft.name;
    if (els.outfitNotes) els.outfitNotes.value = draft.notes;
    editingSavedOutfitId =
      draft.editingSavedOutfitId && savedOutfits.some((o) => o.id === draft.editingSavedOutfitId)
        ? draft.editingSavedOutfitId
        : null;
    syncOutfitSaveButtonLabel();
    return true;
  }

  function initStylingBoardFromStorage() {
    restoreStylingBoardDraft();
    renderOutfitStrip();
    renderSavedOutfits();
    syncStylingBoardUi();
    syncOutfitSaveButtonLabel();
  }

  function newOutfitRecordId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    if (supabaseClient) {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    return `outfit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function outfitIdSet() {
    return new Set(currentOutfitSlots.map((s) => s.itemId));
  }

  function outfitSlotKeySet() {
    return new Set(currentOutfitSlots.map(outfitSlotKey));
  }

  function pushOutfitSlot(slot) {
    const item = itemById.get(slot.itemId);
    if (!item) return;
    if (!itemEligibleForOutfit(item)) {
      showToast(
        "Only clothing, shoes, watches, and accessories go on the styling board — jewellery and perfume stay in the archive."
      );
      return;
    }
    const k = outfitSlotKey(slot);
    if (outfitSlotKeySet().has(k)) {
      showToast("This colour is already on your styling board.");
      return;
    }
    if (currentOutfitSlots.length >= MAX_OUTFIT_ITEMS) {
      showToast(`The styling board is limited to ${MAX_OUTFIT_ITEMS} pieces.`);
      return;
    }
    currentOutfitSlots.push(slot);
    onOutfitChange();
    openStylingBoardDrawer();
    if (!document.getElementById("outfit-strip")) {
      showToast("Added to Styling Board — open the archive to view your board.");
    } else {
      showToast("Added to Styling Board.");
    }
  }

  function openOutfitVariantPicker(itemId) {
    const item = itemById.get(itemId);
    const vars = item ? getItemColourVariants(item) : null;
    const dlg = document.getElementById("outfit-variant-dialog");
    const sel = document.getElementById("outfit-variant-select");
    const title = document.getElementById("outfit-variant-title");
    if (!item || !vars?.length || !dlg || !sel) return;
    pendingOutfitVariantItemId = itemId;
    sel.innerHTML = "";
    for (const v of vars) {
      const o = document.createElement("option");
      o.value = v.key;
      o.textContent = v.label;
      sel.appendChild(o);
    }
    if (title) {
      title.textContent = `${item.brand} — ${displayNameWithoutLeadingColour(item)}`;
    }
    try {
      dlg.showModal();
    } catch {
      /* already open */
    }
    queueMicrotask(() => sel.focus());
  }

  function addToOutfit(id) {
    const item = itemById.get(id);
    if (!item) return;
    const vars = getItemColourVariants(item);
    if (vars?.length) {
      openOutfitVariantPicker(id);
      return;
    }
    pushOutfitSlot({ itemId: id });
  }

  function removeOutfitSlotAt(index) {
    if (index < 0 || index >= currentOutfitSlots.length) return;
    currentOutfitSlots = currentOutfitSlots.filter((_, i) => i !== index);
    onOutfitChange();
  }

  function clearOutfit() {
    currentOutfitSlots = [];
    if (els.outfitName) els.outfitName.value = "";
    if (els.outfitNotes) els.outfitNotes.value = "";
    editingSavedOutfitId = null;
    clearStylingBoardDraft();
    syncOutfitSaveButtonLabel();
    onOutfitChange();
    showToast("Styling board cleared.");
  }

  function syncOutfitSaveButtonLabel() {
    const btn = els.outfitSave || document.getElementById("outfit-save");
    if (!btn) return;
    btn.textContent = editingSavedOutfitId ? "Update outfit" : "Save outfit";
    btn.title = editingSavedOutfitId
      ? "Save changes to the outfit you opened with Edit."
      : "Save the current strip as a new named outfit.";
  }

  function reorderOutfit(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= currentOutfitSlots.length ||
      toIndex >= currentOutfitSlots.length
    ) {
      return;
    }
    const next = [...currentOutfitSlots];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    currentOutfitSlots = next;
    onOutfitChange();
  }

  async function saveCurrentOutfit() {
    const name = els.outfitName?.value.trim() ?? "";
    const notes = els.outfitNotes?.value.trim() ?? "";
    if (!currentOutfitSlots.length) {
      showToast("Add at least one piece to the board first.");
      return;
    }
    if (!name) {
      showToast("Please name this outfit.");
      els.outfitName?.focus();
      return;
    }
    const slots = currentOutfitSlots.map((s) =>
      s.colourKey ? { itemId: s.itemId, colourKey: s.colourKey } : { itemId: s.itemId }
    );

    const editId = editingSavedOutfitId;
    if (editId) {
      const prevIdx = savedOutfits.findIndex((o) => o.id === editId);
      if (prevIdx < 0) {
        editingSavedOutfitId = null;
        syncOutfitSaveButtonLabel();
        showToast("That saved outfit is no longer here — use Save outfit to create a new one.");
        return;
      }
      const prev = savedOutfits[prevIdx];
      const record = {
        id: editId,
        name,
        notes,
        slots,
        createdAt: prev.createdAt,
      };

      if (supabaseClient && useCloudOutfits) {
        const api = await import("./js/supabase-client.js");
        const res = await api.updateOutfitWithItems(supabaseClient, record);
        if (!res.ok) {
          showToast(`Cloud update failed: ${res.error}`);
          return;
        }
      }

      const next = [...savedOutfits];
      next[prevIdx] = record;
      savedOutfits = next;
      persistSavedOutfitsCache();
      editingSavedOutfitId = null;
      syncOutfitSaveButtonLabel();
      if (els.outfitName) els.outfitName.value = "";
      if (els.outfitNotes) els.outfitNotes.value = "";
      renderSavedOutfits();
      showToast(`Updated: “${name}”`);
      return;
    }

    const record = {
      id: newOutfitRecordId(),
      name,
      notes,
      slots,
      createdAt: new Date().toISOString(),
    };

    if (supabaseClient && useCloudOutfits) {
      const api = await import("./js/supabase-client.js");
      const res = await api.insertOutfitWithItems(supabaseClient, record);
      if (!res.ok) {
        showToast(`Cloud save failed: ${res.error}`);
        return;
      }
    }

    savedOutfits = [record, ...savedOutfits];
    persistSavedOutfitsCache();
    if (els.outfitName) els.outfitName.value = "";
    if (els.outfitNotes) els.outfitNotes.value = "";
    renderSavedOutfits();
    showToast(`Saved outfit: “${name}”`);
  }

  async function deleteSavedOutfit(id) {
    if (editingSavedOutfitId === id) {
      editingSavedOutfitId = null;
      syncOutfitSaveButtonLabel();
    }
    if (supabaseClient && useCloudOutfits) {
      const api = await import("./js/supabase-client.js");
      const res = await api.deleteOutfitById(supabaseClient, id);
      if (!res.ok) {
        showToast(`Cloud delete failed: ${res.error}`);
        return;
      }
    }
    savedOutfits = savedOutfits.filter((o) => o.id !== id);
    persistSavedOutfitsCache();
    renderSavedOutfits();
    showToast("Outfit deleted.");
  }

  /**
   * @param {string} id
   * @param {{ forEdit?: boolean }} [opts] Pass `forEdit: true` to update that outfit on next save (name field filled).
   */
  function loadSavedIntoBuilder(id, opts = {}) {
    const forEdit = Boolean(opts.forEdit);
    const found = savedOutfits.find((o) => o.id === id);
    if (!found) return;
    const rawSlots = outfitSlotsFromRecord(found);
    const valid = rawSlots.filter((slot) => {
      const it = itemById.get(slot.itemId);
      return it && itemEligibleForOutfit(it);
    });
    const before = rawSlots.length;
    currentOutfitSlots = valid;
    editingSavedOutfitId = forEdit ? id : null;
    if (els.outfitName) els.outfitName.value = forEdit ? String(found.name ?? "").trim() : "";
    if (els.outfitNotes) els.outfitNotes.value = forEdit ? String(found.notes ?? "").trim() : "";
    syncOutfitSaveButtonLabel();
    onOutfitChange();
    openStylingBoardDrawer();
    const skipped = before - valid.length;
    if (forEdit) {
      els.outfitName?.focus();
      if (skipped > 0) {
        showToast(`Editing “${found.name}” — skipped ${skipped} archive-only piece(s). Save updates this outfit.`);
      } else {
        showToast(`Editing “${found.name}” — Save updates this outfit.`);
      }
    } else if (skipped > 0) {
      showToast(`Loaded: “${found.name}” — skipped ${skipped} archive-only piece(s).`);
    } else {
      showToast(`Loaded: “${found.name}”`);
    }
  }

  function showAddItemFormMsg(text, isError) {
    const el = document.getElementById("add-item-form-msg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("add-item-form__msg--error", Boolean(isError));
  }

  /**
   * Cover fields must never accept more than one file — clears `multiple` and keeps only the first selection.
   * @param {HTMLInputElement | null | undefined} inputEl
   * @param {() => void} [onDroppedExtra]
   */
  function trimCoverFileInputToOne(inputEl, onDroppedExtra) {
    if (!inputEl || inputEl.type !== "file") return;
    try {
      inputEl.removeAttribute("multiple");
    } catch {
      /* ignore */
    }
    const list = inputEl.files;
    if (!list || list.length <= 1) return;
    try {
      const dt = new DataTransfer();
      dt.items.add(list[0]);
      inputEl.files = dt.files;
      if (onDroppedExtra) onDroppedExtra();
    } catch {
      try {
        inputEl.value = "";
      } catch {
        /* ignore */
      }
    }
  }

  /** Main edit: 1 cover + up to 12 gallery slots. */
  const ITEM_EDIT_PHOTO_MAX = 13;

  function revokeItemEditPhotoManager(host) {
    if (!(host instanceof HTMLElement)) return;
    const entries = /** @type {any[]} */ (host.__twPhotoEntries);
    if (Array.isArray(entries)) {
      for (const e of entries) {
        if (e?.kind === "file" && e.previewUrl) {
          try {
            URL.revokeObjectURL(e.previewUrl);
          } catch {
            /* ignore */
          }
        }
      }
    }
    host.__twPhotoEntries = [];
    if (host.__twPhotoFiles instanceof Map) host.__twPhotoFiles.clear();
    host.replaceChildren();
  }

  /**
   * Sync the edit-page “Current cover” column with the first tile in the photo manager.
   * @param {HTMLElement | null} previewCol
   * @param {HTMLElement | null} photosHost
   * @param {object} item
   */
  function syncItemEditCoverPreview(previewCol, photosHost, item) {
    const previewImg = previewCol?.querySelector(".card__media-img");
    if (!(previewImg instanceof HTMLImageElement)) return;
    const entries = Array.isArray(photosHost?.__twPhotoEntries) ? photosHost.__twPhotoEntries : [];
    if (!entries.length) {
      previewImg.removeAttribute("src");
      return;
    }
    const first = entries[0];
    let src = "";
    if (first?.kind === "url" && first.url) {
      src = withWardrobeImageCacheBust(String(first.url), item);
    } else if (first?.kind === "file" && first.previewUrl) {
      src = String(first.previewUrl);
    }
    if (!src) return;
    clearCoverResolutionCacheForItem(String(item?.id ?? ""));
    if (first?.kind === "url") {
      wireCoverImageWithFallbacks(previewImg, item, {
        host: previewCol?.querySelector(".item-detail__media") ?? undefined,
        missingClass: "card__media--missing",
        preferredUrl: src,
        coverRenderWidth: ITEM_DETAIL_GALLERY_RENDER.width,
        coverRenderHeight: ITEM_DETAIL_GALLERY_RENDER.height,
        coverRenderQuality: ITEM_DETAIL_GALLERY_RENDER.quality,
        coverRenderResize: ITEM_DETAIL_GALLERY_RENDER.resize,
      });
      return;
    }
    previewImg.src = src;
  }

  /**
   * Unified photo strip: one upload control, first tile = cover, rest = gallery, drag to reorder.
   * @param {HTMLElement} host
   * @param {{ item?: object, coverUrl?: string, galleryUrls?: string[], maxPhotos?: number, uploadLabel?: string, hint?: string, onDirty?: () => void }} [opts]
   */
  function mountItemEditPhotoManager(host, opts = {}) {
    revokeItemEditPhotoManager(host);
    host.classList.add("item-edit-photo-manager");
    host.dataset.role = "item-edit-photo-manager";

    const maxPhotos = Math.min(
      ITEM_EDIT_PHOTO_MAX,
      Math.max(1, Math.floor(Number(opts.maxPhotos) || ITEM_EDIT_PHOTO_MAX))
    );
    const bustItem = opts.item && typeof opts.item === "object" ? opts.item : null;
    /** @type {any[]} */
    const entries = [];
    const cover0 = String(opts.coverUrl ?? "").trim();
    if (cover0) entries.push({ kind: "url", url: cover0 });
    for (const raw of opts.galleryUrls ?? []) {
      const url = String(raw ?? "").trim();
      if (!url) continue;
      if (entries.some((e) => e.kind === "url" && e.url === url)) continue;
      if (entries.length >= maxPhotos) break;
      entries.push({ kind: "url", url });
    }

    /** @type {Map<string, File>} */
    const filesById = new Map();
    host.__twPhotoFiles = filesById;
    host.__twPhotoEntries = entries;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.hidden = true;
    fileInput.className = "item-edit-photo-manager__file-input";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "btn btn--small btn--ghost item-edit-photo-manager__upload";
    uploadBtn.textContent = opts.uploadLabel || "Upload photos";

    const hint = document.createElement("p");
    hint.className = "item-edit-photo-manager__hint";
    hint.textContent =
      opts.hint ||
      "The first photo is the cover; the rest go in the gallery. Drag tiles to reorder.";

    const list = document.createElement("div");
    list.className = "item-edit-photo-manager__list";
    list.setAttribute("role", "list");
    list.setAttribute("aria-label", "Photos");

    /** @type {number | null} */
    let dragFrom = null;

    function syncEntries() {
      host.__twPhotoEntries = entries;
    }

    function renderList() {
      syncEntries();
      list.replaceChildren();
      if (!entries.length) {
        list.hidden = true;
        return;
      }
      list.hidden = false;
      entries.forEach((entry, index) => {
        const tile = document.createElement("div");
        tile.className = "item-edit-photo-tile";
        if (index === 0) tile.classList.add("item-edit-photo-tile--cover");
        tile.draggable = true;
        tile.dataset.index = String(index);
        tile.setAttribute("role", "listitem");

        const badge = document.createElement("span");
        badge.className = "item-edit-photo-tile__badge";
        badge.textContent = index === 0 ? "Cover" : String(index + 1);

        const img = document.createElement("img");
        img.className = "item-edit-photo-tile__img";
        img.draggable = false;
        img.alt = index === 0 ? "Cover" : `Photo ${index + 1}`;
        if (entry.kind === "url") {
          wireCoverImageWithFallbacks(img, bustItem || { image: entry.url }, {
            missingClass: null,
            preferredUrl: entry.url,
            coverRenderWidth: 220,
            coverRenderHeight: 293,
            coverRenderQuality: 82,
            coverRenderResize: "contain",
          });
        } else {
          img.src = entry.previewUrl;
        }

        const grip = document.createElement("span");
        grip.className = "item-edit-photo-tile__grip";
        grip.setAttribute("aria-hidden", "true");
        grip.title = "Drag to reorder";

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn--small btn--ghost item-edit-photo-tile__remove";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const e = entries[index];
          if (e?.kind === "file" && e.previewUrl) {
            try {
              URL.revokeObjectURL(e.previewUrl);
            } catch {
              /* ignore */
            }
            filesById.delete(e.id);
          }
          entries.splice(index, 1);
          renderList();
          opts.onDirty?.();
        });

        tile.appendChild(badge);
        tile.appendChild(img);
        tile.appendChild(grip);
        tile.appendChild(removeBtn);

        tile.addEventListener("dragstart", (ev) => {
          dragFrom = index;
          tile.classList.add("is-dragging");
          if (ev.dataTransfer) {
            ev.dataTransfer.effectAllowed = "move";
            try {
              ev.dataTransfer.setData("text/plain", String(index));
            } catch {
              /* ignore */
            }
          }
        });
        tile.addEventListener("dragend", () => {
          tile.classList.remove("is-dragging");
          dragFrom = null;
          list.querySelectorAll(".item-edit-photo-tile.is-drop-target").forEach((n) => {
            n.classList.remove("is-drop-target");
          });
        });
        tile.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
          tile.classList.add("is-drop-target");
        });
        tile.addEventListener("dragleave", () => {
          tile.classList.remove("is-drop-target");
        });
        tile.addEventListener("drop", (ev) => {
          ev.preventDefault();
          tile.classList.remove("is-drop-target");
          const from =
            dragFrom != null
              ? dragFrom
              : Number.parseInt(String(ev.dataTransfer?.getData("text/plain") ?? ""), 10);
          const to = index;
          if (!Number.isFinite(from) || from < 0 || from >= entries.length || from === to) return;
          const [moved] = entries.splice(from, 1);
          entries.splice(to, 0, moved);
          dragFrom = null;
          renderList();
          opts.onDirty?.();
        });

        list.appendChild(tile);
      });
    }

    uploadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const picked = fileInput.files ? Array.from(fileInput.files) : [];
      fileInput.value = "";
      let dropped = 0;
      for (const file of picked) {
        if (entries.length >= maxPhotos) {
          dropped += 1;
          continue;
        }
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `f-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const previewUrl = URL.createObjectURL(file);
        filesById.set(id, file);
        entries.push({ kind: "file", id, file, previewUrl });
      }
      if (dropped > 0) {
        hint.textContent = `Only the first ${maxPhotos} photos are kept (${dropped} skipped).`;
      } else if (opts.hint) {
        hint.textContent = opts.hint;
      } else {
        hint.textContent =
          "The first photo is the cover; the rest go in the gallery. Drag tiles to reorder.";
      }
      renderList();
      opts.onDirty?.();
    });

    host.appendChild(uploadBtn);
    host.appendChild(fileInput);
    host.appendChild(hint);
    host.appendChild(list);
    renderList();
  }

  /**
   * @param {HTMLElement} host
   * @returns {{ slots: ({ kind: "url", url: string } | { kind: "file", file: File })[] }}
   */
  function readItemEditPhotoManager(host) {
    const entries = Array.isArray(host?.__twPhotoEntries) ? host.__twPhotoEntries : [];
    const files = host?.__twPhotoFiles instanceof Map ? host.__twPhotoFiles : new Map();
    /** @type {({ kind: "url", url: string } | { kind: "file", file: File })[]} */
    const slots = [];
    for (const e of entries) {
      if (e?.kind === "url" && e.url) {
        slots.push({ kind: "url", url: String(e.url) });
      } else if (e?.kind === "file") {
        const file = files.get(String(e.id ?? ""));
        if (file) slots.push({ kind: "file", file });
      }
    }
    return { slots };
  }

  /**
   * @param {({ kind: "url", url: string } | { kind: "file", file: File })[]} slots
   * @param {string} itemId
   * @param {(t: string, err?: boolean) => void} setMsg
   * @param {{ variantKey?: string, keepCoverOnFailure?: boolean, previousCover?: string }} [opts]
   */
  async function materializeItemEditPhotoSlots(slots, itemId, setMsg, opts = {}) {
    const variantKey = String(opts.variantKey ?? "").trim();
    const prevCover = String(opts.previousCover ?? "").trim();
    let image = "";
    /** @type {string[]} */
    const gallery = [];
    let galIndex = 0;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      let url = "";
      if (s.kind === "url") {
        url = String(s.url ?? "").trim();
      } else if (s.kind === "file" && s.file) {
        try {
          if (isSupabaseReady()) {
            if (i === 0) {
              url = variantKey
                ? await uploadWardrobeImageFileToCloud(s.file, itemId, { type: "variant_cover", key: variantKey })
                : await uploadWardrobeImageFileToCloud(s.file, itemId, { type: "main_cover" });
            } else {
              galIndex += 1;
              url = await uploadWardrobeImageFileToCloud(s.file, itemId, {
                type: "main_gallery",
                index: galIndex,
              });
            }
          } else {
            url = await fileToStorageDataUrl(s.file, { preferJpeg: i > 0 });
          }
        } catch (err) {
          console.warn(err);
          const where =
            i === 0
              ? variantKey
                ? `variant cover (${variantKey})`
                : "main cover"
              : `gallery image #${galIndex + 1}`;
          setMsg(`${messageForCloudUploadFailure(where, err)} — skipped this file.`, true);
          if (i === 0 && opts.keepCoverOnFailure && prevCover) {
            image = prevCover;
          }
          continue;
        }
      }
      if (!url) continue;
      if (i === 0) image = url;
      else gallery.push(url);
    }
    return { image, gallery: dedupeGalleryUrls(image, gallery, 12) };
  }

  /** Target max decoded size per embedded photo (local JSON + uploads). Tune here (bytes). */
  const STORAGE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

  /**
   * Approximate binary size of a `data:*;base64,…` payload (decoded bytes).
   * @param {string} dataUrl
   */
  function dataUrlDecodedByteLength(dataUrl) {
    const s = String(dataUrl ?? "");
    const marker = "base64,";
    const idx = s.indexOf(marker);
    if (idx === -1) return 0;
    const b64 = s.slice(idx + marker.length);
    const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
  }

  /**
   * Read a file as a data URL without re-encoding (for small files under `STORAGE_IMAGE_MAX_BYTES`).
   * @param {File} file
   * @returns {Promise<string>}
   */
  function fileToRawDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file || typeof file !== "object") {
        reject(new Error("Invalid file"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () =>
        reject(reader.error instanceof Error ? reader.error : new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Resize / re-encode an image via canvas and return a data URL.
   * PNG / WebP / GIF default to PNG when not `preferJpeg`, so alpha is kept until size forces JPEG.
   * @param {File} file
   * @param {number | { maxSide?: number, maxWidth?: number, quality?: number, forcePng?: boolean, preferJpeg?: boolean }} [opts]
   * @returns {Promise<string>}
   */
  function fileToResizedDataUrl(file, opts) {
    let o = {};
    if (typeof opts === "number") o = { maxSide: opts };
    else if (opts && typeof opts === "object") o = opts;

    const quality = typeof o.quality === "number" ? o.quality : 0.82;
    const forcePng = Boolean(o.forcePng);
    const preferJpeg = Boolean(o.preferJpeg);
    const maxSide = typeof o.maxSide === "number" ? o.maxSide : typeof o.maxWidth === "number" ? null : 1920;
    const maxWidthLegacy = typeof o.maxWidth === "number" ? o.maxWidth : null;

    const mime = String(file?.type ?? "").toLowerCase();
    const fileName = String(file?.name ?? "").toLowerCase();
    const looksAlphaCapable =
      !preferJpeg &&
      (forcePng ||
        mime === "image/png" ||
        mime === "image/webp" ||
        mime === "image/gif" ||
        fileName.endsWith(".png") ||
        fileName.endsWith(".webp") ||
        fileName.endsWith(".gif"));
    const outMime = looksAlphaCapable ? "image/png" : "image/jpeg";

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (!nw || !nh) {
          reject(new Error("Could not read image dimensions"));
          return;
        }
        let w = nw;
        let h = nh;
        if (maxSide != null && maxSide > 0) {
          const m = Math.max(w, h);
          if (m > maxSide) {
            const s = maxSide / m;
            w = Math.round(w * s);
            h = Math.round(h * s);
          }
        } else {
          const capW = maxWidthLegacy != null && maxWidthLegacy > 0 ? maxWidthLegacy : 1920;
          if (w > capW) {
            h = Math.round((h * capW) / w);
            w = capW;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas"));
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        try {
          if (outMime === "image/png") {
            resolve(canvas.toDataURL("image/png"));
          } else {
            resolve(canvas.toDataURL("image/jpeg", quality));
          }
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image failed to load"));
      };
      img.src = url;
    });
  }

  /** After `QuotaExceededError`: one aggressive re-encode (still HD-class before tiny fallbacks). */
  const QUOTA_SHRINK_MAX_SIDE = 1280;
  const QUOTA_SHRINK_QUALITY = 0.72;

  /**
   * Encode for storage: under `STORAGE_IMAGE_MAX_BYTES` (decoded). Small files stay lossless as raw data URLs.
   * @param {File} file
   * @param {{ preferJpeg?: boolean }} [codecOpts] Gallery slots pass `preferJpeg: true` (smaller, no alpha path).
   * @returns {Promise<string>}
   */
  async function fileToStorageDataUrl(file, codecOpts) {
    const extra = codecOpts && typeof codecOpts === "object" ? codecOpts : {};
    const cap = STORAGE_IMAGE_MAX_BYTES;

    try {
      const raw = await fileToRawDataUrl(file);
      if (raw.startsWith("data:image") && dataUrlDecodedByteLength(raw) <= cap) {
        return raw;
      }
    } catch {
      /* fall through to canvas */
    }

    let maxSide = 2560;
    let quality = 0.88;
    let preferJpeg = Boolean(extra.preferJpeg);
    /** @type {string} */
    let last = "";

    for (let i = 0; i < 40; i++) {
      last = await fileToResizedDataUrl(file, { ...extra, maxSide, quality, preferJpeg });
      if (dataUrlDecodedByteLength(last) <= cap) {
        return last;
      }
      const isPng = last.startsWith("data:image/png");
      if (isPng && !preferJpeg) {
        maxSide = Math.max(320, Math.round(maxSide * 0.83));
        if (maxSide <= 420) {
          preferJpeg = true;
        }
      } else {
        if (quality > 0.42) {
          quality = Math.max(0.35, quality - 0.055);
        } else {
          maxSide = Math.max(320, Math.round(maxSide * 0.83));
        }
      }
    }
    return last;
  }

  /**
   * Re-encode a `data:` image URL smaller as JPEG (used after `QuotaExceededError`).
   * Defaults match `QUOTA_SHRINK_MAX_SIDE` / `QUOTA_SHRINK_QUALITY` (HD-class single pass).
   * @param {string} dataUrl
   * @param {number} [maxSide]
   * @param {number} [quality]
   * @returns {Promise<string>}
   */
  async function shrinkDataUrlForStorage(dataUrl, maxSide = QUOTA_SHRINK_MAX_SIDE, quality = QUOTA_SHRINK_QUALITY) {
    const s = String(dataUrl ?? "").trim();
    if (!s.startsWith("data:image")) return s;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (!w || !h) {
          resolve(s);
          return;
        }
        const m = Math.max(w, h);
        if (m > maxSide) {
          const scale = maxSide / m;
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => resolve(s);
      img.src = s;
    });
  }

  /** Second pass: shrink every embedded image on a custom row before writing JSON to `localStorage`. */
  async function shrinkCustomItemRowForQuota(row) {
    const next = { ...row };
    if (next.image) next.image = await shrinkDataUrlForStorage(String(next.image));
    if (Array.isArray(next.gallery) && next.gallery.length) {
      next.gallery = (
        await Promise.all(next.gallery.map((u) => (u ? shrinkDataUrlForStorage(String(u)) : "")))
      ).filter(Boolean);
    }
    if (Array.isArray(next.colourVariants) && next.colourVariants.length) {
      next.colourVariants = await Promise.all(
        next.colourVariants.map(async (v) => {
          const nv = { ...v };
          if (nv.image) nv.image = await shrinkDataUrlForStorage(String(nv.image));
          if (nv.previewImage) nv.previewImage = await shrinkDataUrlForStorage(String(nv.previewImage));
          if (Array.isArray(nv.gallery) && nv.gallery.length) {
            nv.gallery = (
              await Promise.all(nv.gallery.map((u) => (u ? shrinkDataUrlForStorage(String(u)) : "")))
            ).filter(Boolean);
          }
          return nv;
        })
      );
    } else if (Array.isArray(next.colorVariants) && next.colorVariants.length) {
      next.colourVariants = await Promise.all(
        next.colorVariants.map(async (v) => {
          const nv = { ...v };
          if (nv.image) nv.image = await shrinkDataUrlForStorage(String(nv.image));
          if (nv.previewImage) nv.previewImage = await shrinkDataUrlForStorage(String(nv.previewImage));
          if (Array.isArray(nv.gallery) && nv.gallery.length) {
            nv.gallery = (
              await Promise.all(nv.gallery.map((u) => (u ? shrinkDataUrlForStorage(String(u)) : "")))
            ).filter(Boolean);
          }
          return nv;
        })
      );
      delete next.colorVariants;
    }
    return next;
  }

  /** Shown after `QuotaExceededError` when shrinking and retry did not help. */
  const STORAGE_QUOTA_USER_HINT =
    "不是 Chrome 不讓存：每個網站在瀏覽器裡的儲存上限大約只有 5MB。請少放幾張圖、刪掉較舊的自訂單品，或在網站設定裡清除本網站資料。若錯誤句子像舊版（例如 crop first），請強制重新整理（⌘⇧R 或 Ctrl+Shift+R）載入最新 app.js。";

  function dedupeGalleryUrls(imageMain, galleryUrls, max = 12) {
    const main = String(imageMain ?? "").trim();
    const out = [];
    const seen = new Set();
    for (const u of galleryUrls) {
      const s = String(u ?? "").trim();
      if (!s || s === main || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      if (out.length >= max) break;
    }
    return out;
  }

  /**
   * `outfit_items.item_id` references `wardrobe_items.id` with ON DELETE RESTRICT — Postgres
   * rejects deleting a row that still appears in any saved outfit. Remove those links first.
   * If RLS blocks deletes, PostgREST can return success with 0 rows removed — we detect that and throw.
   */
  async function unlinkCloudOutfitsReferencingWardrobeItem(itemId) {
    const sid = String(itemId ?? "").trim();
    if (!sid || !isSupabaseReady()) return;
    const { error } = await supabaseClient.from("outfit_items").delete().eq("item_id", sid);
    if (error) throw error;
    const { count, error: countErr } = await supabaseClient
      .from("outfit_items")
      .select("item_id", { count: "exact", head: true })
      .eq("item_id", sid);
    if (countErr) {
      console.warn("outfit_items count after unlink:", countErr);
    } else if (count != null && count > 0) {
      const blocked = new Error(
        "Saved outfits still reference this piece in the database (DELETE on outfit_items removed no rows — check Supabase RLS: anon needs DELETE on outfit_items, see migrations/20250513000000_init_wardrobe.sql)."
      );
      /** @type {any} */ (blocked).code = "OUTFIT_ITEMS_UNLINK_BLOCKED";
      throw blocked;
    }
    savedOutfits = savedOutfits.map((o) => {
      const slots = Array.isArray(o.slots) ? o.slots : [];
      const next = slots.filter((s) => String(s.itemId ?? "") !== sid);
      if (next.length === slots.length) return o;
      return { ...o, slots: next };
    });
  }

  function formatSupabaseUserMessage(err) {
    if (err == null) return "";
    const o = /** @type {any} */ (err);
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    if (typeof o.error_description === "string") return o.error_description.trim();
    try {
      return JSON.stringify(o);
    } catch {
      return String(o);
    }
  }

  /** Short line for wardrobe_items upsert failures (add / edit / duplicate). */
  const CLOUD_WRITE_REQUIRED_MESSAGE =
    "Cloud save is required. Supabase is not connected yet — configure js/tw-supabase-config.js (URL + anon key) and retry.";

  function messageForCloudUploadFailure(context, err) {
    const detail = formatSupabaseUserMessage(err);
    if (!detail) return `Cloud upload failed (${context}).`;
    if (/row-level security|violates row-level security policy|permission denied/i.test(detail)) {
      return (
        `Cloud upload failed (${context}): ${detail}. ` +
        "Check Supabase Storage bucket policy for `wardrobe-images` (INSERT/UPDATE/SELECT for current role)."
      );
    }
    return `Cloud upload failed (${context}): ${detail}`;
  }

  function isSupabaseSchemaTableMissingError(detail, tableName) {
    const d = String(detail ?? "").trim();
    if (!d || !tableName) return false;
    const esc = String(tableName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`Could not find the table 'public\\.${esc}' in the schema cache`, "i").test(d);
  }

  function messageForFailedWardrobeUpsert(err) {
    const o = /** @type {any} */ (err);
    let detail = formatSupabaseUserMessage(err);
    if (!detail && typeof o?.details === "string" && o.details.trim()) detail = o.details.trim();
    if (!detail) {
      return "Supabase save failed — check project URL, anon key, and network. If the DB is new, run pending migrations (see supabase/migrations).";
    }
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(detail)) {
      const tail = detail.length > 90 ? `${detail.slice(0, 87)}…` : detail;
      return (
        `Supabase unreachable (${tail}). ` +
        `Net::ERR_FAILED / HTTP 522 usually means the edge timed out, the project is paused, or a brief outage — not a missing CORS rule in this app (failed responses often omit Access-Control-Allow-Origin, so DevTools shows a misleading CORS message). ` +
        `Open the Supabase dashboard: resume the project if needed, confirm URL and anon key, then retry. See https://status.supabase.com for incidents.`
      );
    }
    if (/row-level security|violates row-level security policy|permission denied/i.test(detail)) {
      return (
        `Supabase save failed: ${detail}. ` +
        "Your current DB policy likely allows wardrobe_items SELECT only. " +
        "Allow INSERT/UPDATE for the role used by this app (anon/authenticated), or save through a server/Edge Function using service role."
      );
    }
    const d = detail.length > 140 ? `${detail.slice(0, 137)}…` : detail;
    let msg = `Supabase save failed: ${d}`;
    if (/schema cache/i.test(detail) && /color_code|colour_code|\bcolour\b|\bcolor\b/i.test(detail)) {
      msg +=
        " Run migration `20260613180000_wardrobe_items_ensure_british_colour_columns.sql` if `colour_code` is missing in Postgres; then SQL: NOTIFY pgrst, 'reload schema'; or wait ~1 min.";
    }
    return msg;
  }

  function toastCloudDeleteFailure(step, err) {
    const detail = formatSupabaseUserMessage(err);
    const hint =
      step === "unlink"
        ? "Unlink failed"
        : step === "row"
          ? "Delete row failed"
          : "Delete failed";
    const max = 220;
    const tail = detail ? `: ${detail}` : "";
    const msg = `${hint}${tail}`.slice(0, max);
    showToast(msg);
    console.warn(`deleteWardrobePieceFromBrowser (${step})`, err);
  }

  /**
   * Remove a wardrobe piece via Supabase only: unlink outfit refs, delete referenced Storage objects, DELETE
   * the `wardrobe_items` row. If Supabase is not ready, refuses (no offline delete).
   * The id is always saved to `archive_hidden_ids` so `syncMissingRowsToSupabase` never re-upserts seed/file rows with the same id
   * (critical when the catalogue comes only from Supabase). With seed-merge catalogue, hidden ids still suppress resurgence after reload.
   */
  async function deleteWardrobePieceFromBrowser(id) {
    const sid = String(id);
    if (!sid) return;

    if (!isSupabaseReady()) {
      showToast(CLOUD_WRITE_REQUIRED_MESSAGE);
      return;
    }

    const isCustom = sid.startsWith("custom-");

    currentOutfitSlots = currentOutfitSlots.filter((s) => s.itemId !== sid);

    const prevCloud = cloudBackedCustomItems.slice();
    cloudBackedCustomItems = cloudBackedCustomItems.filter((x) => String(x.id) !== sid);

    try {
      const item = itemById.get(sid) || items.find((x) => String(x?.id ?? "") === String(sid));

      try {
        await unlinkCloudOutfitsReferencingWardrobeItem(sid);
      } catch (e1) {
        cloudBackedCustomItems = prevCloud;
        toastCloudDeleteFailure("unlink", e1);
        return;
      }
      try {
        await deleteWardrobeItemImagesFromCloud(item);
      } catch (eImg) {
        console.warn("Image cleanup before delete (continuing):", eImg);
      }
      const { error } = await supabaseClient.from(WARDROBE_TABLE).delete().eq("id", sid);
      if (error) throw error;

      wardrobeBase = wardrobeBase.filter((row) => String(row?.id ?? "") !== sid);

      if (isCustom) {
        stripCustomIdsFromLocalStorage([sid]);
        await mirrorLocalCustomItemsToProjectFile();
      }

      try {
        const all = loadArchiveOverrides();
        if (Object.prototype.hasOwnProperty.call(all, sid)) {
          delete all[sid];
          await saveArchiveOverrides(all);
        }
      } catch (e) {
        console.warn(e);
      }

      const hidden = loadArchiveHiddenIds();
      hidden.add(sid);
      await saveArchiveHiddenIds(hidden);
    } catch (e) {
      cloudBackedCustomItems = prevCloud;
      try {
        if (useCloudOutfits && isSupabaseReady()) {
          const api = await import("./js/supabase-client.js");
          const res = await api.fetchOutfits(supabaseClient);
          if (res.ok) {
            savedOutfits = (res.outfits || [])
              .map((o) => normalizeSavedOutfitRecord(o))
              .filter(Boolean);
          }
        }
      } catch (e2) {
        console.warn("fetchOutfits after delete failure", e2);
      }
      toastCloudDeleteFailure("row", e);
      return;
    }

    mergeWardrobeFromSources();

    if (document.getElementById("grid")) {
      initFilters();
      onOutfitChange();
      renderSavedOutfits();
    }

    showToast("Piece removed.");

    if (!document.getElementById("grid") && String(detailItemId) === sid) {
      globalThis.location.href = SITE_HOME_URL;
    }
  }

  async function handleAddItemSubmit(ev) {
    ev.preventDefault();
    const form = /** @type {HTMLFormElement} */ (ev.target);
    const brand = document.getElementById("add-item-brand")?.value?.trim() || "";
    const name = document.getElementById("add-item-name")?.value?.trim() || "";
    const browseSlot = document.getElementById("add-item-category")?.value || "";
    const recordPick = document.getElementById("add-item-record-type")?.value?.trim() || "";
    const season = normalizeStoredItemSeason(document.getElementById("add-item-season")?.value?.trim() || "");
    const category = resolveCategoryForBrowseSlot(browseSlot, recordPick, season, {});
    const colourVal = document.getElementById("add-item-colour")?.value?.trim() || "";
    const colourCodeInput = document.getElementById("add-item-colour-code")?.value?.trim() || "";
    const fabric = document.getElementById("add-item-fabric")?.value?.trim() || "";
    const weight = document.getElementById("add-item-weight")?.value?.trim() || "";
    const size = document.getElementById("add-item-size")?.value?.trim() || "";
    const mRows = readMeasurementRowsFromEditor(document.getElementById("add-item-measured-dims-block"));
    const measureUnit = parseMeasurementUnitInput(document.getElementById("add-item-measurement-unit")?.value);
    const measuredDimensions = mRows.length ? measurementRowsToSummaryString(mRows, measureUnit) : "";
    const purchaseDate = joinPurchaseDateFromForm(
      document.getElementById("add-item-purchase-date")?.value?.trim() || "",
      document.getElementById("add-item-purchase-date-note")?.value?.trim() || ""
    );
    const priceRaw = document.getElementById("add-item-price")?.value?.trim() || "";
    const priceCur =
      String(document.getElementById("add-item-price-currency")?.value ?? "TWD").trim().toUpperCase() || "TWD";
    let priceVal = parsePriceAmountFlexible(priceRaw);
    if (!Number.isFinite(priceVal) || priceVal < 0) priceVal = null;
    const notes = document.getElementById("add-item-notes")?.value?.trim() || "";
    const photosInput = document.getElementById("add-item-photos");
    const photoFiles = photosInput?.files ? Array.from(photosInput.files) : [];
    const file = photoFiles[0];
    const galleryFiles = photoFiles.slice(1);
    if (!brand || !name || !browseSlot) {
      showAddItemFormMsg("Fill required fields (brand, name, section).", true);
      return;
    }
    if (!isSupabaseReady()) {
      showAddItemFormMsg(CLOUD_WRITE_REQUIRED_MESSAGE, true);
      showToast(CLOUD_WRITE_REQUIRED_MESSAGE);
      return;
    }

    if (file || galleryFiles.length) showAddItemFormMsg("Processing images…", false);

    const newId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? `custom-${crypto.randomUUID()}`
        : `custom-${Date.now()}`;

    let dataUrl = "";
    if (file) {
      try {
        dataUrl = isSupabaseReady()
          ? await uploadWardrobeImageFileToCloud(file, newId, { type: "main_cover" })
          : await fileToStorageDataUrl(file);
      } catch (err) {
        console.warn(err);
        showAddItemFormMsg(messageForCloudUploadFailure("main cover", err), true);
        return;
      }
    }
    const MAX_GALLERY = 12;
    /** @type {string[]} */
    const galleryUrls = [];
    const gallerySlice = galleryFiles.slice(0, MAX_GALLERY);
    for (let gi = 0; gi < gallerySlice.length; gi++) {
      const gf = gallerySlice[gi];
      try {
        galleryUrls.push(
          isSupabaseReady()
            ? await uploadWardrobeImageFileToCloud(gf, newId, { type: "main_gallery", index: gi + 1 })
            : await fileToStorageDataUrl(gf, { preferJpeg: true })
        );
      } catch (err) {
        console.warn(err);
        showAddItemFormMsg(messageForCloudUploadFailure(`gallery image #${gi + 1}`, err), true);
      }
    }

    const galleryDeduped = galleryUrls.filter((u) => u && u !== dataUrl);

    const colourTrim = String(colourVal ?? "").trim();
    const colourCodeTrim = String(colourCodeInput ?? "").trim();
    const rawBasicPick = String(document.getElementById("add-item-basic-colour")?.value ?? "").trim();
    const newItem = {
      id: newId,
      brand,
      name,
      section: "",
      category,
      season,
      colour: colourTrim,
      fabric,
      weight,
      size,
      measuredDimensions,
      purchaseDate,
      image: dataUrl,
      gallery: galleryDeduped,
      notes,
      pillar: "",
    };
    if (colourCodeTrim) newItem.colourCode = colourCodeTrim;
    if (rawBasicPick.toLowerCase() === BASIC_COLOUR_CLASSIFICATION_OMIT) {
      newItem.basicColour = BASIC_COLOUR_CLASSIFICATION_OMIT;
    } else {
      const basicPick = normalizeStoredBasicColourKey(rawBasicPick);
      if (basicPick) newItem.basicColour = basicPick;
    }
    if (priceVal != null) {
      newItem.price = priceVal;
      newItem.priceCurrency = PRICE_CURRENCY_CODES.includes(priceCur) ? priceCur : "TWD";
    }
    if (mRows.length) {
      newItem.measurementRows = mRows;
      newItem.measurementUnit = measureUnit;
      newItem.metadata = {
        ...(newItem.metadata && typeof newItem.metadata === "object" ? newItem.metadata : {}),
        measurementRows: mRows,
        measurementUnit: measureUnit,
      };
    }

    try {
      const savedCloudItem = await saveWardrobeItemToCloud(newItem);
      stampWardrobeItemMediaNonce(savedCloudItem);
      upsertWardrobeBaseRowInMemory(savedCloudItem);
      cloudBackedCustomItems = [
        savedCloudItem,
        ...cloudBackedCustomItems.filter((x) => String(x.id) !== String(savedCloudItem.id)),
      ];

      mergeWardrobeFromSources();
      initFilters();
      renderGrid();
      form.reset();
      resetAddItemMeasurementBlock();
      showAddItemFormMsg("Saved to Supabase.", false);
      showToast("Saved to cloud.");
      document.getElementById("add-item-dialog")?.close();
      return;
    } catch (err) {
      console.warn(err);
      showAddItemFormMsg(`Cloud row save failed: ${messageForFailedWardrobeUpsert(err)}`, true);
      return;
    }
  }

  /**
   * Clone any visible piece into a new `custom-*` row (same image URLs / data; name gets " (copy)").
   * Archive seed rows become a new custom entry; does not change seed files.
   */
  function buildDuplicateCustomItem(src) {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? `custom-${crypto.randomUUID()}`
        : `custom-${Date.now()}`;
    const nameBase = String(src?.name ?? "").trim();
    const dupName = nameBase ? `${nameBase} (copy)` : "Untitled (copy)";

    const main = String(src?.image ?? "").trim();
    const galleryDeduped = dedupeGalleryUrls(main, itemGalleryList(src), 12);

    /** @type {Record<string, unknown>} */
    const dup = {
      id,
      brand: String(src?.brand ?? "").trim(),
      name: dupName,
      section: String(src?.section ?? "").trim(),
      category: String(src?.category ?? "").trim(),
      season: normalizeStoredItemSeason(src?.season),
      colour: String(src?.colour ?? src?.color ?? "").trim(),
      fabric: String(src?.fabric ?? "").trim(),
      weight: String(src?.weight ?? "").trim(),
      size: String(src?.size ?? "").trim(),
      measuredDimensions: String(src?.measuredDimensions ?? src?.measured_dimensions ?? "").trim(),
      purchaseDate: String(src?.purchaseDate ?? src?.purchase_date ?? "").trim(),
      image: main,
      notes: String(src?.notes ?? "").trim(),
      pillar: String(src?.pillar ?? "").trim(),
    };
    if (Number.isFinite(Number(src?.price))) {
      dup.price = Number(src.price);
      dup.priceCurrency = PRICE_CURRENCY_CODES.includes(String(src?.priceCurrency ?? "").trim().toUpperCase())
        ? String(src.priceCurrency).trim().toUpperCase()
        : "TWD";
    }
    if (galleryDeduped.length) dup.gallery = galleryDeduped;

    const cc = itemColourCode(src);
    if (cc) dup.colourCode = cc;
    const rawBcTop = String(
      src?.basicColour ??
        (src?.metadata && typeof src.metadata === "object" && !Array.isArray(src.metadata)
          ? /** @type {any} */ (src.metadata).basicColour
          : "") ??
        ""
    ).trim();
    if (rawBcTop.toLowerCase() === BASIC_COLOUR_CLASSIFICATION_OMIT) {
      dup.basicColour = BASIC_COLOUR_CLASSIFICATION_OMIT;
    } else {
      const bcTop = normalizeStoredBasicColourKey(rawBcTop);
      if (bcTop) dup.basicColour = bcTop;
    }

    const mr = getMeasurementRows(src);
    const mu = getMeasurementUnit(src);
    if (mr.length) {
      dup.measurementRows = mr;
      dup.measurementUnit = mu;
      dup.metadata =
        src?.metadata && typeof src.metadata === "object" && !Array.isArray(src.metadata)
          ? { ...src.metadata, measurementRows: mr, measurementUnit: mu }
          : { measurementRows: mr, measurementUnit: mu };
    } else if (src?.metadata && typeof src.metadata === "object" && !Array.isArray(src.metadata)) {
      dup.metadata = { ...src.metadata };
    }

    const vars = getItemColourVariants(src);
    if (vars?.length) {
      dup.colourVariants = vars.map((v) => {
        const vim = String(v.image ?? "").trim();
        const g = dedupeGalleryUrls(vim, Array.isArray(v.gallery) ? v.gallery : [], 12);
        const col = String(v.colour ?? v.color ?? "").trim();
        const bv = normalizeStoredBasicColourKey(v.basicColour);
        return {
          key: String(v.key ?? "").trim(),
          label: String(v.label ?? "").trim(),
          colour: col,
          colourCode: String(v.colourCode ?? "").trim(),
          image: vim,
          previewImage: String(v.previewImage ?? "").trim(),
          notes: String(v.notes ?? "").trim(),
          gallery: g,
          ...(bv ? { basicColour: bv } : {}),
        };
      });
    }

    return /** @type {typeof src} */ (dup);
  }

  /** Insert one new custom row using the same paths as “Add a piece” (Supabase vs localStorage + optional shrink). */
  async function persistNewCustomItemRow(row) {
    if (!isSupabaseReady()) throw new Error(CLOUD_WRITE_REQUIRED_MESSAGE);
    const saved = await saveWardrobeItemToCloud(row);
    stampWardrobeItemMediaNonce(saved);
    upsertWardrobeBaseRowInMemory(saved);
    cloudBackedCustomItems = [
      saved,
      ...cloudBackedCustomItems.filter((x) => String(x.id) !== String(saved.id)),
    ];
    mergeWardrobeFromSources();
    return String(saved.id);
  }

  /** @type {boolean} */
  let addItemFormWired = false;

  function initAddItemForm() {
    if (!isTwAdminMode()) return;
    if (addItemFormWired) return;
    const form = document.getElementById("add-item-form");
    const cat = document.getElementById("add-item-category");
    const recordSel = document.getElementById("add-item-record-type");
    const photosInput = document.getElementById("add-item-photos");
    const preview = document.getElementById("add-item-preview");
    if (!form || !cat || !recordSel) return;
    addItemFormWired = true;
    cat.innerHTML = "";
    for (const c of SLOT_OPTIONS) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = categoryDisplayLabel(c);
      cat.appendChild(o);
    }

    function syncAddItemRecordTypes(preferRecordType = "") {
      fillItemEditRecordTypeSelect(recordSel, cat.value, preferRecordType);
    }

    function applyCurrentBrowseContextToAddItemForm() {
      const slot = String(categoryNavFilter ?? "").trim();
      if (!slot || !SLOT_OPTIONS.includes(slot)) {
        syncAddItemRecordTypes("");
        return;
      }
      cat.value = slot;
      const prefer = String(subcategoryFilter ?? "").trim();
      syncAddItemRecordTypes(prefer);
    }
    cat.addEventListener("change", () => syncAddItemRecordTypes(""));
    syncAddItemRecordTypes();

    photosInput?.addEventListener("change", () => {
      const f = photosInput.files?.[0];
      if (!preview) return;
      if (!f) {
        preview.hidden = true;
        preview.removeAttribute("src");
        return;
      }
      const u = URL.createObjectURL(f);
      preview.onload = () => URL.revokeObjectURL(u);
      preview.src = u;
      preview.hidden = false;
    });

    form.addEventListener("submit", (e) => void handleAddItemSubmit(e));
    form.addEventListener("reset", () => {
      requestAnimationFrame(() => {
        if (!preview) return;
        preview.hidden = true;
        preview.removeAttribute("src");
        showAddItemFormMsg("", false);
        syncAddItemRecordTypes();
        resetAddItemMeasurementBlock();
      });
    });

    const addDlg = document.getElementById("add-item-dialog");
    const openAdd = document.getElementById("add-item-open");
    const closeAdd = document.getElementById("add-item-close");
    openAdd?.setAttribute("aria-haspopup", "dialog");
    openAdd?.setAttribute("aria-expanded", "false");
    addDlg?.addEventListener("close", () => {
      openAdd?.setAttribute("aria-expanded", "false");
    });
    openAdd?.addEventListener("click", () => {
      if (!addDlg) return;
      applyCurrentBrowseContextToAddItemForm();
      try {
        addDlg.showModal();
      } catch {
        /* already open */
      }
      openAdd?.setAttribute("aria-expanded", "true");
      queueMicrotask(() => {
        document.getElementById("add-item-brand")?.focus();
        resetAddItemMeasurementBlock();
      });
    });
    closeAdd?.addEventListener("click", () => addDlg?.close());
    addDlg?.addEventListener("click", (e) => {
      if (e.target === addDlg) addDlg.close();
    });

    document.getElementById("add-item-export-custom-json")?.addEventListener("click", () => {
      downloadCustomItemsJsonForRepo();
    });
    document.getElementById("add-item-sync-custom-to-project")?.addEventListener("click", () => {
      void pullBrowserCustomItemsIntoProjectFile();
    });

    resetAddItemMeasurementBlock();
  }

  function isArchiveCardCoarsePointer() {
    return globalThis.matchMedia?.("(max-width: 900px), (hover: none), (pointer: coarse)")?.matches ?? false;
  }

  function isArchiveGridCardContext() {
    return document.body.classList.contains("archive-page") && !!document.getElementById("grid");
  }

  function archiveGridHoverGalleryUrl(item) {
    const list = itemGalleryList(item);
    const u = String(list[0] ?? "").trim();
    if (!u || !isDisplayableCloudImageUrl(u)) return "";
    return wardrobeImageForFrame(u, item, ARCHIVE_GRID_CARD_RENDER);
  }

  function wireArchiveCardHoverGallery(article, img, resolveCoverItem) {
    if (!isArchiveGridCardContext()) return;
    if (globalThis.matchMedia?.("(max-width: 900px)")?.matches) return;

    const restoreCover = () => {
      const cover = String(img.dataset.coverSrc ?? "").trim();
      if (cover) img.src = cover;
    };
    const showHoverGallery = () => {
      const hoverUrl = archiveGridHoverGalleryUrl(resolveCoverItem());
      if (!hoverUrl || !String(img.dataset.coverSrc ?? "").trim()) return;
      img.src = hoverUrl;
    };

    article.addEventListener("mouseenter", showHoverGallery);
    article.addEventListener("mouseleave", restoreCover);
    article.addEventListener("focusin", showHoverGallery);
    article.addEventListener("focusout", (ev) => {
      const next = ev.relatedTarget;
      if (next instanceof Node && article.contains(next)) return;
      restoreCover();
    });
  }

  function mountArchiveCardBoardInHoverChrome(media, boardAddBtn, { hasColourTray = false } = {}) {
    if (!boardAddBtn) return;
    boardAddBtn.classList.add("card__board-add--archive-hover");
    if (hasColourTray) {
      const trayInner = media.querySelector(".card__colour-tray__inner");
      if (trayInner) {
        trayInner.appendChild(boardAddBtn);
        return;
      }
    }
    const bar = document.createElement("div");
    bar.className = "card__hover-bar card__hover-bar--solo";
    const inner = document.createElement("div");
    inner.className = "card__hover-bar__inner";
    inner.appendChild(boardAddBtn);
    bar.appendChild(inner);
    media.appendChild(bar);
  }

  function stylingBoardCtaLabel(blocked) {
    return blocked ? "on board" : "+style";
  }

  function dismissArchiveCardStylingReveal(except) {
    if (!els.grid) return;
    els.grid.querySelectorAll(".card--styling-reveal").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (except && node === except) return;
      node.classList.remove("card--styling-reveal");
    });
  }

  function createCard(item, cardOpts = {}) {
    const variants = getItemColourVariants(item);
    const inOutfit = outfitIdSet().has(item.id);
    const allVariantKeys =
      variants?.map((v) => v.key) ??
      [];
    const takenKeys = new Set(
      currentOutfitSlots.filter((s) => s.itemId === item.id && s.colourKey).map((s) => String(s.colourKey))
    );
    const everyVariantTaken =
      Boolean(variants?.length) && allVariantKeys.length > 0 && allVariantKeys.every((k) => takenKeys.has(k));
    const singleTaken = !variants?.length && outfitSlotKeySet().has(outfitSlotKey({ itemId: item.id }));

    const slotLab = itemSlot(item);
    const recKey = recordCategoryForDrill(item, slotLab);

    const colourBucket = getFilters().basicColour;
    const variantKeyForHero =
      variants?.length && colourBucket ? firstVariantKeyMatchingBasicColourBucket(item, colourBucket) : "";
    const cardCoverItem =
      variantKeyForHero ? itemProjectionForOutfitSlot(item, { itemId: String(item.id), colourKey: variantKeyForHero }) : item;

    const article = document.createElement("article");
    const outfitHighlight = inOutfit && itemEligibleForOutfit(item);
    let cardClass = "card" + (outfitHighlight ? " card--in-outfit" : "");
    if (cardOpts.skipEnterAnimation) cardClass += " card--no-enter";
    article.className = cardClass;
    article.setAttribute("role", "listitem");
    article.dataset.itemId = String(item.id);

    const media = document.createElement("div");
    media.className = "card__media card__media--opens-detail";
    if (variants && variants.length > 1) media.classList.add("card__media--variant-colours");

    const img = document.createElement("img");
    img.className = "card__media-img";
    img.alt = imageAltForItem(cardCoverItem);
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    img.sizes = "(max-width: 900px) 50vw, 33vw";
    if (cardOpts.fetchPriority === "high") img.fetchPriority = "high";
    wireCoverImageWithFallbacks(img, cardCoverItem, {
      host: media,
      coverRenderWidth: ARCHIVE_GRID_CARD_RENDER.width,
      coverRenderHeight: ARCHIVE_GRID_CARD_RENDER.height,
      coverRenderQuality: ARCHIVE_GRID_CARD_RENDER.quality,
      coverRenderResize: ARCHIVE_GRID_CARD_RENDER.resize,
      onResolved(url) {
        img.dataset.coverSrc = url;
        const ti = media.querySelector(".card__gallery-strip .card__gallery-thumb.is-active img");
        if (ti) ti.src = url;
      },
    });

    media.appendChild(img);

    const rawSe = normalizeSeason(item.season);
    if (rawSe === "AW" || rawSe === "SS") {
      const chip = document.createElement("span");
      chip.className = "card__season-chip";
      chip.textContent = rawSe === "SS" ? "S/S" : "A/W";
      media.appendChild(chip);
    }

    /** @type {HTMLButtonElement | null} */
    let boardAddBtn = null;
    if (itemEligibleForOutfit(item)) {
      boardAddBtn = document.createElement("button");
      boardAddBtn.type = "button";
      boardAddBtn.className = "card__board-add";
      boardAddBtn.dataset.outfitAdd = item.id;
      const blocked = everyVariantTaken || singleTaken;
      if (variants?.length) {
        boardAddBtn.title = everyVariantTaken
          ? "Every colour is already on your styling board."
          : "Add a colour to Styling Board";
      } else {
        boardAddBtn.title = blocked ? "Already on styling board." : "Add to Styling Board";
      }
      boardAddBtn.setAttribute("aria-label", boardAddBtn.title);
      boardAddBtn.textContent = stylingBoardCtaLabel(blocked);
      boardAddBtn.disabled = Boolean(blocked);
    }

    const openHint = "Open piece";
    media.title = openHint;
    function openCardDetail(ev) {
      openItemDetail(String(item.id), ev);
    }
    media.addEventListener("click", (ev) => {
      if (ev.target.closest(".card__board-add, .card__quick-outfit")) return;
      if (ev.target.closest(".card__swatch--pick")) return;
      if (ev.target.closest(".card__colour-tray")) return;
      if (ev.target.closest(".card__gallery-thumb")) return;
      if (ev.target.closest(".card__season-chip")) return;
      if (isArchiveCardCoarsePointer() && boardAddBtn && !boardAddBtn.disabled) {
        if (!article.classList.contains("card--styling-reveal")) {
          dismissArchiveCardStylingReveal(article);
          article.classList.add("card--styling-reveal");
          return;
        }
      }
      dismissArchiveCardStylingReveal();
      openCardDetail(ev);
    });

    const body = document.createElement("div");
    body.className = "card__body";

    const title = document.createElement("h2");
    title.className = "card__title card__title--opens-detail";
    title.textContent = displayNameWithoutLeadingColour(item);
    title.title = openHint;
    title.tabIndex = 0;
    title.addEventListener("click", openCardDetail);
    title.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      openCardDetail(ev);
    });

    const brand = document.createElement("p");
    brand.className = "card__brand";
    brand.textContent = item.brand;

    const metaLine = document.createElement("p");
    metaLine.className = "card__meta-line";
    const colourLabel = colourLabelForItem(item);
    metaLine.textContent = [colourLabel, item.size ? `Size ${String(item.size).trim()}` : ""]
      .filter(Boolean)
      .join(" · ");

    body.appendChild(title);
    body.appendChild(brand);
    body.appendChild(metaLine);

    const hasColourTray = Boolean(variants && variants.length > 1);
    if (hasColourTray) {
      mountVariantSwatchStrip(media, item, {
        outfitPick: true,
        heroImg: img,
        heroHost: media,
        showHeroGallery: false,
        gridColourTray: true,
        heroInitialColourKey: variantKeyForHero || undefined,
      });
    }
    mountArchiveCardBoardInHoverChrome(media, boardAddBtn, { hasColourTray });

    const resolveCoverItemForHover = () => {
      const active = media.querySelector(".card__swatch.is-active");
      const ck = active instanceof HTMLElement ? String(active.dataset.variantKey ?? "").trim() : "";
      if (ck) return itemProjectionForOutfitSlot(item, { itemId: String(item.id), colourKey: ck });
      return cardCoverItem;
    };
    wireArchiveCardHoverGallery(article, img, resolveCoverItemForHover);

    const specs = document.createElement("ul");
    specs.className = "card__specs card__specs--hover";
    const fr = friendlyRecordCategory(recKey) || recKey;
    [fr, categoryDisplayLabel(slotLab), ...specParts(item, { forGridCard: true })].filter(Boolean).forEach((part) => {
      const li = document.createElement("li");
      li.textContent = part;
      specs.appendChild(li);
    });
    const showPurchaseOnCard = archiveSortMode === "date-desc";
    if (showPurchaseOnCard && item.purchaseDate) {
      const li = document.createElement("li");
      li.textContent = formatPurchaseDateForDisplay(item.purchaseDate);
      specs.appendChild(li);
    }

    if (specs.children.length) body.appendChild(specs);

    {
      const priceBrief = formattedArchivePriceLine(item, { brief: true });
      if (priceBrief) {
        const priceEl = document.createElement("p");
        priceEl.className = "card__price-subtle card__price-subtle--hover";
        priceEl.textContent = priceBrief;
        const priceFull = formattedArchivePriceLine(item);
        if (priceFull !== priceBrief) priceEl.title = priceFull;
        body.appendChild(priceEl);
      }
    }

    article.appendChild(media);
    article.appendChild(body);
    {
      const summary = buildCardNativeTitleSummary(item);
      if (summary) article.title = summary;
    }
    return article;
  }

  /** Structural key for main grid: invalidates when wardrobe, filters, sort, or currency changes. */
  let lastGridStructuralKey = "";

  /** Outfit slots key: when only this changes, patch card UI in place. */
  let lastGridOutfitKey = "";

  function buildArchiveGridStructuralKey(sorted, searchNorm) {
    const ids = sorted.map((x) => String(x.id)).join("\x1f");
    return [
      seasonNavFilter,
      categoryNavFilter,
      String(subcategoryFilter ?? "").trim(),
      searchNorm,
      String(archiveSubmittedSearchNorm ?? "").trim(),
      String(archiveSearchWithinRecordCategory ?? "").trim(),
      archiveSearchBrowseAllSlots ? "1" : "0",
      basicColourFilter,
      [...selectedBrandFilters].sort().join("\x1f"),
      archiveSortMode,
      archiveDisplayCurrency,
      String(wardrobeRevision),
      String(sorted.length),
      ids,
    ].join("\x1e");
  }

  function buildArchiveGridOutfitKey() {
    return currentOutfitSlots.map((s) => `${s.itemId}\x1d${s.colourKey ?? ""}`).join("\x1c");
  }

  /** @returns {boolean} false if DOM order/id mismatch — caller should full-rebuild grid. */
  function syncArchiveGridCardsOutfitUi(sorted) {
    if (!els.grid) return false;
    const rows = els.grid.querySelectorAll(":scope > .card[data-item-id]");
    if (rows.length !== sorted.length) return false;
    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const article = rows[i];
      if (!(article instanceof HTMLElement)) return false;
      if (article.dataset.itemId !== String(item.id)) return false;

      const inOutfit = outfitIdSet().has(item.id);
      const outfitHighlight = inOutfit && itemEligibleForOutfit(item);
      article.classList.toggle("card--in-outfit", Boolean(outfitHighlight));

      const quick = article.querySelector(".card__board-add, .card__quick-outfit");
      if (!quick) continue;

      const variants = getItemColourVariants(item);
      const allVariantKeys = variants?.map((v) => v.key) ?? [];
      const takenKeys = new Set(
        currentOutfitSlots.filter((s) => s.itemId === item.id && s.colourKey).map((s) => String(s.colourKey))
      );
      const everyVariantTaken =
        Boolean(variants?.length) && allVariantKeys.length > 0 && allVariantKeys.every((k) => takenKeys.has(k));
      const singleTaken = !variants?.length && outfitSlotKeySet().has(outfitSlotKey({ itemId: item.id }));

      const blocked = everyVariantTaken || singleTaken;
      quick.textContent = stylingBoardCtaLabel(blocked);
      /** @type {HTMLButtonElement} */ (quick).disabled = Boolean(blocked);
      if (variants?.length) {
        quick.title = everyVariantTaken
          ? "Every colour is already on your styling board."
          : "Add a colour to Styling Board";
      } else {
        quick.title = blocked ? "Already on styling board." : "Add to Styling Board";
      }
      quick.setAttribute("aria-label", quick.title);
    }
    return true;
  }

  function isCustomWardrobeItem(item) {
    return item && typeof item.id === "string" && item.id.startsWith("custom-");
  }

  function compareGridItems(a, b) {
    if (archiveSortMode === "price-asc" || archiveSortMode === "price-desc") {
      const pa = priceSortComparableInDisplayCurrency(a);
      const pb = priceSortComparableInDisplayCurrency(b);
      if (pa == null && pb == null) return compareArchiveGridItems(a, b);
      if (pa == null) return 1;
      if (pb == null) return -1;
      const cmp = pa - pb;
      if (cmp !== 0) return archiveSortMode === "price-desc" ? -cmp : cmp;
      return compareArchiveGridItems(a, b);
    }
    if (archiveSortMode === "date-asc" || archiveSortMode === "date-desc") {
      const da = purchaseDateSortMs(a);
      const db = purchaseDateSortMs(b);
      if (da == null && db == null) return compareArchiveGridItems(a, b);
      if (da == null) return 1;
      if (db == null) return -1;
      const cmp = da - db;
      if (cmp !== 0) return archiveSortMode === "date-desc" ? -cmp : cmp;
      return compareArchiveGridItems(a, b);
    }
    return compareArchiveGridItems(a, b);
  }

  /**
   * List order: when not filtered by drill record-type, outer → jackets → … → bottoms → shoes → …
   * then brand / name. With a drill sub-type active, preserve archive seed order inside that type.
   */
  function compareArchiveGridItems(a, b) {
    const drilled = Boolean(String(subcategoryFilter ?? "").trim());
    if (!drilled) {
      const tax = compareByTaxonomy(a, b);
      if (tax !== 0) return tax;
      const ka = `${String(a?.brand ?? "")}\0${String(a?.name ?? "")}\0${String(a?.id ?? "")}`;
      const kb = `${String(b?.brand ?? "")}\0${String(b?.name ?? "")}\0${String(b?.id ?? "")}`;
      return ka.localeCompare(kb, undefined, { sensitivity: "base" });
    }

    const ca = isCustomWardrobeItem(a);
    const cb = isCustomWardrobeItem(b);
    if (ca !== cb) return ca ? -1 : 1;
    if (ca) {
      const ka = `${String(a?.brand ?? "")}\0${String(a?.name ?? "")}\0${String(a?.id ?? "")}`;
      const kb = `${String(b?.brand ?? "")}\0${String(b?.name ?? "")}\0${String(b?.id ?? "")}`;
      return ka.localeCompare(kb, undefined, { sensitivity: "base" });
    }
    const oa = Number.isFinite(a?.__archiveOrdinal) ? a.__archiveOrdinal : 1e9;
    const ob = Number.isFinite(b?.__archiveOrdinal) ? b.__archiveOrdinal : 1e9;
    if (oa !== ob) return oa - ob;
    return String(a?.id ?? "").localeCompare(String(b?.id ?? ""), undefined, { sensitivity: "base" });
  }

  const ARCHIVE_ALL_TYPES_LABEL = "All Types";
  const ARCHIVE_HEADING_DEFAULT_TITLE = "Collection";

  /** Season token for line 1 (`COLLECTION / … /`). */
  function archiveHeadingSeasonLabel() {
    if (seasonNavFilter === "SS") return "S / S";
    if (seasonNavFilter === "AW") return "A / W";
    return "ALL SEASONS";
  }

  function archiveHeadingAtCollectionRoot() {
    const cat = String(categoryNavFilter ?? "").trim();
    const sub = String(subcategoryFilter ?? "").trim();
    return !cat && !sub && !seasonNavFilter && !narrowingFiltersActive();
  }

  /** Archive root — all seasons, no division drill, no narrowing filters. */
  function navigateArchiveCollectionRoot() {
    resetAllArchiveFilters();
    scrollArchiveViewportTop();
  }

  /** Clear season tab only; keep parent division / subcategory drill when set. */
  function navigateArchiveAllSeasonsKeepDivision() {
    if (!seasonNavFilter) return;
    seasonNavFilter = null;
    try {
      persistSeasonNav();
    } catch {
      /* ignore */
    }
    replaceArchiveSeasonQuery(seasonNavFilter);
    syncSeasonTabUI();
    renderGrid();
  }

  function renderArchiveHeadingBreadcrumb(host, { searchActive = false } = {}) {
    if (!host) return;
    host.replaceChildren();

    const nav = document.createElement("nav");
    nav.className = "archive-heading__breadcrumb";
    nav.setAttribute("aria-label", "Collection breadcrumb");

    function appendSep() {
      const sep = document.createElement("span");
      sep.className = "archive-heading__crumb-sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = " / ";
      nav.appendChild(sep);
    }

    function appendCrumb(label, { onClick = null, isCurrent = false } = {}) {
      if (isCurrent || !onClick) {
        const el = document.createElement("span");
        el.className = "archive-heading__crumb archive-heading__crumb--current";
        el.textContent = label;
        nav.appendChild(el);
        return;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "archive-heading__crumb archive-heading__crumb--link";
      btn.textContent = label;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        onClick();
      });
      nav.appendChild(btn);
    }

    const atRoot = archiveHeadingAtCollectionRoot();
    appendCrumb("COLLECTION", {
      onClick: navigateArchiveCollectionRoot,
      isCurrent: atRoot && !searchActive,
    });
    appendSep();

    if (searchActive) {
      appendCrumb("SEARCH", { isCurrent: true });
    } else {
      const seasonAll = !seasonNavFilter;
      appendCrumb(archiveHeadingSeasonLabel(), {
        onClick: navigateArchiveAllSeasonsKeepDivision,
        isCurrent: seasonAll,
      });
    }
    appendSep();

    host.appendChild(nav);
  }

  /** Line 2 — parent division only; subcategories stay in drill pills / filter chips. */
  function archiveHeadingTitleLine(parentCategory) {
    const cat = String(parentCategory ?? "").trim();
    if (cat) return categoryDisplayLabel(cat);
    return ARCHIVE_HEADING_DEFAULT_TITLE;
  }

  function resolveArchiveSearchTitleLine(qNorm) {
    const rawQ =
      headerSearchOverlayArchiveSearchFrozen && headerSearchOverlayOpeningQueryRaw != null
        ? headerSearchOverlayOpeningQueryRaw
        : archiveSubmittedSearchRaw || String(els.search?.value ?? "").trim();
    return rawQ.length > 0 ? `Results for “${rawQ}”` : `Results for “${qNorm}”`;
  }

  /** Two-line editorial archive heading (context trail + serif title). */
  function renderArchiveHeading({
    titleLine = ARCHIVE_HEADING_DEFAULT_TITLE,
    hidden = false,
    searchActive = false,
  } = {}) {
    const root = document.getElementById("archive-heading");
    const elContext = document.getElementById("archive-heading-context");
    const elTitle = document.getElementById("items-toolbar-page-title");
    if (!root || !elContext || !elTitle) return;

    root.hidden = hidden;
    if (hidden) {
      elContext.replaceChildren();
      elTitle.textContent = "";
      elTitle.setAttribute("aria-hidden", "true");
      root.removeAttribute("aria-label");
      return;
    }

    const title = String(titleLine ?? "").trim() || ARCHIVE_HEADING_DEFAULT_TITLE;
    renderArchiveHeadingBreadcrumb(elContext, { searchActive });
    elContext.hidden = false;
    elTitle.hidden = false;
    elTitle.removeAttribute("aria-hidden");
    elTitle.textContent = title;
    elTitle.classList.remove("items-toolbar__page-title--placeholder");
    const trail = searchActive
      ? "COLLECTION / SEARCH /"
      : `COLLECTION / ${archiveHeadingSeasonLabel()} /`;
    root.setAttribute("aria-label", `${trail} ${title}`);
  }
  /** Per-slot subcategory drill / mega menu: view entire parent category (empty `subcategoryFilter`). */
  const SUBCATEGORY_ALL_LABEL = "All";

  function resolveCategoryJump(jump) {
    const j = String(jump ?? "").trim();
    return SLOT_OPTIONS.includes(j) ? j : "";
  }

  function applyCategoryNavFilter(nextSlot, { scrollTop = false } = {}) {
    const slot = String(nextSlot ?? "").trim();
    categoryNavFilter = SLOT_OPTIONS.includes(slot) ? slot : "";
    subcategoryFilter = "";
    noteArchiveSearchUserChoseMainSlotFilter();
    syncCategoryTabUI();
    validateSubcategoryFilter();
    renderCategoryDrill();
    syncFiltersMenuForViewport();
    renderGrid();
    if (scrollTop) scrollArchiveViewportTop();
  }

  /** Two-line editorial archive heading (context trail + serif title). */
  function syncArchiveToolbarHeading() {
    const root = document.getElementById("archive-heading");
    if (!root) return;
    const submitted = String(archiveSubmittedSearchNorm ?? "").trim();
    const qNorm = effectiveArchiveKeywordSearchNorm();
    const searchActive = Boolean((submitted && !isHeaderSearchWrapOpen()) || qNorm);
    const cat = String(categoryNavFilter ?? "").trim();
    const sub = String(subcategoryFilter ?? "").trim();
    const allSeasonsNav = !seasonNavFilter;
    const classicHome = !cat && !sub && !narrowingFiltersActive() && allSeasonsNav;
    const allPiecesLanding =
      classicHome && !archiveSubmittedSearchNorm && !qNorm && !isHeaderSearchWrapOpen();
    const defaultArchiveLanding =
      !cat && !sub && !narrowingFiltersActive() && !archiveSubmittedSearchNorm && !qNorm && !isHeaderSearchWrapOpen();

    document.body.classList.toggle("archive-ui--all-pieces-landing", allPiecesLanding);
    document.body.classList.toggle("archive-ui--default-archive-landing", defaultArchiveLanding);

    if (qNorm) {
      renderArchiveHeading({
        searchActive: true,
        titleLine: resolveArchiveSearchTitleLine(qNorm),
      });
      return;
    }

    renderArchiveHeading({
      searchActive: false,
      titleLine: archiveHeadingTitleLine(cat),
    });
  }

  function renderGrid() {
    if (!els.grid) return;
    dismissArchiveCardStylingReveal();
    const sorted = getArchiveSortedDataset();
    const filtered = sorted;
    els.grid.classList.toggle("grid--dense", sorted.length > GRID_DENSE_ANIMATION_THRESHOLD);
    syncArchiveFilterDrawerDoneLabel(filtered.length);
    syncFilterSearchFieldDomPlacement();
    syncArchiveSearchResultsPlpUi();
    syncArchiveCountLinePlacement();
    syncArchiveToolbarHeading();
    syncBasicColourFilterChipUi();
    syncArchiveBrandFilterChipUi();
    syncArchiveDrawerSubcategoryPills();
    syncCategoryFilterChip();
    syncColourFilterChip();
    syncSubcategoryFilterChip();
    syncToolbarActiveFilterChips();
    const searchNorm = effectiveArchiveKeywordSearchNorm();
    const structuralKey = buildArchiveGridStructuralKey(sorted, searchNorm);
    const outfitKey = buildArchiveGridOutfitKey();

    if (structuralKey === lastGridStructuralKey && outfitKey === lastGridOutfitKey) {
      syncFilterSearchFieldDomPlacement();
      syncArchiveSearchResultsPlpUi();
      syncToolbarActiveFilterChips();
      return;
    }

    const canPatchOutfitOnly =
      structuralKey === lastGridStructuralKey &&
      outfitKey !== lastGridOutfitKey &&
      els.grid.childElementCount === sorted.length;

    if (canPatchOutfitOnly && syncArchiveGridCardsOutfitUi(sorted)) {
      lastGridOutfitKey = outfitKey;
    } else {
      lastGridStructuralKey = structuralKey;
      lastGridOutfitKey = outfitKey;
      updateFilterSpendTotal(filtered);
      const frag = document.createDocumentFragment();
      for (let i = 0; i < sorted.length; i++) {
        frag.appendChild(
          createCard(sorted[i], {
            fetchPriority: i < 4 ? "high" : "auto",
            skipEnterAnimation: i >= 8,
          })
        );
      }
      els.grid.replaceChildren(frag);
    }

    const n = sorted.length;
    const seasonalTotal = countItemsForCurrentSeasonTab();
    const gridSearchNorm = effectiveArchiveKeywordSearchNorm();
    let countText = "";
    if (gridSearchNorm) {
      countText = `${n} piece${n === 1 ? "" : "s"}`;
    } else if (narrowingFiltersActive()) {
      countText =
        n === seasonalTotal
          ? `${n} piece${n === 1 ? "" : "s"}`
          : `${n} of ${seasonalTotal} piece${seasonalTotal === 1 ? "" : "s"}`;
    } else {
      countText = `${n} piece${n === 1 ? "" : "s"}`;
    }
    const spendText = els.spendTotal?.dataset.spendCompact || "";
    if (els.count) {
      els.count.textContent = spendText ? `${countText} · ${spendText}` : countText;
    }
    if (els.emptyMsg) {
      const onSeasonTab = Boolean(seasonNavFilter);
      if (gridSearchNorm) {
        els.emptyMsg.textContent = "No pieces match this search.";
      } else {
        els.emptyMsg.textContent = narrowingFiltersActive()
          ? onSeasonTab
            ? "Nothing matches that category, type, colour, or search on this season tab."
            : "Nothing matches that category, type, colour, or search."
          : onSeasonTab
            ? "No pieces on this season tab match."
            : "No pieces match.";
      }
    }
    if (els.emptyReset) els.emptyReset.hidden = !narrowingFiltersActive();
    if (els.emptyWrap) els.emptyWrap.hidden = n > 0;
    els.grid.hidden = n === 0;
    syncFilterSearchFieldDomPlacement();
    syncArchiveSearchResultsPlpUi();
    syncToolbarActiveFilterChips();
  }

  function updateFilterSpendTotal(filteredItems) {
    const el = els.spendTotal;
    if (!el) return;
    const total = sumPriceInDisplayCurrency(filteredItems);
    const prefix = effectiveArchiveKeywordSearchNorm()
      ? "Search results"
      : narrowingFiltersActive()
        ? "Filtered spend"
        : "Visible spend";
    const reduce = Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

    if (!Number.isFinite(total)) {
      const formatted = formatMoneyInCurrency(0, archiveDisplayCurrency);
      el.dataset.spendCompact = formatted;
      el.textContent = formatted;
      return;
    }

    const token = ++spendTotalAnimToken;
    if (spendTotalAnimRaf) cancelAnimationFrame(spendTotalAnimRaf);
    el.dataset.spendCompact = formatMoneyInCurrency(total, archiveDisplayCurrency);

    if (reduce) {
      spendTotalCurrentValue = total;
      el.textContent = el.dataset.spendCompact;
      return;
    }

    const start = spendTotalCurrentValue;
    const delta = total - start;
    const duration = 420;
    const t0 = performance.now();
    function step(now) {
      if (token !== spendTotalAnimToken) return;
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = start + delta * eased;
      const formatted = formatMoneyInCurrency(next, archiveDisplayCurrency);
      el.dataset.spendCompact = formatted;
      el.textContent = formatted;
      if (p < 1) {
        spendTotalAnimRaf = requestAnimationFrame(step);
      } else {
        spendTotalCurrentValue = total;
        spendTotalAnimRaf = 0;
      }
    }
    spendTotalAnimRaf = requestAnimationFrame(step);
  }

  function cancelSearchGridDebounce() {
    /* Kept for call sites — search is commit-only (Enter / submit / trending), no keystroke grid updates. */
  }

  function syncFilterSearchClearVisibility() {
    const btn = els.searchClear;
    if (btn) {
      const q = String(els.search?.value ?? "").trim();
      btn.hidden = !q;
    }
    syncSearchKeywordChip();
  }

  function flushSearchGridDebounceIfPending() {
    if (isHeaderSearchWrapOpen()) flushHeaderSearchOverlayUiDebounceIfPending();
  }

  let dragFromIndex = null;

  function syncBrandSignatureBarHeight() {
    const bar = document.querySelector(".site-utility-bar");
    const h = bar ? Math.ceil(bar.getBoundingClientRect().height) : 40;
    const px = `${Math.max(h, 36)}px`;
    document.documentElement.style.setProperty("--brand-signature-bar-height", px);
    if (globalThis.matchMedia?.("(max-width: 900px)")?.matches) {
      document.documentElement.style.setProperty("--site-mobile-shell-top", px);
    }
  }

  function syncStylingBoardUi() {
    const n = currentOutfitSlots.length;
    const countEl = document.getElementById("styling-board-count");
    const btn = document.getElementById("site-header-saved-toggle");
    if (countEl) {
      if (n > 0) {
        countEl.textContent = String(n);
        countEl.hidden = false;
      } else {
        countEl.hidden = true;
        countEl.textContent = "";
      }
    }
    if (btn) {
      btn.setAttribute("aria-expanded", stylingBoardDrawerOpen ? "true" : "false");
      const label = stylingBoardDrawerOpen ? "Close Styling Board" : "Open Styling Board";
      btn.setAttribute("aria-label", label);
      btn.title = "Styling Board";
    }
  }

  function openStylingBoardDrawer() {
    const root = document.getElementById("styling-board-drawer");
    if (!root) return;
    syncBrandSignatureBarHeight();
    stylingBoardDrawerOpen = true;
    if (root.hasAttribute("hidden")) {
      if (stylingBoardDrawerOpenRaf) {
        cancelAnimationFrame(stylingBoardDrawerOpenRaf);
        stylingBoardDrawerOpenRaf = 0;
      }
      stylingBoardDrawerFocusReturn = document.activeElement;
      root.removeAttribute("hidden");
      root.setAttribute("aria-hidden", "false");
      stylingBoardDrawerOpenRaf = requestAnimationFrame(() => {
        stylingBoardDrawerOpenRaf = 0;
        if (root.hasAttribute("hidden")) return;
        root.classList.add("styling-board-drawer--visible");
        document.body.classList.add("archive-ui--styling-board");
        syncStylingBoardUi();
        renderOutfitStrip();
        document.getElementById("styling-board-drawer-close")?.focus();
      });
    } else {
      syncStylingBoardUi();
      renderOutfitStrip();
    }
  }

  function closeStylingBoardDrawer() {
    const root = document.getElementById("styling-board-drawer");
    if (!root) return;
    stylingBoardDrawerOpen = false;
    if (stylingBoardDrawerOpenRaf) {
      cancelAnimationFrame(stylingBoardDrawerOpenRaf);
      stylingBoardDrawerOpenRaf = 0;
    }
    if (root.hasAttribute("hidden")) {
      document.body.classList.remove("archive-ui--styling-board");
      syncStylingBoardUi();
      return;
    }
    root.classList.remove("styling-board-drawer--visible");
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("archive-ui--styling-board");
    const returnFocus = stylingBoardDrawerFocusReturn;
    stylingBoardDrawerFocusReturn = null;
    const finish = () => {
      if (stylingBoardDrawerOpen) return;
      root.setAttribute("hidden", "");
      syncStylingBoardUi();
      if (returnFocus instanceof HTMLElement && document.contains(returnFocus)) {
        returnFocus.focus();
      }
    };
    const sheet = root.querySelector(".styling-board-drawer__sheet");
    if (sheet) {
      const onEnd = (e) => {
        if (e.target !== sheet || e.propertyName !== "transform") return;
        sheet.removeEventListener("transitionend", onEnd);
        finish();
      };
      sheet.addEventListener("transitionend", onEnd);
      setTimeout(finish, 400);
    } else {
      finish();
    }
  }

  function toggleStylingBoardDrawer() {
    if (stylingBoardDrawerOpen) closeStylingBoardDrawer();
    else openStylingBoardDrawer();
  }

  /** @deprecated alias */
  function syncOutfitBuilderPanel() {
    syncStylingBoardUi();
  }

  function renderOutfitStrip() {
    if (!els.outfitStrip) return;
    els.outfitStrip.innerHTML = "";
    const empty = currentOutfitSlots.length === 0;
    if (els.outfitEmpty) els.outfitEmpty.hidden = !empty;
    if (empty) {
      syncOutfitBuilderPanel();
      return;
    }

    currentOutfitSlots.forEach((pieceSlot, index) => {
      const item = itemById.get(pieceSlot.itemId);
      if (!item) return;
      const proj = itemProjectionForOutfitSlot(item, pieceSlot);
      const variant = getItemColourVariants(item)?.find((v) => v.key === pieceSlot.colourKey);

      const slot = document.createElement("div");
      slot.className = "outfit-slot";
      slot.setAttribute("role", "listitem");
      slot.draggable = true;
      slot.dataset.dragIndex = String(index);

      slot.addEventListener("dragstart", (e) => {
        dragFromIndex = index;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        slot.classList.add("outfit-slot--dragging");
      });

      slot.addEventListener("dragend", () => {
        dragFromIndex = null;
        slot.classList.remove("outfit-slot--dragging");
      });

      slot.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });

      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        const from =
          dragFromIndex != null
            ? dragFromIndex
            : parseInt(e.dataTransfer.getData("text/plain"), 10);
        const to = index;
        if (!Number.isFinite(from)) return;
        reorderOutfit(from, to);
      });

      const thumb = document.createElement("div");
      thumb.className = "outfit-slot__thumb";
      const simg = document.createElement("img");
      simg.alt = "";
      wireCoverImageWithFallbacks(simg, proj, {
        host: thumb,
        missingClass: null,
        coverRenderWidth: 132,
        coverRenderHeight: 176,
        coverRenderQuality: 78,
        coverRenderResize: "contain",
        onExhausted: () => {
          thumb.style.background = "transparent";
        },
      });
      thumb.appendChild(simg);

      const meta = document.createElement("div");
      meta.className = "outfit-slot__meta";
      const b = document.createElement("p");
      b.className = "outfit-slot__brand";
      b.textContent = item.brand;
      const nm = document.createElement("p");
      nm.className = "outfit-slot__name";
      nm.textContent = displayNameWithoutLeadingColour(item);
      meta.appendChild(b);
      meta.appendChild(nm);
      if (variant) {
        const col = document.createElement("p");
        col.className = "outfit-slot__colour";
        col.textContent = variantCaptionText(variant) || variant.label;
        meta.appendChild(col);
      }

      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn btn--small btn--ghost outfit-slot__remove";
      rm.textContent = "Remove";
      rm.dataset.outfitRemoveIndex = String(index);

      slot.appendChild(thumb);
      slot.appendChild(meta);
      slot.appendChild(rm);
      els.outfitStrip.appendChild(slot);
    });
    syncOutfitBuilderPanel();
  }

  function formatSavedDate(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }

  function renderSavedOutfits() {
    if (!els.savedList) return;
    els.savedList.innerHTML = "";
    const empty = savedOutfits.length === 0;
    els.savedEmpty.hidden = !empty;
    if (empty) return;

    for (const outfit of savedOutfits) {
      const li = document.createElement("li");
      const card = document.createElement("div");
      card.className = "saved-card";

      const body = document.createElement("div");
      body.className = "saved-card__body";
      const title = document.createElement("p");
      title.className = "saved-card__name";
      title.textContent = outfit.name;
      const meta = document.createElement("p");
      meta.className = "saved-card__meta";
      const slots = outfitSlotsFromRecord(outfit);
      const n = slots.filter((s) => itemById.has(s.itemId)).length;
      const dateStr = formatSavedDate(outfit.createdAt);
      const notes = String(outfit.notes ?? "").trim();
      meta.textContent = `${n} piece${n === 1 ? "" : "s"}${dateStr ? ` · ${dateStr}` : ""}${
        notes ? ` · ${notes.length > 48 ? `${notes.slice(0, 45)}…` : notes}` : ""
      }`;
      body.appendChild(title);
      body.appendChild(meta);

      const flatlay = document.createElement("div");
      flatlay.className = "saved-card__flatlay";
      flatlay.setAttribute("aria-hidden", "true");
      for (const pieceSlot of slots.slice(0, 5)) {
        const piece = itemById.get(pieceSlot.itemId);
        if (!piece) continue;
        const proj = itemProjectionForOutfitSlot(piece, pieceSlot);
        const pieceWrap = document.createElement("span");
        pieceWrap.className = "saved-card__piece";
        const im = document.createElement("img");
        im.alt = "";
        im.loading = "lazy";
        pieceWrap.appendChild(im);
        wireCoverImageWithFallbacks(im, proj, { missingClass: null });
        flatlay.appendChild(pieceWrap);
      }

      const act = document.createElement("div");
      act.className = "saved-card__actions";
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "saved-card__ctrl";
      viewBtn.textContent = "View";
      viewBtn.title = "Load this outfit onto the styling board.";
      viewBtn.dataset.outfitLoad = outfit.id;
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "saved-card__ctrl";
      editBtn.textContent = "Edit";
      editBtn.title = "Load onto the board and update on save.";
      editBtn.dataset.outfitEdit = outfit.id;
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "saved-card__ctrl saved-card__ctrl--danger";
      delBtn.textContent = "Delete";
      delBtn.dataset.outfitDelete = outfit.id;
      act.appendChild(viewBtn);
      act.appendChild(editBtn);
      act.appendChild(delBtn);

      body.appendChild(act);
      card.appendChild(flatlay);
      card.appendChild(body);
      li.appendChild(card);
      els.savedList.appendChild(li);
    }
  }

  function onOutfitChange() {
    sanitizeCurrentOutfit();
    persistStylingBoardDraft();
    renderGrid();
    renderOutfitStrip();
  }

  function newEditorVariantKey() {
    const tail =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
        : String(Date.now());
    return `nv-${tail}`;
  }

  /** URL-ish slug for a new variant; falls back to nv-* if empty. */
  function slugVariantKeyBase(label) {
    const s = String(label ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]+/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return s.slice(0, 48);
  }

  function syncVariantRemoveButtons(listEl) {
    if (!listEl) return;
    const rows = listEl.querySelectorAll(".item-edit-variant-row");
    const n = rows.length;
    listEl.querySelectorAll(".item-edit-variant-remove").forEach((b) => {
      /** @type {HTMLButtonElement} */ (b).hidden = n <= 1;
    });
  }

  /**
   * @param {HTMLElement} listEl
   * @param {{ key?: string, label?: string, colour?: string, colourCode?: string, basicColour?: string, image?: string, previewImage?: string, gallery?: string[], notes?: string }} data
   */
  function appendVariantEditorRow(listEl, data) {
    const key = String(data.key ?? "").trim() || newEditorVariantKey();
    const label = String(data.label ?? "").trim();
    const colourVal = String(data.colour ?? data.color ?? "").trim();
    const colourCode = String(data.colourCode ?? data.colour_code ?? data.color_code ?? "").trim();
    const image = String(data.image ?? "").trim();
    const previewImg = String(data.previewImage ?? "").trim();
    const notes = data.notes != null ? String(data.notes) : "";
    const fs = document.createElement("fieldset");
    fs.className = "item-edit-variant-row";
    if (image) fs.setAttribute("data-prev-image", image);
    if (previewImg) fs.setAttribute("data-prev-preview", previewImg);

    const leg = document.createElement("legend");
    leg.className = "item-edit-variant-legend";
    leg.textContent = "Colour";

    const keyIn = document.createElement("input");
    keyIn.type = "hidden";
    keyIn.className = "item-edit-variant-key";
    keyIn.value = key;

    const labelIn = document.createElement("input");
    labelIn.type = "text";
    labelIn.className = "item-edit-variant-label";
    labelIn.maxLength = 80;
    labelIn.placeholder = "Label (outfit picker)";
    labelIn.value = label;

    const colourIn = document.createElement("input");
    colourIn.type = "text";
    colourIn.className = "item-edit-variant-colour";
    colourIn.maxLength = 80;
    colourIn.placeholder = "Colour name";
    colourIn.value = colourVal;

    const codeIn = document.createElement("input");
    codeIn.type = "text";
    codeIn.className = "item-edit-variant-colour-code";
    codeIn.maxLength = 80;
    codeIn.placeholder = "Colour code (#hex, SKU…)";
    codeIn.value = colourCode;

    const codeRow = document.createElement("div");
    codeRow.className = "item-edit-colour-code-row";
    const codePreview = createItemEditColourCodePreview();
    codeRow.append(codePreview, codeIn);
    wireItemEditColourCodePreview({
      input: codeIn,
      preview: codePreview,
      colourInput: colourIn,
      labelInput: labelIn,
    });

    const basicSel = document.createElement("select");
    basicSel.className = "item-edit-variant-basic-colour";
    basicSel.setAttribute("aria-label", "Broad colour (archive filter)");
    fillBasicColourSelectOptions(basicSel, String(data.basicColour ?? "").trim());

    const notesIn = document.createElement("input");
    notesIn.type = "text";
    notesIn.className = "item-edit-variant-notes";
    notesIn.maxLength = 200;
    notesIn.placeholder = "Notes (optional)";
    notesIn.value = notes;

    const photoHost = document.createElement("div");
    photoHost.className = "item-edit-photo-manager item-edit-photo-manager--variant";
    mountItemEditPhotoManager(photoHost, {
      coverUrl: image,
      galleryUrls: Array.isArray(data.gallery) ? data.gallery : [],
      maxPhotos: ITEM_EDIT_PHOTO_MAX,
      uploadLabel: "Upload photos",
    });

    const previewLab = document.createElement("label");
    previewLab.className = "item-edit-variant-preview-wrap";
    const previewSpan = document.createElement("span");
    previewSpan.className = "item-edit-variant-cover-label";
    previewSpan.textContent = previewImg
      ? "Replace colour preview (optional, swatch only)"
      : "Colour preview (optional — if empty, strip uses hex from colour code / name, then the code text)";
    const previewIn = document.createElement("input");
    previewIn.type = "file";
    previewIn.className = "item-edit-variant-preview";
    previewIn.accept = "image/*";
    previewIn.addEventListener("change", () => {
      trimCoverFileInputToOne(previewIn);
      delete fs.dataset.previewRemoved;
    });
    previewLab.appendChild(previewSpan);
    previewLab.appendChild(previewIn);

    const rmPrev = document.createElement("button");
    rmPrev.type = "button";
    rmPrev.className = "btn btn--small btn--ghost item-edit-variant-preview-remove";
    rmPrev.textContent = "Remove colour preview";
    rmPrev.hidden = !previewImg;
    rmPrev.addEventListener("click", () => {
      fs.dataset.previewRemoved = "1";
      fs.removeAttribute("data-prev-preview");
      previewSpan.textContent = "Colour preview (optional — if empty, strip uses hex from colour code / name, then the code text)";
      rmPrev.hidden = true;
      previewIn.value = "";
    });


    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn btn--small btn--ghost item-edit-variant-remove";
    rm.textContent = "Remove";
    rm.hidden = true;

    rm.addEventListener("click", () => {
      fs.remove();
      syncVariantRemoveButtons(listEl);
    });

    fs.appendChild(leg);
    fs.appendChild(keyIn);
    fs.appendChild(labelIn);
    fs.appendChild(colourIn);
    fs.appendChild(codeRow);
    fs.appendChild(basicSel);
    fs.appendChild(notesIn);
    fs.appendChild(photoHost);
    fs.appendChild(previewLab);
    fs.appendChild(rmPrev);
    fs.appendChild(rm);
    listEl.appendChild(fs);
    syncVariantRemoveButtons(listEl);
  }

  /**
   * @param {HTMLFormElement} form
   * @param {object} prev
   * @param {(t: string, err?: boolean) => void} setMsg
   * @param {{ cloudItemId?: string }} [opts]
   * @returns {Promise<{ key: string, label: string, colour: string, colourCode: string, image: string, previewImage?: string, gallery: string[], notes: string }[] | null>}
   */
  async function gatherColourVariantsFromEditForm(form, prev, setMsg, opts = {}) {
    const wrap = form.querySelector("#item-edit-variants-wrap");
    if (!wrap || wrap.dataset.active !== "1") return null;
    const listEl = form.querySelector("#item-edit-variants-list");
    if (!listEl) return null;
    const rawRows = [...listEl.querySelectorAll(".item-edit-variant-row")];
    const rows = rawRows.filter((row) => {
      const lab = row.querySelector(".item-edit-variant-label")?.value?.trim() || "";
      const col = row.querySelector(".item-edit-variant-colour")?.value?.trim() || "";
      const code = row.querySelector(".item-edit-variant-colour-code")?.value?.trim() || "";
      const nts = row.querySelector(".item-edit-variant-notes")?.value?.trim() || "";
      const prevPr = row.getAttribute("data-prev-preview")?.trim() || "";
      const previewIn = row.querySelector(".item-edit-variant-preview");
      const previewFile = previewIn?.files?.[0];
      const photoHost = row.querySelector(".item-edit-photo-manager");
      const photoCount = photoHost ? readItemEditPhotoManager(photoHost).slots.length : 0;
      return Boolean(lab || col || code || nts || prevPr || previewFile || photoCount > 0);
    });
    if (!rows.length) {
      setMsg("Add at least one colour row with a cover image.", true);
      return null;
    }
    /** @type {{ key: string, label: string, colour: string, colourCode: string, image: string, previewImage?: string, gallery: string[], notes: string }[]} */
    const built = [];
    const prevVars = getItemColourVariants(prev) || [];
    for (const row of rows) {
      const key = row.querySelector(".item-edit-variant-key")?.value?.trim() || "";
      const label = row.querySelector(".item-edit-variant-label")?.value?.trim() || "";
      const colourTxt = row.querySelector(".item-edit-variant-colour")?.value?.trim() || "";
      const colourCode = row.querySelector(".item-edit-variant-colour-code")?.value?.trim() || "";
      const notes = row.querySelector(".item-edit-variant-notes")?.value?.trim() || "";
      const photoHost = row.querySelector(".item-edit-photo-manager");
      const { slots: photoSlots } = photoHost
        ? readItemEditPhotoManager(photoHost)
        : { slots: /** @type {const} */ ([]) };
      if (!key) {
        setMsg("Each colour row needs an internal key (reload and try again).", true);
        return null;
      }
      const outLabel = (label || colourTxt).trim();
      if (!outLabel) {
        setMsg(
          "Each row needs a label or a colour name — fill at least one per row (used when picking a colour for outfits).",
          true
        );
        return null;
      }
      if (!photoSlots.length) {
        setMsg("Each colour row needs at least one photo.", true);
        return null;
      }
      const match = prevVars.find((x) => x && String(x.key ?? "").trim() === key);
      const prevCover = String(match?.image ?? row.getAttribute("data-prev-image") ?? "").trim();
      const cloudId = opts?.cloudItemId && isSupabaseReady() ? String(opts.cloudItemId).trim() : id;
      const materialized = await materializeItemEditPhotoSlots(photoSlots, cloudId, setMsg, {
        variantKey: key,
        keepCoverOnFailure: true,
        previousCover: prevCover,
      });
      const image = materialized.image;
      const gallery = materialized.gallery;
      if (!image) {
        setMsg("Each row needs a cover image — upload one, or keep an existing row’s image.", true);
        return null;
      }

      const previewRemoved = row.dataset.previewRemoved === "1";
      const previewInEl = row.querySelector(".item-edit-variant-preview");
      trimCoverFileInputToOne(/** @type {HTMLInputElement | null} */ (previewInEl));
      const previewFile2 = previewInEl?.files?.[0];
      const prevPr = row.getAttribute("data-prev-preview")?.trim() || "";
      let previewImage = "";
      if (!previewRemoved) {
        previewImage = prevPr;
        if (previewFile2) {
          try {
            const cloudId = opts?.cloudItemId && isSupabaseReady() ? String(opts.cloudItemId).trim() : "";
            previewImage = cloudId
              ? await uploadWardrobeImageFileToCloud(previewFile2, cloudId, { type: "variant_preview", key })
              : await fileToStorageDataUrl(previewFile2);
          } catch (err) {
            console.warn(err);
            setMsg(messageForCloudUploadFailure(`variant preview (${key || "unknown key"})`, err), true);
            return null;
          }
        } else if (!previewImage && match) {
          previewImage = String(match.previewImage ?? "").trim();
        }
      }

      const rowObj = {
        key,
        label: label.trim() || outLabel,
        colour: colourTxt.trim() || outLabel,
        colourCode: colourCode.trim(),
        image,
        gallery,
        notes,
      };
      if (previewImage) rowObj.previewImage = previewImage;
      const basicV = normalizeStoredBasicColourKey(
        /** @type {HTMLSelectElement | null} */ (row.querySelector(".item-edit-variant-basic-colour"))?.value ?? ""
      );
      if (basicV) rowObj.basicColour = basicV;
      built.push(rowObj);
    }
    return built;
  }

  function itemEditVariantsActive(form) {
    const wrap = form.querySelector("#item-edit-variants-wrap");
    return Boolean(wrap && wrap.dataset.active === "1");
  }

  async function saveItemDetailEdit(form) {
    const msgEl = document.getElementById("item-detail-edit-msg");
    const statusEl = document.getElementById("item-detail-edit-status");
    const setMsg = (t, err) => {
      if (msgEl) {
        msgEl.textContent = t || "";
        msgEl.classList.toggle("item-detail__edit-msg--error", Boolean(err));
        msgEl.hidden = !t;
      }
      if (!statusEl) return;
      if (!t) {
        statusEl.hidden = true;
        statusEl.textContent = "";
        statusEl.classList.remove(
          "item-edit-save-status--error",
          "item-edit-save-status--saving",
          "item-edit-save-status--saved"
        );
        return;
      }
      statusEl.hidden = false;
      const saving =
        /^(Saving|Processing)/i.test(t) || t === "Saving…";
      statusEl.textContent = err ? t : saving ? "Saving…" : t;
      statusEl.classList.toggle("item-edit-save-status--error", Boolean(err));
      statusEl.classList.toggle("item-edit-save-status--saving", saving && !err);
      statusEl.classList.toggle("item-edit-save-status--saved", !err && !saving && t === "Saved to archive");
    };
    let keepFinalWarningMessage = false;

    const id = detailItemId;
    if (!id) return;
    const prev = itemById.get(id);
    if (!prev) return;
    const isCustom = String(id).startsWith("custom-");
    if (!isSupabaseReady()) {
      setMsg(CLOUD_WRITE_REQUIRED_MESSAGE, true);
      showToast(CLOUD_WRITE_REQUIRED_MESSAGE);
      return;
    }

    setMsg("Saving…", false);

    const brand = form.querySelector("#item-edit-brand")?.value?.trim() || "";
    const name = form.querySelector("#item-edit-name")?.value?.trim() || "";
    const browseSlot = form.querySelector("#item-edit-browse-slot")?.value || "";
    const recordPick = form.querySelector("#item-edit-record-type")?.value?.trim() ?? "";
    const season = normalizeStoredItemSeason(
      form.querySelector("#item-edit-season")?.value?.trim() || String(prev.season ?? "").trim()
    );
    const category = resolveCategoryForBrowseSlot(browseSlot, recordPick, season, prev);
    const fabric = form.querySelector("#item-edit-fabric")?.value?.trim() || "";
    const weight = form.querySelector("#item-edit-weight")?.value?.trim() || "";
    const size = form.querySelector("#item-edit-size")?.value?.trim() || "";
    const measHost = form.querySelector("#item-edit-measured-dims-block");
    const mRows = readMeasurementRowsFromEditor(measHost instanceof HTMLElement ? measHost : null);
    const measureUnit = parseMeasurementUnitInput(form.querySelector("#item-edit-measurement-unit")?.value);
    const measuredDimensions = mRows.length ? measurementRowsToSummaryString(mRows, measureUnit) : "";
    const purchaseDate = joinPurchaseDateFromForm(
      form.querySelector("#item-edit-purchase-date")?.value?.trim() || "",
      form.querySelector("#item-edit-purchase-date-note")?.value?.trim() || ""
    );
    const priceRaw = form.querySelector("#item-edit-price")?.value?.trim() || "";
    const priceCur = String(form.querySelector("#item-edit-price-currency")?.value ?? "TWD").trim().toUpperCase() || "TWD";
    let priceVal = parsePriceAmountFlexible(priceRaw);
    if (!Number.isFinite(priceVal) || priceVal < 0) priceVal = null;
    const notes = form.querySelector("#item-edit-notes")?.value?.trim() || "";
    const basicSel = /** @type {HTMLSelectElement | null} */ (form.querySelector("#item-edit-basic-colour"));
    const rawBasicSingle = String(basicSel?.value ?? "").trim();
    const basicPickSingle =
      rawBasicSingle.toLowerCase() === BASIC_COLOUR_CLASSIFICATION_OMIT
        ? BASIC_COLOUR_CLASSIFICATION_OMIT
        : normalizeStoredBasicColourKey(rawBasicSingle);

    const variantsMode = itemEditVariantsActive(form);
    /** @type {{ key: string, label: string, colour: string, colourCode: string, image: string, previewImage?: string, gallery: string[], notes: string }[] | null} */
    let colourVariantsBuilt = null;
    if (variantsMode) {
      setMsg("Processing colour images…", false);
      colourVariantsBuilt = await gatherColourVariantsFromEditForm(form, prev, setMsg, { cloudItemId: id });
      if (colourVariantsBuilt == null) return;
    }

    const primaryColour =
      variantsMode && colourVariantsBuilt?.length
        ? String(colourVariantsBuilt[0].colour ?? colourVariantsBuilt[0].label ?? "").trim()
        : form.querySelector("#item-edit-colour")?.value?.trim() || "";

    const colourCode =
      variantsMode && colourVariantsBuilt?.length
        ? String(colourVariantsBuilt[0].colourCode ?? "").trim()
        : form.querySelector("#item-edit-colour-code")?.value?.trim() || "";

    if (!brand || !name || !browseSlot) {
      setMsg("Brand, name, and section are required.", true);
      return;
    }

    let image = String(prev.image ?? "").trim();
    let gallery = [...itemGalleryList(prev)];
    const prevImage = image;
    const prevGallerySig = itemGalleryList(prev)
      .map((u) => String(u).split("?")[0])
      .join("|");
    let hadNewPhotoFiles = false;
    if (!(variantsMode && colourVariantsBuilt?.length)) {
      const photoHost = document.getElementById("item-edit-photos");
      if (photoHost) {
        const entryCount = Array.isArray(photoHost.__twPhotoEntries) ? photoHost.__twPhotoEntries.length : 0;
        const { slots } = readItemEditPhotoManager(photoHost);
        hadNewPhotoFiles = slots.some((s) => s.kind === "file");
        if (entryCount === 0) {
          image = "";
          gallery = [];
        } else if (slots.length) {
          setMsg("Processing images…", false);
          const materialized = await materializeItemEditPhotoSlots(slots, id, setMsg, {
            keepCoverOnFailure: true,
            previousCover: image,
          });
          image = materialized.image;
          gallery = materialized.gallery;
        } else {
          setMsg(
            "Could not read the uploaded photo files. Remove them and upload again, then save.",
            true
          );
          return;
        }
      }
    }

    const colourTrim = String(primaryColour ?? "").trim();
    const colourCodeTrim = String(colourCode ?? "").trim();
    const updated = {
      ...prev,
      brand,
      name,
      section: String(prev.section ?? ""),
      category,
      season,
      fabric,
      weight,
      size,
      measuredDimensions,
      purchaseDate,
      notes,
      image,
      pillar: String(prev.pillar ?? ""),
    };
    if (colourTrim) {
      updated.colour = colourTrim;
    } else {
      delete updated.colour;
    }
    if (colourCodeTrim) updated.colourCode = colourCodeTrim;
    else {
      delete updated.colourCode;
      delete updated.color_code;
    }
    if (priceVal != null) {
      updated.price = priceVal;
      updated.priceCurrency = PRICE_CURRENCY_CODES.includes(priceCur) ? priceCur : "TWD";
    } else {
      delete updated.price;
      delete updated.priceCurrency;
    }
    if (gallery.length) updated.gallery = gallery;
    else delete updated.gallery;

    if (variantsMode && colourVariantsBuilt?.length) {
      updated.colourVariants = colourVariantsBuilt;
      delete updated.basicColour;
    } else {
      delete updated.colourVariants;
      if (basicPickSingle) updated.basicColour = basicPickSingle;
      else delete updated.basicColour;
    }

    const prevMeta =
      prev.metadata && typeof prev.metadata === "object" && !Array.isArray(prev.metadata) ? { ...prev.metadata } : {};
    if (priceVal != null) {
      prevMeta.price = priceVal;
      prevMeta.priceCurrency = PRICE_CURRENCY_CODES.includes(priceCur) ? priceCur : "TWD";
    } else {
      delete prevMeta.price;
      delete prevMeta.priceCurrency;
    }
    if (mRows.length) {
      prevMeta.measurementRows = mRows;
      prevMeta.measurementUnit = measureUnit;
      updated.measurementRows = mRows;
      updated.measurementUnit = measureUnit;
    } else {
      delete prevMeta.measurementRows;
      delete prevMeta.measurementUnit;
      delete updated.measurementRows;
      delete updated.measurementUnit;
    }
    if (variantsMode && colourVariantsBuilt?.length) {
      delete prevMeta.basicColour;
    } else if (basicPickSingle) {
      prevMeta.basicColour = basicPickSingle;
    } else {
      delete prevMeta.basicColour;
    }
    if (Object.keys(prevMeta).length) updated.metadata = prevMeta;
    else delete updated.metadata;

    const nextGallerySig = gallery
      .map((u) => String(u).split("?")[0])
      .join("|");
    const mediaTouched =
      hadNewPhotoFiles ||
      String(image).split("?")[0] !== String(prevImage).split("?")[0] ||
      nextGallerySig !== prevGallerySig;
    if (mediaTouched) stampWardrobeItemMediaNonce(updated);

    /** When saving a custom piece, whether `data/custom-items.json` was updated (npm run dev). */
    let customProjectSynced = true;
    let customCloudSynced = false;
    /** After custom or catalogue mirror save, cloud refresh already merged + rendered the grid. */
    let didCloudListRefresh = false;
    let archiveCloudRowSaved = false;
    let archiveSavedAsOverride = false;
    /** @type {object | null} */
    let savedRowForPin = null;

    if (isCustom) {
      const inWardrobe = loadCustomItems().some((x) => String(x.id) === id);
      if (!inWardrobe) {
        setMsg("This piece is no longer in your wardrobe.", true);
        return;
      }

      try {
        const saved = await saveWardrobeItemToCloud(updated);
        const mediaBust = stampWardrobeItemMediaNonce(
          saved,
          typeof /** @type {any} */ (updated).__displayNonce === "number"
            ? /** @type {any} */ (updated).__displayNonce
            : Date.now()
        );
        upsertWardrobeBaseRowInMemory(saved);
        stripCustomIdsFromLocalStorage([id]);
        await mirrorLocalCustomItemsToProjectFile();
        customCloudSynced = true;
        customProjectSynced = false;
        await deleteSupabaseImagesNoLongerUsed(prev, saved, updated);
        savedRowForPin = saved;
        try {
          await refreshCloudBackedCustomItems({ pinnedRows: [saved] });
          didCloudListRefresh = true;
          const hit = cloudBackedCustomItems.find((x) => String(x.id) === String(id));
          if (hit) /** @type {any} */ (hit).__displayNonce = mediaBust;
        } catch (re) {
          console.warn(re);
          cloudBackedCustomItems = [
            saved,
            ...cloudBackedCustomItems.filter((x) => String(x.id) !== String(saved.id)),
          ];
          const hit2 = cloudBackedCustomItems.find((x) => String(x.id) === String(id));
          if (hit2) /** @type {any} */ (hit2).__displayNonce = mediaBust;
        }
      } catch (e) {
        console.warn(e);
        setMsg(`Cloud row save failed: ${messageForFailedWardrobeUpsert(e)}`, true);
        return;
      }
    } else {
      const patch = {
        brand,
        name,
        section: String(prev.section ?? ""),
        category,
        season,
        colour: colourTrim,
        colourCode: colourCodeTrim,
        fabric,
        weight,
        size,
        measuredDimensions,
        purchaseDate,
        notes,
        image,
        pillar: String(prev.pillar ?? ""),
      };
      if (priceVal != null) {
        patch.price = priceVal;
        patch.priceCurrency = PRICE_CURRENCY_CODES.includes(priceCur) ? priceCur : "TWD";
      } else {
        patch.price = null;
        patch.priceCurrency = null;
      }
      if (gallery.length) patch.gallery = gallery;
      else patch.gallery = [];
      if (variantsMode && colourVariantsBuilt?.length) {
        patch.colourVariants = colourVariantsBuilt;
      }
      {
        const baseMeta =
          prev.metadata && typeof prev.metadata === "object" && !Array.isArray(prev.metadata)
            ? { ...prev.metadata }
            : {};
        if (priceVal != null) {
          baseMeta.price = priceVal;
          baseMeta.priceCurrency = PRICE_CURRENCY_CODES.includes(priceCur) ? priceCur : "TWD";
        } else {
          delete baseMeta.price;
          delete baseMeta.priceCurrency;
        }
        if (mRows.length) {
          baseMeta.measurementRows = mRows;
          baseMeta.measurementUnit = measureUnit;
        } else {
          delete baseMeta.measurementRows;
          delete baseMeta.measurementUnit;
        }
        if (variantsMode && colourVariantsBuilt?.length) {
          delete baseMeta.basicColour;
        } else if (basicPickSingle) {
          baseMeta.basicColour = basicPickSingle;
        } else {
          delete baseMeta.basicColour;
        }
        if (Object.keys(baseMeta).length) patch.metadata = baseMeta;
        else if (prev.metadata && typeof prev.metadata === "object" && !Array.isArray(prev.metadata))
          patch.metadata = null;
      }

      try {
        const mergedForCloud = normalizeItemDerivedFields(mergeArchivePatchIntoFullItem(prev, patch));
        const saved = await saveWardrobeItemToCloud(mergedForCloud);
        const mediaBust = stampWardrobeItemMediaNonce(
          saved,
          typeof /** @type {any} */ (updated).__displayNonce === "number"
            ? /** @type {any} */ (updated).__displayNonce
            : Date.now()
        );
        archiveCloudRowSaved = true;
        upsertWardrobeBaseRowInMemory(saved);
        try {
          const allOv = loadArchiveOverrides();
          if (Object.prototype.hasOwnProperty.call(allOv, id)) {
            delete allOv[id];
            await saveArchiveOverrides(allOv);
          }
        } catch (clearOvErr) {
          console.warn("Could not clear stale archive override after cloud save.", clearOvErr);
        }
        cloudBackedCustomItems = [
          saved,
          ...cloudBackedCustomItems.filter((x) => String(x?.id ?? "") !== String(saved.id)),
        ];
        try {
          await deleteSupabaseImagesNoLongerUsed(prev, saved, mergedForCloud);
        } catch (imgErr) {
          console.warn("Image cleanup after catalogue save (continuing):", imgErr);
        }
        savedRowForPin = saved;
        await refreshCloudBackedCustomItems({ pinnedRows: [saved] });
        const hitCat = cloudBackedCustomItems.find((x) => String(x?.id ?? "") === String(id));
        if (hitCat) /** @type {any} */ (hitCat).__displayNonce = mediaBust;
        didCloudListRefresh = true;
      } catch (e) {
        setMsg(`Cloud row save failed: ${messageForFailedWardrobeUpsert(e)}`, true);
        keepFinalWarningMessage = true;
        return;
      }
    }

    if (!keepFinalWarningMessage && !(isCustom && isSupabaseReady() && !customCloudSynced)) {
      setMsg("Saved to archive", false);
    }
    if (!didCloudListRefresh) {
      mergeWardrobeFromSources();
      if (document.getElementById("grid")) {
        initFilters();
        onOutfitChange();
        renderGrid();
      }
    }
    const next = itemById.get(id);
    const mount = itemDetailMountRoot();
    const returnToArchiveAfterSave = Boolean(mount && itemDetailIsPageRoot(mount));
    if (!returnToArchiveAfterSave) {
      if (next && mount) renderItemDetailContent(mount, next, { edit: false });
      replaceItemPageUrl(id, false);
    }
    if (isSupabaseReady()) {
      if (!isCustom && !archiveCloudRowSaved && archiveSavedAsOverride) {
        showToast("Saved as override (cloud row write failed).");
        return;
      }
      showToast("Saved to your wardrobe (Supabase).");
    } else if (isCustom) {
      showToast(
        customProjectSynced
          ? "Saved changes (and project file)."
          : "Saved changes in this browser/origin only. Run npm run dev to mirror to data/custom-items.json."
      );
    } else {
      showToast(
        "Saved in this browser/origin only (domain/protocol/port). Add Supabase (js/tw-supabase-config.js) to sync your wardrobe, or keep backups via “Download backup JSON”."
      );
    }
    if (returnToArchiveAfterSave) {
      if (savedRowForPin) pinWardrobeSaveToSession(savedRowForPin);
      writeArchiveBrowseRestoreForItemReturn(next ?? updated);
      navigateToArchiveMain();
    }
  }

  /** PDP-style trail: site → section → record type (matches archive tabs / drill). */
  function buildItemDetailBreadcrumbNav(item) {
    const nav = document.createElement("nav");
    nav.className = "item-detail__breadcrumb";
    nav.setAttribute("aria-label", "Breadcrumb");

    const slotLabel = itemSlot(item);
    const sectionLabel = categoryDisplayLabel(slotLabel);
    const rk = recordCategoryForDrill(item, slotLabel);
    const typeLabel = friendlyRecordCategory(rk) || rk;

    function appendSep() {
      const s = document.createElement("span");
      s.className = "item-detail__breadcrumb-sep";
      s.setAttribute("aria-hidden", "true");
      s.textContent = "/";
      nav.appendChild(s);
    }

    const home = document.createElement("a");
    home.className = "item-detail__breadcrumb-link";
    home.href = SITE_HOME_URL;
    home.textContent = "Timeless Wardrobe";
    nav.appendChild(home);

    appendSep();

    const sec = document.createElement("a");
    sec.className = "item-detail__breadcrumb-link";
    sec.href = ARCHIVE_HOME_MAIN_URL;
    sec.textContent = sectionLabel;
    sec.addEventListener("click", (e) => {
      e.preventDefault();
      const cat = String(slotLabel ?? "").trim();
      if (!SLOT_OPTIONS.includes(cat)) {
        navigateToArchiveMain();
        return;
      }
      writeArchiveBrowseRestoreSnapshot({ category: cat, subcategory: "" });
      navigateToArchiveMain();
    });
    nav.appendChild(sec);

    appendSep();

    const typeLink = document.createElement("a");
    typeLink.className = "item-detail__breadcrumb-link item-detail__breadcrumb-current";
    typeLink.href = ARCHIVE_HOME_MAIN_URL;
    typeLink.textContent = typeLabel;
    typeLink.setAttribute("aria-label", `View archive: ${typeLabel} in ${sectionLabel}`);
    typeLink.addEventListener("click", (e) => {
      e.preventDefault();
      const cat = String(slotLabel ?? "").trim();
      const sub = String(rk ?? "").trim();
      if (!SLOT_OPTIONS.includes(cat)) {
        globalThis.location.assign(ARCHIVE_HOME_MAIN_URL);
        return;
      }
      writeArchiveBrowseRestoreSnapshot({ category: cat, subcategory: sub });
      navigateToArchiveMain();
    });
    nav.appendChild(typeLink);

    return nav;
  }

  /** Chip quick-pick for record type; mirrors `<select id="item-edit-record-type">` (one chip per display label). */
  function syncItemEditSubcategoryChipsFromSelect(recordTypeSel, stripRoot, chipsInner) {
    if (!stripRoot || !chipsInner || !recordTypeSel) return;
    chipsInner.replaceChildren();
    const unique = [];
    const seenLabels = new Set();
    for (let i = 0; i < recordTypeSel.options.length; i++) {
      const raw = String(recordTypeSel.options[i].value ?? "").trim();
      if (!raw) continue;
      const opt = recordTypeSel.options[i];
      const label = String(opt.textContent ?? "").trim() || friendlyRecordCategory(raw) || raw;
      const labelKey = label.toLowerCase();
      if (seenLabels.has(labelKey)) continue;
      seenLabels.add(labelKey);
      unique.push(raw);
    }
    const recordTypeField = recordTypeSel.closest(".field");
    if (unique.length <= 1) {
      stripRoot.hidden = true;
      recordTypeSel.classList.remove("item-edit-record-type--chips-visible");
      if (recordTypeField instanceof HTMLElement) recordTypeField.hidden = false;
      return;
    }
    stripRoot.hidden = false;
    recordTypeSel.classList.add("item-edit-record-type--chips-visible");
    if (recordTypeField instanceof HTMLElement) recordTypeField.hidden = true;
    const current = String(recordTypeSel.value ?? "").trim();
    for (const raw of unique) {
      const opt = [...recordTypeSel.options].find((o) => String(o.value ?? "").trim() === raw);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "item-edit-subtype-chip";
      if (raw === current) b.classList.add("is-active");
      b.textContent = opt ? String(opt.textContent ?? "").trim() : friendlyRecordCategory(raw) || raw;
      b.title = raw;
      b.addEventListener("click", () => {
        recordTypeSel.value = raw;
        recordTypeSel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      chipsInner.appendChild(b);
    }
  }

  function createItemEditSection(headingText) {
    const section = document.createElement("section");
    section.className = "item-edit-section";
    const heading = document.createElement("h3");
    heading.className = "item-edit-section__heading";
    heading.textContent = headingText;
    section.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "item-detail__form-grid item-edit-section__grid";
    section.appendChild(grid);
    return { section, grid };
  }

  function appendItemEditField(grid, labelText, child) {
    const lab = document.createElement("label");
    lab.className = "field";
    const span = document.createElement("span");
    span.className = "field__label";
    span.textContent = labelText;
    lab.appendChild(span);
    lab.appendChild(child);
    grid.appendChild(lab);
  }

  function renderItemDetailContent(root, item, opts = {}) {
    const edit = Boolean(opts.edit) && isTwAdminMode();
    detailItemId = item.id;
    root.innerHTML = "";
    const itemForMedia = ensureItemMediaCacheBust({ ...item });

    const media = document.createElement("div");
    media.className = "card__media item-detail__media";
    const detailVariants = getItemColourVariants(itemForMedia);
    if (detailVariants?.length) media.classList.add("card__media--variant-colours");
    const img = document.createElement("img");
    img.className = "card__media-img";
    img.alt = imageAltForItem(itemForMedia);
    img.decoding = "async";
    img.draggable = false;
    wireCoverImageWithFallbacks(img, itemForMedia, {
      host: media,
      coverRenderWidth: ITEM_DETAIL_GALLERY_RENDER.width,
      coverRenderHeight: ITEM_DETAIL_GALLERY_RENDER.height,
      coverRenderQuality: ITEM_DETAIL_GALLERY_RENDER.quality,
      coverRenderResize: ITEM_DETAIL_GALLERY_RENDER.resize,
      onResolved(url) {
        const ti = media.querySelector(".card__gallery-strip .card__gallery-thumb.is-active img");
        if (ti) ti.src = url;
      },
    });
    media.appendChild(img);
    if (!detailVariants?.length) {
      mountHeroGalleryStrip(media, img, itemForMedia);
    } else if (itemGalleryList(itemForMedia).length) {
      mountHeroGalleryStrip(media, img, itemForMedia);
    }

    if (root.classList.contains("item-detail__root--page")) {
      wireInlineItemHeroZoom(media, img);
    }

    const isPageEdit = edit && root.classList.contains("item-detail__root--page");
    if (isPageEdit) root.classList.add("item-detail__root--edit");

    /** @type {HTMLElement | null} */
    let editPreviewCol = null;

    if (isPageEdit) {
      const previewCol = document.createElement("div");
      previewCol.className = "item-edit-preview";
      editPreviewCol = previewCol;
      previewCol.appendChild(media);
      const previewCaption = document.createElement("p");
      previewCaption.className = "item-edit-preview__caption";
      previewCaption.textContent = "Current cover";
      previewCol.appendChild(previewCaption);
      root.appendChild(previewCol);
    } else {
      root.appendChild(media);
    }

    if (edit) {
      const wrap = document.createElement("div");
      wrap.className = "item-detail__body item-detail__body--edit";
      wrap.appendChild(buildItemDetailBreadcrumbNav(item));

      const statusEl = document.createElement("p");
      statusEl.id = "item-detail-edit-status";
      statusEl.className = "item-edit-save-status";
      statusEl.hidden = true;
      statusEl.setAttribute("role", "status");
      statusEl.setAttribute("aria-live", "polite");
      wrap.appendChild(statusEl);

      const h2 = document.createElement("h2");
      h2.id = "item-detail-heading";
      h2.className = "item-detail__title item-detail__title--edit";
      h2.textContent = "Edit piece";
      wrap.appendChild(h2);

      const form = document.createElement("form");
      form.id = "item-detail-edit-form";
      form.className = "item-detail__form item-edit-form";
      form.setAttribute("novalidate", "");

      const formScroll = document.createElement("div");
      formScroll.className = "item-edit-form-scroll";

      const identitySec = createItemEditSection("Identity");
      const identityGrid = identitySec.grid;
      const initialVariants = getItemColourVariants(item);
      const isCustomPiece = String(item.id ?? "").startsWith("custom-");
      const colourSec = createItemEditSection("Colour & season");
      const colourGrid = colourSec.grid;
      const materialSec = createItemEditSection("Material & fit");
      const materialGrid = materialSec.grid;
      const acquisitionSec = createItemEditSection("Acquisition");
      const acquisitionGrid = acquisitionSec.grid;

      function addField(labelText, child, targetGrid = identityGrid) {
        appendItemEditField(targetGrid, labelText, child);
      }

      const brandIn = document.createElement("input");
      brandIn.type = "text";
      brandIn.id = "item-edit-brand";
      brandIn.required = true;
      brandIn.maxLength = 120;
      brandIn.value = String(item.brand ?? "");
      addField("Brand", brandIn);

      const nameIn = document.createElement("input");
      nameIn.type = "text";
      nameIn.id = "item-edit-name";
      nameIn.required = true;
      nameIn.maxLength = 200;
      nameIn.value = String(item.name ?? "");
      addField("Name", nameIn);

      const photosFieldWrap = document.createElement("div");
      photosFieldWrap.className = "field field--span2 item-edit-photos-field";
      photosFieldWrap.id = "item-edit-photos-field";
      const photosLabel = document.createElement("span");
      photosLabel.className = "field__label";
      photosLabel.textContent = "Photos";
      const photosHost = document.createElement("div");
      photosHost.id = "item-edit-photos";
      if (!initialVariants) {
        mountItemEditPhotoManager(photosHost, {
          item: itemForMedia,
          coverUrl: String(itemForMedia.image ?? "").trim(),
          galleryUrls: itemGalleryList(itemForMedia),
          uploadLabel: "Upload photos",
          onDirty: () => syncItemEditCoverPreview(editPreviewCol, photosHost, itemForMedia),
        });
        syncItemEditCoverPreview(editPreviewCol, photosHost, itemForMedia);
      }
      photosFieldWrap.appendChild(photosLabel);
      photosFieldWrap.appendChild(photosHost);
      photosFieldWrap.hidden = Boolean(initialVariants);
      identityGrid.appendChild(photosFieldWrap);

      const catSel = document.createElement("select");
      catSel.id = "item-edit-browse-slot";
      catSel.required = true;
      const rawCat = String(item.category ?? "").trim();
      const slotPick = SLOT_OPTIONS.includes(rawCat) ? rawCat : itemSlot(item);
      for (const c of SLOT_OPTIONS) {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = categoryDisplayLabel(c);
        if (c === slotPick) o.selected = true;
        catSel.appendChild(o);
      }
      addField("Section", catSel);

      const recordTypeSel = document.createElement("select");
      recordTypeSel.id = "item-edit-record-type";
      recordTypeSel.className = "item-edit-record-type-select";
      recordTypeSel.title =
        'Same labels as the archive "type" strip — controls filtering and default browse order.';
      const currentRecKey = recordCategoryForDrill(item, slotPick);
      addField("Record type", recordTypeSel);
      fillItemEditRecordTypeSelect(recordTypeSel, slotPick, currentRecKey);

      const subtypeStrip = document.createElement("div");
      subtypeStrip.className = "field field--span2 item-edit-subtype-strip";
      subtypeStrip.hidden = true;
      const stLabel = document.createElement("span");
      stLabel.className = "field__label";
      stLabel.textContent = "Type";
      const subtypeInner = document.createElement("div");
      subtypeInner.className = "category-drill__grid item-edit-subtype-chips";
      subtypeInner.setAttribute("role", "group");
      subtypeInner.setAttribute("aria-label", "Record type quick pick");
      subtypeStrip.appendChild(stLabel);
      subtypeStrip.appendChild(subtypeInner);
      identityGrid.appendChild(subtypeStrip);

      function refreshSubtypeChips() {
        syncItemEditSubcategoryChipsFromSelect(recordTypeSel, subtypeStrip, subtypeInner);
      }

      catSel.addEventListener("change", () => {
        fillItemEditRecordTypeSelect(recordTypeSel, catSel.value, recordTypeSel.value);
        refreshSubtypeChips();
      });
      recordTypeSel.addEventListener("change", () => {
        refreshSubtypeChips();
      });
      refreshSubtypeChips();

      /** @type {HTMLElement | null} */
      let colourSingleField = null;

      const colourBlock = document.createElement("div");
      colourBlock.className = "field--span2 item-edit-single-colour-block";
      colourBlock.hidden = Boolean(initialVariants);

      const colourNameInput = document.createElement("input");
      colourNameInput.type = "text";
      colourNameInput.id = "item-edit-colour";
      colourNameInput.maxLength = 80;
      colourNameInput.autocomplete = "off";
      colourNameInput.value = String(item.colour ?? item.color ?? "");

      const colourNameLab = document.createElement("label");
      colourNameLab.className = "field";
      const cspan = document.createElement("span");
      cspan.className = "field__label";
      cspan.textContent = "Colour (optional)";
      colourNameLab.appendChild(cspan);
      colourNameLab.appendChild(colourNameInput);

      const colourCodeInput = document.createElement("input");
      colourCodeInput.type = "text";
      colourCodeInput.id = "item-edit-colour-code";
      colourCodeInput.maxLength = 80;
      colourCodeInput.autocomplete = "off";
      colourCodeInput.placeholder = "#hex, SKU…";
      colourCodeInput.value = itemColourCode(item);

      const colourCodeLab = document.createElement("label");
      colourCodeLab.className = "field";
      const ccspan = document.createElement("span");
      ccspan.className = "field__label";
      ccspan.textContent = "Colour code (optional)";
      const colourCodeRow = document.createElement("div");
      colourCodeRow.className = "item-edit-colour-code-row";
      const colourCodePreview = createItemEditColourCodePreview();
      colourCodeRow.append(colourCodePreview, colourCodeInput);
      colourCodeLab.appendChild(ccspan);
      colourCodeLab.appendChild(colourCodeRow);
      wireItemEditColourCodePreview({
        input: colourCodeInput,
        preview: colourCodePreview,
        colourInput: colourNameInput,
      });

      const itemMetaForBasic =
        item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata : null;
      const rawInitialBasic = String(item.basicColour ?? itemMetaForBasic?.basicColour ?? "").trim();
      const initialBasic =
        rawInitialBasic.toLowerCase() === BASIC_COLOUR_CLASSIFICATION_OMIT
          ? BASIC_COLOUR_CLASSIFICATION_OMIT
          : normalizeStoredBasicColourKey(rawInitialBasic);

      const basicSel = document.createElement("select");
      basicSel.id = "item-edit-basic-colour";
      basicSel.className = "item-edit-basic-colour";
      fillBasicColourSelectOptions(basicSel, initialBasic);
      const basicLab = document.createElement("label");
      basicLab.className = "field";
      const bspan = document.createElement("span");
      bspan.className = "field__label";
      bspan.textContent = "Broad colour (optional)";
      basicLab.appendChild(bspan);
      basicLab.appendChild(basicSel);

      colourBlock.appendChild(colourNameLab);
      colourBlock.appendChild(colourCodeLab);
      colourBlock.appendChild(basicLab);

      if (isCustomPiece) {
        const migrateHint = document.createElement("p");
        migrateHint.className = "item-edit-variant-migrate-hint";
        migrateHint.textContent =
          "Same piece in another colour needs its own cover photo — outfits will ask which colour to use.";
        const migrateBtn = document.createElement("button");
        migrateBtn.type = "button";
        migrateBtn.className = "btn btn--small btn--ghost item-edit-enable-variants";
        migrateBtn.textContent = "Add another colour…";
        colourBlock.appendChild(migrateHint);
        colourBlock.appendChild(migrateBtn);
      }
      colourGrid.appendChild(colourBlock);
      colourSingleField = colourBlock;

      const variantsWrap = document.createElement("div");
      variantsWrap.id = "item-edit-variants-wrap";
      variantsWrap.className = "field field--span2 item-edit-variants-wrap";
      if (initialVariants) {
        variantsWrap.dataset.active = "1";
        variantsWrap.hidden = false;
      } else {
        variantsWrap.dataset.active = "0";
        variantsWrap.hidden = true;
      }

      if (initialVariants) {
        const variantsIntro = document.createElement("p");
        variantsIntro.className = "item-edit-variants-intro";
        variantsIntro.textContent =
          "This piece keeps one primary cover for the archive grid; each colour has its own variant cover. The colour strip uses an uploaded preview if set, otherwise a hex value from the colour code or name, otherwise the code text, and only then the variant cover. Keys stay fixed — use “Add another colour…” for a new option.";
        variantsWrap.appendChild(variantsIntro);
      }

      const listEl = document.createElement("div");
      listEl.id = "item-edit-variants-list";
      listEl.className = "item-edit-variants-list";

      const addVarBtn = document.createElement("button");
      addVarBtn.type = "button";
      addVarBtn.className = "btn btn--small btn--ghost item-edit-variant-add";
      addVarBtn.textContent = "Add another colour…";
      addVarBtn.hidden = !initialVariants;
      const disableVariantsBtn = document.createElement("button");
      disableVariantsBtn.type = "button";
      disableVariantsBtn.className = "btn btn--small btn--ghost item-edit-variant-disable";
      disableVariantsBtn.textContent = "Use single colour";
      disableVariantsBtn.hidden = !initialVariants || !colourSingleField;

      if (initialVariants) {
        for (const v of initialVariants) {
          appendVariantEditorRow(listEl, {
            key: v.key,
            label: v.label,
            colour: v.colour ?? v.color,
            colourCode: v.colourCode,
            basicColour: v.basicColour,
            image: v.image,
            previewImage: v.previewImage,
            gallery: v.gallery,
            notes: v.notes,
          });
        }
      }

      variantsWrap.appendChild(listEl);
      variantsWrap.appendChild(addVarBtn);
      variantsWrap.appendChild(disableVariantsBtn);

      addVarBtn.addEventListener("click", () => {
        appendVariantEditorRow(listEl, {
          key: newEditorVariantKey(),
          label: "",
          colour: "",
          colourCode: "",
          image: "",
          previewImage: "",
          gallery: [],
          notes: "",
        });
        variantsWrap.dataset.active = "1";
        variantsWrap.hidden = false;
        addVarBtn.hidden = false;
        disableVariantsBtn.hidden = !colourSingleField;
      });

      disableVariantsBtn.addEventListener("click", () => {
        if (!colourSingleField) return;
        const firstRow = listEl.querySelector(".item-edit-variant-row");
        if (firstRow) {
          const firstLabel = firstRow.querySelector(".item-edit-variant-label")?.value?.trim() || "";
          const firstColour = firstRow.querySelector(".item-edit-variant-colour")?.value?.trim() || "";
          const firstCode = firstRow.querySelector(".item-edit-variant-colour-code")?.value?.trim() || "";
          const colourNameEl = /** @type {HTMLInputElement | null} */ (colourSingleField.querySelector("#item-edit-colour"));
          const codeIn = /** @type {HTMLInputElement | null} */ (colourSingleField.querySelector("#item-edit-colour-code"));
          if (colourNameEl) colourNameEl.value = firstColour || firstLabel || colourNameEl.value;
          if (codeIn) codeIn.value = firstCode || codeIn.value;
          const firstBasic = /** @type {HTMLSelectElement | null} */ (firstRow.querySelector(".item-edit-variant-basic-colour"));
          const singleBasic = /** @type {HTMLSelectElement | null} */ (colourSingleField.querySelector("#item-edit-basic-colour"));
          if (singleBasic) {
            const raw = String(firstBasic?.value ?? "").trim();
            const sel =
              raw.toLowerCase() === BASIC_COLOUR_CLASSIFICATION_OMIT
                ? BASIC_COLOUR_CLASSIFICATION_OMIT
                : normalizeStoredBasicColourKey(raw);
            fillBasicColourSelectOptions(singleBasic, sel || "");
          }
        }
        variantsWrap.dataset.active = "0";
        variantsWrap.hidden = true;
        colourSingleField.hidden = false;
        addVarBtn.hidden = true;
        disableVariantsBtn.hidden = true;
        const photosField = document.getElementById("item-edit-photos-field");
        if (photosField instanceof HTMLElement) photosField.hidden = false;
      });

      if (colourSingleField) {
        const migrateBtn = colourSingleField.querySelector(".item-edit-enable-variants");
        migrateBtn?.addEventListener("click", () => {
          const colourNameEl = /** @type {HTMLInputElement | null} */ (
            colourSingleField.querySelector("#item-edit-colour")
          );
          const codeIn = /** @type {HTMLInputElement | null} */ (colourSingleField.querySelector("#item-edit-colour-code"));
          const baseColour = colourNameEl?.value?.trim() || "";
          const baseCode = codeIn?.value?.trim() || "";
          const basicTop = /** @type {HTMLSelectElement | null} */ (colourSingleField.querySelector("#item-edit-basic-colour"));
          const rawTop = String(basicTop?.value ?? "").trim();
          const basicFromSingle =
            rawTop.toLowerCase() === BASIC_COLOUR_CLASSIFICATION_OMIT ? "" : normalizeStoredBasicColourKey(rawTop);
          const label0 = baseColour || "Colour 1";
          const key0 = slugVariantKeyBase(label0) || "colour-1";
          listEl.innerHTML = "";
          appendVariantEditorRow(listEl, {
            key: key0,
            label: label0,
            colour: baseColour,
            colourCode: baseCode,
            basicColour: basicFromSingle,
            image: String(item.image ?? ""),
            previewImage: "",
            gallery: itemGalleryList(item),
            notes: "",
          });
          appendVariantEditorRow(listEl, {
            key: newEditorVariantKey(),
            label: "",
            colour: "",
            colourCode: "",
            image: "",
            previewImage: "",
            gallery: [],
            notes: "",
          });
          variantsWrap.dataset.active = "1";
          variantsWrap.hidden = false;
          colourSingleField.hidden = true;
          addVarBtn.hidden = false;
          disableVariantsBtn.hidden = false;
          const photosField = document.getElementById("item-edit-photos-field");
          if (photosField instanceof HTMLElement) photosField.hidden = true;
        });
      }

      colourGrid.appendChild(variantsWrap);

      const seaSel = document.createElement("select");
      seaSel.id = "item-edit-season";
      const seasonRows = [
        { value: "All-season", label: "All seasons" },
        { value: "A/W", label: "A/W" },
        { value: "S/S", label: "S/S" },
      ];
      const curSe = String(item.season ?? "").trim();
      const curPick = curSe === "A/W" || curSe === "S/S" ? curSe : "All-season";
      for (const row of seasonRows) {
        const o = document.createElement("option");
        o.value = row.value;
        o.textContent = row.label;
        if (row.value === curPick) o.selected = true;
        seaSel.appendChild(o);
      }

      const fabIn = document.createElement("input");
      fabIn.type = "text";
      fabIn.id = "item-edit-fabric";
      fabIn.maxLength = 80;
      fabIn.value = String(item.fabric ?? "");

      const wtIn = document.createElement("input");
      wtIn.type = "text";
      wtIn.id = "item-edit-weight";
      wtIn.maxLength = 80;
      wtIn.value = String(item.weight ?? "");

      const sizeIn = document.createElement("input");
      sizeIn.type = "text";
      sizeIn.id = "item-edit-size";
      sizeIn.maxLength = 120;
      sizeIn.value = String(item.size ?? "");

      addField("Season (optional)", seaSel, colourGrid);
      addField("Fabric (optional)", fabIn, materialGrid);
      addField("Weight / specs (optional)", wtIn, materialGrid);
      addField("Size (optional)", sizeIn, materialGrid);

      const pd = String(item.purchaseDate ?? "").trim();
      const { date: purchaseDateValue, note: purchaseNoteValue } = splitPurchaseDateForForm(pd);
      const purchaseWrap = document.createElement("div");
      purchaseWrap.className = "item-edit-purchase-fields";
      const purchaseIn = document.createElement("input");
      purchaseIn.type = "date";
      purchaseIn.id = "item-edit-purchase-date";
      purchaseIn.value = purchaseDateValue;
      const purchaseNoteIn = document.createElement("input");
      purchaseNoteIn.type = "text";
      purchaseNoteIn.id = "item-edit-purchase-date-note";
      purchaseNoteIn.maxLength = 80;
      purchaseNoteIn.autocomplete = "off";
      purchaseNoteIn.placeholder = "Optional note (e.g. approximate, gift)";
      purchaseNoteIn.value = purchaseNoteValue;
      purchaseWrap.appendChild(purchaseIn);
      purchaseWrap.appendChild(purchaseNoteIn);

      const priceWrap = document.createElement("div");
      priceWrap.className = "item-edit-price-row";
      const priceIn = document.createElement("input");
      priceIn.type = "number";
      priceIn.id = "item-edit-price";
      priceIn.min = "0";
      priceIn.step = "any";
      priceIn.inputMode = "decimal";
      priceIn.placeholder = "e.g. 199 or 199.5";
      priceIn.autocomplete = "off";
      if (Number.isFinite(Number(item.price))) priceIn.value = String(item.price);
      const priceCurSel = document.createElement("select");
      priceCurSel.id = "item-edit-price-currency";
      priceCurSel.setAttribute("aria-label", "Price currency");
      const priceCurrencyPick = PRICE_CURRENCY_CODES.includes(String(item.priceCurrency ?? "").trim().toUpperCase())
        ? String(item.priceCurrency).trim().toUpperCase()
        : "TWD";
      for (const c of PRICE_CURRENCY_CODES) {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        if (c === priceCurrencyPick) o.selected = true;
        priceCurSel.appendChild(o);
      }
      priceWrap.appendChild(priceIn);
      priceWrap.appendChild(priceCurSel);

      addField("Purchase date (optional)", purchaseWrap, acquisitionGrid);
      addField("Price (optional)", priceWrap, acquisitionGrid);

      formScroll.appendChild(identitySec.section);
      formScroll.appendChild(colourSec.section);
      formScroll.appendChild(materialSec.section);
      formScroll.appendChild(acquisitionSec.section);

      const notesSec = createItemEditSection("Notes");
      const notesLab = document.createElement("label");
      notesLab.className = "field field--block item-edit-section__block-field";
      const notesSpan = document.createElement("span");
      notesSpan.className = "field__label";
      notesSpan.textContent = "Notes (optional)";
      const notesTa = document.createElement("textarea");
      notesTa.id = "item-edit-notes";
      notesTa.rows = 4;
      notesTa.maxLength = 2000;
      notesTa.value = String(item.notes ?? "");
      notesLab.appendChild(notesSpan);
      notesLab.appendChild(notesTa);
      notesSec.grid.appendChild(notesLab);
      formScroll.appendChild(notesSec.section);

      const measSec = createItemEditSection("Measurements");
      const measWrap = document.createElement("label");
      measWrap.className = "field field--block item-edit-measurements-wrap item-edit-section__block-field";
      const measSpan = document.createElement("span");
      measSpan.className = "field__label";
      measSpan.textContent = "Measurements (optional)";
      const measBlockHost = document.createElement("div");
      measBlockHost.id = "item-edit-measured-dims-block";
      measBlockHost.className = "item-edit-measured-dims-host";
      measWrap.appendChild(measSpan);
      measWrap.appendChild(measBlockHost);
      measSec.grid.appendChild(measWrap);
      formScroll.appendChild(measSec.section);
      mountMeasurementRowsEditor(
        measBlockHost,
        resolveInitialMeasurementRowsForEditor(getMeasurementRows(item), { defaultsForEmpty: false }),
        { unitSelectId: "item-edit-measurement-unit", initialUnit: getMeasurementUnit(item) }
      );

      const formFooter = document.createElement("div");
      formFooter.className = "item-edit-form-footer";

      const msg = document.createElement("p");
      msg.id = "item-detail-edit-msg";
      msg.className = "item-detail__edit-msg";
      msg.hidden = true;
      msg.setAttribute("role", "status");
      formFooter.appendChild(msg);

      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        void saveItemDetailEdit(form);
      });
      form.addEventListener("keydown", (ev) => {
        if (!(ev.ctrlKey || ev.metaKey) || ev.key !== "Enter") return;
        ev.preventDefault();
        void saveItemDetailEdit(form);
      });

      const act = document.createElement("div");
      act.className = "item-detail__form-actions";
      const actPush = document.createElement("div");
      actPush.className = "item-detail__form-actions-push";
      const saveBtn = document.createElement("button");
      saveBtn.type = "submit";
      saveBtn.className = "btn btn--small";
      saveBtn.textContent = "Save changes";
      saveBtn.title = "Save (⌘ Enter or Ctrl+Enter)";
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn--small btn--ghost";
      cancelBtn.id = "item-detail-cancel-edit";
      cancelBtn.textContent = "Cancel";
      cancelBtn.title = "Discard changes (Esc)";
      actPush.appendChild(saveBtn);
      actPush.appendChild(cancelBtn);
      const dupBtn = document.createElement("button");
      dupBtn.type = "button";
      dupBtn.className = "btn btn--small btn--ghost";
      dupBtn.id = "item-detail-duplicate";
      dupBtn.classList.add("tw-admin-only");
      dupBtn.textContent = "Duplicate";
      dupBtn.title =
        "Save a copy as a new custom piece (same photos and fields; name gets “ (copy)”) — opens the copy here for editing.";
      actPush.appendChild(dupBtn);
      act.appendChild(actPush);

      const delWrap = document.createElement("div");
      delWrap.className = "item-detail__form-danger tw-admin-only";
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn--small btn--danger";
      delBtn.id = "item-detail-delete";
      delBtn.textContent = "Delete piece…";
      delBtn.title =
        "Remove this piece from Supabase (outfit links cleared; cloud images removed where applicable; cannot be undone).";
      delWrap.appendChild(delBtn);
      act.appendChild(delWrap);
      formFooter.appendChild(act);

      form.appendChild(formScroll);
      form.appendChild(formFooter);

      let editDirty = false;
      const markEditDirty = () => {
        if (editDirty) return;
        editDirty = true;
        const st = document.getElementById("item-detail-edit-status");
        if (!st || st.classList.contains("item-edit-save-status--saving")) return;
        st.hidden = false;
        st.textContent = "Unsaved changes";
        st.classList.add("item-edit-save-status--dirty");
        st.classList.remove("item-edit-save-status--saved", "item-edit-save-status--error");
      };
      form.addEventListener("input", markEditDirty);
      form.addEventListener("change", markEditDirty);

      wrap.appendChild(form);
      root.appendChild(wrap);
      afterItemDetailPageRender(root, true);
      return;
    }

    const body = document.createElement("div");
    body.className = "item-detail__body";

    body.appendChild(buildItemDetailBreadcrumbNav(item));

    const title = document.createElement("h2");
    title.id = "item-detail-heading";
    title.className = "item-detail__title";
    if (root.classList.contains("item-detail__root--page")) {
      title.classList.add("item-detail__title--product");
      title.tabIndex = -1;
    }
    title.textContent = displayNameWithoutLeadingColour(item);
    body.appendChild(title);

    const brand = document.createElement("p");
    brand.className = "item-detail__brand";
    brand.textContent = item.brand;
    body.appendChild(brand);

    mountVariantSwatchStrip(body, item, { outfitPick: true, heroImg: img, heroHost: media, addToOutfitOnPick: true });

    if (!itemEligibleForOutfit(item)) {
      const only = document.createElement("p");
      only.className = "item-detail__archive-only";
      only.textContent = "Archive entry — not used in the outfit builder.";
      body.appendChild(only);
    }

    const dl = document.createElement("dl");
    dl.className = "item-detail__meta";

    function addRow(label, value) {
      const v = value == null ? "" : String(value).trim();
      if (!v) return;
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = v;
      dl.appendChild(dt);
      dl.appendChild(dd);
    }

    addRow("Season", seasonUiLabel(item.season));
    addRow("Size", item.size);
    {
      const pd = String(item.purchaseDate ?? "").trim();
      if (pd) addRow("Purchase date", formatPurchaseDateForDisplay(pd));
    }
    {
      const pl = formattedArchivePriceLine(item);
      if (pl) addRow("Price", pl);
    }
    const specLine = specParts(item).join(" · ");
    if (specLine) addRow("Details", specLine);

    if (dl.children.length) body.appendChild(dl);

    if (item.notes) {
      const nh = document.createElement("h3");
      nh.className = "item-detail__notes-h";
      nh.textContent = "Notes";
      const np = document.createElement("div");
      np.className = "item-detail__notes";
      np.textContent = item.notes;
      body.appendChild(nh);
      body.appendChild(np);
    }

    appendMeasurementDisplaySection(body, item);

    root.appendChild(body);

    const actions = document.createElement("div");
    actions.className = "item-detail__actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn--small btn--ghost";
    copyBtn.id = "item-detail-copy-text";
    copyBtn.textContent = "Copy text for AI";
    copyBtn.title =
      "Copies text fields only; paths stay as text, embedded images are summarized (not pasted in full).";
    actions.appendChild(copyBtn);

    const ed = document.createElement("button");
    ed.type = "button";
    ed.className = "btn btn--small";
    ed.id = "item-detail-edit";
    ed.classList.add("tw-admin-only");
    ed.textContent = "Edit";
    if (!isSupabaseReady()) {
      ed.disabled = true;
      ed.title = CLOUD_WRITE_REQUIRED_MESSAGE;
    }
    actions.appendChild(ed);
    actions.id = "item-detail-actions";
    root.appendChild(actions);
    afterItemDetailPageRender(root, false);
  }

  function replaceItemPageUrl(id, withEdit) {
    if (document.getElementById("grid")) return;
    const u = new URL("item.html", globalThis.location.href);
    u.searchParams.set("id", String(id));
    if (withEdit) u.searchParams.set("edit", "1");
    else u.searchParams.delete("edit");
    globalThis.history.replaceState(null, "", u.pathname + u.search);
  }

  function persistArchiveListScrollForReturn() {
    if (!document.getElementById("grid")) return;
    try {
      sessionStorage.setItem(
        ARCHIVE_SCROLL_RESTORE_KEY,
        JSON.stringify({
          y: globalThis.scrollY ?? globalThis.pageYOffset ?? 0,
          t: Date.now(),
        })
      );
    } catch {
      /* private mode / disabled storage */
    }
  }

  function writeArchiveBrowseRestoreSnapshot(overrides = {}) {
    try {
      sessionStorage.setItem(
        ARCHIVE_BROWSE_RESTORE_KEY,
        JSON.stringify({
          t: Date.now(),
          seasonNav: normalizeSeasonNavToken(overrides.seasonNav ?? seasonNavFilter),
          category: overrides.category != null ? String(overrides.category) : String(categoryNavFilter ?? ""),
          subcategory:
            overrides.subcategory != null
              ? String(overrides.subcategory).trim()
              : String(subcategoryFilter ?? "").trim(),
          search: overrides.search != null ? String(overrides.search).trim() : String(els.search?.value ?? "").trim(),
          basicColour:
            overrides.basicColour != null
              ? String(overrides.basicColour).trim()
              : String(basicColourFilter ?? "").trim(),
        })
      );
    } catch {
      /* private mode / disabled storage */
    }
  }

  /** Read browse snapshot without consuming (same TTL as `consumeArchiveBrowseStateForReturn`). */
  function peekArchiveBrowseRestoreSnapshot() {
    try {
      const raw = sessionStorage.getItem(ARCHIVE_BROWSE_RESTORE_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      const t = Number(o?.t);
      if (!Number.isFinite(t) || Date.now() - t > ARCHIVE_SCROLL_TTL_MS) return null;
      return o;
    } catch {
      return null;
    }
  }

  /**
   * Before leaving `item.html` after save, refresh the archive browse snapshot so the PLP
   * re-opens on the same section + record-type drill the user came from (or the saved item’s type).
   * @param {object | null | undefined} item
   */
  function writeArchiveBrowseRestoreForItemReturn(item) {
    const prev = peekArchiveBrowseRestoreSnapshot();
    const slot = item ? itemSlot(item) : "";
    const drill = item ? recordCategoryForDrill(item, slot) : "";
    let category = String(prev?.category ?? "").trim();
    let subcategory = String(prev?.subcategory ?? "").trim();
    if (!SLOT_OPTIONS.includes(category)) category = slot;
    if (!subcategory && drill) subcategory = drill;
    if (prev) {
      writeArchiveBrowseRestoreSnapshot({
        seasonNav: prev.seasonNav,
        category,
        subcategory,
        search: String(prev.search ?? ""),
        basicColour: String(prev.basicColour ?? ""),
      });
      return;
    }
    writeArchiveBrowseRestoreSnapshot({ category, subcategory });
  }

  function navigateToArchiveMain() {
    try {
      globalThis.location.assign(ARCHIVE_HOME_MAIN_URL);
    } catch {
      globalThis.location.href = ARCHIVE_HOME_MAIN_URL;
    }
  }

  function normalizeArchiveTopLanding() {
    if (!isArchiveLocation()) return;
    if (String(globalThis.location.hash ?? "") !== "#main") return;
    try {
      const u = new URL(globalThis.location.href);
      u.hash = "";
      globalThis.history.replaceState(null, "", `${u.pathname}${u.search}`);
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => {
      try {
        globalThis.scrollTo(0, 0);
      } catch {
        /* ignore */
      }
    });
  }

  function isSiteHomePage() {
    return resolvePageTheme() === "home";
  }

  /** Logo / brand home: editorial hero landing — never the archive PLP. */
  function scrollSiteHomeTop() {
    try {
      const reduce = Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
      globalThis.scrollTo({ top: 0, left: 0, behavior: reduce ? "auto" : "smooth" });
    } catch {
      globalThis.scrollTo(0, 0);
    }
  }

  function navigateToSiteHome() {
    if (isSiteHomePage()) {
      scrollSiteHomeTop();
      return;
    }
    try {
      sessionStorage.removeItem(ARCHIVE_BROWSE_RESTORE_KEY);
    } catch {
      /* ignore */
    }
    try {
      globalThis.location.assign(SITE_HOME_URL);
    } catch {
      globalThis.location.href = SITE_HOME_URL;
    }
  }

  function persistArchiveBrowseStateForReturn() {
    if (!document.getElementById("grid")) return;
    writeArchiveBrowseRestoreSnapshot();
  }

  /** Apply category / season / drill / search after a full reload when returning from `item.html`. */
  function consumeArchiveBrowseStateForReturn() {
    if (!document.getElementById("grid")) return;
    let raw = null;
    try {
      raw = sessionStorage.getItem(ARCHIVE_BROWSE_RESTORE_KEY);
      if (raw) sessionStorage.removeItem(ARCHIVE_BROWSE_RESTORE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let o = null;
    try {
      o = JSON.parse(raw);
    } catch {
      return;
    }
    const t = Number(o?.t);
    if (!Number.isFinite(t) || Date.now() - t > ARCHIVE_SCROLL_TTL_MS) return;

    const urlSeason = readSeasonNavFromUrl();
    if (urlSeason) {
      seasonNavFilter = urlSeason;
    } else if (archiveUrlHasSeasonParam() || isArchiveLocation()) {
      seasonNavFilter = null;
    } else {
      seasonNavFilter = normalizeSeasonNavToken(o?.seasonNav);
    }

    const cat = String(o?.category ?? "").trim();
    if (!cat) categoryNavFilter = "";
    else if (SLOT_OPTIONS.includes(cat)) categoryNavFilter = cat;

    subcategoryFilter = String(o?.subcategory ?? "").trim();
    const q = String(o?.search ?? "").trim();
    if (els.search && q) {
      els.search.value = q.slice(0, 500);
      const qn = normalizeSearch(q);
      if (qn) {
        archiveSubmittedSearchNorm = qn;
        archiveSubmittedSearchRaw = q;
        archiveSearchWithinRecordCategory = "";
        archiveSearchBrowseAllSlots = true;
        archiveSearchReturnSnapshot = null;
        document.body.classList.remove("archive-ui--search-results-plp");
      }
    }

    const bc = String(o?.basicColour ?? "")
      .trim()
      .toLowerCase();
    if (BASIC_COLOUR_FAMILY_KEYS.includes(bc)) {
      basicColourFilter = persistBasicColourFilter(bc);
    } else {
      basicColourFilter = persistBasicColourFilter("");
    }
    try {
      persistSeasonNav();
    } catch {
      /* ignore */
    }
  }

  function consumeAndRestoreArchiveListScroll() {
    if (!document.getElementById("grid")) return;
    let raw = null;
    try {
      raw = sessionStorage.getItem(ARCHIVE_SCROLL_RESTORE_KEY);
      if (raw) sessionStorage.removeItem(ARCHIVE_SCROLL_RESTORE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let o = null;
    try {
      o = JSON.parse(raw);
    } catch {
      return;
    }
    const y = Number(o?.y);
    const t = Number(o?.t);
    if (!Number.isFinite(y) || y < 0) return;
    if (!Number.isFinite(t) || Date.now() - t > ARCHIVE_SCROLL_TTL_MS) return;

    function clampScroll(target) {
      const el = document.documentElement;
      const body = document.body;
      const h = Math.max(
        el?.scrollHeight ?? 0,
        body?.scrollHeight ?? 0,
        el?.offsetHeight ?? 0,
        body?.offsetHeight ?? 0
      );
      const max = Math.max(0, h - globalThis.innerHeight);
      globalThis.scrollTo(0, Math.min(Math.max(0, target), max));
    }

    const run = () => clampScroll(y);
    requestAnimationFrame(run);
    requestAnimationFrame(() => requestAnimationFrame(run));
    setTimeout(run, 80);
    setTimeout(run, 280);
  }

  /**
   * @param {string} id
   * @param {MouseEvent | undefined} [fromEvent] — used for modifier-click → new tab
   */
  function openItemDetail(id, fromEvent) {
    if (!id) return;
    const u = new URL("item.html", globalThis.location.href);
    u.searchParams.set("id", String(id));
    const url = u.toString();
    const ev = fromEvent;
    const openNewTab =
      ev instanceof MouseEvent &&
      (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1);
    if (openNewTab) {
      globalThis.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    persistArchiveListScrollForReturn();
    persistArchiveBrowseStateForReturn();
    globalThis.location.assign(url);
  }

  function initItemDetailRootDelegates() {
    const root = itemDetailMountRoot();
    if (!root) return;

    if (!itemDetailDelegatesInstalled) {
      itemDetailDelegatesInstalled = true;
      root.addEventListener("click", (e) => {
        const mount = /** @type {HTMLElement} */ (e.currentTarget);
        const t = /** @type {Element | null} */ (e.target instanceof Element ? e.target : null);
        if (t?.closest("#item-detail-copy-text")) {
          const it = itemById.get(detailItemId);
          if (it) void copyItemPlainTextForAi(it);
          return;
        }
        if (t?.closest("#item-detail-duplicate")) {
          if (!isTwAdminMode()) return;
          const it = itemById.get(detailItemId);
          if (!it) return;
          if (!isSupabaseReady()) {
            showToast(CLOUD_WRITE_REQUIRED_MESSAGE);
            return;
          }
          const dupBtnEl = /** @type {HTMLButtonElement | null} */ (mount.querySelector("#item-detail-duplicate"));
          if (dupBtnEl) dupBtnEl.disabled = true;
          void (async () => {
            try {
              const dup = buildDuplicateCustomItem(it);
              const newId = await persistNewCustomItemRow(dup);
              const next = itemById.get(newId);
              if (!next) {
                showToast("Duplicate saved but the new piece could not be shown — refresh the page.");
                return;
              }
              renderItemDetailContent(mount, next, { edit: true });
              replaceItemPageUrl(newId, true);
              document.title = `${next.brand} — ${displayNameWithoutLeadingColour(next)} · Timeless Wardrobe`;
              showToast("Duplicate saved — edit this copy below.");
            } catch (err) {
              console.warn("duplicate piece", err);
              showToast(messageForFailedWardrobeUpsert(err));
            } finally {
              if (dupBtnEl) dupBtnEl.disabled = false;
            }
          })();
          return;
        }
        if (t?.closest("#item-detail-edit")) {
          if (!isTwAdminMode()) return;
          const it = itemById.get(detailItemId);
          if (!it) return;
          if (!isSupabaseReady()) {
            showToast(CLOUD_WRITE_REQUIRED_MESSAGE);
            return;
          }
          renderItemDetailContent(mount, it, { edit: true });
          replaceItemPageUrl(it.id, true);
          return;
        }
        if (t?.closest("#item-detail-delete")) {
          if (!isTwAdminMode()) return;
          const it = itemById.get(detailItemId);
          if (!it) return;
          if (!isSupabaseReady()) {
            showToast(CLOUD_WRITE_REQUIRED_MESSAGE);
            return;
          }
          const msg =
            "Delete this piece from Supabase? Links in saved outfits are removed first (`outfit_items`). Then we delete Storage objects only when the image URL maps to your wardrobe-images bucket—external URLs stay. Finally we delete the `wardrobe_items` row; nothing here can restore it.";
          if (!confirm(msg)) return;
          void deleteWardrobePieceFromBrowser(it.id);
          return;
        }
        if (t?.closest("#item-detail-cancel-edit")) {
          const it = itemById.get(detailItemId);
          if (it) {
            renderItemDetailContent(mount, it, { edit: false });
            replaceItemPageUrl(it.id, false);
          }
          return;
        }
      });
    }

    if (!itemDetailPageKeyboardInstalled) {
      itemDetailPageKeyboardInstalled = true;
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (document.querySelector("dialog[open]")) return;
        const mount = itemDetailMountRoot();
        if (!mount?.classList.contains("item-detail__root--page")) return;
        if (document.getElementById("grid")) return;
        if (!document.getElementById("item-detail-edit-form")) return;
        const it = itemById.get(detailItemId);
        if (!it || !mount) return;
        e.preventDefault();
        renderItemDetailContent(mount, it, { edit: false });
        replaceItemPageUrl(it.id, false);
      });
    }
  }

  /**
   * On item.html, one stale in-memory pass can happen right after add/edit navigation.
   * Retry once by refreshing sources before declaring "not found".
   * @param {string} pageId
   * @returns {Promise<object | null>}
   */
  async function resolveItemForDetailPage(pageId) {
    if (!pageId) return null;
    let hit = itemById.get(pageId);
    if (hit) return hit;

    try {
      if (isCloudModeActive()) {
        await refreshCloudBackedCustomItems();
      } else {
        fileBackedCustomItems = await loadFileBackedCustomItems();
        mergeWardrobeFromSources();
      }
    } catch (e) {
      console.warn("Detail page refresh before lookup failed:", e);
    }
    hit = itemById.get(pageId);
    return hit || null;
  }

  async function runItemDetailPage(root, pageId) {
    const item = await resolveItemForDetailPage(pageId);
    const params = new URLSearchParams(globalThis.location.search);
    const wantEdit = params.get("edit") === "1";

    if (!item) {
      root.innerHTML =
        '<div class="item-page-not-found-wrap" role="alert">' +
        '<p class="item-page-not-found">This piece is not in the archive.</p>' +
        '<p class="item-page-not-found__hint">The link may be outdated or the piece was removed.</p>' +
        `<p><a class="btn" href="${ARCHIVE_HOME_MAIN_URL}">Back to archive</a></p>` +
        "</div>";
      document.title = "Piece not found · Timeless Wardrobe";
      globalThis.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    document.title = `${item.brand} — ${displayNameWithoutLeadingColour(item)} · Timeless Wardrobe`;
    recordRecentlyViewedItem(item.id);
    const wantEditRequested = wantEdit;
    let allowEdit = wantEditRequested && isTwAdminMode();
    if (wantEditRequested && !isTwAdminMode()) {
      replaceItemPageUrl(item.id, false);
    }
    if (wantEditRequested && isTwAdminMode() && !isSupabaseReady()) {
      showToast(CLOUD_WRITE_REQUIRED_MESSAGE);
      allowEdit = false;
      replaceItemPageUrl(item.id, false);
    }
    renderItemDetailContent(root, item, { edit: allowEdit });
  }

  function syncCategoryTabUI() {
    const filter = String(categoryNavFilter ?? "").trim();
    const subF = String(subcategoryFilter ?? "").trim();
    const submenuOpen = document.body.classList.contains("archive-ui--header-submenu-open");
    const openSlot = submenuOpen ? String(headerNavOpenSlot ?? "").trim() : "";
    const jumpMatches = (el) => String(el.getAttribute("data-category-jump") ?? "").trim() === filter;

    document.querySelectorAll(".site-header__nav-link[data-category-jump]").forEach((el) => {
      const jump = String(el.getAttribute("data-category-jump") ?? "").trim();
      const active = openSlot ? jump === openSlot : Boolean(filter) && jump === filter;
      el.classList.toggle("is-active", active);
      if (active) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });

    document.querySelectorAll(".site-header__mobile-link[data-category-jump]").forEach((el) => {
      const active = jumpMatches(el);
      el.classList.toggle("is-active", active);
      if (active) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });

    document.querySelectorAll(".site-header__mobile-browse-all[data-category-jump]").forEach((el) => {
      const active = jumpMatches(el) && !subF;
      el.classList.toggle("is-active", active);
    });

    document
      .querySelectorAll(".site-header__search-aside-link[data-category-jump], .site-header__search-category-card[data-category-jump]")
      .forEach((el) => {
        const jump = String(el.getAttribute("data-category-jump") ?? "").trim();
        const sub = String(el.getAttribute("data-subcategory-jump") ?? "").trim();
        const active = jump === filter && subcategoryFilterMatchesEntry(sub, subF);
        el.classList.toggle("is-active", active);
      });

    document.querySelectorAll(".site-header__submenu-link[data-category-jump]").forEach((el) => {
      const jump = String(el.getAttribute("data-category-jump") ?? "").trim();
      const sub = String(el.getAttribute("data-subcategory-jump") ?? "").trim();
      const activeRow = jump === filter && subcategoryFilterMatchesEntry(sub, subF);
      el.classList.toggle("is-active", activeRow);
    });

  }

  function setSeasonNavFilter(next) {
    const normalized = normalizeSeason(next);
    const v = normalized === "SS" || normalized === "AW" ? normalized : null;
    seasonNavFilter = v && seasonNavFilter !== v ? v : null;
    persistSeasonNav();
    replaceArchiveSeasonQuery(seasonNavFilter);
    invalidateArchiveSortedCache();
    syncSeasonTabUI();
    validateSubcategoryFilter();
    renderCategoryDrill();
    renderGrid();
  }

  function syncSeasonTabUI() {
    const markTabs = (root, selector, pressedAttr) => {
      if (!root) return;
      root.querySelectorAll(selector).forEach((tab) => {
        const raw = tab.dataset.seasonFilter ?? "";
        const normalized = normalizeSeason(raw);
        const v = normalized === "SS" || normalized === "AW" ? normalized : null;
        const active = v === seasonNavFilter;
        tab.classList.toggle("is-active", active);
        tab.setAttribute(pressedAttr, active ? "true" : "false");
      });
    };
    markTabs(document.getElementById("season-nav"), ".season-strip__tab", "aria-selected");
    markTabs(document.getElementById("season-nav-mini"), ".site-header__season-mini-tab", "aria-pressed");
    markTabs(
      document.getElementById("archive-drawer-season-chips"),
      "button[data-season-filter]",
      "aria-pressed"
    );
  }

  /** Match archive mobile PLP + compact header (`max-width: 900px` in CSS / `isHeaderCompactLayout`). */
  function isFiltersNarrowViewport() {
    return globalThis.matchMedia?.("(max-width: 900px)")?.matches ?? false;
  }

  /** After changing category / type filters, bring the archive list back into view from the top. */
  function scrollArchiveViewportTop() {
    try {
      const reduce = Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
      globalThis.scrollTo({ top: 0, left: 0, behavior: reduce ? "auto" : "smooth" });
    } catch {
      globalThis.scrollTo(0, 0);
    }
  }

  /** Keep viewport Y stable when toolbar / drill chips reflow (avoids scroll-fold feedback loops). */
  function withPreservedArchiveScroll(updateFn) {
    const y = globalThis.scrollY ?? globalThis.pageYOffset ?? 0;
    updateFn();
    requestAnimationFrame(() => {
      const max = Math.max(0, document.documentElement.scrollHeight - globalThis.innerHeight);
      globalThis.scrollTo(0, Math.min(y, max));
    });
  }

  function syncFiltersMenuForViewport() {
    const nav = document.getElementById("filters-nav");
    const btn = document.getElementById("filters-menu-btn");
    if (!nav) return;
    if (!btn) {
      nav.classList.remove("filters--menu-open");
      return;
    }
    if (!isFiltersNarrowViewport()) {
      nav.classList.remove("filters--menu-open");
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("aria-hidden", "true");
      btn.tabIndex = -1;
    } else {
      btn.removeAttribute("aria-hidden");
      btn.tabIndex = 0;
      btn.setAttribute("aria-expanded", nav.classList.contains("filters--menu-open") ? "true" : "false");
      document.body.classList.remove("archive-ui--nav-folded");
    }
  }

  function collapseFiltersMenuPanel() {
    const nav = document.getElementById("filters-nav");
    if (!nav || !isFiltersNarrowViewport()) return;
    nav.classList.remove("filters--menu-open");
    const btn = document.getElementById("filters-menu-btn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function toggleFiltersMenuPanel() {
    const nav = document.getElementById("filters-nav");
    const btn = document.getElementById("filters-menu-btn");
    if (!nav || !btn || !isFiltersNarrowViewport()) return;
    nav.classList.toggle("filters--menu-open");
    const open = nav.classList.contains("filters--menu-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      document.body.classList.remove("archive-ui--nav-folded");
    }
  }

  function initFilters() {
    syncSeasonTabUI();
    syncCategoryTabUI();
    validateSubcategoryFilter();
    renderCategoryDrill();
    syncFiltersMenuForViewport();
    wireArchiveBrowseToolControls();
    syncFilterSearchClearVisibility();
    syncArchiveSortChipUi();
  }

  /**
   * Filter drawer: pill row of record types present in the current slot + season (counts), above sort/colour.
   * Mirrors `fillItemEditRecordTypeSelect` key ordering; hidden when fewer than two distinct types.
   */
  function syncArchiveDrawerSubcategoryPills() {
    const section = document.getElementById("archive-drawer-record-types");
    const chipWrap = document.getElementById("archive-drawer-record-type-chips");
    if (!section || !chipWrap) return;

    const slot = String(categoryNavFilter ?? "").trim();
    if (!slot || !SLOT_OPTIONS.includes(slot)) {
      section.hidden = true;
      chipWrap.replaceChildren();
      return;
    }

    const pool = poolItemsForDrillSubcategories();
    const fall = defaultRecordCategoryForSlot(slot);
    let keys = drillSubcategoryKeysFromPool(slot, pool);
    const knownExtra = KNOWN_RECORD_TYPES_BY_SLOT[slot];
    if (knownExtra?.length) keys = sortRecordTypeKeysForSlot(slot, [...keys, ...knownExtra]);
    if (slot === SLOT_ACCESSORIES) {
      keys = keys.filter((k) => k && !["Jewellery", "Jewellery", "Future"].includes(k));
      keys = keys.filter(
        (k) => k && !["Everyday", "Watches", "Beater", "Dress watch", "Dive watch"].includes(k)
      );
      if (!keys.includes("Jewellery")) keys.push("Jewellery");
      keys = sortRecordTypeKeysForSlot(slot, keys);
    }
    if (!keys.includes(fall)) keys = sortRecordTypeKeysForSlot(slot, [fall, ...keys]);

    const typeEntries = collapseRecordTypeKeysByDisplayLabel(keys, slot);

    const withCounts = typeEntries
      .map(({ raw, label }) => ({
        raw,
        label,
        count: pool.filter(
          (i) => itemSlot(i) === slot && itemMatchesDrillSubcategory(i, slot, raw)
        ).length,
      }))
      .filter((x) => x.count > 0);

    if (withCounts.length <= 1) {
      section.hidden = true;
      chipWrap.replaceChildren();
      return;
    }

    section.hidden = false;
    chipWrap.replaceChildren();

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "archive-drawer-record-type-chip";
    allBtn.dataset.drawerRecordType = "";
    const subActive = !String(subcategoryFilter ?? "").trim();
    allBtn.classList.toggle("is-active", subActive);
    allBtn.setAttribute("aria-pressed", subActive ? "true" : "false");
    allBtn.setAttribute("aria-label", "All record types");
    const allTxt = document.createElement("span");
    allTxt.className = "colour-filter-chip__text";
    allTxt.textContent = "All types";
    allBtn.appendChild(allTxt);
    chipWrap.appendChild(allBtn);

    for (const { raw, label, count } of withCounts) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "archive-drawer-record-type-chip";
      b.dataset.drawerRecordType = raw;
      const on = recordTypeDrillKeysEquivalent(subcategoryFilter, raw);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.setAttribute("aria-label", `Filter by ${label}`);
      const txt = document.createElement("span");
      txt.className = "colour-filter-chip__text";
      txt.textContent = `${label} (${count})`;
      b.appendChild(txt);
      chipWrap.appendChild(b);
    }
  }

  function syncBasicColourFilterChipUi() {
    const chipWrap = document.getElementById("archive-colour-chips");
    const chipBlock = chipWrap?.closest(".items-toolbar__colour-block");
    if (!chipWrap) return;
    const allowColour = allowArchiveBasicColourFilter();
    if (chipBlock) chipBlock.hidden = !allowColour;
    chipWrap.hidden = !allowColour;
    if (!allowColour) {
      chipWrap.replaceChildren();
      return;
    }
    const available = availableBasicColourFamiliesForCurrentContext();
    const counts = basicColourFamilyCountsForCurrentContext();
    const keys = [""];
    for (const k of BASIC_COLOUR_FAMILY_KEYS) {
      if (available.has(k) || basicColourFilter === k) keys.push(k);
    }
    chipWrap.replaceChildren();
    for (const key of keys) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "colour-filter-chip";
      if (!key) b.classList.add("colour-filter-chip--all");
      b.dataset.basicColour = key;
      const on = basicColourFilter === key;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.setAttribute("aria-label", key ? `Filter colour: ${basicColourLabelEn(key)}` : "Show all colours");

      if (key) {
        const sw = document.createElement("span");
        sw.className = "colour-filter-chip__swatch";
        sw.style.setProperty("--chip-swatch-color", BASIC_COLOUR_SWATCH_HEX[key] || "#888");
        b.appendChild(sw);
      }

      const txt = document.createElement("span");
      txt.className = "colour-filter-chip__text";
      txt.textContent = basicColourLabelEn(key);
      b.appendChild(txt);
      if (key) {
        const cnt = document.createElement("span");
        cnt.className = "colour-filter-chip__count";
        cnt.textContent = `(${counts.get(key) ?? 0})`;
        b.appendChild(cnt);
      }

      b.addEventListener("click", () => {
        let next = "";
        if (key === "") next = "";
        else if (basicColourFilter === key) next = "";
        else next = key;
        basicColourFilter = persistBasicColourFilter(next);
        renderGrid();
      });
      chipWrap.appendChild(b);
    }
  }

  function syncArchiveBrandFilterChipUi() {
    const chipWrap = document.getElementById("archive-drawer-brand-chips");
    const chipBlock = chipWrap?.closest(".archive-filter-drawer__block--brands");
    if (!chipWrap) return;
    const allowBrand = allowArchiveBasicColourFilter();
    if (chipBlock) chipBlock.hidden = !allowBrand;
    chipWrap.hidden = !allowBrand;
    if (!allowBrand) {
      chipWrap.replaceChildren();
      return;
    }
    const counts = brandCountsForCurrentContext();
    const available = new Set(availableBrandsForCurrentContext());
    const keys = [...available];
    for (const brand of selectedBrandFilters) {
      if (!available.has(brand)) keys.push(brand);
    }
    keys.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    chipWrap.replaceChildren();
    if (!keys.length) return;
    for (const brand of keys) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "archive-drawer-sort-chip archive-drawer-brand-chip";
      b.dataset.brandFilter = brand;
      const on = selectedBrandFilters.has(brand);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.setAttribute("aria-label", `Filter brand: ${brand}`);
      b.textContent = `${brand} (${counts.get(brand) ?? 0})`;
      b.addEventListener("click", () => {
        toggleBrandFilter(brand);
        syncArchiveBrandFilterChipUi();
        syncToolbarActiveFilterChips();
        renderGrid();
      });
      chipWrap.appendChild(b);
    }
  }

  function openArchiveFilterDrawer() {
    const root = document.getElementById("archive-filter-drawer");
    const openBtn = document.getElementById("archive-filter-drawer-open");
    if (!root || !openBtn) return;
    if (!root.hasAttribute("hidden")) return;
    if (archiveFilterDrawerOpenRaf) {
      cancelAnimationFrame(archiveFilterDrawerOpenRaf);
      archiveFilterDrawerOpenRaf = 0;
    }
    archiveFilterDrawerFocusReturn = document.activeElement;
    root.removeAttribute("hidden");
    root.setAttribute("aria-hidden", "false");
    archiveFilterDrawerOpenRaf = requestAnimationFrame(() => {
      archiveFilterDrawerOpenRaf = 0;
      if (root.hasAttribute("hidden")) return;
      root.classList.add("archive-filter-drawer--visible");
      openBtn.setAttribute("aria-expanded", "true");
      document.body.classList.add("archive-ui--filter-drawer");
      syncArchiveDrawerSubcategoryPills();
      syncArchiveSortChipUi();
      syncArchiveBrandFilterChipUi();
      syncArchiveFilterDrawerDoneLabel(applyFilters(items).length);
      document.getElementById("archive-filter-drawer-close")?.focus();
    });
  }

  function closeArchiveFilterDrawer() {
    const root = document.getElementById("archive-filter-drawer");
    const openBtn = document.getElementById("archive-filter-drawer-open");
    if (!root) return;
    if (archiveFilterDrawerOpenRaf) {
      cancelAnimationFrame(archiveFilterDrawerOpenRaf);
      archiveFilterDrawerOpenRaf = 0;
    }
    if (root.hasAttribute("hidden")) {
      document.body.classList.remove("archive-ui--filter-drawer");
      return;
    }

    const sheet = root.querySelector(".archive-filter-drawer__sheet");
    const finalize = () => {
      if (root.hasAttribute("hidden")) return;
      root.setAttribute("hidden", "");
      root.setAttribute("aria-hidden", "true");
      root.classList.remove("archive-filter-drawer--visible");
      openBtn?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("archive-ui--filter-drawer");
      const el = archiveFilterDrawerFocusReturn;
      archiveFilterDrawerFocusReturn = null;
      if (el && typeof el.focus === "function") {
        try {
          el.focus();
        } catch {
          /* ignore */
        }
      }
    };

    if (!root.classList.contains("archive-filter-drawer--visible")) {
      finalize();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      sheet?.removeEventListener("transitionend", onTrans);
      clearTimeout(safety);
      finalize();
    };
    const onTrans = (e) => {
      if (e.target !== sheet || e.propertyName !== "transform") return;
      finish();
    };
    sheet?.addEventListener("transitionend", onTrans);
    const safety = setTimeout(finish, 420);
    root.classList.remove("archive-filter-drawer--visible");
  }

  function wireArchiveBrowseToolControls() {
    const filterDrawer = document.getElementById("archive-filter-drawer");
    if (filterDrawer && filterDrawer.dataset.twSortChipWired !== "1") {
      filterDrawer.dataset.twSortChipWired = "1";
      filterDrawer.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-archive-sort]");
        if (!btn || !filterDrawer.contains(btn)) return;
        const v = String(btn.getAttribute("data-archive-sort") ?? "").trim();
        if (!ARCHIVE_SORT_MODES.includes(v)) return;
        archiveSortMode = persistArchiveSortMode(v);
        syncArchiveSortChipUi();
        renderGrid();
      });
    }
    syncArchiveSortChipUi();

    const drawerOpen = document.getElementById("archive-filter-drawer-open");
    const drawerRoot = document.getElementById("archive-filter-drawer");
    const drawerRecChips = document.getElementById("archive-drawer-record-type-chips");
    if (drawerRecChips && drawerRecChips.dataset.twDrawerRecWired !== "1") {
      drawerRecChips.dataset.twDrawerRecWired = "1";
      drawerRecChips.addEventListener("click", (e) => {
        const b = e.target.closest("button.archive-drawer-record-type-chip");
        if (!b || !drawerRecChips.contains(b)) return;
        withPreservedArchiveScroll(() => {
          subcategoryFilter = String(b.dataset.drawerRecordType ?? "").trim();
          validateSubcategoryFilter();
          renderCategoryDrill();
          renderGrid();
        });
      });
    }
    if (drawerRoot && drawerOpen && drawerRoot.dataset.twDrawerUiWired !== "1") {
      drawerRoot.dataset.twDrawerUiWired = "1";
      drawerOpen.addEventListener("click", () => openArchiveFilterDrawer());
      document.getElementById("archive-filter-drawer-backdrop")?.addEventListener("click", () => closeArchiveFilterDrawer());
      document.getElementById("archive-filter-drawer-close")?.addEventListener("click", () => closeArchiveFilterDrawer());
      document.getElementById("archive-filter-drawer-done")?.addEventListener("click", () => closeArchiveFilterDrawer());
      if (document.body.dataset.twFilterDrawerEscapeWired !== "1") {
        document.body.dataset.twFilterDrawerEscapeWired = "1";
        document.addEventListener(
          "keydown",
          (e) => {
            if (e.key !== "Escape") return;
            const r = document.getElementById("archive-filter-drawer");
            if (!r || r.hasAttribute("hidden")) return;
            closeArchiveFilterDrawer();
          },
          true
        );
      }
    }

    const chipWrap = document.getElementById("archive-colour-chips");
    if (chipWrap && chipWrap.dataset.twColourWired !== "1") {
      chipWrap.dataset.twColourWired = "1";
      syncBasicColourFilterChipUi();
    }

    const brandWrap = document.getElementById("archive-drawer-brand-chips");
    if (brandWrap && brandWrap.dataset.twBrandWired !== "1") {
      brandWrap.dataset.twBrandWired = "1";
      syncArchiveBrandFilterChipUi();
    }
  }

  function syncSearchOverlayBackdropTop() {
    try {
      if (globalThis.matchMedia?.("(min-width: 901px)")?.matches) {
        syncHeaderFlyoutDimTop();
        return;
      }
      const wrap = document.getElementById("site-header-search-wrap");
      const panel = wrap?.querySelector(".desktop-search-flyout-inner") ?? wrap;
      if (!wrap?.classList.contains("is-open") || !panel) {
        document.documentElement.style.removeProperty("--tw-search-dim-top");
        return;
      }
      const bottom = Math.ceil(panel.getBoundingClientRect().bottom);
      document.documentElement.style.setProperty("--tw-search-dim-top", `${bottom}px`);
    } catch {
      try {
        document.documentElement.style.removeProperty("--tw-search-dim-top");
      } catch {
        /* ignore */
      }
    }
  }

  /** Viewport Y below utility + primary header row (flyout panels sit above the dim). */
  function measureHeaderChromeBottom() {
    const util = document.querySelector(".site-utility-bar");
    const brandNav = document.querySelector(".site-header__brand-nav");
    let bottom = 0;
    if (util) bottom = Math.max(bottom, Math.ceil(util.getBoundingClientRect().bottom));
    if (brandNav) bottom = Math.max(bottom, Math.ceil(brandNav.getBoundingClientRect().bottom));
    return bottom;
  }

  /** Desktop flyouts: dim full page below header chrome; flyouts sit above dim (z-index). */
  function syncHeaderFlyoutDimTop() {
    try {
      if (!globalThis.matchMedia?.("(min-width: 901px)")?.matches) {
        document.documentElement.style.removeProperty("--site-header-submenu-dim-top");
        return;
      }
      const submenuOpen =
        document.body.classList.contains("archive-ui--header-submenu-open") ||
        document.body.classList.contains("archive-ui--header-submenu-closing");
      const searchWrap = document.getElementById("site-header-search-wrap");
      const searchState = String(searchWrap?.dataset.searchState ?? "closed").trim() || "closed";
      const searchOpen =
        document.body.classList.contains("archive-ui--header-search-open") ||
        document.body.classList.contains("archive-ui--header-search-closing") ||
        searchState === "opening" ||
        searchState === "open" ||
        searchState === "closing";
      if (!submenuOpen && !searchOpen) {
        document.documentElement.style.removeProperty("--site-header-submenu-dim-top");
        return;
      }
      const chromeBottom = measureHeaderChromeBottom();
      if (chromeBottom > 0) {
        document.documentElement.style.setProperty("--site-header-chrome-bottom", `${chromeBottom}px`);
        document.documentElement.style.setProperty("--site-header-submenu-dim-top", `${chromeBottom}px`);
      }
    } catch {
      try {
        document.documentElement.style.removeProperty("--site-header-submenu-dim-top");
      } catch {
        /* ignore */
      }
    }
  }

  function syncHeaderSubmenuDimTop() {
    syncHeaderFlyoutDimTop();
  }

  const HEADER_SEARCH_FLYOUT_MOTION_MS = 300;

  function hideHeaderFlyoutDimIfIdle() {
    const searchWrap = document.getElementById("site-header-search-wrap");
    const searchState = String(searchWrap?.dataset.searchState ?? "closed").trim() || "closed";
    const submenuOpen =
      document.body.classList.contains("archive-ui--header-submenu-open") ||
      document.body.classList.contains("archive-ui--header-submenu-closing");
    const searchOpen =
      document.body.classList.contains("archive-ui--header-search-open") ||
      document.body.classList.contains("archive-ui--header-search-closing") ||
      searchWrap?.classList.contains("is-open") ||
      searchState === "opening" ||
      searchState === "open" ||
      searchState === "closing";
    if (submenuOpen || searchOpen) return;
    const dim = document.getElementById("site-header-submenu-dim");
    if (dim) {
      dim.hidden = true;
      dim.setAttribute("aria-hidden", "true");
    }
    try {
      document.documentElement.style.removeProperty("--site-header-chrome-bottom");
      document.documentElement.style.removeProperty("--site-header-submenu-dim-top");
      document.documentElement.style.removeProperty("--tw-search-dim-top");
    } catch {
      /* ignore */
    }
  }

  function showHeaderFlyoutDim() {
    if (globalThis.matchMedia?.("(max-width: 900px)")?.matches) return;
    const dim = document.getElementById("site-header-submenu-dim");
    if (!dim) return;
    dim.hidden = false;
    dim.setAttribute("aria-hidden", "false");
    syncHeaderFlyoutDimTop();
  }

  const TW_MOTION_MS = 280;
  const TW_SEARCH_MOTION_MS = 220;

  function twPrefersReducedMotion() {
    try {
      return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    } catch {
      return false;
    }
  }

  /** @type {(() => void) | null} */
  let headerSubmenuHideAnimated = null;

  /**
   * @param {HTMLElement} el
   * @param {number} ms
   * @param {() => void} cb
   * @param {string[]} [props]
   * @returns {() => void}
   */
  function twAfterMotion(el, ms, cb, props = ["opacity", "transform"]) {
    if (!el || twPrefersReducedMotion()) {
      queueMicrotask(cb);
      return () => {};
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener("transitionend", onTrans);
      clearTimeout(timer);
      cb();
    };
    const onTrans = (e) => {
      if (e.target !== el) return;
      if (props.length && !props.includes(e.propertyName)) return;
      done();
    };
    el.addEventListener("transitionend", onTrans);
    const timer = setTimeout(done, ms + 60);
    return () => {
      if (settled) return;
      settled = true;
      el.removeEventListener("transitionend", onTrans);
      clearTimeout(timer);
    };
  }

  function dismissHeaderSubmenuDom() {
    if (headerSubmenuHideAnimated) {
      headerSubmenuHideAnimated();
      return;
    }
    const wrap = document.getElementById("site-header-submenu");
    if (wrap) {
      if (isFiltersNarrowViewport()) {
        wrap.hidden = true;
      } else {
        wrap.removeAttribute("hidden");
      }
      wrap.dataset.submenuState = "closed";
      wrap.classList.remove("site-header__submenu--opening", "site-header__submenu--switching");
      wrap.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("archive-ui--header-submenu-open", "archive-ui--header-submenu-closing");
    hideHeaderFlyoutDimIfIdle();
    try {
      document.documentElement.style.removeProperty("--site-header-chrome-bottom");
      document.documentElement.style.removeProperty("--site-header-submenu-dim-top");
    } catch {
      /* ignore */
    }
  }

  const PAGE_THEME_LEAK_CLASSES = [
    "home",
    "hero-active",
    "hero-overlay",
    "header-overlay",
    "dark-page",
    "theme-dark",
    "is-hero",
    "has-hero",
    "nav-on-hero",
    "theme-home",
  ];

  const PAGE_THEME_SCOPE_CLASSES = ["home-page", "theme-catalogue", "theme-item", "theme-home"];

  function resolvePageTheme() {
    if (document.body.classList.contains("home-page") || document.querySelector(".site-home-stage")) {
      return "home";
    }
    const path = String(globalThis.location?.pathname ?? "");
    if (path === "/" || path === "" || /\/index\.html$/i.test(path)) return "home";
    return "catalogue";
  }

  /** Route-level theme: catalogue is always light; homepage may use hero overlay. */
  function applyPageTheme() {
    const theme = resolvePageTheme();
    const root = document.documentElement;
    const body = document.body;

    for (const cls of PAGE_THEME_LEAK_CLASSES) body.classList.remove(cls);
    for (const cls of PAGE_THEME_SCOPE_CLASSES) {
      body.classList.remove(cls);
      root.classList.remove(cls);
    }
    root.style.removeProperty("color-scheme");

    if (theme === "home") {
      body.classList.add("home-page");
      root.classList.add("theme-home");
      return;
    }

    body.classList.add("theme-catalogue");
    root.classList.add("theme-catalogue");
    root.style.colorScheme = "light";
    if (body.classList.contains("item-page") || document.getElementById("item-page-main")) {
      body.classList.add("theme-item");
    }

    resetCatalogueHeaderState();
  }

  function normalizeCatalogueHeaderMasthead() {
    if (resolvePageTheme() === "home") return;
    const siteHeader = document.querySelector(".site-header");
    const shell = document.querySelector(".site-header-shell");
    siteHeader?.classList.remove("site-header--overlay");
    siteHeader?.classList.add("site-header--solid");
    shell?.classList.remove("site-header-shell--home-overlay");
  }

  /** Catalogue pages: solid masthead; strip hero overlay UI state. */
  function resetCatalogueHeaderState() {
    if (resolvePageTheme() === "home") return;

    teardownHomeHeroHeader();

    const siteHeader = document.querySelector(".site-header");
    const shell = document.querySelector(".site-header-shell");
    siteHeader?.classList.remove("site-header--overlay");
    siteHeader?.classList.add("site-header--solid");
    shell?.classList.remove("site-header-shell--home-overlay");

    document.body.classList.remove(
      "archive-ui--mobile-nav-open",
      "archive-ui--header-search-open",
      "archive-ui--header-search-closing",
      "archive-ui--header-submenu-open",
      "archive-ui--styling-board",
      "archive-ui--filter-drawer",
      "archive-ui--nav-folded"
    );
    document.body.style.removeProperty("--home-header-nav-height");
    document.body.style.removeProperty("--home-header-stack-height");
    document.documentElement.style.removeProperty("--tw-search-dim-top");

    forceCloseHeaderSearchOverlay();
    dismissHeaderSubmenuDom();
    closeStylingBoardDrawer();

    const mobileShell = document.getElementById("site-mobile-shell");
    if (mobileShell) {
      mobileShell.classList.remove("is-open");
      mobileShell.hidden = true;
      mobileShell.setAttribute("aria-hidden", "true");
    }
    document.getElementById("site-header-menu-btn")?.setAttribute("aria-expanded", "false");
    document.getElementById("site-header-menu-btn")?.setAttribute("aria-label", "Open categories menu");

    const filterDrawer = document.getElementById("archive-filter-drawer");
    if (filterDrawer) {
      filterDrawer.hidden = true;
      filterDrawer.setAttribute("aria-hidden", "true");
    }
  }

  function installPageThemeLifecycle() {
    if (installPageThemeLifecycle._wired) return;
    installPageThemeLifecycle._wired = true;
    globalThis.addEventListener("pageshow", () => {
      applyPageTheme();
      if (resolvePageTheme() === "home") mountHomePageHero();
    });
    globalThis.addEventListener("popstate", () => {
      applyPageTheme();
      if (resolvePageTheme() === "home") mountHomePageHero();
    });
    globalThis.addEventListener("pagehide", () => {
      if (resolvePageTheme() === "home") teardownHomeHeroHeader();
    });
  }

  function forceCloseHeaderSearchOverlay({ submitted = false, clear = false } = {}) {
    const headerSearchWrap = document.getElementById("site-header-search-wrap");
    const headerSearchBtn = document.getElementById("site-header-search-btn");
    const headerSearchInput = /** @type {HTMLInputElement | null} */ (document.getElementById("filter-search"));
    if (!headerSearchWrap?.classList.contains("is-open")) return;
    const snap = headerSearchOverlayOpeningQueryRaw;
    headerSearchOverlayArchiveSearchFrozen = false;
    headerSearchOpenArchiveSearchNorm = "";
    headerSearchOverlayOpeningQueryRaw = null;
    cancelHeaderSearchOverlayUiDebounce();
    resetHeaderSearchOverlayResultsDom();
    headerSearchWrap.classList.remove("is-open");
    headerSearchWrap.setAttribute("aria-hidden", "true");
    headerSearchWrap.dataset.searchState = "closed";
    if (globalThis.matchMedia?.("(min-width: 901px)")?.matches) {
      headerSearchWrap.setAttribute("hidden", "");
    }
    headerSearchBtn?.setAttribute("aria-expanded", "false");
    headerSearchBtn?.setAttribute("aria-label", "Open search");
    document.body.classList.remove("archive-ui--header-search-open", "archive-ui--header-search-closing");
    document.documentElement.style.removeProperty("--tw-search-dim-top");
    hideHeaderFlyoutDimIfIdle();
    if (clear && headerSearchInput) {
      headerSearchInput.value = "";
    } else if (!submitted && snap != null && headerSearchInput) {
      headerSearchInput.value = snap;
    }
    syncFilterSearchClearVisibility();
    syncFilterSearchFieldDomPlacement();
    syncSearchKeywordChip();
    if (document.getElementById("grid")) renderGrid();
  }

  /** Safety: release scroll lock if drawer/search are not actually open (handles fast open/close races). */
  function ensureBodyScrollUnlockedWhenNoOverlay() {
    const drawerRoot = document.getElementById("archive-filter-drawer");
    const drawerOpen = !!drawerRoot && !drawerRoot.hasAttribute("hidden");
    const headerSearchOpen = document.getElementById("site-header-search-wrap")?.classList.contains("is-open");
    const mobileNavOpen = document.getElementById("site-mobile-shell")?.classList.contains("is-open");
    const submenuOpen =
      document.body.classList.contains("archive-ui--header-submenu-open") ||
      document.body.classList.contains("archive-ui--header-submenu-closing");
    if (!drawerOpen && !headerSearchOpen && !mobileNavOpen) {
      document.body.classList.remove("archive-ui--filter-drawer");
    }
    if (!drawerOpen && !headerSearchOpen && !mobileNavOpen && !submenuOpen) {
      hideHeaderFlyoutDimIfIdle();
    }
  }

  /** Desktop (wider than 900px): scroll direction toggles `archive-ui--nav-folded` (hides branding shell). Search stays in the expanded header with filters — no floating magnifier while folded. */
  const ENABLE_ARCHIVE_NAV_SCROLL_FOLD = true;

  let archiveNavScrollFoldLastY = 0;
  let archiveNavScrollFoldTicking = false;

  /** Scroll fold: hide desktop header chrome while scrolling down on the archive page (`#filters-nav` removed — optional menu state kept for compatibility). */
  function initArchiveNavScrollFold() {
    if (!ENABLE_ARCHIVE_NAV_SCROLL_FOLD) {
      document.body.classList.remove("archive-ui--nav-folded");
      return;
    }
    if (!document.getElementById("grid")) return;
    const filtersNav = document.getElementById("filters-nav");
    const body = document.body;

    function onScrollNavFold() {
      if (archiveNavScrollFoldTicking) return;
      archiveNavScrollFoldTicking = true;
      requestAnimationFrame(() => {
        try {
          archiveNavScrollFoldTicking = false;
          if (isFiltersNarrowViewport()) {
            body.classList.remove("archive-ui--nav-folded");
            archiveNavScrollFoldLastY = globalThis.scrollY ?? globalThis.pageYOffset ?? 0;
            return;
          }
          if (body.classList.contains("archive-ui--header-search-open")) {
            body.classList.remove("archive-ui--nav-folded");
            archiveNavScrollFoldLastY = globalThis.scrollY ?? globalThis.pageYOffset ?? 0;
            return;
          }
          if (body.classList.contains("archive-ui--header-submenu-open")) {
            body.classList.remove("archive-ui--nav-folded");
            archiveNavScrollFoldLastY = globalThis.scrollY ?? globalThis.pageYOffset ?? 0;
            return;
          }
          const y = globalThis.scrollY ?? globalThis.pageYOffset ?? 0;
          /** PLP filters / chips: header collapse shifts layout and retriggers scroll (bounce loop). */
          if (categoryNavFilter || narrowingFiltersActive()) {
            body.classList.remove("archive-ui--nav-folded");
            archiveNavScrollFoldLastY = y;
            return;
          }
          const dy = y - archiveNavScrollFoldLastY;
          if (filtersNav?.classList.contains("filters--menu-open")) {
            body.classList.remove("archive-ui--nav-folded");
            archiveNavScrollFoldLastY = y;
            return;
          }
          const folded = body.classList.contains("archive-ui--nav-folded");
          if (y < 160) {
            if (folded) body.classList.remove("archive-ui--nav-folded");
          } else if (dy > 12) {
            if (!folded) body.classList.add("archive-ui--nav-folded");
          } else if (dy < -12) {
            if (folded) body.classList.remove("archive-ui--nav-folded");
          }
          archiveNavScrollFoldLastY = y;
        } catch {
          /* ignore */
        }
      });
    }

    globalThis.addEventListener("scroll", onScrollNavFold, { passive: true });
    onScrollNavFold();
  }

  function initOutfitVariantDialog() {
    const dlg = document.getElementById("outfit-variant-dialog");
    const sel = document.getElementById("outfit-variant-select");
    const cancel = document.getElementById("outfit-variant-cancel");
    const ok = document.getElementById("outfit-variant-confirm");
    cancel?.addEventListener("click", () => {
      pendingOutfitVariantItemId = null;
      dlg?.close();
    });
    ok?.addEventListener("click", () => {
      const id = pendingOutfitVariantItemId;
      const key = sel?.value?.trim();
      pendingOutfitVariantItemId = null;
      dlg?.close();
      if (id && key) pushOutfitSlot({ itemId: id, colourKey: key });
    });
    dlg?.addEventListener("click", (e) => {
      if (e.target === dlg) {
        pendingOutfitVariantItemId = null;
        dlg.close();
      }
    });
  }

  let navPrefetchInstalled = false;

  function initNavigationPrefetch() {
    if (navPrefetchInstalled) return;
    navPrefetchInstalled = true;
    const seen = new Set();
    const maybePrefetch = (href) => {
      const raw = String(href ?? "").trim();
      if (!raw || raw.startsWith("#")) return;
      try {
        const u = new URL(raw, globalThis.location.href);
        if (u.origin !== globalThis.location.origin) return;
        const key = `${u.pathname}${u.search}`;
        if (seen.has(key)) return;
        seen.add(key);
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.as = "document";
        link.href = `${u.pathname}${u.search}`;
        document.head.appendChild(link);
      } catch {
        /* ignore */
      }
    };
    document.addEventListener(
      "pointerover",
      (e) => {
        const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
        if (!a) return;
        maybePrefetch(a.getAttribute("href"));
      },
      { passive: true }
    );
    document.addEventListener(
      "touchstart",
      (e) => {
        const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
        if (!a) return;
        maybePrefetch(a.getAttribute("href"));
      },
      { passive: true }
    );
  }

  function wireEvents() {
    initNavigationPrefetch();
    const archiveMainHref = () => ARCHIVE_HOME_MAIN_URL;

    /** Full-screen mobile nav shell (below utility bar); replaces legacy slide-in panel. */
    function mountMobileNavigationShell() {
      let shell = document.getElementById("site-mobile-shell");
      if (shell) {
        const hasRlLayout =
          shell.querySelector(".site-mobile-shell__bar--submenu") &&
          shell.querySelector(".site-mobile-shell__submenu-back .site-mobile-shell__submenu-title") &&
          shell.querySelector(".site-mobile-nav__season-link");
        if (hasRlLayout) return shell;
        shell.remove();
        shell = null;
      }
      document.getElementById("site-header-mobile-panel")?.remove();

      shell = document.createElement("div");
      shell.id = "site-mobile-shell";
      shell.className = "site-mobile-shell";
      shell.hidden = true;
      shell.setAttribute("aria-hidden", "true");

      const chrome = document.createElement("div");
      chrome.className = "site-mobile-shell__chrome";

      const mainBar = document.createElement("header");
      mainBar.className = "site-mobile-shell__bar site-mobile-shell__bar--main";

      const logo = document.createElement("a");
      logo.href = "/";
      logo.className = "site-mobile-shell__logo";
      logo.setAttribute("aria-label", "Timeless Wardrobe home");
      logo.innerHTML =
        '<span class="site-title__mark" role="img" aria-hidden="true"></span><span class="site-mobile-shell__wordmark">TIMELESS WARDROBE</span>';

      const tools = document.createElement("div");
      tools.className = "site-mobile-shell__tools";

      const shellSearchBtn = document.createElement("button");
      shellSearchBtn.type = "button";
      shellSearchBtn.id = "site-mobile-shell-search-btn";
      shellSearchBtn.className =
        "site-mobile-shell__tool site-mobile-shell__tool--search site-header__search-btn";
      shellSearchBtn.setAttribute("aria-label", "Search");
      shellSearchBtn.innerHTML = '<span class="site-header__search-icon" aria-hidden="true"></span>';

      const shellStylingBtn = document.createElement("button");
      shellStylingBtn.type = "button";
      shellStylingBtn.id = "site-mobile-shell-styling-btn";
      shellStylingBtn.className =
        "site-mobile-shell__tool site-mobile-shell__tool--board site-header__styling-board-btn";
      shellStylingBtn.setAttribute("aria-label", "Open Styling Board");
      shellStylingBtn.innerHTML =
        '<span class="site-header__styling-board-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7.5" height="7.5" rx="1" stroke="currentColor" stroke-width="1.75"/><rect x="13.5" y="3" width="7.5" height="5" rx="1" stroke="currentColor" stroke-width="1.75"/><rect x="13.5" y="10" width="7.5" height="11" rx="1" stroke="currentColor" stroke-width="1.75"/><rect x="3" y="12.5" width="7.5" height="8.5" rx="1" stroke="currentColor" stroke-width="1.75"/></svg></span>';

      const shellCloseBtn = document.createElement("button");
      shellCloseBtn.type = "button";
      shellCloseBtn.id = "site-mobile-shell-close-btn";
      shellCloseBtn.className = "site-mobile-shell__tool site-mobile-shell__tool--close";
      shellCloseBtn.setAttribute("aria-label", "Close menu");
      shellCloseBtn.innerHTML = '<span class="site-mobile-shell__close-icon" aria-hidden="true"></span>';

      logo.addEventListener("click", (e) => {
        e.preventDefault();
        navigateToSiteHome();
      });

      tools.append(shellSearchBtn, shellStylingBtn, shellCloseBtn);
      mainBar.append(logo, tools);

      const submenuBar = document.createElement("header");
      submenuBar.className = "site-mobile-shell__bar site-mobile-shell__bar--submenu";
      submenuBar.setAttribute("aria-hidden", "true");
      submenuBar.innerHTML = `
        <button type="button" class="site-mobile-shell__submenu-back" id="site-mobile-nav-back" aria-label="Back to main menu">
          <span class="site-mobile-nav__back-chevron" aria-hidden="true"></span>
          <span class="site-mobile-shell__submenu-title" id="site-mobile-nav-drill-title"></span>
        </button>
        <button type="button" class="site-mobile-shell__submenu-close" id="site-mobile-nav-drill-close" aria-label="Close menu">
          <span class="site-mobile-shell__close-icon" aria-hidden="true"></span>
        </button>
      `;

      chrome.append(mainBar, submenuBar);

      const body = document.createElement("div");
      body.className = "site-mobile-shell__body";

      const nav = document.createElement("nav");
      nav.id = "site-mobile-nav";
      nav.className = "site-mobile-nav";
      nav.setAttribute("aria-label", "Shop categories");

      const rootLevel = document.createElement("div");
      rootLevel.id = "site-mobile-nav-root";
      rootLevel.className = "site-mobile-nav__level site-mobile-nav__level--root";

      const rootList = document.createElement("ul");
      rootList.className = "site-mobile-nav__list site-mobile-nav__list--root";
      for (const slot of SLOT_OPTIONS) {
        const rowLi = document.createElement("li");
        rowLi.className = "site-mobile-nav__item";
        const row = document.createElement("button");
        row.type = "button";
        row.className = "site-mobile-nav__row";
        row.dataset.mobileNavSlot = slot;
        const label = categoryDisplayLabel(slot) || slot;
        row.innerHTML = `<span class="site-mobile-nav__label">${label}</span><span class="site-mobile-nav__chevron" aria-hidden="true"></span>`;
        rowLi.appendChild(row);
        rootList.appendChild(rowLi);
      }
      rootLevel.appendChild(rootList);

      const rootFooter = document.createElement("div");
      rootFooter.className = "site-mobile-nav__footer";
      rootFooter.innerHTML = `
        <div class="site-mobile-nav__footer-divider" aria-hidden="true"></div>
        <div class="site-mobile-nav__season-row" role="group" aria-label="Season">
          <button type="button" class="site-mobile-nav__season-link" data-mobile-nav-season="S/S">SPRING / SUMMER</button>
          <button type="button" class="site-mobile-nav__season-link" data-mobile-nav-season="A/W">AUTUMN / WINTER</button>
          <a class="site-mobile-nav__season-link site-mobile-nav__browse-all" href="#" data-mobile-nav-browse-all="1">ALL PIECES</a>
        </div>
      `;
      rootLevel.appendChild(rootFooter);

      const drillLevel = document.createElement("div");
      drillLevel.id = "site-mobile-nav-drill";
      drillLevel.className = "site-mobile-nav__level site-mobile-nav__level--drill";
      drillLevel.setAttribute("aria-hidden", "true");
      const drillList = document.createElement("ul");
      drillList.id = "site-mobile-nav-drill-list";
      drillList.className = "site-mobile-nav__list site-mobile-nav__list--drill";
      drillLevel.appendChild(drillList);

      nav.append(rootLevel, drillLevel);
      body.appendChild(nav);
      shell.append(chrome, body);
      document.body.appendChild(shell);
      return shell;
    }

    const jumpHeaderCategory = (jump) => {
      clearArchiveKeywordColourNarrowing();
      if (archiveSubmittedSearchNorm) exitArchiveSearchPlpRestoreBrowse({ skipRestore: true });
      if (!document.getElementById("grid")) {
        categoryNavFilter = resolveCategoryJump(jump);
        subcategoryFilter = "";
        validateSubcategoryFilter();
        writeArchiveBrowseRestoreSnapshot();
        navigateToArchiveMain();
        return;
      }
      applyCategoryNavFilter(resolveCategoryJump(jump), { scrollTop: true });
      collapseFiltersMenuPanel();
    };

  /** @type {ReturnType<typeof setTimeout> | null} */
    let closeTimer = null;
    let headerSubmenuSwitchAnimTimer = 0;
    /** @type {(() => void) | null} */
    let headerSubmenuCloseAbort = null;
    const HEADER_SUBMENU_HOVER_HIDE_MS = 120;
    const HEADER_SUBMENU_MOTION_MS = 300;

    const headerSubmenuUsesDomHidden = () => isFiltersNarrowViewport();

    const getHeaderSubmenuState = (wrap) => {
      if (!wrap) return "closed";
      return String(wrap.dataset.submenuState || "closed").trim() || "closed";
    };

    const headerSubmenuIsOpen = (wrap) => {
      const el = wrap || document.getElementById("site-header-submenu");
      if (!el) return false;
      const state = getHeaderSubmenuState(el);
      return state === "open" || state === "opening";
    };

    const HEADER_DIVISION_LINK_SELECTOR = ".site-header__primary-nav.main-nav [data-category-jump]";

    const getHeaderDivisionLink = (el) => {
      if (!(el instanceof Element)) return null;
      return el.closest(HEADER_DIVISION_LINK_SELECTOR);
    };

    const isInMegaMenuHoverSafe = (el) => {
      if (!(el instanceof Element)) return false;
      return !!(
        el.closest(".site-header__division-hover-zone") ||
        el.closest("#site-header-submenu.site-header__submenu")
      );
    };

    const cancelCloseMegaMenu = () => {
      if (!closeTimer) return;
      clearTimeout(closeTimer);
      closeTimer = null;
    };

    const scheduleCloseMegaMenu = () => {
      cancelCloseMegaMenu();
      closeTimer = setTimeout(() => {
        closeTimer = null;
        hideHeaderSubmenu();
      }, HEADER_SUBMENU_HOVER_HIDE_MS);
    };

    const closeMegaMenuNow = () => {
      cancelCloseMegaMenu();
      hideHeaderSubmenu();
    };

    const stripDesktopMegaMenuDivisionHeading = () => {
      if (isFiltersNarrowViewport()) return;
      const content = document.querySelector(
        ".desktop-mega-menu-content, .desktop-mega-menu .site-header__submenu-content"
      );
      if (!content) return;
      content
        .querySelectorAll(
          "#site-header-submenu-title, .mega-menu-content__heading, .site-header__submenu-title, hr"
        )
        .forEach((el) => el.remove());
    };

    const clearHeaderSubmenuContent = () => {
      const links = document.getElementById("site-header-submenu-links");
      const preview = document.getElementById("site-header-submenu-preview");
      if (links) links.replaceChildren();
      if (preview) preview.replaceChildren();
      stripDesktopMegaMenuDivisionHeading();
    };

    const setHeaderSubmenuState = (wrap, state) => {
      wrap.dataset.submenuState = state;
    };

    const clearHeaderSubmenuBackdropInset = () => {
      document.documentElement.style.removeProperty("--site-header-chrome-bottom");
      document.documentElement.style.removeProperty("--site-header-submenu-dim-top");
    };

    const syncHeaderSubmenuBackdropInset = () => {
      if (isHeaderCompactLayout()) return;
      const chromeBottom = measureHeaderChromeBottom();
      if (chromeBottom > 0) {
        document.documentElement.style.setProperty("--site-header-chrome-bottom", `${chromeBottom}px`);
      }
      syncHeaderFlyoutDimTop();
    };

    const finalizeHeaderSubmenuHide = (wrap) => {
      if (headerSubmenuUsesDomHidden()) {
        wrap.hidden = true;
      } else {
        wrap.removeAttribute("hidden");
      }
      wrap.setAttribute("aria-hidden", "true");
      setHeaderSubmenuState(wrap, "closed");
      wrap.classList.remove("site-header__submenu--opening", "site-header__submenu--switching");
      document.body.classList.remove("archive-ui--header-submenu-open", "archive-ui--header-submenu-closing");
      headerNavOpenSlot = "";
      syncCategoryTabUI();
      clearHeaderSubmenuContent();
      clearHeaderSubmenuBackdropInset();
      hideHeaderFlyoutDimIfIdle();
    };

    const hideHeaderSubmenu = () => {
      cancelCloseMegaMenu();
      if (headerSubmenuSwitchAnimTimer) {
        clearTimeout(headerSubmenuSwitchAnimTimer);
        headerSubmenuSwitchAnimTimer = 0;
      }
      const wrap = document.getElementById("site-header-submenu");
      if (!wrap) return;

      const state = getHeaderSubmenuState(wrap);
      if (state === "closing") return;
      if (state === "closed") return;

      if (headerSubmenuCloseAbort) {
        headerSubmenuCloseAbort();
        headerSubmenuCloseAbort = null;
      }

      if (twPrefersReducedMotion() || isFiltersNarrowViewport()) {
        finalizeHeaderSubmenuHide(wrap);
        return;
      }

      setHeaderSubmenuState(wrap, "closing");
      document.body.classList.add("archive-ui--header-submenu-closing");
      document.body.classList.remove("archive-ui--header-submenu-open");
      wrap.setAttribute("aria-hidden", "true");

      headerSubmenuCloseAbort = twAfterMotion(
        wrap,
        HEADER_SUBMENU_MOTION_MS,
        () => {
          headerSubmenuCloseAbort = null;
          finalizeHeaderSubmenuHide(wrap);
        },
        ["clip-path", "opacity", "transform", "visibility"]
      );
    };

    headerSubmenuHideAnimated = hideHeaderSubmenu;

    const headerMenuBtn = document.getElementById("site-header-menu-btn");
    const mobileShell = mountMobileNavigationShell();
    const siteHeaderEl =
      document.querySelector(".site-header-shell") || document.querySelector(".site-header");
    const siteUtilityBarEl = document.querySelector(".site-utility-bar");
    const headerSearchBtn = document.getElementById("site-header-search-btn");
    const headerSearchWrap = document.getElementById("site-header-search-wrap");
    const headerSearchInput = /** @type {HTMLInputElement | null} */ (document.getElementById("filter-search"));
    /** @type {(() => void) | null} */
    let headerSearchCloseAbort = null;

    const getHeaderSearchFlyoutState = (wrap) => {
      if (!wrap) return "closed";
      return String(wrap.dataset.searchState || "closed").trim() || "closed";
    };

    const setHeaderSearchFlyoutState = (wrap, state) => {
      wrap.dataset.searchState = state;
    };

    const closeHeaderSearch = ({ clear = false, submitted = false } = {}) => {
      if (!headerSearchWrap) return;
      const wasOpen = headerSearchWrap.classList.contains("is-open");
      if (!wasOpen) return;

      const ae = document.activeElement;
      const refocusMagnifier =
        !!headerSearchBtn &&
        ae instanceof Element &&
        (ae === headerSearchInput || headerSearchWrap.contains(ae));
      const snap = headerSearchOverlayOpeningQueryRaw;

      const finishClose = () => {
        headerSearchCloseAbort = null;
        headerSearchWrap.setAttribute("aria-hidden", "true");
        setHeaderSearchFlyoutState(headerSearchWrap, "closed");
        if (!isHeaderCompactLayout()) {
          headerSearchWrap.setAttribute("hidden", "");
        }
        headerSearchBtn?.setAttribute("aria-expanded", "false");
        headerSearchBtn?.setAttribute("aria-label", "Open search");
        document.body.classList.remove("archive-ui--header-search-open", "archive-ui--header-search-closing");
        document.documentElement.style.removeProperty("--tw-search-dim-top");
        hideHeaderFlyoutDimIfIdle();
        if (!clear && !submitted && snap != null && headerSearchInput) {
          headerSearchInput.value = snap;
        }
        headerSearchOverlayArchiveSearchFrozen = false;
        headerSearchOpenArchiveSearchNorm = "";
        headerSearchOverlayOpeningQueryRaw = null;
        cancelHeaderSearchOverlayUiDebounce();
        resetHeaderSearchOverlayResultsDom();
        if (clear && headerSearchInput) {
          cancelSearchGridDebounce();
          headerSearchInput.value = "";
          syncFilterSearchClearVisibility();
        } else {
          syncFilterSearchClearVisibility();
        }
        syncSearchKeywordChip();
        syncFilterSearchFieldDomPlacement();
        if (document.getElementById("grid")) renderGrid();
        if (refocusMagnifier) queueMicrotask(() => headerSearchBtn?.focus({ preventScroll: true }));
        ensureBodyScrollUnlockedWhenNoOverlay();
        normalizeCatalogueHeaderMasthead();
      };

      if (headerSearchCloseAbort) {
        headerSearchCloseAbort();
        headerSearchCloseAbort = null;
      }

      headerSearchWrap.classList.remove("is-open");

      if (!isHeaderCompactLayout() && !twPrefersReducedMotion()) {
        setHeaderSearchFlyoutState(headerSearchWrap, "closing");
        document.body.classList.add("archive-ui--header-search-closing");
        document.body.classList.remove("archive-ui--header-search-open");
        headerSearchWrap.setAttribute("aria-hidden", "true");
        headerSearchCloseAbort = twAfterMotion(headerSearchWrap, HEADER_SEARCH_FLYOUT_MOTION_MS, () => {
          document.body.classList.remove("archive-ui--header-search-closing");
          finishClose();
        });
        return;
      }

      if (isHeaderCompactLayout() && !twPrefersReducedMotion()) {
        setHeaderSearchFlyoutState(headerSearchWrap, "closed");
        headerSearchCloseAbort = twAfterMotion(headerSearchWrap, TW_SEARCH_MOTION_MS, finishClose);
        return;
      }

      finishClose();
    };

    /** Trending chip: full-catalog keyword search, close overlay, ignore browse filters. */
    function submitTrendingSearchFromMegaMenu(raw) {
      const q = String(raw ?? "").trim();
      if (!q || !els.search) return;
      cancelSearchGridDebounce();
      cancelHeaderSearchOverlayUiDebounce();
      exitArchiveSearchPlpRestoreBrowse({ skipRestore: true });
      seasonNavFilter = null;
      try {
        persistSeasonNav();
      } catch {
        /* ignore */
      }
      categoryNavFilter = "";
      subcategoryFilter = "";
      basicColourFilter = persistBasicColourFilter("");
      archiveSearchWithinRecordCategory = "";
      archiveSearchBrowseAllSlots = true;
      syncSeasonTabUI();
      syncCategoryTabUI();
      validateSubcategoryFilter();
      renderCategoryDrill();
      syncBasicColourFilterChipUi();
      els.search.value = q;
      syncFilterSearchClearVisibility();
      if (!document.getElementById("grid")) {
        closeHeaderSearch({ submitted: true });
        writeArchiveBrowseRestoreSnapshot({ search: q });
        navigateToArchiveMain();
        return;
      }
      closeHeaderSearch({ submitted: true });
      submitArchiveSearchFromInput();
    }

    function isHeaderSearchDropdownLayout() {
      return globalThis.matchMedia?.("(min-width: 901px)")?.matches ?? false;
    }

    function isHeaderCompactLayout() {
      return globalThis.matchMedia?.("(max-width: 900px)")?.matches ?? false;
    }

    function syncMobileShellTop() {
      syncBrandSignatureBarHeight();
    }

    const MOBILE_NAV_MOTION_MS = 320;

    function resetMobileNavDrill({ focusMain = false } = {}) {
      const shell = document.getElementById("site-mobile-shell");
      const nav = document.getElementById("site-mobile-nav");
      const root = document.getElementById("site-mobile-nav-root");
      const drill = document.getElementById("site-mobile-nav-drill");
      const submenuBar = shell?.querySelector(".site-mobile-shell__bar--submenu");
      if (!nav || !root || !drill) return;
      nav.classList.remove("site-mobile-nav--drill-open");
      drill.classList.remove("is-active");
      shell?.classList.remove("site-mobile-shell--submenu");
      submenuBar?.setAttribute("aria-hidden", "true");
      root.removeAttribute("aria-hidden");
      drill.setAttribute("aria-hidden", "true");
      if (focusMain) {
        const firstRow = root.querySelector(".site-mobile-nav__row");
        if (firstRow instanceof HTMLElement) firstRow.focus();
      }
    }

    function openMobileNavDrill(slot) {
      const shell = document.getElementById("site-mobile-shell");
      const nav = document.getElementById("site-mobile-nav");
      const root = document.getElementById("site-mobile-nav-root");
      const drill = document.getElementById("site-mobile-nav-drill");
      const title = document.getElementById("site-mobile-nav-drill-title");
      const list = document.getElementById("site-mobile-nav-drill-list");
      const submenuBar = shell?.querySelector(".site-mobile-shell__bar--submenu");
      if (!nav || !root || !drill || !title || !list) return;
      const pool = poolItemsForDrillSubcategories({ respectCategory: false });
      const entries = mobileNavSubcategoryEntriesForSlot(slot, pool);
      if (!entries.length) {
        handleMobileCategoryNavigation(slot, "");
        return;
      }
      title.textContent = String(categoryDisplayLabel(slot) || slot).toUpperCase();
      list.replaceChildren();
      for (const { raw, label } of entries) {
        const li = document.createElement("li");
        li.className = "site-mobile-nav__item";
        const a = document.createElement("a");
        a.href = archiveMainHref();
        a.className = "site-mobile-nav__subrow";
        a.setAttribute("data-category-jump", slot);
        if (raw) a.setAttribute("data-subcategory-jump", raw);
        else a.removeAttribute("data-subcategory-jump");
        a.textContent = label;
        li.appendChild(a);
        list.appendChild(li);
      }
      drill.classList.remove("is-active");
      shell?.classList.add("site-mobile-shell--submenu");
      submenuBar?.setAttribute("aria-hidden", "false");
      root.setAttribute("aria-hidden", "true");
      drill.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        nav.classList.add("site-mobile-nav--drill-open");
        drill.classList.add("is-active");
        document.getElementById("site-mobile-nav-back")?.focus();
      });
    }

    function handleMobileCategoryNavigation(jump, sub, { season } = {}) {
      clearArchiveKeywordColourNarrowing();
      if (archiveSubmittedSearchNorm) exitArchiveSearchPlpRestoreBrowse({ skipRestore: true });
      const seasonRaw = normalizeSeason(season);
      if (seasonRaw === "SS" || seasonRaw === "AW" || seasonRaw === "ALL") {
        const selectedSeason = seasonRaw === "ALL" ? null : seasonRaw;
        if (!document.getElementById("grid") && selectedSeason) {
          navigateToArchiveSeason(seasonRaw);
          closeMobileCategoryPanel();
          collapseFiltersMenuPanel();
          return;
        }
        seasonNavFilter = selectedSeason;
        try {
          persistSeasonNav();
        } catch {
          /* ignore */
        }
        replaceArchiveSeasonQuery(seasonNavFilter);
        syncSeasonTabUI();
      }
      categoryNavFilter = resolveCategoryJump(jump);
      subcategoryFilter = sub;
      noteArchiveSearchUserChoseMainSlotFilter();
      syncCategoryTabUI();
      if (!document.getElementById("grid")) {
        validateSubcategoryFilter();
        writeArchiveBrowseRestoreSnapshot();
        navigateToArchiveMain();
        closeMobileCategoryPanel();
        collapseFiltersMenuPanel();
        return;
      }
      validateSubcategoryFilter();
      renderCategoryDrill();
      renderGrid();
      closeMobileCategoryPanel();
      collapseFiltersMenuPanel();
    }

    /** @type {(() => void) | null} */
    let mobileShellCloseAbort = null;

    function closeMobileCategoryPanel() {
      if (!mobileShell) return;
      if (mobileShell.hidden && !mobileShell.classList.contains("is-open")) return;
      if (mobileShell.classList.contains("is-closing")) return;

      const finish = () => {
        mobileShellCloseAbort = null;
        mobileShell.classList.remove("is-open", "is-closing");
        mobileShell.hidden = true;
        mobileShell.setAttribute("aria-hidden", "true");
        resetMobileNavDrill();
        headerMenuBtn?.setAttribute("aria-expanded", "false");
        headerMenuBtn?.setAttribute("aria-label", "Open categories menu");
        document.body.classList.remove("archive-ui--mobile-nav-open");
        ensureBodyScrollUnlockedWhenNoOverlay();
        normalizeCatalogueHeaderMasthead();
      };

      if (mobileShellCloseAbort) {
        mobileShellCloseAbort();
        mobileShellCloseAbort = null;
      }

      mobileShell.classList.remove("is-open");
      document.body.classList.remove("archive-ui--mobile-nav-open");
      headerMenuBtn?.setAttribute("aria-expanded", "false");
      headerMenuBtn?.setAttribute("aria-label", "Open categories menu");

      if (twPrefersReducedMotion()) {
        finish();
        return;
      }

      mobileShell.classList.add("is-closing");
      mobileShellCloseAbort = twAfterMotion(mobileShell, MOBILE_NAV_MOTION_MS, finish);
    }

    function openMobileCategoryPanel() {
      if (!mobileShell) return;
      if (mobileShellCloseAbort) {
        mobileShellCloseAbort();
        mobileShellCloseAbort = null;
        mobileShell.classList.remove("is-closing");
      }
      syncMobileShellTop();
      resetMobileNavDrill();
      mobileShell.hidden = false;
      mobileShell.classList.add("is-open");
      mobileShell.setAttribute("aria-hidden", "false");
      document.body.classList.add("archive-ui--mobile-nav-open");
      headerMenuBtn?.setAttribute("aria-expanded", "true");
      headerMenuBtn?.setAttribute("aria-label", "Close categories menu");
      requestAnimationFrame(() => {
        syncMobileShellTop();
      });
    }

    function openMobileHeaderSearch() {
      if (!headerSearchWrap || headerSearchWrap.classList.contains("is-open")) return;
      closeMobileCategoryPanel();
      headerSearchBtn?.click();
    }

    syncBrandSignatureBarHeight();

    const renderHeaderSubmenuPreview = (slot, subcategory) => {
      stripDesktopMegaMenuDivisionHeading();
      const preview = document.getElementById("site-header-submenu-preview");
      if (!preview) return;
      const pool = items.filter((it) => itemPassesSeasonNav(it, seasonNavFilter) && itemSlot(it) === slot);
      const sub = String(subcategory ?? "").trim();
      const matches = pool
        .filter((it) => (!sub ? true : itemMatchesDrillSubcategory(it, slot, sub)))
        .sort(compareGridItems)
        .slice(0, 4);
      preview.replaceChildren();
      preview.classList.add("site-header__submenu-preview--editorial");
      if (!matches.length) {
        const empty = document.createElement("p");
        empty.className = "site-header__submenu-preview-empty";
        empty.textContent = "No items in this type yet.";
        preview.appendChild(empty);
        return;
      }
      for (const item of matches) {
        const a = document.createElement("a");
        a.className = "site-header__submenu-preview-card";
        const detailUrl = new URL("item.html", globalThis.location.href);
        detailUrl.searchParams.set("id", String(item.id));
        a.href = detailUrl.toString();
        const media = document.createElement("div");
        media.className = "site-header__submenu-preview-media site-header__submenu-preview-media--contain";
        const im = document.createElement("img");
        im.alt = imageAltForItem(item);
        im.loading = "lazy";
        wireCoverImageWithFallbacks(im, item, {
          host: media,
          missingClass: "site-header__submenu-preview-media--missing",
          coverRenderWidth: 360,
          coverRenderHeight: 480,
          coverRenderQuality: 86,
          coverRenderResize: "contain",
        });
        media.appendChild(im);
        const caption = document.createElement("p");
        caption.className = "site-header__submenu-preview-caption";
        const brand = String(item.brand ?? "").trim();
        const name = displayNameWithoutLeadingColour(item);
        caption.textContent = brand ? `${brand} · ${name}` : name;
        a.append(media, caption);
        preview.appendChild(a);
      }
    };

    let headerSubmenuDimEl = document.getElementById("site-header-submenu-dim");
    if (!headerSubmenuDimEl) {
      headerSubmenuDimEl = document.createElement("button");
      headerSubmenuDimEl.type = "button";
      headerSubmenuDimEl.id = "site-header-submenu-dim";
      headerSubmenuDimEl.className = "site-header__submenu-dim";
      headerSubmenuDimEl.hidden = true;
      headerSubmenuDimEl.setAttribute("aria-hidden", "true");
      headerSubmenuDimEl.setAttribute("aria-label", "Close category menu");
      headerSubmenuDimEl.tabIndex = -1;
      headerSubmenuDimEl.addEventListener("click", () => {
        closeMegaMenuNow();
        closeHeaderSearch();
      });
      headerSubmenuDimEl.addEventListener("pointerenter", () => scheduleCloseMegaMenu());
      document.body.appendChild(headerSubmenuDimEl);
    }

    const showHeaderSubmenuForCategory = (jump) => {
      const searchW = document.getElementById("site-header-search-wrap");
      if (searchW?.classList.contains("is-open")) closeHeaderSearch();
      const slot = String(jump ?? "").trim();
      const wrap = document.getElementById("site-header-submenu");
      const links = document.getElementById("site-header-submenu-links");
      if (!wrap || !links) return;
      if (!slot || !SLOT_OPTIONS.includes(slot)) {
        hideHeaderSubmenu();
        return;
      }
      if (!ARCHIVE_RECORD_TYPE_SUBNAV_ENABLED) {
        hideHeaderSubmenu();
        return;
      }
      if (headerSubmenuCloseAbort) {
        headerSubmenuCloseAbort();
        headerSubmenuCloseAbort = null;
        document.body.classList.remove("archive-ui--header-submenu-closing");
        document.body.classList.add("archive-ui--header-submenu-open");
        setHeaderSubmenuState(wrap, "open");
        wrap.classList.remove("site-header__submenu--opening", "site-header__submenu--switching");
        if (headerSubmenuDimEl) {
          headerSubmenuDimEl.hidden = false;
          headerSubmenuDimEl.setAttribute("aria-hidden", "false");
        }
      }

      const openingNow =
        getHeaderSubmenuState(wrap) === "closed" || getHeaderSubmenuState(wrap) === "closing";
      const switchingSlot = headerSubmenuIsOpen(wrap) && headerNavOpenSlot && headerNavOpenSlot !== slot;
      if (switchingSlot) {
        if (headerSubmenuSwitchAnimTimer) {
          clearTimeout(headerSubmenuSwitchAnimTimer);
          headerSubmenuSwitchAnimTimer = 0;
        }
        wrap.classList.remove("site-header__submenu--switching");
        void wrap.offsetWidth;
        wrap.classList.add("site-header__submenu--switching");
        headerSubmenuSwitchAnimTimer = setTimeout(() => {
          headerSubmenuSwitchAnimTimer = 0;
          wrap.classList.remove("site-header__submenu--switching");
        }, 320);
      }

      const seasonalPool = poolItemsForDrillSubcategories({ respectCategory: false });
      const dedupedEntries = megaMenuSubcategoryEntriesForSlot(slot, seasonalPool);
      if (!dedupedEntries.length) {
        hideHeaderSubmenu();
        return;
      }

      wrap.classList.remove("site-header__submenu--preview-only");
      links.replaceChildren();
      stripDesktopMegaMenuDivisionHeading();

      const subF = String(subcategoryFilter ?? "").trim();

      dedupedEntries.forEach(({ raw, label }) => {
        const a = document.createElement("a");
        a.href = archiveMainHref();
        a.className = "site-header__submenu-link";
        a.textContent = label;
        a.setAttribute("data-category-jump", slot);
        a.setAttribute("data-subcategory-jump", raw);
        if (subcategoryFilterMatchesEntry(raw, headerNavOpenSlot === slot ? subF : "")) {
          a.classList.add("is-active");
        }
        a.addEventListener("pointerenter", () => {
          links.querySelectorAll(".site-header__submenu-link.is-active").forEach((n) => n.classList.remove("is-active"));
          a.classList.add("is-active");
          renderHeaderSubmenuPreview(slot, raw);
        });
        a.addEventListener("focus", () => {
          links.querySelectorAll(".site-header__submenu-link.is-active").forEach((n) => n.classList.remove("is-active"));
          a.classList.add("is-active");
          renderHeaderSubmenuPreview(slot, raw);
        });
        links.appendChild(a);
      });
      const initialPreview =
        dedupedEntries.find((e) => subcategoryFilterMatchesEntry(e.raw, headerNavOpenSlot === slot ? subF : "")) ??
        dedupedEntries[0];
      renderHeaderSubmenuPreview(slot, initialPreview?.raw ?? "");
      if (headerSubmenuUsesDomHidden()) {
        wrap.hidden = false;
      } else {
        wrap.removeAttribute("hidden");
      }
      wrap.setAttribute("aria-hidden", "false");
      if (openingNow) {
        setHeaderSubmenuState(wrap, "opening");
        void wrap.offsetWidth;
        requestAnimationFrame(() => {
          if (getHeaderSubmenuState(wrap) !== "opening") return;
          setHeaderSubmenuState(wrap, "open");
        });
      } else {
        setHeaderSubmenuState(wrap, "open");
      }
      document.body.classList.add("archive-ui--header-submenu-open");
      document.body.classList.remove("archive-ui--header-submenu-closing");
      headerNavOpenSlot = slot;
      syncCategoryTabUI();
      if (headerSubmenuDimEl) {
        headerSubmenuDimEl.hidden = false;
        headerSubmenuDimEl.setAttribute("aria-hidden", "false");
      }
      requestAnimationFrame(() => {
        if (document.body.classList.contains("archive-ui--header-submenu-open")) {
          syncHeaderSubmenuBackdropInset();
        }
      });
    };

    const openMegaMenu = (category) => {
      cancelCloseMegaMenu();
      showHeaderSubmenuForCategory(category);
    };

    const divisionHoverZoneRef = document.querySelector(".site-header__division-hover-zone");
    const headerCategoryNav = document.querySelector(".site-header__primary-nav.main-nav");
    const megaMenuRef = document.getElementById("site-header-submenu");

    if (megaMenuRef && !headerSubmenuUsesDomHidden()) {
      megaMenuRef.removeAttribute("hidden");
      setHeaderSubmenuState(megaMenuRef, "closed");
    }
    if (headerCategoryNav) {
      headerCategoryNav.addEventListener("click", (e) => {
        const link = e.target.closest("[data-category-jump]");
        if (!link) return;
        e.preventDefault();
        const jump = String(link.getAttribute("data-category-jump") ?? "").trim();
        jumpHeaderCategory(jump);
        hideHeaderSubmenu();
        closeHeaderSearch();
      });
      headerCategoryNav.addEventListener("focusin", (e) => {
        if (isFiltersNarrowViewport()) return;
        const link = getHeaderDivisionLink(e.target);
        if (!link) return;
        const jump = String(link.getAttribute("data-category-jump") ?? "").trim();
        if (jump) openMegaMenu(jump);
      });
    }

    if (divisionHoverZoneRef) {
      divisionHoverZoneRef.addEventListener("mouseenter", () => {
        if (isFiltersNarrowViewport()) return;
        cancelCloseMegaMenu();
      });
      divisionHoverZoneRef.addEventListener("mouseleave", (e) => {
        if (isFiltersNarrowViewport()) return;
        const to = e.relatedTarget;
        if (isInMegaMenuHoverSafe(to)) return;
        scheduleCloseMegaMenu();
      });
      divisionHoverZoneRef.querySelectorAll(HEADER_DIVISION_LINK_SELECTOR).forEach((link) => {
        link.addEventListener("mouseenter", () => {
          if (isFiltersNarrowViewport()) return;
          closeHeaderSearch();
          const jump = String(link.getAttribute("data-category-jump") ?? "").trim();
          if (jump) openMegaMenu(jump);
        });
      });
    }

    const utilityNavRef = document.querySelector(".site-header__tools");
    const logoRef = document.querySelector(".site-title");

    utilityNavRef?.addEventListener("mouseenter", () => {
      if (isFiltersNarrowViewport()) return;
      closeMegaMenuNow();
    });
    logoRef?.addEventListener("mouseenter", () => {
      if (isFiltersNarrowViewport()) return;
      closeMegaMenuNow();
    });

    const headerHome = document.getElementById("site-header-home");
    headerHome?.addEventListener("click", (e) => {
      e.preventDefault();
      hideHeaderSubmenu();
      closeMobileCategoryPanel();
      collapseFiltersMenuPanel();
      navigateToSiteHome();
    });

    megaMenuRef?.addEventListener("mouseenter", () => {
      if (isFiltersNarrowViewport()) return;
      cancelCloseMegaMenu();
    });
    megaMenuRef?.addEventListener("mouseleave", (e) => {
      if (isFiltersNarrowViewport()) return;
      const to = e.relatedTarget;
      if (isInMegaMenuHoverSafe(to)) return;
      scheduleCloseMegaMenu();
    });

    const headerSubmenuLinks = document.getElementById("site-header-submenu-links");
    headerSubmenuLinks?.addEventListener("click", (e) => {
      const link = e.target.closest("[data-category-jump]");
      if (!link) return;
      e.preventDefault();
      const jump = String(link.getAttribute("data-category-jump") ?? "").trim();
      const sub = String(link.getAttribute("data-subcategory-jump") ?? "").trim();
      clearArchiveKeywordColourNarrowing();
      if (archiveSubmittedSearchNorm) exitArchiveSearchPlpRestoreBrowse({ skipRestore: true });
      categoryNavFilter = resolveCategoryJump(jump);
      subcategoryFilter = sub;
      noteArchiveSearchUserChoseMainSlotFilter();
      syncCategoryTabUI();
      if (!document.getElementById("grid")) {
        validateSubcategoryFilter();
        writeArchiveBrowseRestoreSnapshot();
        navigateToArchiveMain();
        hideHeaderSubmenu();
        return;
      }
      validateSubcategoryFilter();
      renderCategoryDrill();
      renderGrid();
      scrollArchiveViewportTop();
      hideHeaderSubmenu();
    });
    headerSubmenuLinks?.addEventListener("focusout", () => {
      if (isFiltersNarrowViewport()) return;
      queueMicrotask(() => {
        const active = document.activeElement;
        const wrap = document.querySelector(".site-header__container, .site-header__inner");
        if (!(active instanceof Element) || !wrap?.contains(active)) {
          hideHeaderSubmenu();
        }
      });
    });

    headerSearchBtn?.addEventListener("click", () => {
      if (!headerSearchWrap) return;
      const open = !headerSearchWrap.classList.contains("is-open");
      if (open) {
        if (headerSearchCloseAbort) {
          headerSearchCloseAbort();
          headerSearchCloseAbort = null;
        }
        cancelSearchGridDebounce();
        headerSearchOverlayArchiveSearchFrozen = true;
        headerSearchOpenArchiveSearchNorm =
          archiveSubmittedSearchNorm || normalizeSearch(els.search?.value ?? "");
        headerSearchOverlayOpeningQueryRaw = String(els.search?.value ?? "").trim();
        syncSearchKeywordChip();
        hideHeaderSubmenu();
        closeMobileCategoryPanel();
        document.body.classList.remove("archive-ui--nav-folded", "archive-ui--header-search-closing");
        syncHeaderSearchFeaturedSubcategoryCards();
        headerSearchWrap.classList.add("is-open");
        headerSearchWrap.removeAttribute("hidden");
        headerSearchWrap.setAttribute("aria-hidden", "false");
        headerSearchBtn.setAttribute("aria-expanded", "true");
        headerSearchBtn.setAttribute("aria-label", "Close search");
        document.body.classList.add("archive-ui--header-search-open");
        if (!isHeaderCompactLayout()) {
          setHeaderSearchFlyoutState(headerSearchWrap, "opening");
          syncHeaderSubmenuBackdropInset();
          void headerSearchWrap.offsetWidth;
          requestAnimationFrame(() => {
            if (getHeaderSearchFlyoutState(headerSearchWrap) === "opening") {
              setHeaderSearchFlyoutState(headerSearchWrap, "open");
            }
          });
          showHeaderFlyoutDim();
        } else {
          setHeaderSearchFlyoutState(headerSearchWrap, "open");
          syncMobileShellTop();
        }
        relocateFilterSearchFieldIntoHeaderOverlayPillWrap();
        queueMicrotask(() => {
          headerSearchInput?.focus();
          resetHeaderSearchOverlayResultsDom();
          syncSearchOverlayBackdropTop();
          requestAnimationFrame(() => {
            syncSearchOverlayBackdropTop();
          });
        });
      } else {
        closeHeaderSearch();
      }
    });
    document.getElementById("site-header-search-close")?.addEventListener("click", () => {
      closeHeaderSearch();
    });
    document.getElementById("archive-search-results-clear")?.addEventListener("click", () => {
      clearArchiveKeywordSearchThenRender({ focusInput: false });
    });
    document.getElementById("archive-search-results-pills")?.addEventListener("click", (e) => {
      const pill = /** @type {HTMLElement | null} */ (
        e.target.closest("[data-search-result-category], [data-search-result-all]")
      );
      if (!pill) return;
      e.preventDefault();
      archiveSearchWithinRecordCategory =
        pill.dataset.searchResultAll === "1" ? "" : String(pill.dataset.searchResultCategory ?? "").trim();
      syncArchiveSearchResultsPlpUi();
      renderGrid();
    });
    headerSearchWrap?.addEventListener("click", (e) => {
      const chip = /** @type {HTMLElement | null} */ (e.target.closest("[data-trending-search]"));
      if (chip && headerSearchWrap.contains(chip)) {
        e.preventDefault();
        const q = String(chip.getAttribute("data-trending-search") ?? "").trim();
        if (q) submitTrendingSearchFromMegaMenu(q);
        return;
      }
      const a = e.target.closest(".site-header__search-aside-link[data-category-jump], .site-header__search-category-card[data-category-jump]");
      if (!a || !headerSearchWrap?.contains(a)) return;
      e.preventDefault();
      const jump = String(a.getAttribute("data-category-jump") ?? "").trim();
      const sub = String(a.getAttribute("data-subcategory-jump") ?? "").trim();
      if (sub) {
        if (archiveSubmittedSearchNorm) exitArchiveSearchPlpRestoreBrowse({ skipRestore: true });
        clearArchiveKeywordColourNarrowing();
        categoryNavFilter = resolveCategoryJump(jump);
        subcategoryFilter = sub;
        noteArchiveSearchUserChoseMainSlotFilter();
        syncCategoryTabUI();
        hideHeaderSubmenu();
        closeHeaderSearch();
        if (!document.getElementById("grid")) {
          validateSubcategoryFilter();
          writeArchiveBrowseRestoreSnapshot();
          navigateToArchiveMain();
          return;
        }
        validateSubcategoryFilter();
        renderCategoryDrill();
        renderGrid();
        scrollArchiveViewportTop();
        return;
      }
      jumpHeaderCategory(jump);
      hideHeaderSubmenu();
      closeHeaderSearch();
    });
    headerMenuBtn?.addEventListener("click", () => {
      if (!mobileShell) return;
      const open = !mobileShell.classList.contains("is-open");
      if (open) {
        closeHeaderSearch();
        hideHeaderSubmenu();
        openMobileCategoryPanel();
      } else {
        closeMobileCategoryPanel();
      }
    });
    document.getElementById("site-mobile-shell-close-btn")?.addEventListener("click", () => {
      closeMobileCategoryPanel();
    });
    document.getElementById("site-mobile-shell-search-btn")?.addEventListener("click", () => {
      openMobileHeaderSearch();
    });
    document.getElementById("site-mobile-shell-styling-btn")?.addEventListener("click", () => {
      closeMobileCategoryPanel();
      document.getElementById("site-header-saved-toggle")?.click();
    });
    document.getElementById("site-mobile-nav-back")?.addEventListener("click", () => {
      resetMobileNavDrill({ focusMain: true });
    });
    document.getElementById("site-mobile-nav-drill-close")?.addEventListener("click", () => {
      closeMobileCategoryPanel();
    });
    document.getElementById("site-mobile-nav")?.addEventListener("click", (e) => {
      const seasonBtn = /** @type {HTMLElement | null} */ (
        e.target.closest("[data-mobile-nav-season]")
      );
      if (seasonBtn) {
        e.preventDefault();
        const season = String(seasonBtn.getAttribute("data-mobile-nav-season") ?? "").trim();
        handleMobileCategoryNavigation("", "", { season });
        return;
      }
      const browseAll = /** @type {HTMLElement | null} */ (e.target.closest("[data-mobile-nav-browse-all]"));
      if (browseAll) {
        e.preventDefault();
        handleMobileCategoryNavigation("", "", { season: "All" });
        return;
      }
      const row = /** @type {HTMLElement | null} */ (e.target.closest(".site-mobile-nav__row"));
      if (row) {
        const slot = String(row.dataset.mobileNavSlot ?? "").trim();
        if (SLOT_OPTIONS.includes(slot)) openMobileNavDrill(slot);
        return;
      }
      const link = /** @type {HTMLElement | null} */ (e.target.closest("[data-category-jump]"));
      if (!link || !mobileShell?.contains(link)) return;
      e.preventDefault();
      const jump = String(link.getAttribute("data-category-jump") ?? "").trim();
      const sub = String(link.getAttribute("data-subcategory-jump") ?? "").trim();
      handleMobileCategoryNavigation(jump, sub);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (mobileShell?.classList.contains("is-open")) {
        const nav = document.getElementById("site-mobile-nav");
        if (nav?.classList.contains("site-mobile-nav--drill-open")) {
          resetMobileNavDrill({ focusMain: true });
          return;
        }
        closeMobileCategoryPanel();
      }
      if (headerSearchWrap?.classList.contains("is-open")) {
        closeHeaderSearch();
      }
      if (headerSubmenuIsOpen()) {
        hideHeaderSubmenu();
      }
    });
    document.addEventListener("click", (e) => {
      if (!headerSearchWrap?.classList.contains("is-open")) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      const flyoutInner = t.closest(".desktop-search-flyout-inner");
      if (flyoutInner) return;
      if (headerSearchBtn?.contains(t)) return;
      closeHeaderSearch();
    });
    if (document.body.dataset.twSearchDimResizeWired !== "1") {
      document.body.dataset.twSearchDimResizeWired = "1";
      globalThis.addEventListener(
        "resize",
        () => {
          syncSearchOverlayBackdropTop();
        },
        { passive: true }
      );
    }
    if (document.body.dataset.twStrictFilePickerClickWired !== "1") {
      document.body.dataset.twStrictFilePickerClickWired = "1";
      document.addEventListener(
        "click",
        (e) => {
          const t = e.target;
          if (!(t instanceof Element)) return;
          const label = t.closest("label.field--file");
          if (!label) return;
          const input = label.querySelector('input[type="file"]');
          if (!input) return;
          if (t === input) return;
          e.preventDefault();
        },
        true
      );
    }
    globalThis.matchMedia?.("(max-width: 900px)")?.addEventListener?.("change", (ev) => {
      if (ev.matches) return;
      closeMobileCategoryPanel();
      hideHeaderSubmenu();
      closeHeaderSearch();
      ensureBodyScrollUnlockedWhenNoOverlay();
    });

    if (isFiltersNarrowViewport()) {
      closeMobileCategoryPanel();
      closeHeaderSearch();
      ensureBodyScrollUnlockedWhenNoOverlay();
    }

    globalThis.addEventListener(
      "resize",
      () => {
        if (
          document.body.classList.contains("archive-ui--header-submenu-open") ||
          document.body.classList.contains("archive-ui--header-submenu-closing")
        ) {
          syncHeaderSubmenuBackdropInset();
        }
        syncBrandSignatureBarHeight();
        if (mobileShell?.classList.contains("is-open")) syncMobileShellTop();
        if (headerSearchWrap?.classList.contains("is-open") && isHeaderCompactLayout()) syncMobileShellTop();
      },
      { passive: true }
    );

    const seasonMini = document.getElementById("season-nav-mini");
    seasonMini?.addEventListener("click", (e) => {
      const tab = e.target.closest(".site-header__season-mini-tab");
      if (!tab) return;
      const v = String(tab.dataset.seasonFilter ?? "").trim();
      if (!normalizeSeasonNavToken(v)) return;
      if (!document.getElementById("grid")) {
        navigateToArchiveSeason(v);
        return;
      }
      setSeasonNavFilter(v);
    });

    const savedToggleBtn = document.getElementById("site-header-saved-toggle");
    savedToggleBtn?.addEventListener("click", () => {
      toggleStylingBoardDrawer();
    });
    document.getElementById("styling-board-drawer-backdrop")?.addEventListener("click", () => {
      closeStylingBoardDrawer();
    });
    document.getElementById("styling-board-drawer-close")?.addEventListener("click", () => {
      closeStylingBoardDrawer();
    });
    if (document.body.dataset.twStylingBoardEscapeWired !== "1") {
      document.body.dataset.twStylingBoardEscapeWired = "1";
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const root = document.getElementById("styling-board-drawer");
        if (!root || root.hasAttribute("hidden")) return;
        closeStylingBoardDrawer();
      });
    }

    els.emptyReset?.addEventListener("click", () => {
      resetNarrowingFilters();
      showToast("Type, colour, and search cleared — showing full archive.");
    });

    const seasonNav = document.getElementById("season-nav");
    seasonNav?.addEventListener("click", (e) => {
      const seasonTab = e.target.closest(".season-strip__tab");
      if (!seasonTab) return;
      const v = String(seasonTab.dataset.seasonFilter ?? "").trim();
      if (!normalizeSeason(v)) return;
      setSeasonNavFilter(v);
    });

    document.getElementById("archive-drawer-season-chips")?.addEventListener("click", (e) => {
      const chip = e.target.closest("button[data-season-filter]");
      if (!chip) return;
      const v = String(chip.dataset.seasonFilter ?? "").trim();
      if (!normalizeSeason(v)) return;
      setSeasonNavFilter(v);
    });

    const categoryDrill = document.getElementById("category-drill");
    if (categoryDrill) {
      categoryDrill.addEventListener("click", (e) => {
        const slotBtn = e.target.closest("button[data-slot-filter]");
        if (slotBtn && categoryDrill.contains(slotBtn)) {
          const raw = slotBtn.getAttribute("data-slot-filter") ?? "";
          applyCategoryNavFilter(raw && SLOT_OPTIONS.includes(raw) ? raw : "", { scrollTop: true });
          collapseFiltersMenuPanel();
          return;
        }
        const choice = e.target.closest(".category-drill__choice[data-subcategory]");
        if (!choice) return;
        const next = String(choice.dataset.subcategory ?? "").trim();
        withPreservedArchiveScroll(() => {
          subcategoryFilter = subcategoryFilterMatchesEntry(next, subcategoryFilter) ? "" : next;
          validateSubcategoryFilter();
          renderCategoryDrill();
          renderGrid();
        });
        collapseFiltersMenuPanel();
      });
    }

    if (els.grid) {
      els.grid.addEventListener("click", (e) => {
        const outfitBtn = e.target.closest("[data-outfit-add]");
        if (outfitBtn && !outfitBtn.disabled) {
          addToOutfit(outfitBtn.dataset.outfitAdd);
          outfitBtn.closest(".card")?.classList.remove("card--styling-reveal");
          return;
        }
      });
    }

    if (els.grid && document.body.dataset.twArchiveStylingRevealWired !== "1") {
      document.body.dataset.twArchiveStylingRevealWired = "1";
      document.addEventListener("click", (e) => {
        if (!isArchiveCardCoarsePointer()) return;
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (t.closest(".card--styling-reveal .card__board-add, .card--styling-reveal .card__quick-outfit")) {
          return;
        }
        if (t.closest(".card--styling-reveal .card__media")) return;
        dismissArchiveCardStylingReveal();
      });
    }

    if (els.outfitStrip) {
      els.outfitStrip.addEventListener("click", (e) => {
        const rm = e.target.closest("[data-outfit-remove-index]");
        if (!rm) return;
        const idx = parseInt(rm.dataset.outfitRemoveIndex, 10);
        if (!Number.isFinite(idx)) return;
        removeOutfitSlotAt(idx);
      });
    }

    initOutfitVariantDialog();

    if (els.outfitSave) {
      els.outfitSave.addEventListener("click", () => {
        void saveCurrentOutfit();
      });
    }

    const persistDraftFromFields = () => persistStylingBoardDraft();
    els.outfitName?.addEventListener("input", persistDraftFromFields);
    els.outfitNotes?.addEventListener("input", persistDraftFromFields);

    if (els.outfitClear) {
      els.outfitClear.addEventListener("click", () => {
        if (!currentOutfitSlots.length && !els.outfitName.value.trim()) {
          showToast("Nothing to clear.");
          return;
        }
        clearOutfit();
      });
    }

    if (els.savedList) {
      els.savedList.addEventListener("click", (e) => {
        const loadBtn = e.target.closest("[data-outfit-load]");
        if (loadBtn) {
          loadSavedIntoBuilder(loadBtn.dataset.outfitLoad);
          return;
        }
        const editBtn = e.target.closest("[data-outfit-edit]");
        if (editBtn) {
          loadSavedIntoBuilder(editBtn.dataset.outfitEdit, { forEdit: true });
          return;
        }
        const delBtn = e.target.closest("[data-outfit-delete]");
        if (delBtn) {
          void deleteSavedOutfit(delBtn.dataset.outfitDelete);
        }
      });
    }

    els.search?.addEventListener("input", () => syncFilterSearchClearVisibility());
    els.search?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      if (!document.getElementById("grid")) {
        validateSubcategoryFilter();
        const raw = String(els.search?.value ?? "").trim();
        writeArchiveBrowseRestoreSnapshot({ search: raw });
        navigateToArchiveMain();
        return;
      }
      submitArchiveSearchFromInput();
    });
    els.search?.addEventListener("blur", () => {
      syncFilterSearchClearVisibility();
    });

    els.searchChip?.addEventListener("click", () => clearArchiveKeywordSearchThenRender());

    els.colourChip?.addEventListener("click", () => {
      if (!basicColourFilter) return;
      basicColourFilter = persistBasicColourFilter("");
      renderGrid();
    });

    els.categoryChip?.addEventListener("click", () => {
      if (!categoryNavFilter) return;
      categoryNavFilter = "";
      subcategoryFilter = "";
      syncCategoryTabUI();
      renderCategoryDrill();
      renderGrid();
    });

    els.subcategoryChip?.addEventListener("click", () => {
      if (!String(subcategoryFilter ?? "").trim()) return;
      subcategoryFilter = "";
      renderCategoryDrill();
      renderGrid();
    });

    els.searchClear?.addEventListener("click", () => clearArchiveKeywordSearchThenRender());

    const filtersNav = document.getElementById("filters-nav");
    const filtersMenuBtn = document.getElementById("filters-menu-btn");
    filtersMenuBtn?.addEventListener("click", () => toggleFiltersMenuPanel());

    if (filtersNav && !filtersMenuDismissListenersInstalled) {
      filtersMenuDismissListenersInstalled = true;
      document.addEventListener(
        "pointerdown",
        (e) => {
          if (!isFiltersNarrowViewport()) return;
          if (!filtersNav.classList.contains("filters--menu-open")) return;
          const t = e.target;
          if (!(t instanceof Element)) return;
          if (filtersNav.contains(t)) return;
          collapseFiltersMenuPanel();
        },
        true
      );
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        collapseFiltersMenuPanel();
      });
      globalThis.matchMedia?.("(max-width: 900px)")?.addEventListener?.("change", () => {
        syncFiltersMenuForViewport();
      });
    }

    wireEditorialLandingPageArchiveLinks();

    initArchiveNavScrollFold();

    globalThis.addEventListener("pageshow", (e) => {
      const pe = /** @type {PageTransitionEvent} */ (e);
      if (!pe.persisted) return;
      applyPageTheme();
      if (!document.getElementById("grid")) return;
      void (async () => {
        try {
          if (isSupabaseReady()) {
            await hydrateArchiveAndSeasonState();
          }
          await refreshCloudBackedCustomItems();
          renderOutfitStrip();
          renderSavedOutfits();
        } catch (err) {
          console.warn("bfcache restore refresh failed", err);
        }
      })();
    });
  }

  function seedItemsFromScript() {
    return typeof WARDROBE_ITEMS !== "undefined" && Array.isArray(WARDROBE_ITEMS)
      ? WARDROBE_ITEMS
      : [];
  }

  /** @type {{ count: number, ids: Set<string>, frozenAt: string } | null} */
  let catalogueLockManifest = null;

  async function loadCatalogueLockManifest() {
    try {
      const res = await fetch("data/wardrobe-catalogue-lock.json", { cache: "no-store" });
      if (!res.ok) return null;
      const p = await res.json();
      if (String(p?._schema ?? "") !== "timeless-wardrobe-catalogue-lock-v1") return null;
      const ids = Array.isArray(p.ids) ? p.ids.map((x) => String(x)).filter(Boolean) : [];
      const count = Number(p.count) || ids.length;
      if (!count || !ids.length) return null;
      return { count, ids: new Set(ids), frozenAt: String(p.frozenAt ?? "") };
    } catch (e) {
      console.warn("wardrobe-catalogue-lock.json", e);
      return null;
    }
  }

  /**
   * If cloud returns fewer rows than the frozen lock, merge seed + cloud instead of showing a shrunk list.
   * Pieces are only removed from Supabase via explicit Admin delete — not by a partial fetch.
   * @param {object[]} cloudItems
   * @returns {object[]}
   */
  function resolveWardrobeBaseFromCloudFetch(cloudItems) {
    const rows = Array.isArray(cloudItems) ? cloudItems : [];
    if (!catalogueLockManifest || rows.length >= catalogueLockManifest.count) {
      return rows;
    }
    console.warn(
      `[catalogue lock] Cloud returned ${rows.length} rows but lock expects ${catalogueLockManifest.count} (frozen ${catalogueLockManifest.frozenAt || "—"}). Using seed merge — nothing was deleted unless you used Admin Delete.`
    );
    wardrobeCatalogueSource = "seed";
    wardrobeBase = seedItemsFromScript().map((r) => ({ ...r }));
    mergeWardrobeBaseWithFetchedCloudRows(rows);
    return wardrobeBase.slice();
  }

  async function loadFileBackedCustomItems() {
    try {
      const res = await fetch("data/custom-items.json", { cache: "no-store" });
      if (!res.ok) return [];
      return normalizeCustomItemRows(await res.json());
    } catch (e) {
      console.warn("data/custom-items.json", e);
      return [];
    }
  }

  /** Merge cloud `wardrobe_items` rows into in-memory catalogue by `id` (seed catalogue + extra cloud rows). */
  function mergeWardrobeBaseWithFetchedCloudRows(cloudRows) {
    if (!Array.isArray(cloudRows) || !cloudRows.length) return;
    const byId = new Map();
    for (const raw of cloudRows) {
      const n =
        raw && typeof raw === "object" && raw.__source === "supabase"
          ? normalizeItemDerivedFields({ ...raw })
          : normalizeCloudItemRow(raw);
      if (n) byId.set(String(n.id), { ...n });
    }
    wardrobeBase = wardrobeBase.map((row) => {
      if (!row || row.id == null) return row;
      const hit = byId.get(String(row.id));
      return hit ? carryForwardMediaNonce(row, hit) : { ...row };
    });
    const have = new Set(wardrobeBase.map((r) => String(r?.id ?? "")));
    for (const [iid, row] of byId) {
      if (!have.has(iid)) {
        wardrobeBase.push({ ...row });
        have.add(iid);
      }
    }
  }

  /** Upsert one normalized row in `wardrobeBase` so UI can reflect successful cloud save immediately. */
  function upsertWardrobeBaseRowInMemory(row) {
    const id = String(row?.id ?? "").trim();
    if (!id) return;
    const existing = wardrobeBase.find((r) => String(r?.id ?? "") === id);
    const next =
      existing && !(typeof /** @type {any} */ (row).__displayNonce === "number")
        ? carryForwardMediaNonce(existing, row)
        : { ...row };
    let replaced = false;
    wardrobeBase = wardrobeBase.map((r) => {
      if (String(r?.id ?? "") !== id) return r;
      replaced = true;
      return next;
    });
    if (!replaced) wardrobeBase.push(next);
  }

  /**
   * @param {{ pinnedRows?: object[] }} [opts] — rows just written to Supabase; kept when cloud fetch is still stale.
   */
  async function refreshCloudBackedCustomItems(opts = {}) {
    const pinnedRows = Array.isArray(opts?.pinnedRows)
      ? opts.pinnedRows.filter((r) => r && r.id != null)
      : [];
    /** @type {Map<string, object>} */
    const pinnedById = new Map();
    for (const r of pinnedRows) pinnedById.set(String(r.id), r);

    if (!isCloudModeActive()) {
      cloudBackedCustomItems = [];
      mergeWardrobeFromSources();
      if (document.getElementById("grid")) {
        initFilters();
        onOutfitChange();
        renderGrid();
      }
      return cloudBackedCustomItems;
    }
    cloudBackedCustomItems = await loadWardrobeItemsFromCloud();
    if (cloudBackedCustomItems.length) {
      stripCustomIdsFromLocalStorage(cloudBackedCustomItems.map((r) => String(r?.id ?? "")));
      if (wardrobeCatalogueSource === "cloud") {
        const prevById = new Map();
        for (const r of wardrobeBase) {
          if (r?.id != null) prevById.set(String(r.id), r);
        }
        wardrobeBase = cloudBackedCustomItems.map((r) => {
          const id = String(r?.id ?? "");
          const pinned = pinnedById.get(id);
          if (pinned) return mergeCloudWardrobeRowWithPinnedSave(pinned, r);
          const prev = prevById.get(id);
          return prev ? carryForwardMediaNonce(prev, r) : { ...r };
        });
        const cloudIds = new Set(cloudBackedCustomItems.map((r) => String(r?.id ?? "")));
        for (const [id, pinned] of pinnedById) {
          if (!cloudIds.has(id)) upsertWardrobeBaseRowInMemory(pinned);
        }
      } else {
        mergeWardrobeBaseWithFetchedCloudRows(cloudBackedCustomItems);
        for (const pinned of pinnedById.values()) upsertWardrobeBaseRowInMemory(pinned);
      }
    } else {
      for (const pinned of pinnedById.values()) upsertWardrobeBaseRowInMemory(pinned);
    }
    for (const pinned of pinnedById.values()) {
      const id = String(pinned.id);
      cloudBackedCustomItems = [
        pinned,
        ...cloudBackedCustomItems.filter((x) => String(x?.id ?? "") !== id),
      ];
    }
    mergeWardrobeFromSources();
    if (document.getElementById("grid")) {
      initFilters();
      onOutfitChange();
      renderGrid();
    }
    return cloudBackedCustomItems;
  }

  /**
   * Defer sync work so the homepage can paint (`mergeWardrobeFromSources` → `renderGrid`) first.
   * Falls back where `requestIdleCallback` is unavailable (Safari older builds).
   * @param {() => void} fn
   */
  function scheduleHomepageDeferredWork(fn) {
    const ric = globalThis.requestIdleCallback;
    if (typeof ric === "function") {
      ric.call(globalThis, fn, { timeout: 4800 });
    } else {
      globalThis.requestAnimationFrame(() => {
        globalThis.setTimeout(fn, 400);
      });
    }
  }

  /** @param {number} ms */
  function twSleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  let twPageLoaderShellInstalled = false;

  function installTwPageLoaderShell() {
    if (twPageLoaderShellInstalled || !document.body) return;
    twPageLoaderShellInstalled = true;
    const root = document.createElement("div");
    root.id = "tw-page-loader";
    root.className = "tw-page-loader";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-busy", "true");
    root.setAttribute("aria-label", "Loading");
    const inner = document.createElement("div");
    inner.className = "tw-page-loader__brand";
    const mark = document.createElement("img");
    mark.className = "tw-page-loader__mark";
    mark.src = "/loading-logo.png";
    mark.alt = "Timeless Wardrobe";
    mark.decoding = "async";
    const wm = document.createElement("span");
    wm.className = "tw-page-loader__wordmark";
    wm.textContent = "Timeless Wardrobe";
    inner.appendChild(mark);
    inner.appendChild(wm);
    root.appendChild(inner);
    document.body.insertBefore(root, document.body.firstChild);
    document.body.classList.add("tw-page-loader-active", "tw-page-loader-main-pending");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.add("tw-page-loader--brand-visible"));
    });
  }

  async function completeTwInitialPageLoader(startedAt) {
    const root = document.getElementById("tw-page-loader");
    if (!root || !document.body.classList.contains("tw-page-loader-active")) return;
    const minMs = 1000;
    const logoInMs = 1000;
    const fadeOutMs = 520;
    const mainInMs = 500;
    const elapsed = () => performance.now() - startedAt;
    await twSleep(Math.max(0, logoInMs - elapsed()));
    await twSleep(Math.max(0, minMs - elapsed()));
    root.classList.add("tw-page-loader--exiting");
    await twSleep(fadeOutMs);
    root.classList.remove("tw-page-loader--exiting");
    root.classList.add("tw-page-loader--off");
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("aria-busy", "false");
    document.body.classList.remove("tw-page-loader-active");
    document.body.classList.remove("tw-page-loader-main-pending");
    document.body.classList.add("tw-page-loader-main-reveal");
    await twSleep(mainInMs);
    document.body.classList.remove("tw-page-loader-main-reveal");
  }

  async function bootstrap() {
    applyPageTheme();
    initTwAdminMode();
    installPageThemeLifecycle();
    ensureHomeHeroPreloadLink();
    installTwPageLoaderShell();
    const twLoaderPageStarted = performance.now();
    try {
    let deferredSeedSyncSnapshot = /** @type {object[] | null} */ (null);
    catalogueLockManifest = await loadCatalogueLockManifest();
    if (catalogueLockManifest) {
      console.info(
        `[catalogue lock] Frozen catalogue: ${catalogueLockManifest.count} pieces (${catalogueLockManifest.frozenAt || "—"}).`
      );
    }
    const cfg = globalThis.APP_CONFIG || {};
    const url = String(cfg.SUPABASE_URL || globalThis.__TW_SUPABASE_URL__ || "").trim();
    const key = String(cfg.SUPABASE_ANON_KEY || globalThis.__TW_SUPABASE_ANON_KEY__ || "").trim();

    if (url && key) {
      try {
        const api = await import("./js/supabase-client.js");
        supabaseClient = api.createBrowserClient(String(url).trim(), String(key).trim());
        if (supabaseClient) {
          storageMode = "cloud";
          let wardrobeFromSupabase = false;
          /** @type {Promise<{ ok: boolean, outfits?: unknown, error?: string }> | null} */
          let outfitsFetchPromise = null;
          const res = await api.fetchWardrobeItems(supabaseClient);
          if (res.ok && res.items.length) {
            const resolved = resolveWardrobeBaseFromCloudFetch(res.items);
            wardrobeBase = resolved;
            wardrobeFromSupabase = true;
            if (wardrobeCatalogueSource !== "seed") wardrobeCatalogueSource = "cloud";
            deferredSeedSyncSnapshot = wardrobeBase.slice();
            outfitsFetchPromise = api.fetchOutfits(supabaseClient);
          } else {
            if (!res.ok) {
              console.warn("Supabase wardrobe_items:", res.error);
            } else {
              console.warn(
                catalogueLockManifest
                  ? `[catalogue lock] Cloud returned 0 rows — using frozen seed (${catalogueLockManifest.count} pieces).`
                  : "Supabase wardrobe_items returned 0 rows — falling back to data/wardrobe.js; run npm run db:import-seed."
              );
            }
            wardrobeBase = seedItemsFromScript().map((r) => ({ ...r }));
            if (catalogueLockManifest) wardrobeCatalogueSource = "seed";
            const cloudBackfillReportBlocking = await syncMissingRowsToSupabase([]);
            if (cloudBackfillReportBlocking && (cloudBackfillReportBlocking.synced > 0 || cloudBackfillReportBlocking.failed > 0)) {
              console.info(
                `Supabase backfill completed — synced: ${cloudBackfillReportBlocking.synced}, failed: ${cloudBackfillReportBlocking.failed}.`
              );
            }
            const cloudReloaded = await loadWardrobeItemsFromCloud();
            if (cloudReloaded.length) {
              wardrobeBase = cloudReloaded;
              wardrobeFromSupabase = true;
              wardrobeCatalogueSource = "cloud";
              outfitsFetchPromise = api.fetchOutfits(supabaseClient);
            } else {
              wardrobeCatalogueSource = "seed";
            }
          }

          if (wardrobeFromSupabase) {
            const outfitsRes = outfitsFetchPromise
              ? await outfitsFetchPromise
              : await api.fetchOutfits(supabaseClient);
            if (outfitsRes.ok) {
              const fromCloud = (outfitsRes.outfits || [])
                .map((o) => normalizeSavedOutfitRecord(o))
                .filter(Boolean);
              savedOutfits = mergeSavedOutfitNotesFromLocalCache(fromCloud)
                .map((o) => normalizeSavedOutfitRecord(o))
                .filter(Boolean);
              persistSavedOutfitsCache();
              useCloudOutfits = true;
            } else {
              const outfitsErr = String(outfitsRes.error || "").trim();
              if (
                isSupabaseSchemaTableMissingError(outfitsErr, "outfits") ||
                isSupabaseSchemaTableMissingError(outfitsErr, "outfit_items")
              ) {
                console.info(
                  "Supabase outfits tables not found yet (outfits/outfit_items). Falling back to browser-saved outfits."
                );
              } else {
                console.warn("Supabase outfits:", outfitsRes.error);
              }
              savedOutfits = loadSavedOutfitsFromStorage();
              useCloudOutfits = false;
            }
          } else {
            savedOutfits = loadSavedOutfitsFromStorage();
            useCloudOutfits = false;
          }
        }
      } catch (e) {
        deferredSeedSyncSnapshot = null;
        console.warn("Supabase unavailable, using local seed + cache.", e);
        supabaseClient = null;
        storageMode = "local";
        useCloudOutfits = false;
        wardrobeBase = seedItemsFromScript();
        wardrobeCatalogueSource = "seed";
        savedOutfits = loadSavedOutfitsFromStorage();
      }
    } else {
      storageMode = "local";
      wardrobeBase = seedItemsFromScript();
      wardrobeCatalogueSource = "seed";
      savedOutfits = loadSavedOutfitsFromStorage();
    }

    await hydrateArchiveAndSeasonState();

    if (isCloudModeActive()) {
      fileBackedCustomItems = [];
      if (wardrobeCatalogueSource === "cloud" && wardrobeBase.length) {
        cloudBackedCustomItems = wardrobeBase.map((r) => (r && typeof r === "object" ? { ...r } : /** @type {any} */ (r)));
        stripCustomIdsFromLocalStorage(cloudBackedCustomItems.map((r) => String(r?.id ?? "")));
      } else {
        cloudBackedCustomItems = await loadWardrobeItemsFromCloud();
        if (cloudBackedCustomItems.length) {
          stripCustomIdsFromLocalStorage(cloudBackedCustomItems.map((r) => String(r?.id ?? "")));
          mergeWardrobeBaseWithFetchedCloudRows(cloudBackedCustomItems);
        }
      }
    } else {
      fileBackedCustomItems = await loadFileBackedCustomItems();
      cloudBackedCustomItems = [];
    }

    const pinnedSave = consumePinnedWardrobeSaveFromSession();
    if (pinnedSave) {
      upsertWardrobeBaseRowInMemory(pinnedSave);
      if (isCloudModeActive()) {
        const pinId = String(pinnedSave.id);
        cloudBackedCustomItems = [
          pinnedSave,
          ...cloudBackedCustomItems.filter((x) => String(x?.id ?? "") !== pinId),
        ];
      }
    }

    const hasStylingBoardUi = Boolean(
      document.getElementById("outfit-strip") || document.getElementById("styling-board-drawer")
    );

    mergeWardrobeFromSources();
    if (hasStylingBoardUi) {
      initStylingBoardFromStorage();
    }
    if (!items.length) {
      console.warn("No wardrobe items loaded.");
    }

    const seedSyncDeferredSnapshot = deferredSeedSyncSnapshot;
    deferredSeedSyncSnapshot = null;
    if (seedSyncDeferredSnapshot != null && isSupabaseReady()) {
      scheduleHomepageDeferredWork(() => {
        void (async () => {
          try {
            const report = await syncMissingRowsToSupabase(seedSyncDeferredSnapshot);
            if (report && ((report.synced ?? 0) > 0 || (report.failed ?? 0) > 0)) {
              console.info(
                `Supabase seed backfill (deferred): synced: ${report.synced}, failed: ${report.failed}.`
              );
            }
            if ((report?.synced ?? 0) > 0 && isCloudModeActive()) {
              await refreshCloudBackedCustomItems();
            }
          } catch (err) {
            console.warn("Deferred seed→cloud sync failed:", err);
          }
        })();
      });
    }

    const itemRoot = document.getElementById("item-detail-root");
    const hasArchiveGrid = Boolean(document.getElementById("grid"));
    const pageId = new URLSearchParams(globalThis.location.search).get("id");
    if (itemRoot && pageId && !hasArchiveGrid) {
      initItemDetailRootDelegates();
      initFilters();
      wireEvents();
      syncOutfitSaveButtonLabel();
      installItemPageBackNavigation();
      await runItemDetailPage(itemRoot, pageId);
      return;
    }

    normalizeArchiveTopLanding();
    consumeArchiveBrowseStateForReturn();
    initFilters();
    wireEvents();
    syncOutfitSaveButtonLabel();
    initAddItemForm();
    renderGrid();
    if (!hasStylingBoardUi) {
      renderOutfitStrip();
      renderSavedOutfits();
      syncOutfitBuilderPanel();
    }
    consumeAndRestoreArchiveListScroll();
    if (document.getElementById("local-data-risk-banner")) {
      installLocalDataRiskBanner();
    }
    installWardrobeTextLocalExportActions();
    if (document.body.classList.contains("home-page")) {
      const devAsset = globalThis.TW_DEV_ASSET;
      if (devAsset?.isLocalDev) {
        await devAsset.primeTokens([
          "images/season-duo/summer.png",
          "images/season-duo/winter.png",
          ...HOME_HERO_IMAGES,
        ]);
        devAsset.refreshDomImages();
      }
      renderEditorialLandingPage();
      devAsset?.refreshDomImages?.();
    }
    } finally {
      await completeTwInitialPageLoader(twLoaderPageStarted);
    }
  }

  void bootstrap();
})();
