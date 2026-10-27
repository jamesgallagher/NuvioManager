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

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server on `http://localhost:5173`. |
| `npm run build` | Type-check and build the production bundle. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint over `src/`. |
| `npm run typecheck` | Run `tsc --noEmit`. |
| `npm test` | Run the Vitest suite. |

---

## Security and privacy

- Tokens (access and refresh) and the Supabase anon key are stored in **plain text** in this browser's `localStorage`. Use a trusted browser profile; anyone with access to that profile can read them.
- **"Delete account"** removes the account and its stored tokens from this browser.
- Addon URLs are only ever requested from **their own host** (no proxy, no third party).
- The app needs a Supabase **anon key** to connect; without it, account setup is rejected.

---

## Docker and Unraid

The app is a static build served by a small non-root nginx container. The image is published to GitHub Container Registry automatically whenever a PR is merged to `main`.

**Image and tags:** `ghcr.io/jamesgallagher/nuvio-manager`
- `latest` — the newest build of `main` (or the newest version tag).
- `sha-xxxxxxx` — immutable, one per commit.
- `X.Y.Z` and `X.Y` — from `vX.Y.Z` git tags.

**Run it:**
```bash
docker run -d --name nuvio-manager \
  -p 8095:8080 \
  -e SUPABASE_URL=https://api.nuvio.tv \
  -e SUPABASE_ANON_KEY=your-anon-key \
  ghcr.io/jamesgallagher/nuvio-manager:latest
```

**Environment variables:**
- `SUPABASE_URL` — the default Supabase API URL pre-filled when adding an account.
- `SUPABASE_ANON_KEY` — the default Supabase anon (public) key pre-filled when adding an account.

These only pre-fill defaults; you can still enter a URL and key per account in the app. All data stays in your browser — nothing is stored on the server.

**Installing on Unraid:**
1. Copy `unraid/my-nuvio-manager.xml` to `/boot/config/plugins/dockerMan/templates-user/`.
2. In the Unraid UI, go to the **Docker** tab, click **Add Container**, and pick the **Nuvio Manager** template.

**Security:** the app handles Supabase tokens, so serve it only on a trusted network or behind your own HTTPS reverse proxy.

---

## Extensibility

The codebase is built with modular services ready to be extended:
- `src/services/catalogService.ts`: Home catalog synchronization RPCs.
- `src/services/addonService.ts`: Addon installation and management.
- `src/services/supabaseClient.ts`: Supabase client factory and credentials.
- Future modules can easily add tabs for Collections (`sync_push_collections`), Profile settings (`sync_push_profile_settings_blob`), and Provider credentials (`sync_push_provider_credentials`).
