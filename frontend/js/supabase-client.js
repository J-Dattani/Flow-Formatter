// [ADDED]: Step Auth - Initialize Supabase client for frontend usage
// This file exposes a global `supabase` client using your project's anon key.
// UI remains unchanged; this only wires authentication and future data calls.

(function initSupabase() {
  try {
    // Ensure the Supabase library is loaded (from CDN)
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      // In Supabase JS v2 via CDN, the global is `supabase`
      // However, if not present yet, we wait until DOMContentLoaded and retry
      document.addEventListener('DOMContentLoaded', initSupabase);
      return;
    }
  } catch (e) {
    // If any unexpected error, we retry after DOM is ready
    document.addEventListener('DOMContentLoaded', initSupabase);
    return;
  }

  // Helpers: configuration sources and (re)create client
  function readConfig() {
    // Priority: window overrides -> localStorage -> hardcoded fallback
    var w = window || {};
    var params = new URLSearchParams(location.search);
    var url = params.get('supaUrl') || w.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || 'https://pvrqhnmwbckyrzwxhftk.supabase.co';
    var key = params.get('supaAnon') || w.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cnFobm13YmNreXJ6d3hoZnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDYyMjQsImV4cCI6MjA3NTQ4MjIyNH0.usngzASPOkOKV9k6omPxCAy_inCi2fT7Gtp5pZiMfA4';
    return { url: url, key: key };
  }

  function createClient() {
    var cfg = readConfig();
    try {
   window.__supabaseClient = window.supabase.createClient(cfg.url, cfg.key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce", // helps with Netlify hosted apps
  },
  global: {
    headers: {
      "x-client-info": "flow-formatter",
    },
  },
});

      window.supabaseClient = window.__supabaseClient; // back-compat alias
      return true;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return false;
    }
  }

  // Expose a simple runtime reconfigure utility
  window.setSupabaseConfig = function(url, anonKey, persist) {
    if (persist) {
      try {
        if (url) localStorage.setItem('SUPABASE_URL', url);
        if (anonKey) localStorage.setItem('SUPABASE_ANON_KEY', anonKey);
      } catch (e) { /* ignore storage errors */ }
    } else {
      if (url) window.SUPABASE_URL = url;
      if (anonKey) window.SUPABASE_ANON_KEY = anonKey;
    }
    return createClient();
  };

  // Create the client now (or refresh if already present)
  createClient();
})();
