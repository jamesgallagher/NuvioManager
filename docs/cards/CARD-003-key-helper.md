# CARD-003: Anon key helper (bookmarklet), server settings and plain-HTTP fixes

| Field | Value |
|---|---|
| Card | CARD-003 |
| Title | Anon key helper (bookmarklet), server settings and plain-HTTP fixes |
| Size | M |
| Depends on | CARD-001 and CARD-002 (merged to `main`) |
| Repository | https://github.com/jamesgallagher/NuvioManager |
| Local folder | `C:\Users\james\OpenCode\Testing\NuvioManager` |
| Base branch | `main` |
| Work branch | `bob/card-003-key-helper` |
| PR title | `CARD-003: Anon key helper, server settings and plain-HTTP fixes` |

## 1. Project context

To sign in, the app needs the Nuvio Supabase **anon key** (a public client key; Nuvio's own web app ships it to every browser). The official repos do not publish it, so we do **not** hard-code it in this public repo or image. Today a user who has no key gets `A Supabase anon key is required` and has to dig the key out of DevTools. That is bad UX.

This card adds:

1. **A key helper**: a bookmarklet the user runs while on `nuvio.tv`. It finds the anon key in the page's own scripts (or, failing that, in the first request the page makes), and sends it back to this app in a URL **fragment** (`#nuvio-key=...`), which is never sent to any server. The app validates it and saves it in this browser.
2. **Server settings**: the saved key is a single app-wide default, not per account. Once set, adding an account is email + password only and the "Advanced" section stays hidden.
3. **Fixes for plain HTTP**: the app is served over plain HTTP on a LAN address (`http://192.168.0.148:8095`), which is not a "secure context". There `crypto.randomUUID` and `navigator.clipboard` are `undefined` (Claude confirmed this on the live page). Saving an account currently calls `crypto.randomUUID()` and would crash.

Security rules for the helper (these are hard rules, see also section 6): it reads **only** the anon key. It never reads cookies, `localStorage`, session tokens, passwords or form fields. It only ever hands back a JWT whose payload says `"role":"anon"`. A `service_role` key (or anything else) is ignored and never sent anywhere.

## 2. Goal

A user with no key opens **Get the key** in the app, drags the bookmarklet to the bookmarks bar, opens nuvio.tv, clicks it, lands back in the app with the key saved, and can then add an account with just email + password; the whole flow works on plain HTTP; `npm run lint`, `typecheck`, `test` and `build` pass.

## 3. Out of scope

Do **not**: hard-code or commit any real anon key or token (tests use fakes built in code, see 9.1); read or transmit session tokens, cookies or passwords; add a backend or any new network call from the app itself; add dependencies; change the Docker image, nginx config, workflows or the Unraid template; add routing libraries; change Tailwind classes of existing components (new components use the same style language); store the key anywhere other than `localStorage`; touch `CARD-001`/`CARD-002` files.

## 4. Tech and versions

Existing stack only. No new dependencies. React 19 blocks `javascript:` URLs in rendered `href` props, so the bookmarklet link must have its `href` set through a ref in an effect (`el.setAttribute('href', ...)`), not as a JSX prop.

## 5. Work items

One commit each, message in brackets.

### 5.1 Plain-HTTP safety (`CARD-003: work on plain HTTP (uuid and clipboard)`)

Files: `src/services/randomId.ts` (new), `src/services/accountStorage.ts`, `src/components/accounts/AddAccountModal.tsx`, `src/services/clipboard.ts` (new), tests.

- `makeId(): string`: returns `crypto.randomUUID()` when it exists, otherwise a UUID v4 built from `crypto.getRandomValues` (set the version and variant bits correctly: 13th hex digit `4`, 17th hex digit one of `8 9 a b`). Never uses `Math.random`. Replace both `crypto.randomUUID()` call sites.
- `copyText(text): Promise<boolean>`: uses `navigator.clipboard.writeText` when `window.isSecureContext && navigator.clipboard`, otherwise the fallback (hidden `<textarea>`, `select()`, `document.execCommand('copy')`, then remove it). Returns `true` on success, `false` on failure; never throws.

### 5.2 Server settings store and key validation (`CARD-003: server settings and anon key validation`)

Files: `src/services/serverSettings.ts` (new), `src/services/anonKey.ts` (new), `src/services/supabaseClient.ts`, `src/components/accounts/AddAccountModal.tsx`, `src/services/accountStorage.ts`, tests.

- `anonKey.ts`:
  - `decodeJwtPayload(token): Record<string, unknown> | null` (three base64url parts, JSON payload, never throws);
  - `validateAnonKey(token: string): { ok: true; key: string } | { ok: false; reason: 'format' | 'role' | 'expired' }`: trims; must be a well-formed JWT; payload `role` must be exactly `"anon"` (`service_role` or anything else → `role`); if `exp` is present and in the past → `expired`. Length limit 4096.
  - `maskKey(key): string` → first 8 characters + `…` + last 4 (never the whole key).
- `serverSettings.ts`: `localStorage` key `nuvio_server_settings_v1`, shape `{ supabaseAnonKey: string; savedAt: string }`. `loadServerSettings()`, `saveServerSettings(key)` (validates with `validateAnonKey`, throws `InvalidAnonKeyError` with the reason if not ok), `clearServerSettings()`. All three wrapped so a broken or blocked `localStorage` never throws (load returns `null`; save reports failure by throwing a clear `Error('Could not save settings in this browser')`).
- `supabaseClient.ts`: add `getDefaultAnonKey()`: saved server setting, else runtime config (CARD-002), else `VITE_SUPABASE_ANON_KEY`, else `''`. Keep the existing `DEFAULT_SUPABASE_ANON_KEY` export working (it may stay as the non-saved default) but every place that needs the *current* default (`AddAccountModal` initial state, `createDefaultAccount`) must call `getDefaultAnonKey()`. Per-account keys already stored on accounts are untouched and still win for that account.
- `AddAccountModal`: when `getDefaultAnonKey()` is non-empty, the **Advanced: Backend Server Configuration** section starts collapsed, as now, and a missing-key error is not shown. When it is empty, replace the bare `A Supabase anon key is required` with the same text **plus** a button/link `Get the key automatically` that closes the modal and opens the Get-the-key view (5.4). The `MissingAnonKeyError` message string must not change (CARD-001 tests assert it).

### 5.3 The helper script (`CARD-003: key helper bookmarklet script`)

Files: `src/helper/keyHelper.ts` (new), tests.

Write the helper as **one self-contained function** `nuvioKeyHelper(managerOrigin: string)` (no imports, no outer-scope variables, no TypeScript-only runtime helpers, so `fn.toString()` yields runnable code). Export:

- `buildHelperSource(managerOrigin: string): string` → `"(" + nuvioKeyHelper.toString() + ")(" + JSON.stringify(managerOrigin) + ")"`.
- `buildBookmarklet(managerOrigin): string` → `"javascript:" + encodeURIComponent(buildHelperSource(managerOrigin))`.
- Validate `managerOrigin` in both builders: must parse as an `http:` or `https:` URL; use only `url.origin`; otherwise throw `Error('Invalid manager origin')`.

Behaviour of `nuvioKeyHelper` when run on a page:

1. If `location.hostname` is not `nuvio.tv` or a subdomain of it, show `alert('Open nuvio.tv first, then click this bookmark again.')` and stop.
2. **Synchronously** (to keep the user gesture) open `window.open('about:blank', '_blank')` and keep the handle `w` (it may be `null` if blocked).
3. Find candidates: inline `<script>` text plus every same-origin `.js` URL from `performance.getEntriesByType('resource')` and `document.scripts[src]`; fetch each with `credentials: 'omit'`, at most 80 files, overall budget 8 seconds (`AbortController`); regex `/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g` over the text.
4. For each match decode the middle part (base64url → JSON). Keep only tokens whose payload has `role === 'anon'`. Ignore everything else **and never transmit it**. De-duplicate.
5. If at least one anon token is found: take the first, deliver it (step 7).
6. If none: install a one-time hook on `window.fetch` and `XMLHttpRequest.prototype.setRequestHeader` that watches for a header named `apikey` (case-insensitive) whose value is an anon token; tell the user with a non-blocking on-page banner (`Nuvio key helper: now reload or click around in Nuvio; I'll pick the key up from the next request.`). On capture, deliver it (step 7) and remove the hooks. After 90 seconds without a capture, remove the hooks and show `Could not find the key.`. The hook must call the original function with the original arguments unchanged and must not read request bodies, cookies or any other header.
7. Deliver: navigate the handle to `managerOrigin + '/#nuvio-key=' + encodeURIComponent(token)`; if `w` is null/closed, set `location.href` to the same URL instead.
8. Never write to `localStorage`/`sessionStorage`/cookies on nuvio.tv; never send the token anywhere except the fragment URL above; show one small banner in the page for success/failure and auto-remove it after 6 seconds.

Because the page might block a bookmarklet with its CSP, the app also offers the same source as a copy-paste console snippet (5.4).

### 5.4 Receiving the key, and the Get-the-key view (`CARD-003: receive key and Get-the-key view`)

Files: `src/services/keyHandoff.ts` (new), `src/hooks/useKeyHandoff.ts` (new), `src/components/settings/GetKeyView.tsx` (new), `src/components/common/NoAccountPlaceholder.tsx`, `src/components/settings/AccountSettingsView.tsx`, `src/App.tsx`, `src/components/layout/Sidebar.tsx` (only if needed to open the view), tests.

- `keyHandoff.ts`: `parseKeyHandoff(hash: string): { token: string } | null` accepts `#nuvio-key=<urlencoded token>` (also with other `&` params ignored); returns `null` for anything else.
- `useKeyHandoff()`: on mount, if `location.hash` parses as a handoff: run `validateAnonKey`; on ok call `saveServerSettings`; **always** remove the fragment from the address bar with `history.replaceState(null, '', location.pathname + location.search)` (also when invalid); return `{ result: null | { ok: true; masked: string } | { ok: false; reason } }` and a `dismiss()`.
- `App`: render a dismissible banner from the hook result (`Anon key saved (eyJhbGci…ab12). You can now sign in with just your email and password.` or a clear failure: `That key was not accepted (<reason in plain English>).`). Add the banner without changing the layout of existing components.
- `GetKeyView` (reachable from the no-account placeholder, from Settings, and from the AddAccountModal button in 5.2; implement it as a modal or an in-page panel, your choice, no router). It shows:
  1. current status: `Key saved: <masked>` with a **Remove** button (calls `clearServerSettings` after `window.confirm`), or `No key saved`;
  2. **Step 1:** a link labelled `Nuvio key helper` whose `href` is `buildBookmarklet(location.origin)`, set through a ref in an effect, with text `Drag this to your bookmarks bar`; clicking it in the app must do nothing (`preventDefault`);
  3. **Step 2:** `Open nuvio.tv, sign in if you like, then click the bookmark.` with a link to `https://nuvio.tv` (`target="_blank" rel="noopener noreferrer"`);
  4. **Step 3:** `You will come back here with the key saved.`;
  5. **If bookmarks are blocked:** a `Copy snippet` button using `copyText(buildHelperSource(location.origin))` with the instruction `Open nuvio.tv, press F12, open Console, paste, Enter`; show `Copied` or `Could not copy; select the text below` and also render the source in a read-only `<textarea>` for manual copy;
  6. **Manual paste:** a password-style text input + **Save key** that runs `validateAnonKey` and `saveServerSettings`, showing the failure reason in plain English.
  Explain in one sentence what the helper does: `It only looks for Nuvio's public client key on the nuvio.tv page. It does not read your login, cookies or passwords.`
- The `NoAccountPlaceholder` gets a secondary link `Need the Nuvio key? Get it automatically`. Keep its existing markup and classes otherwise.

### 5.5 Docs (`CARD-003: README key helper section`)

Add a short "Getting the Nuvio anon key" section to `README.md` (do not rewrite others): what the key is (public client key), why it is not shipped here, the three ways to supply it (helper, paste, `SUPABASE_ANON_KEY` env var for Docker/Unraid), and the helper's privacy rules. Update the Unraid template section text only if it mentions the key as required.

## 6. Guardrails

- No real key anywhere in the repo, tests, PR or handback. In tests build fake JWTs in code, for example `fakeJwt({ role: 'anon' })` that base64url-encodes a header and payload with a dummy signature, and name them clearly as fake.
- The helper script must be unable to leak anything else: a test (9.3) asserts the source contains no reference to `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB`, `password`, `Authorization` or `access_token`.
- A key whose role is not exactly `anon` is rejected everywhere (helper, fragment, manual paste).
- The fragment is always removed from the URL after handling, success or failure.
- No new network call from the app; the only network activity is the helper running on nuvio.tv fetching nuvio.tv's own scripts.
- Do not weaken the CARD-002 CSP or any nginx setting. (The app's CSP does not affect a bookmarklet running on nuvio.tv, and the helper source is only ever copied as text.)
- A refactor must not change behaviour: all 126 existing tests must still pass unedited (except the two `randomUUID` stubs in existing tests, which may be extended only if needed; list any edit under Deviations).
- If you are about to change something not named in this card, stop and ask under Blockers.

## 7. Steps

1. Start from the latest `main`:
   ```powershell
   cd C:\Users\james\OpenCode\Testing\NuvioManager
   git checkout main
   git pull origin main
   git checkout -b bob/card-003-key-helper
   npm ci
   ```
   After the pull `docs/cards/CARD-003-key-helper.md` must exist. If not, pull again; if still missing, stop and ask James.
2. Do 5.1 to 5.5 in order, one commit each. After each run `npm run lint`, `npm run typecheck`, `npm test`.
3. Run all of section 8.
4. Push and open the PR (section 10). Do not merge.
5. Wait for CI (`gh pr checks <number> --watch`): both `CI / build and test` and `Docker / build-and-push` must be green.
6. Send James the handback report (section 12).

## 8. Acceptance criteria

### 8.1 Commands

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; paste the vitest summary and per-file counts of the new test files.
- [ ] `git grep -nE "eyJ[A-Za-z0-9_-]{20,}" -- . ":!package-lock.json"` prints nothing (no real or realistic hard-coded key; tests build theirs in code).
- [ ] `git grep -nE "randomUUID" -- src ":!*.test.ts" ":!*.test.tsx"` shows only `src/services/randomId.ts`.
- [ ] `git grep -nE "document\.cookie|localStorage|sessionStorage" -- src/helper/keyHelper.ts` prints nothing.
- [ ] `git diff --name-only main...HEAD` lists only the files in 8.3.

### 8.2 Manual run (a browser, fakes only)

You have no real key. With `npm run dev` open `http://localhost:5173`, and for the plain-HTTP checks also serve the built app on a LAN address (`npm run build`, `npx vite preview --host`, open `http://<your-LAN-IP>:4173`):

- [ ] On the LAN-IP (non-secure) page, `typeof crypto.randomUUID` is `undefined` in the console and adding/saving an account (use a fake URL and fake key) does **not** throw.
- [ ] Open the Get-the-key view: the helper link is present, its `href` starts with `javascript:`, clicking it in the app does nothing; `Copy snippet` shows `Copied` (or the fallback message) on the non-secure page.
- [ ] Visit `http://localhost:5173/#nuvio-key=<a fake anon JWT built in the console>`: the banner shows a masked key, the address bar no longer has the fragment, and `localStorage.nuvio_server_settings_v1` exists. Repeat with a fake `service_role` JWT and with garbage: a failure banner, the fragment removed, nothing saved.
- [ ] After a key is saved, **Add account** opens without the missing-key error.

If you cannot run a step write `NOT RUN` and why; the unit tests are the main proof.

### 8.3 Repo

- [ ] Both GitHub checks green on the PR.
- [ ] Expected files only (anything else is a deviation):
  ```
  README.md
  src/App.tsx
  src/components/accounts/AddAccountModal.tsx
  src/components/common/NoAccountPlaceholder.tsx
  src/components/layout/Sidebar.tsx            (only if needed)
  src/components/settings/AccountSettingsView.tsx
  src/components/settings/GetKeyView.tsx
  src/components/settings/GetKeyView.test.tsx
  src/helper/keyHelper.ts
  src/helper/keyHelper.test.ts
  src/hooks/useKeyHandoff.ts
  src/hooks/useKeyHandoff.test.ts
  src/services/accountStorage.ts
  src/services/anonKey.ts
  src/services/anonKey.test.ts
  src/services/clipboard.ts
  src/services/clipboard.test.ts
  src/services/keyHandoff.ts
  src/services/keyHandoff.test.ts
  src/services/randomId.ts
  src/services/randomId.test.ts
  src/services/serverSettings.ts
  src/services/serverSettings.test.ts
  src/services/supabaseClient.ts
  src/services/supabaseClient.test.ts
  ```
  plus existing test files only if 9.5 says so. `package.json`, the lockfile, `Dockerfile`, `docker/`, `.github/` and `unraid/` must **not** change.

## 9. Tests (all required)

Mock nothing you can run for real. Use `vi.stubGlobal` for `crypto`, `navigator.clipboard`, `window.isSecureContext`, `fetch`; jsdom `localStorage`; fake timers where noted. A test helper `fakeJwt(payload)` builds `base64url(header).base64url(payload).fakesignature` in code.

### 9.1 `anonKey.test.ts`

1. `decodeJwtPayload`: valid token → object; not three parts, bad base64, non-JSON payload, empty string → `null`, no throw;
2. `validateAnonKey`: `role:'anon'` → ok with the trimmed key; `role:'service_role'` → `role`; `role:'authenticated'` → `role`; missing role → `role`; payload not JSON / two parts / empty → `format`; `exp` in the past → `expired`; `exp` in the future → ok; over 4096 characters → `format`; surrounding whitespace is trimmed;
3. `maskKey` shows exactly 8 + `…` + 4 and never contains the middle of the key; short input does not throw.

### 9.2 `serverSettings.test.ts`, `keyHandoff.test.ts`, `randomId.test.ts`, `clipboard.test.ts`, `supabaseClient.test.ts` (add)

- serverSettings: empty → `null`; save then load round-trips with `savedAt` as ISO time; saving a `service_role` or garbage key throws `InvalidAnonKeyError` with the reason and stores nothing; `clear` removes it; corrupt JSON in storage → load returns `null`; a throwing `localStorage` does not make load/clear throw.
- keyHandoff: `#nuvio-key=abc` → token `abc`; urlencoded token decoded; extra params ignored; `#other=1`, empty hash, `#nuvio-key=` → `null`.
- randomId: with `randomUUID` present it is used; with it removed (`undefined`) the fallback returns a valid v4 UUID (regex `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`); 1000 calls are all different; `Math.random` is never called (spy).
- clipboard: secure context uses `navigator.clipboard.writeText` and returns `true`; insecure context uses the textarea fallback, calls `document.execCommand('copy')`, removes the textarea and returns `true`; both failing returns `false` without throwing.
- supabaseClient: `getDefaultAnonKey()` precedence saved setting > runtime config > `VITE_` > `''` (use `vi.resetModules()` as in the existing precedence tests); an empty saved value does not win; existing `MissingAnonKeyError` tests still pass unedited.

### 9.3 `keyHelper.test.ts`

Run the generated source against a fake page: build the source with `buildHelperSource('http://192.168.0.148:8095')`, execute it with `new Function('window','document','location','performance','fetch','XMLHttpRequest','AbortController','alert', source)` style injection (or an equivalent harness you document), with fake globals.

1. **self-contained**: the source runs without `ReferenceError`; it contains no `__name(`, `import ` or `require(`;
2. **leak guard**: the source contains none of `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB`, `password`, `Authorization`, `access_token`;
3. **wrong host**: on `example.com` it calls `alert` with the `Open nuvio.tv first` text, opens no window, calls `fetch` zero times;
4. **found in a script**: a fake `nuvio.tv` page with two same-origin scripts, one containing a fake `anon` JWT and one a fake `service_role` JWT → the opened window's location becomes `http://192.168.0.148:8095/#nuvio-key=<the anon token>` and the `service_role` token appears **nowhere** in any URL, alert or call argument;
5. fetches use `credentials: 'omit'` and never more than 80 files;
6. **popup blocked**: `window.open` returns `null` → `location.href` is set to the same URL;
7. **no key in scripts**: installs the `fetch`/`XHR` hooks; a later request with header `apikey: <fake anon>` triggers delivery and the original function is still called with its original arguments; a request with a fake `service_role` apikey is ignored; hooks are removed after delivery and after the 90 s timeout (fake timers) with a `Could not find the key` banner;
8. banner element is added and removed after 6 s; nothing is written to storage or cookies;
9. `buildHelperSource` / `buildBookmarklet`: invalid origins (`ftp://x`, `javascript:alert(1)`, `not a url`, empty) throw `Invalid manager origin`; an origin with a path is reduced to its `origin`; `buildBookmarklet` starts with `javascript:` and decodes back to the source.

### 9.4 `useKeyHandoff.test.ts`, `GetKeyView.test.tsx`, `AddAccountModal` (add to the existing test file, do not edit existing tests)

- useKeyHandoff: a valid fragment saves the key, returns the masked result, and leaves the address without a fragment (`history.replaceState` called, `location.hash === ''`); a `service_role` fragment returns `{ok:false, reason:'role'}`, saves nothing, fragment removed; garbage fragment → failure, removed; no fragment → `result` null and `replaceState` not called; `dismiss()` clears the result.
- GetKeyView: shows `No key saved` / the masked saved key; **Remove** asks to confirm and clears; the helper link `href` starts with `javascript:` and contains the page origin (encoded); clicking the link calls `preventDefault`; `Copy snippet` shows `Copied` on success and the fallback text on failure and the textarea contains the helper source; manual paste: a valid fake anon key saves and shows the masked key, a `service_role` key shows a plain-English refusal and saves nothing, an empty input shows a message.
- AddAccountModal: with no key available the error text still contains `A Supabase anon key is required` and the `Get the key automatically` button is present and opens the view; with a saved server key the missing-key error does not appear and sign-in is attempted with that key (mocked client).

### 9.5 Existing tests

All 126 existing tests still pass. The only edits allowed to existing test files are to the `randomUUID` stubs in `accountStorage.test.ts` and `AddAccountModal.test.tsx` if needed for `makeId`; list each under Deviations.

## 10. Git and pull request

1. Branch from the latest `main` (step 1).
2. Five commits as named in section 5, messages `CARD-003: <what changed>`.
3. Before pushing, rerun 8.1.
4. Push: `git push -u origin bob/card-003-key-helper`
5. Open the PR into `main` titled `CARD-003: Anon key helper, server settings and plain-HTTP fixes`. Write the body to `C:\Users\james\OpenCode\Testing\temp\pr-body.md` (create the folder first: `New-Item -ItemType Directory -Force C:\Users\james\OpenCode\Testing\temp | Out-Null`) and run `gh pr create --base main --head bob/card-003-key-helper --title "CARD-003: Anon key helper, server settings and plain-HTTP fixes" --body-file C:\Users\james\OpenCode\Testing\temp\pr-body.md`. Body: `## Card`, `## What I did` (one line per 5.x), `## Acceptance criteria` (tick only what you ran and saw), `## Deviations from the card`, `## Blockers / questions`.
6. **Do not merge the PR.** Do not push to `main`. Do not tag. Claude reviews and merges.
7. Send James the handback report (section 12).

## 11. If something is wrong

If the card is wrong or a command fails in a way you cannot fix within scope: stop, commit what works, and describe it under "Blockers / questions". Paste the first error lines, not the whole log.

Known traps:

- **`fn.toString()` output uses helpers esbuild injects** (for example `__name`): keep the function simple (no decorators, no class fields, no object-spread helpers needing runtime support); the 9.3 test 1 catches this.
- **React blocks the `javascript:` href**: set it with `ref.current.setAttribute('href', …)` in an effect.
- **`navigator.clipboard` is undefined** on the LAN page: that is expected; use the fallback.
- **`crypto.randomUUID` is undefined** on the LAN page: that is the bug being fixed.
- **Bookmarklet blocked by the real site's CSP**: cannot be tested without a real key; the console snippet is the fallback. Do not try to bypass a CSP.
- **Do not log, print or store a token** in the console, the PR or the handback.
- **Temporary files** go in `C:\Users\james\OpenCode\Testing\temp\`, never `$env:TEMP`.
- **Every difference from the card is a deviation**, including comments and how you ran a check. A failing test is reported, not edited or skipped.
- **Say honestly what you did not verify**: you have no real key, so the helper has been proven only against fake pages.

## 12. Handback report (required)

When the PR is open and CI has finished, your **last message to James** must be the report below inside one fenced code block. Claude checks every line against the PR, CI and its own run, so write only what you actually saw. Real output only; `NOT RUN` plus the reason for anything not run; tick a box only if you ran it.

````text
Claude, here is Bob's handback for CARD-003. Please review and merge if it is good.

CARD: CARD-003 Anon key helper, server settings and plain-HTTP fixes
PR: <full PR URL>
Branch: bob/card-003-key-helper
Head commit: <output of `git rev-parse HEAD`>

Files changed (`git diff --name-only main...HEAD`):
<paste the list>

Commits (`git log --oneline main..HEAD`):
<paste>

Commands run, with real output:
- npm run lint -> <...>
- npm run typecheck -> <...>
- npm test -> <vitest summary + per-file counts for the new test files>
- npm run build -> <...>
- git grep for JWT-looking strings -> <output>
- git grep randomUUID (non-test) -> <output>
- git grep cookie/localStorage in keyHelper.ts -> <output>
- gh pr checks <number> -> <output, both checks>

Work items (5.1 to 5.5):
- [x] 5.1 <one line, or NOT DONE: reason>
- ...

Test cases from section 9 (list any NOT WRITTEN by number):
<None, or each>

Manual run (8.2): <each bullet with what you saw, or NOT RUN: reason>

Acceptance criteria:
- [x] <criterion> (ran it, output above)
- [ ] <criterion> NOT RUN: <reason>

Deviations from the card:
<None, or each one: file, what differs, why, and whether you verified the reason or are guessing>

Not verified (because there is no real key): <what you could not prove>

Outside the repo:
<None, or each change>

Questions / blockers:
<None, or each one>
````
