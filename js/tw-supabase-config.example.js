/**
 * Copy to `tw-supabase-config.js` (or edit the committed stub) and paste
 * **Project URL** + **anon public** key from Supabase → Settings → API.
 * Never put the service_role key here.
 */
globalThis.__TW_SUPABASE_URL__ = "https://yyzrzmbsxphlhoqzikjn.supabase.co";
globalThis.__TW_SUPABASE_ANON_KEY__ = "YOUR_ANON_PUBLIC_KEY";

/** Google accounts allowed to edit (must match `wardrobe_editors` in Supabase). */
window.APP_CONFIG = {
  SUPABASE_URL: globalThis.__TW_SUPABASE_URL__,
  SUPABASE_ANON_KEY: globalThis.__TW_SUPABASE_ANON_KEY__,
  SITE_ORIGIN: "https://timeless-wardrobe.vercel.app",
  EDITOR_ALLOWED_EMAILS: ["you@gmail.com"],
};
