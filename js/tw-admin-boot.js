/**
 * Runs in <head> before paint — keeps admin UI out of public layout (no flash).
 */
(function () {
  var admin = false;
  try {
    var h = location.hostname;
    var localDev = h === "localhost" || h === "127.0.0.1" || h === "[::1]";
    admin = localDev;
    if (localDev && /(?:^|[?&])admin=true(?:&|$)/.test(location.search)) {
      localStorage.setItem("adminMode", "true");
    }
  } catch (e) {
    /* private mode */
  }
  var root = document.documentElement;
  if (admin) root.classList.add("tw-admin-mode");
  else root.classList.remove("tw-admin-mode");
})();
