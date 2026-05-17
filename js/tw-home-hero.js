/**
 * Early homepage hero pick + preload (runs in <head> before paint).
 * Keeps sessionStorage in sync with app.js `pickHomeHeroImagePath`.
 */
(async function () {
  const FALLBACK_HOME_HERO_IMAGES = [
    "images/heroes/hero-country-classics.png",
    "images/heroes/hero-editorial-01.png",
    "images/heroes/hero-editorial-02.png",
  ];
  const HOME_HERO_IMAGES =
    Array.isArray(window.TW_HOME_HERO_IMAGES) && window.TW_HOME_HERO_IMAGES.length
      ? window.TW_HOME_HERO_IMAGES
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
    const bust = window.TW_DEV_ASSET?.bustKnownUrl?.(encoded);
    return bust || encoded;
  }

  function pickHomeHeroImagePath() {
    try {
      const cached = sessionStorage.getItem(HOME_HERO_STORAGE_KEY);
      if (cached && HOME_HERO_IMAGES.indexOf(cached) !== -1) return cached;
    } catch (_) {
      /* ignore */
    }
    const hero = HOME_HERO_IMAGES[Math.floor(Math.random() * HOME_HERO_IMAGES.length)];
    try {
      sessionStorage.setItem(HOME_HERO_STORAGE_KEY, hero);
    } catch (_) {
      /* ignore */
    }
    return hero;
  }

  const hero = pickHomeHeroImagePath();
  let href = homeHeroMediaUrl(hero);
  if (window.TW_DEV_ASSET?.isLocalDev && window.TW_DEV_ASSET.bustUrl) {
    href = await window.TW_DEV_ASSET.bustUrl(hero);
  }
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = isHomeHeroVideoPath(hero) ? "video" : "image";
  link.href = href;
  if (!isHomeHeroVideoPath(hero)) link.setAttribute("fetchpriority", "high");
  link.setAttribute("data-tw-hero-preload", hero);
  document.head.appendChild(link);

  /* Other carousel slides are warmed after mount via app.js `preloadHomeHeroImage`. */
})();
