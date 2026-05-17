/**
 * Local dev: bust browser cache for project `images/` assets (same path after file replace).
 * Loaded before hero preload on the homepage.
 */
(function (global) {
  const isLocalDev =
    typeof location !== "undefined" &&
    /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);

  /** @type {Map<string, string>} */
  const tokenByPath = new Map();
  /** @type {Map<string, Promise<string>>} */
  const pendingByPath = new Map();

  function isLocalImagesPath(url) {
    const s = String(url ?? "").trim();
    if (!s || /^https?:\/\//i.test(s) || s.startsWith("data:")) return false;
    return /^(?:\/)?images\//i.test(s);
  }

  function normalizePath(url) {
    let raw = String(url ?? "").trim().split("?")[0].split("#")[0];
    if (!raw) return "";
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* keep raw */
    }
    return raw.replace(/^\//, "");
  }

  function requestPathForKey(key) {
    const encoded = key
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `/${encoded}`;
  }

  function withToken(path, token) {
    if (!token || !path) return path;
    const base = String(path).split("?")[0];
    const params = new URLSearchParams(String(path).includes("?") ? String(path).split("?")[1] : "");
    params.set("v", token);
    return `${base}?${params}`;
  }

  /**
   * @param {string} path
   * @returns {Promise<string>}
   */
  function fetchToken(path) {
    const key = normalizePath(path);
    if (!key) return Promise.resolve("");
    const cached = tokenByPath.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = pendingByPath.get(key);
    if (pending) return pending;

    const job = fetch(requestPathForKey(key), { method: "HEAD", cache: "no-store" })
      .then((r) => {
        const etag = r.headers.get("ETag");
        const lm = r.headers.get("Last-Modified");
        const tok = etag
          ? etag.replace(/^"|"$/g, "")
          : lm && !Number.isNaN(Date.parse(lm))
            ? String(Date.parse(lm))
            : "";
        if (tok) tokenByPath.set(key, tok);
        return tok;
      })
      .catch(() => "")
      .finally(() => {
        pendingByPath.delete(key);
      });

    pendingByPath.set(key, job);
    return job;
  }

  /**
   * @param {string} url
   * @returns {Promise<string>}
   */
  async function bustUrl(url) {
    if (!isLocalDev || !isLocalImagesPath(url)) return url;
    const token = await fetchToken(url);
    return token ? withToken(url, token) : url;
  }

  /**
   * @param {string} url
   */
  function bustKnownUrl(url) {
    if (!isLocalDev || !isLocalImagesPath(url)) return url;
    const token = tokenByPath.get(normalizePath(url));
    return token ? withToken(url, token) : url;
  }

  /**
   * @param {ParentNode} [root]
   */
  function refreshDomImages(root) {
    if (!isLocalDev) return;
    const scope = root && "querySelectorAll" in root ? root : document;
    scope.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      if (!isLocalImagesPath(src)) return;
      void bustUrl(src).then((next) => {
        if (next && next !== img.getAttribute("src")) img.src = next;
      });
    });
  }

  /**
   * @param {string[]} paths
   */
  async function primeTokens(paths) {
    if (!isLocalDev) return;
    const list = [...new Set((paths || []).map((p) => normalizePath(p)).filter(Boolean))];
    await Promise.all(list.map((p) => fetchToken(p)));
  }

  global.TW_DEV_ASSET = {
    isLocalDev,
    bustUrl,
    bustKnownUrl,
    refreshDomImages,
    primeToken: fetchToken,
    primeTokens,
  };
})(typeof window !== "undefined" ? window : globalThis);
