/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Runtime config written by the container's entrypoint (or the static
 * `public/config.js` in dev). Values may be absent or non-string; the app
 * treats anything that is not a non-empty string as unset.
 */
interface NuvioRuntimeConfig {
  SUPABASE_URL?: unknown;
  SUPABASE_ANON_KEY?: unknown;
}

interface Window {
  __NUVIO_CONFIG__?: NuvioRuntimeConfig;
}

declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
