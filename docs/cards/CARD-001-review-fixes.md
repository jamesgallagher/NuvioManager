# CARD-001: Review fixes, hardening and refactor

| Field | Value |
|---|---|
| Card | CARD-001 |
| Title | Review fixes, hardening and refactor |
| Size | L |
| Depends on | Nothing (first card) |
| Repository | https://github.com/jamesgallagher/NuvioManager |
| Local folder | `C:\Users\james\OpenCode\Testing\NuvioManager` |
| Base branch | `main` |
| Work branch | `bob/card-001-review-fixes` |
| PR title | `CARD-001: Review fixes, hardening and refactor` |

## 1. Project context

Nuvio Remote Support Hub lets James manage someone else's Nuvio TV remotely through Nuvio's Supabase backend. It signs in (email+password or a pasted JWT), reads the installed addons (`addons` table), pulls the home layout (`sync_pull_home_catalog_settings`), lets the user show/hide/reorder/rename catalog rows, and pushes the layout back (`sync_push_home_catalog_settings`). Addons are pushed with `sync_push_addons`. Accounts are kept in `localStorage`.

Claude reviewed the first commit and found real bugs, two privacy problems and a god component. This card fixes all of them. Read the whole card before you start. The order of the work items matters: tests and pure-function fixes first, the refactor only after the logic is covered by tests.

Files you will touch most: `src/App.tsx`, `src/services/catalogService.ts`, `src/services/addonService.ts`, `src/services/supabaseClient.ts`, `src/services/accountStorage.ts`, `src/components/accounts/AddAccountModal.tsx`, `src/types/nuvio.ts`.

## 2. Goal

`npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass; pushing a catalog layout never drops remote items or resets `hide_unreleased_content`; no addon URL is ever sent to a third party; addon changes fail visibly and roll back; expired sessions refresh or ask the user to sign in again; stale responses cannot overwrite newer state; and `src/App.tsx` is a thin shell (under 150 lines) built from hooks, with the same behaviour as before apart from the fixes listed here.

## 3. Out of scope

Do **not**: add features; change the Supabase RPC names, parameters or table queries; change styling or Tailwind classes; reformat existing files or add Prettier; upgrade or add dependencies other than those listed in section 4; implement real Collections management (the Collections tab stays a placeholder, only moved to its own file); add routing, state libraries (Redux, Zustand, React Query) or a UI kit; add encryption of stored tokens; touch `package-lock.json` except as `npm install` requires for the listed dev dependencies; change the `localStorage` keys.

## 4. Tech and versions

Existing stack stays. Add **dev dependencies only**, current stable versions, pinned by the lockfile:

- `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`
- `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`

Scripts to add to `package.json`: `"typecheck": "tsc --noEmit"`, `"lint": "eslint src"`, `"test": "vitest run"`. Keep `dev`, `build`, `preview` as they are. Vitest config goes in `vite.config.ts` (`test: { environment: 'jsdom', globals: false }`); pure-function tests do not need jsdom but may run under it.

ESLint: flat config `eslint.config.js`, recommended sets for JS, TypeScript and react-hooks. Rules `@typescript-eslint/no-explicit-any` and `react-hooks/exhaustive-deps` are **errors**. If the existing code has lint errors other than those you are fixing in this card, fix only trivially-safe ones (unused imports); otherwise add a narrow `// eslint-disable-next-line <rule> -- <reason>` and list each one under "Deviations".

CI: add `.github/workflows/ci.yml` running on push to `main` and on pull requests: checkout, setup-node (Node 22, npm cache), `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Job name: `CI / build and test`.

## 5. Work items

Do them in this order, one commit per item (commit message in brackets). Section 7 lists the commands.

### 5.1 Tooling (`CARD-001: test, lint and CI tooling`)

Add the dev dependencies, scripts, `eslint.config.js`, vitest config, `.github/workflows/ci.yml`. Add one trivial passing smoke test so `npm test` is green before real tests land (delete it once 5.2 tests exist, or keep it if it is meaningful).

### 5.2 Catalog data-loss fixes (`CARD-001: preserve remote catalog items on push`)

Files: `src/services/catalogService.ts`, `src/types/nuvio.ts` (only if needed), `src/services/catalogService.test.ts`.

Problems: `enrichCatalogs` skips disabled addons and addons whose manifest failed, so their remote items have no rows and `buildSyncPayload` drops them on push; and `buildSyncPayload` hard-codes `hide_unreleased_content: false`.

Design (follow it; if you think it is wrong, raise it under Blockers rather than redesign):

- Change the signature to `buildSyncPayload(rows: EnrichedCatalogRow[], remotePayload: SyncHomeCatalogPayload | null): SyncHomeCatalogPayload`. Remove the old second parameter `hideUnreleasedContent`.
- `hide_unreleased_content` = `remotePayload?.hide_unreleased_content ?? false`.
- Output items = all `rows` in row order (`order` = index, exactly as today), **followed by** every remote item that is not a collection and whose `buildCatalogKey(addon_id, type, catalog_id)` does not equal the `key` of any row. These preserved items keep all their fields; their `order` continues the index sequence after the rows, in their original relative order (sort them by their original `order`, stable). Do not invent or alter fields on them.
- Collections are already rows (see `enrichCatalogs`), so they are never "preserved" a second time.
- Export a small helper `findUnmatchedRemoteItems(rows, remotePayload)` so it can be tested on its own.
- `App` (later `useRemoteData`) must keep the pulled `remotePayload` in state and pass it to `buildSyncPayload`. After a successful push, update that stored payload to the one pushed, so a second push without reloading is still correct.
- Do not change `enrichCatalogs` row behaviour (disabled addons stay hidden from the UI; failed-manifest addons produce no rows).

### 5.3 Manifest fetching: no third party, timeout, validation (`CARD-001: harden addon manifest fetching`)

Files: `src/services/catalogService.ts` (or move `fetchAddonManifest` and `isAddonManifest` into a new `src/services/manifestService.ts` and re-export from `catalogService.ts` so imports keep working), `src/services/addonService.ts`, tests.

- **Delete the `api.allorigins.win` fallback entirely.** No addon URL, and nothing derived from it, may be sent to any host other than the addon's own. Add a test that proves `fetch` is called exactly once, with the addon's own manifest URL, when it fails.
- Add a 10 second timeout using `AbortController` (make the timeout a parameter with a default so tests can use a small value). A timeout produces an error whose message contains `timed out`.
- Normalise the URL: trim; strip trailing slashes; append `/manifest.json` unless it already ends with it (case-insensitive); reject anything that is not `http:` or `https:` with an error containing `Invalid addon URL`. Export `normalizeManifestUrl(url)` and test it.
- Validate the response with a type guard `isAddonManifest(value): value is AddonManifest`: object; `id` and `name` non-empty strings; `types` an array of strings; `catalogs`, if present, an array of objects with string `id` and `type`. A response that fails throws `Invalid manifest from <url>`.
- In `fetchRemoteAddons`, limit manifest fetching to **5 at a time** (write a small `mapWithConcurrency(items, limit, fn)` helper in a new `src/services/concurrency.ts`; no library). Results keep the input order. The existing per-addon try/catch that records `error` on the addon stays.

### 5.4 Supabase client and auth (`CARD-001: supabase client, anon key, session refresh`)

Files: `src/services/supabaseClient.ts`, new `src/services/session.ts`, `src/services/accountStorage.ts`, `src/components/accounts/AddAccountModal.tsx`, tests.

- **No `'dummy-anon-key'`.** `getSupabaseClient` throws `MissingAnonKeyError` (exported class, message `A Supabase anon key is required`) when the key is empty after trimming. `AddAccountModal` must check this before it tries to authenticate and show the message in its existing error area.
- Client cache key includes the anon key: `${url}__${anonKey}__${accessToken || 'anon'}`. Export `evictClients(url?: string)` that removes cached clients (all, or those for that URL). Call it when an account is deleted and when an account's tokens change.
- Add a typed error `AuthExpiredError` (exported from `session.ts`, message `Session expired. Sign in again.`).
- Add `isAuthError(err: unknown): boolean` in `session.ts`: true for an object with `status === 401`, or `code === 'PGRST301'`, or a message matching `/jwt expired|invalid jwt|not authenticated/i`.
- Add `withSession<T>(account, fn: (client) => Promise<T>, onAccountUpdated: (a: ManagedAccount) => void): Promise<T>`:
  1. Run `fn` with `clientFor(account)` (see 5.6 for `clientFor`; for now a local helper is fine).
  2. If it throws an auth error and `account.refreshToken` exists: call `client.auth.refreshSession({ refresh_token })` on an **un-authenticated** client for that URL and anon key. On success build `{...account, accessToken, refreshToken}`, call `onAccountUpdated`, `evictClients(account.supabaseUrl)`, and retry `fn` **once** with the new account.
  3. If refresh fails, there is no refresh token, or the retry also fails with an auth error: throw `AuthExpiredError`.
  4. Non-auth errors pass through untouched. Never loop more than one retry.
- Every remote call in the app (load, push catalog, addon mutations) goes through `withSession` (done when you wire the hooks in 5.6).
- The UI shows `AuthExpiredError` as status `error` with the message and the account is marked as needing sign-in (Settings tab "Edit" still works; no new screens).
- Never `console.log` tokens, passwords, anon keys or full addon URLs. Existing `console.error` calls that print Supabase error objects stay.

### 5.5 Small services cleanups (`CARD-001: shared origin id and error helpers`)

- One `makeOriginClientId()` in `src/services/originClient.ts`: `nuvio-support-web-` + 8 random base36 characters (use `crypto.getRandomValues`, not `Math.random`). Replace both copies.
- `src/services/errors.ts`: `toErrorMessage(err: unknown, fallback: string): string`. Replace every `catch (err: any)` in `src` with `catch (err: unknown)` + `toErrorMessage`. No `any` remains in `src` (a repo-wide grep for `: any` and `as any` returns nothing, except in test files where a comment explains why).
- `src/services/catalogSignature.ts`: `catalogSignature(rows)` returning the same string `App.tsx` currently builds twice. Replace both uses.

### 5.6 Extract hooks and split `App.tsx` (`CARD-001: split App into hooks`)

This item is a **behaviour-preserving refactor**. Do it after 5.2 to 5.5 are committed and tested. New files:

- `src/services/clientFor.ts`: `clientFor(account: ManagedAccount): SupabaseClient` (wraps `getSupabaseClient` with the account's url, anon key and access token). Replace the five repeated call sites.
- `src/hooks/useAccounts.ts`: owns `accounts`, `activeAccount`, and the functions `selectAccount`, `selectProfile`, `saveAccount`, `deleteAccount`, `updateAccountTokens`. Uses functional `setState` updates so no stale `accounts` closure remains. Persists through `accountStorage`.
- `src/hooks/useRemoteData.ts`: owns `catalogs`, `addons`, `remotePayload`, `baselineSignature`, loading/saving/status/message, and `load`, `pushCatalogs`, `addAddon`, `toggleAddon`, `removeAddon`. This is where the fixes of 5.7 land.
- `src/hooks/useCatalogEditor.ts` (or functions inside `useRemoteData` if cleaner): `moveCatalog`, `toggleCatalog`, `updateTitle`, `enableAll`, `disableAll`, `hasUnsavedChanges`.
- `src/components/collections/CollectionsView.tsx`: the existing placeholder markup, moved unchanged.
- `src/components/common/NoAccountPlaceholder.tsx` and `LoadingPlaceholder.tsx` for the two inline blocks (markup and classes unchanged).
- `src/App.tsx`: composes the above; **under 150 lines**; same props passed to the existing components as today (add props only where 5.7/5.8 requires).

### 5.7 Behaviour fixes inside the hooks (`CARD-001: remote data race, rollback and unsaved-change guards`)

Files: the hooks from 5.6, `src/App.tsx`, `src/components/settings/AccountSettingsView.tsx` (delete confirmation), tests.

1. **No fake data.** Delete the Cinemeta fallback. If `fetchRemoteAddons` throws, `load` sets status `error` with the message, leaves `catalogs` and `addons` empty, and does **not** continue to pull the catalog layout. Per-addon manifest failures are still just recorded on that addon (unchanged).
2. **Stale responses.** Each `load` call takes an incrementing request id (a `useRef` counter). After every `await`, if the id is no longer the latest, return without setting state. Changing account or profile also invalidates in-flight loads. `isLoading` is only cleared by the latest request.
3. **Clear old data on switch.** When the account id or profile id changes, `catalogs`, `addons`, `remotePayload` and the baseline are cleared synchronously before the new load starts, so the loading view shows and the previous account's rows are never visible under the new account's name.
4. **Unsaved changes guard.** If `hasUnsavedChanges` is true, then switching account, switching profile, pressing Refresh, or "Reset" in the catalog bar first calls `window.confirm('Discard unsaved catalog changes?')`; cancel does nothing. Put the guard in one function `confirmDiscard(): boolean` in the hook, injectable (`confirm` option defaulting to `window.confirm`) so tests do not need the real dialog. Add a `beforeunload` listener while `hasUnsavedChanges` is true; remove it otherwise and on unmount.
5. **Addon mutations (add, toggle, remove).**
   - Run through a **single serial queue** (a promise chain in a `useRef`), so two quick toggles produce two ordered pushes built from the latest list, never overlapping.
   - Optimistic update first; if the push fails, **roll back** to the previous addon list, set status `error` with the message, and do not call `load`.
   - `addAddon(url)`: normalise with `normalizeManifestUrl`; if an addon with the same normalised URL already exists, reject with `This addon is already installed` and do not push. Fetch the manifest first; a bad manifest rejects before any push (the modal/form already shows errors from a rejected promise; check `AddonManager.tsx` and keep that behaviour).
   - After a successful add or remove, `load` runs as today.
   - No unhandled promise rejections: every handler's promise is caught inside the hook.
6. **Accounts.** `deleteAccount` asks `window.confirm('Delete this account from this browser?')` (injectable like above) in `AccountSettingsView`'s handler path; on delete call `evictClients`, clear the stored active id if it was this account, and select the first remaining account (and persist it) or none. `saveAccount` persists the active account id via `setActiveAccountId`. If the saved account is the active one, `activeAccount` is replaced with the saved object so profile lists are not stale.
7. A successful push sets status `success` for 4 seconds; clear that timer on unmount and when a new status is set (today the timer can clear a later error message).

### 5.8 Docs and accessibility (`CARD-001: docs and aria labels`)

- `README.md`: add a "Security and privacy" section: tokens and the anon key are stored in plain text in this browser's `localStorage`; use a trusted browser profile; "Delete account" removes them; addon URLs are only ever requested from their own host (no proxy); the app needs a Supabase anon key. Add the new `npm` scripts. Do not rewrite other sections.
- `.env.example`: comment that `VITE_SUPABASE_ANON_KEY` is required.
- Add `aria-label` (and `title` where missing) to every icon-only `<button>` in `src/components` (grep for buttons whose only child is a `lucide-react` icon). Text and classes unchanged.
- Replace the hard-coded `top-[61px]` sticky offset in `CatalogManager` only if you can do it without changing the rendered result (for example a CSS variable on the header height); if not, leave it and say so under "Deviations".

## 6. Guardrails (the short list)

- Do not change Supabase RPC names/params or the shape of data sent to them, except as 5.2 describes for the payload contents.
- A refactor commit (5.6) must not change behaviour. If a test written in 5.2 to 5.5 needs editing during 5.6, stop and explain in Blockers.
- Never send addon URLs, tokens, emails or passwords anywhere new. No new network calls at all.
- No new dependencies beyond section 4. No lockfile churn beyond those.
- Do not run `npm audit fix`, `npm update` or any formatter over the repo.
- Never commit `.env`, tokens or real account data. Tests use fake values like `https://example.invalid` and `test-anon-key`.
- If you are about to change something not named in this card, stop and ask under Blockers.

## 7. Steps

1. Start from the latest `main` and create the branch (the card file must exist after the pull; if it does not, run `git pull origin main` again, and if still missing, stop and ask James):
   ```powershell
   cd C:\Users\james\OpenCode\Testing\NuvioManager
   git checkout main
   git pull origin main
   git checkout -b bob/card-001-review-fixes
   npm ci
   npm run build
   ```
   Note whether `npm run build` passes **before** your changes; report it in the handback.
2. Do 5.1 to 5.8 in order, one commit each. After each commit run `npm run lint`, `npm run typecheck`, `npm test` (the first one has no tests until 5.1 adds the smoke test).
3. Run all of section 8.
4. Push and open the PR (section 10). Do not merge.
5. Wait for CI: `gh pr checks <number> --watch`.
6. Send James the handback report (section 12).

## 8. Acceptance criteria

Never put a real password, token, anon key or email in the PR or the handback.

### 8.1 Commands

- [ ] `npm ci` ends without errors.
- [ ] `npm run lint` exits 0 with no warnings about `any` or `exhaustive-deps`.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0; paste the final summary lines (test files and tests passed).
- [ ] `npm run build` exits 0.
- [ ] `git grep -nE ": any|as any|<any>" -- src ":!*.test.ts" ":!*.test.tsx"` prints nothing.
- [ ] `git grep -nE "allorigins|dummy-anon-key|Math\.random" -- src` prints nothing.
- [ ] `(Get-Content src\App.tsx | Measure-Object -Line).Lines` is under 150.

### 8.2 Manual run (the app, with fakes)

You have no real Nuvio account, so use the built app with a throwaway local mock where noted. Do not use James's real credentials. Run `npm run dev`, open `http://localhost:5173`, and check:

- [ ] With no accounts, the "No Managed Account Selected" view shows; **Add Account** with an empty anon key shows `A Supabase anon key is required` and makes no network request (check the browser Network tab or `read_network_requests`).
- [ ] No request to `api.allorigins.win` appears at any point.
- [ ] Add an account with a fake URL (`http://localhost:9`): the app shows an error status, an empty list, no Cinemeta row.
- [ ] Deleting an account shows the confirm dialog; cancel keeps it; OK removes it and `localStorage.getItem('nuvio_active_account_id_v1')` no longer holds the deleted id.

If you cannot run the browser steps, write `NOT RUN` with the reason; do not tick them. The unit tests in section 9 are the main proof.

### 8.3 Repo

- [ ] `git status` is clean after your last commit; `.env`, `node_modules`, `dist` are not tracked.
- [ ] GitHub Actions `CI / build and test` is green on the PR (`gh pr checks <number> --watch`).
- [ ] `git diff --name-only main...HEAD` lists only files under: `src/`, `.github/workflows/ci.yml`, `eslint.config.js`, `vite.config.ts`, `package.json`, `package-lock.json`, `README.md`, `.env.example`. Anything else is a deviation.
- [ ] `src/services/` and `src/hooks/` import nothing from `src/components/`.

## 9. Tests (all required)

Tests use Vitest. Mock `fetch` with `vi.stubGlobal('fetch', vi.fn())`. Mock Supabase clients with plain objects (`{ rpc: vi.fn(), from: vi.fn(), auth: {...} }`); never call the network. Hook tests use `@testing-library/react` `renderHook`/`act`. Inject `confirm` and timers (`vi.useFakeTimers`) instead of touching real dialogs.

### 9.1 `src/services/catalogService.test.ts`

`buildCatalogKey`: trims and lower-cases `type`, trims `catalogId`.

`enrichCatalogs`:
1. rows from two addons come out sorted by remote `order`, then reindexed 0..n-1;
2. a catalog with `extra: [{name:'search', isRequired:true}]` is skipped; one with optional search is kept;
3. a disabled addon produces no rows; an addon with no manifest produces no rows;
4. a remote setting sets `enabled`, `customTitle`, `order`; a catalog with no remote setting gets `enabled: true` and sorts last;
5. remote collections become rows with `isCollection: true` and `collectionId`.

`buildSyncPayload` / `findUnmatchedRemoteItems` (the data-loss fix):
6. rows only, `remotePayload` null → items equal rows, `hide_unreleased_content` false;
7. `remotePayload.hide_unreleased_content === true` → pushed payload has `true`;
8. a remote item for a disabled addon (no row) is **kept** with its original `enabled`, `custom_title`, and appended after the rows with consecutive `order`;
9. a remote item for an addon whose manifest failed is kept the same way;
10. two preserved items keep their original relative order;
11. a remote item that matches a row is **not** duplicated;
12. a collection is not duplicated and not treated as unmatched;
13. a row's `customTitle` is trimmed; collection rows send empty `addon_id`, `type`, `catalog_id`;
14. round trip: `enrichCatalogs` then `buildSyncPayload` with no edits produces items equal (as a set of key fields) to the remote payload, nothing lost, nothing added.

### 9.2 `src/services/manifestService.test.ts` (or `catalogService.test.ts` if not split)

`normalizeManifestUrl`: adds `/manifest.json`; keeps an existing one (also `MANIFEST.JSON`); strips trailing slashes and whitespace; keeps a query string intact; rejects `ftp://x`, `javascript:alert(1)` and `not a url` with `Invalid addon URL`.

`fetchAddonManifest`:
1. success returns the manifest;
2. HTTP 404 throws and `fetch` was called **exactly once**, with the addon's own URL (assert the called URL; assert no URL contains `allorigins`);
3. network error throws, still one call;
4. invalid JSON / manifest missing `id` / `types` not an array / `catalogs` item without `type` each throw `Invalid manifest`;
5. a fetch that never resolves times out with a message containing `timed out` (small timeout, fake timers; the `AbortSignal` is passed to `fetch`).

`concurrency.test.ts`: `mapWithConcurrency` never runs more than `limit` at once (track a counter), returns results in input order, propagates the fn's rejection, handles an empty array.

### 9.3 `src/services/addonService.test.ts`

1. `fetchRemoteAddons` sorts by `sort_order`, defaults `enabled` to true, adds `manifest` on success and `error` (not a throw) on a failed manifest; filters by `user_id` only when given;
2. a Supabase error from the table query is thrown;
3. with 12 addons, manifest fetches never exceed 5 concurrent;
4. `pushRemoteAddons` sends `sort_order` equal to array index, `enabled` default true, `name` falling back to the manifest name then `''`, and an `nuvio-support-web-` origin id.

### 9.4 `src/services/supabaseClient.test.ts` and `session.test.ts`

1. empty / whitespace anon key throws `MissingAnonKeyError`; no client is created;
2. same url+key+token returns the cached instance; a different anon key returns a different instance; `evictClients(url)` makes the next call create a new one;
3. `isAuthError`: true for `{status:401}`, `{code:'PGRST301'}`, `new Error('JWT expired')`; false for a 500, a plain network error, `null`, a string;
4. `withSession`: success passes through; non-auth error passes through with no refresh attempt; auth error + refresh token → refresh called once, `onAccountUpdated` called with the new tokens, retry called once and its result returned; refresh fails → `AuthExpiredError`; no refresh token → `AuthExpiredError` with no refresh call; retry fails with auth error → `AuthExpiredError` and exactly 2 calls to `fn`.

### 9.5 `src/services/accountStorage.test.ts`

load returns `[]` on empty, on invalid JSON; save then load round-trips; active id get/set; `createDefaultAccount` fills defaults and keeps passed values (use jsdom `localStorage`, clear between tests). `originClient.test.ts`: id has the prefix, 8 base36 chars, two calls differ. `errors.test.ts`: `toErrorMessage` for `Error`, string, object with `message`, `null`, with the fallback. `catalogSignature.test.ts`: same rows → same string; changing `enabled`, `order` or `customTitle` changes it; changing an unrelated field (`addonLogo`) does not.

### 9.6 `src/hooks/useAccounts.test.ts`

1. loads accounts and selects the stored active id, else the first, else none;
2. `saveAccount` adds a new one, replaces an existing one, makes it active and persists the active id; two `saveAccount` calls in one `act` both survive (no stale closure);
3. `selectProfile` updates only the active account's `activeProfileId` and persists;
4. `deleteAccount`: confirm cancelled → nothing changes; confirmed → removed, clients evicted, next account selected and its id persisted; deleting the last account leaves none and clears the stored active id; deleting a non-active account keeps the active one;
5. `updateAccountTokens` replaces tokens in state and storage.

### 9.7 `src/hooks/useRemoteData.test.ts`

Mock the service modules (`vi.mock`).

1. load success: addons and catalogs set, baseline set, `hasUnsavedChanges` false;
2. addons fetch throws → status `error`, `catalogs` and `addons` empty, `pullRemoteCatalogSettings` **not called**, no Cinemeta in state;
3. a failed addon manifest only marks that addon; others load;
4. stale response: start load A (slow), switch account, load B (fast) resolves, then A resolves → state is B's data, `isLoading` false;
5. switching account/profile clears catalogs, addons, remotePayload before the new data arrives;
6. edits: toggle, rename, move (including to the same index and out of range → no change), enable all, disable all; `hasUnsavedChanges` flips true and back to false when the edit is undone;
7. unsaved guard: with changes and `confirm` → false, `selectAccount`/`selectProfile`/`refresh`/`reset` do nothing; with `confirm` → true they proceed; with no changes `confirm` is never called; `beforeunload` listener is added only while there are unsaved changes and removed on unmount;
8. push: calls `pushRemoteCatalogSettings` with a payload built from rows **and** the stored remote payload (assert a preserved item and `hide_unreleased_content` are present); on success baseline updates and `hasUnsavedChanges` false; a second push still includes the preserved items; on failure status `error`, baseline unchanged;
9. addon toggle failure rolls the list back and sets status `error`; toggle success pushes the full list in order;
10. two toggles started back-to-back produce two pushes in order, the second built from the first's result (assert call order and payloads);
11. adding an addon whose normalised URL already exists rejects with `already installed`, no push; adding with a failing manifest rejects, no push; success pushes, then reloads;
12. remove failure rolls back;
13. auth: a push that hits an auth error triggers one refresh and a retry (via mocked `withSession` or mocked client) and `updateAccountTokens` is called; `AuthExpiredError` surfaces as status `error` with `Session expired. Sign in again.`;
14. the 4 second success timer does not clear a later error message (fake timers) and is cleared on unmount.

### 9.8 Component tests (keep to these three)

- `src/components/accounts/AddAccountModal.test.tsx`: submit with an empty anon key shows `A Supabase anon key is required` and calls no auth function; password flow with a mocked client stores user id and tokens in the saved account; token flow with a bad token shows an error.
- `src/components/catalogs/CatalogManager.test.tsx`: search, addon, type and status filters narrow the list; reordering while filtered passes the **master** index to `onMove`; the unsaved banner shows only when `hasUnsavedChanges`.
- `src/components/settings/AccountSettingsView.test.tsx`: delete asks to confirm (via the injected/spied `window.confirm`) before calling `onDeleteAccount`.

A test that is hard to write because the code is hard to test is a sign the code needs a small change; make the smallest one, and list it under "Deviations".

## 10. Git and pull request

1. Start from the latest `main` (step 1).
2. Commit in the eight small commits named in section 5. Message format: `CARD-001: <what changed>`.
3. Before pushing, run all of 8.1 again.
4. Push: `git push -u origin bob/card-001-review-fixes`
5. Open a PR into `main` titled `CARD-001: Review fixes, hardening and refactor`. Write the body to `C:\Users\james\OpenCode\Testing\temp\pr-body.md` (create the folder first: `New-Item -ItemType Directory -Force C:\Users\james\OpenCode\Testing\temp | Out-Null`) and run `gh pr create --base main --head bob/card-001-review-fixes --title "CARD-001: Review fixes, hardening and refactor" --body-file C:\Users\james\OpenCode\Testing\temp\pr-body.md`. Body:
   ```markdown
   ## Card
   docs/cards/CARD-001-review-fixes.md

   ## What I did
   - one line per work item 5.1 to 5.8

   ## Acceptance criteria
   - [x] npm ci / lint / typecheck / test / build — output: ...
   - [x] grep checks (any, allorigins, dummy key, Math.random) — output: empty
   - [x] App.tsx line count — output: NNN
   - [x] manual run — results (or NOT RUN: reason)
   - [x] CI check green
   - [x] only expected files changed

   ## Deviations from the card
   None. (Or list each one and why.)

   ## Blockers / questions
   None. (Or list them.)
   ```
   Only tick a box if you ran the command and saw that output.
6. **Do not merge the PR.** Do not push to `main`. Claude reviews and merges.
7. Send James the handback report (section 12).

## 11. If something is wrong

If the card is wrong, impossible, or a command fails in a way you cannot fix within the card's scope: stop, do not improvise a different design, commit what works, and describe the problem under "Blockers / questions" in the PR. Paste the first error lines, not the whole log.

Known traps:

- **`npm run build` fails on `main` before your changes**: record the first error lines in the handback and fix only what is needed to make the build pass; list it as a deviation.
- **ESLint reports many existing errors**: do not mass-fix. Fix unused imports and the `any`/hooks-deps ones this card names; for the rest, prefer a narrow disable with a reason, and list them.
- **`react-hooks/exhaustive-deps` on the old `useEffect`**: the hook rewrite in 5.6/5.7 is the fix; do not silence it.
- **jsdom has no `crypto.randomUUID` / `crypto.getRandomValues`**: Node 22 provides `globalThis.crypto`; if a test environment lacks it, stub it in a test setup file and list that file.
- **A 5.2 test fails after the 5.6 refactor**: you changed behaviour. Revert the refactor step that broke it; do not edit the test.
- **Supabase types complain about the mock clients**: cast the mock once through `unknown` inside the test helper (`as unknown as SupabaseClient`); that is the one allowed cast in tests.
- **Temporary files** go in `C:\Users\james\OpenCode\Testing\temp\`, never `$env:TEMP`. List them under "Outside the repo".
- **Every difference from the card is a deviation**, in any file, including tests, comments and how you ran a check. If you explain why something happened, say whether you checked it or are guessing.
- **A test fails**: do not change the test to make it pass, and do not skip it. Report it.

## 12. Handback report (required)

When the PR is open, your **last message to James** must be the handback report below, inside one fenced code block so James can copy it in one go and paste it to Claude. Claude checks every line against the PR, the CI logs and its own test run, so write only what you actually saw.

Rules:

- Every command line shows the **real** output you saw, copied, not retyped from the card. If you did not run a command, write `NOT RUN` and the reason. Never write the expected output from the card as if you saw it.
- "Deviations" lists every way your files differ from the card, including comments, wording and whitespace. If you think the card is wrong, quote the exact card line and say what is wrong with it.
- "Outside the repo" lists anything you changed on James's PC outside the repo folder. Write `None` if there was nothing.
- List the number of tests per test file (copy the vitest summary).

The report, filled in:

````text
Claude, here is Bob's handback for CARD-001. Please review and merge if it is good.

CARD: CARD-001 Review fixes, hardening and refactor
PR: <full PR URL>
Branch: bob/card-001-review-fixes
Head commit: <output of `git rev-parse HEAD`>
Build on main before changes: <pass / fail + first error lines>

Files changed (`git diff --name-only main...HEAD`):
<paste the list>

Commits (`git log --oneline main..HEAD`):
<paste>

Commands run, with real output:
- npm ci -> <key lines>
- npm run lint -> <key lines>
- npm run typecheck -> <key lines>
- npm test -> <vitest summary: files, tests, per-file counts>
- npm run build -> <key lines>
- git grep for any / allorigins / dummy-anon-key / Math.random -> <output>
- App.tsx line count -> <number>
- gh pr checks <number> -> <output>

Work items (5.1 to 5.8):
- [x] 5.1 <one line, or NOT DONE: reason>
- ... one line each

Test cases from section 9 (list any NOT WRITTEN, by number):
<None, or each>

Acceptance criteria:
- [x] <criterion> (ran it, output above)
- [ ] <criterion> NOT RUN: <reason>

Manual run (8.2): <what you saw, or NOT RUN: reason>

Deviations from the card:
<None, or each one: file, what differs, why>

Outside the repo:
<None, or each change>

Questions / blockers:
<None, or each one>
````
