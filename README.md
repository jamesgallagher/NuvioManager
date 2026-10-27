# Nuvio Remote Support Hub

A dedicated remote management application for **Nuvio TV**. Manage catalog layouts (show/hide, reorder, rename), addons, and configurations across remote installations and managed devices without needing to be on their local network.

---

## Features

- **Multi-Account Switching:** Easily store and switch between managed accounts with individual profile selection.
- **Home Catalog Management:**
  - **Show / Hide Catalogs:** Instantly toggle any catalog row on or off with live visual feedback.
  - **Re-order Catalogs:** Send catalogs to top/bottom or nudge up/down.
  - **Custom Rename:** Rename catalog rows (e.g. rename "Cinemeta - Top Movies" to "Featured Movies").
  - **Bulk Actions:** Quick "Show All", "Hide All", or "Reset".
  - **Push to TV:** Pushes the layout directly to Nuvio's backend via `sync_push_home_catalog_settings` RPC.
- **Remote Addon Manager:** Inspect installed Stremio addons, toggle them on/off, or install new addons remotely.
- **Direct Supabase Integration:** Connects to official Nuvio (`https://api.nuvio.tv`), with support for custom/self-hosted instances.

---

## How It Works

1. **Authentication:** Authenticate using the account's email/password or paste a session JWT token from `nuvio.tv`.
2. **Catalog Discovery:** The app queries installed addons from Supabase, fetches each addon's `manifest.json`, and extracts available catalog descriptors.
3. **Layout Sync:** It pulls the current remote layout using `sync_pull_home_catalog_settings`.
4. **Push:** When you click **Push Changes to TV**, it formats a `SyncHomeCatalogPayload` and calls `sync_push_home_catalog_settings`.
5. **On the TV:** Next time the remote TV opens or restarts Nuvio TV (or on next sync), the TV pulls the new layout and updates immediately!

---

## Getting Started

### 1. Configure Environment
Copy `.env.example` to `.env` and set your values:
```bash
cp .env.example .env
```

### 2. Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Production Build
```bash
npm run build
npm run preview
```

---

## Extensibility

The codebase is built with modular services ready to be extended:
- `src/services/catalogService.ts`: Home catalog synchronization RPCs.
- `src/services/addonService.ts`: Addon installation and management.
- `src/services/supabaseClient.ts`: Supabase client factory and credentials.
- Future modules can easily add tabs for Collections (`sync_push_collections`), Profile settings (`sync_push_profile_settings_blob`), and Provider credentials (`sync_push_provider_credentials`).
