/**
 * Route-level catalogue theme — runs before paint on collection/item pages.
 * Prevents OS dark-mode tokens from flashing before app.js bootstrap.
 *
 * `?mobile=1` (or `?viewport=mobile`) pins layout viewport to 390px and sets
 * `html.tw-preview-mobile` so narrow-layout CSS matches real phones in IDE previews.
 */
(function twPageThemeBoot() {
  const params = new URLSearchParams(String(globalThis.location?.search ?? ""));
  const forceMobilePreview =
    params.get("mobile") === "1" || params.get("viewport") === "mobile";
  if (forceMobilePreview) {
    const root = document.documentElement;
    root.classList.add("tw-preview-mobile");
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "viewport");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "width=390, initial-scale=1, viewport-fit=cover"
    );
  }

  const path = String(globalThis.location?.pathname ?? "");
  const isHome = path === "/" || path === "" || /\/index\.html$/i.test(path);
  if (isHome) return;
  const root = document.documentElement;
  root.classList.add("theme-catalogue");
  root.style.colorScheme = "light";
  const body = document.body;
  if (body) body.classList.add("theme-catalogue");
})();
