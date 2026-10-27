# CARD-002: Docker image, GHCR publishing and Unraid template

| Field | Value |
|---|---|
| Card | CARD-002 |
| Title | Docker image, GHCR publishing and Unraid template |
| Size | M |
| Depends on | CARD-001 (merged to `main`) |
| Repository | https://github.com/jamesgallagher/NuvioManager |
| Local folder | `C:\Users\james\OpenCode\Testing\NuvioManager` |
| Base branch | `main` |
| Work branch | `bob/card-002-docker-unraid` |
| PR title | `CARD-002: Docker image, GHCR publishing and Unraid template` |

## 1. Project context

Nuvio Manager is a static single-page app (Vite build output in `dist/`). All state lives in the user's browser (`localStorage`); the app talks to Supabase and to addon hosts directly from the browser. There is no server component, so the container is just a small web server for static files.

James runs an Unraid server and wants to host the app there from a Docker image published automatically to GitHub Container Registry (GHCR) whenever a PR is merged to `main`. Claude does the deployment to the server, the GitHub settings and the release tag after this card is merged; **you only change files in the repo**. You do not touch the Unraid server, GitHub settings, or create tags or releases.

Already in the repo (made by Claude, do not change): `unraid/nuvio-manager-icon.svg` and `unraid/nuvio-manager-icon.png` (the logo).

Image name: `ghcr.io/jamesgallagher/nuvio-manager` (lowercase). Container port: **8080** (unprivileged nginx). Unraid host port default: **8095**.

## 2. Goal

`docker build` produces a small image that serves the app on port 8080 as a non-root user, with runtime-configurable default Supabase URL and anon key; a GitHub Actions workflow builds and pushes it to GHCR on every push to `main` (tags `latest` and `sha-<short>`), and on version tags `vX.Y.Z` (tags `X.Y.Z`, `X.Y` and `latest`); an Unraid template `unraid/my-nuvio-manager.xml` has every field filled in; `npm run lint`, `typecheck`, `test` and `build` pass with the new tests.

## 3. Out of scope

Do **not**: touch the Unraid server, GitHub repo settings, package visibility, secrets or tags; add dependencies; change app behaviour other than reading the runtime config (5.1); add a backend, database or volume; add docker-compose files; change existing tests; reformat existing files; edit `CARD-001-review-fixes.md`.

## 4. Tech and versions

- Build stage: `node:22-alpine`, `npm ci`, `npm run build`.
- Runtime stage: `nginxinc/nginx-unprivileged:1.27-alpine` (non-root, listens on 8080). Pin the tag as written; do not use `latest`.
- Actions (use these major versions): `actions/checkout@v4`, `docker/setup-qemu-action@v3`, `docker/setup-buildx-action@v3`, `docker/login-action@v3`, `docker/metadata-action@v5`, `docker/build-push-action@v6`.
- Platforms for pushed images: `linux/amd64,linux/arm64`.

## 5. Work items

One commit each, message in brackets.

### 5.1 Runtime config in the app (`CARD-002: runtime config for default Supabase URL and anon key`)

Files: `public/config.js` (new), `index.html`, `src/services/runtimeConfig.ts` (new), `src/services/supabaseClient.ts`, `src/vite-env.d.ts` (add the `window.__NUVIO_CONFIG__` type), tests.

- `public/config.js` contains exactly `window.__NUVIO_CONFIG__ = {};` (used by `npm run dev` and as the file Vite copies into `dist/`; in the container nginx serves a generated one instead, see 5.2).
- `index.html`: add `<script src="/config.js"></script>` **before** the app's module script.
- `src/services/runtimeConfig.ts`: `getRuntimeConfig(): { supabaseUrl?: string; supabaseAnonKey?: string }` reads `window.__NUVIO_CONFIG__` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), trims, treats empty strings and non-strings as unset, never throws (also when `window` has no config).
- `supabaseClient.ts`: `DEFAULT_SUPABASE_URL` = runtime config, else `import.meta.env.VITE_SUPABASE_URL`, else `https://api.nuvio.tv`. `DEFAULT_SUPABASE_ANON_KEY` = runtime config, else `import.meta.env.VITE_SUPABASE_ANON_KEY`, else `''`. Precedence is runtime > build-time > built-in default. Keep `MissingAnonKeyError` behaviour unchanged. Because the constants are evaluated at import time, `config.js` must load first (that is why the script tag is placed before the module script).

### 5.2 Container (`CARD-002: Dockerfile and nginx config`)

New files: `Dockerfile`, `.dockerignore`, `.gitattributes`, `docker/nginx.conf`, `docker/40-runtime-config.sh`.

- `.gitattributes`: `*.sh text eol=lf`, `Dockerfile text eol=lf`, `docker/*.conf text eol=lf`. (A CRLF shell script breaks the container on Linux.)
- `.dockerignore`: `node_modules`, `dist`, `.git`, `.github`, `docs`, `*.md` except nothing needed by the build, `.env*`, `unraid`, `*.log`, `coverage`. The image must never contain a `.env`.
- `Dockerfile`: multi-stage as in section 4. Build stage copies `package.json` and `package-lock.json` first (layer cache), `npm ci`, then the rest, `npm run build`. Runtime stage copies `dist/` to `/usr/share/nginx/html`, `docker/nginx.conf` to `/etc/nginx/conf.d/default.conf`, `docker/40-runtime-config.sh` to `/docker-entrypoint.d/40-runtime-config.sh` (executable). `EXPOSE 8080`. `USER` stays non-root (the base image's `nginx` user). `HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1`. OCI labels: `org.opencontainers.image.source=https://github.com/jamesgallagher/NuvioManager`, `...description`, `...title`.
- `docker/nginx.conf` (one `server` block listening on 8080):
  - `location = /healthz` returns `200 ok` (`default_type text/plain`).
  - `location = /config.js` serves `/tmp/config.js` (`alias /tmp/config.js;`) with `Cache-Control: no-store`. (The html dir is read-only for the non-root user, so the generated file lives in `/tmp`.)
  - `location /assets/` long cache: `Cache-Control: public, max-age=31536000, immutable`.
  - `location /` with `try_files $uri /index.html;` and `Cache-Control: no-cache` on `index.html`.
  - gzip on for text, JS, CSS, JSON, SVG.
  - Headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and a `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src * data: blob:; font-src 'self' data:; connect-src *; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. (`connect-src *` is deliberate: the app calls Supabase and arbitrary addon hosts. Do not "tighten" it.) If the smoke test in 5.3 shows the CSP breaks the built app (for example the Vite build needs an inline script), relax only the failing directive and list it under Deviations.
  - `server_tokens off`.
- `docker/40-runtime-config.sh` (POSIX `sh`, `set -eu`): writes `/tmp/config.js` containing `window.__NUVIO_CONFIG__ = {"SUPABASE_URL":"<v>","SUPABASE_ANON_KEY":"<v>"};` from the env vars `SUPABASE_URL` and `SUPABASE_ANON_KEY` (either may be unset or empty, in which case write an empty string). Values must be **JSON-escaped** (backslash, double quote, and control characters such as newline and tab) so a bad value cannot break out of the string or inject script; also escape `<` as `\u003c` so the value can never close a script context. Do not print the values to the log (print only whether each is set). `/tmp/config.js` must be created even when both are unset.

### 5.3 Test the container build in CI and locally (`CARD-002: docker smoke test`)

- `docker/smoke-test.sh` (POSIX `sh`): given an image name argument, runs it detached on a free host port, waits up to 20 s for `/healthz`, then asserts: `GET /` is 200 and contains `<div id="root">`; `GET /healthz` is 200 `ok`; `GET /config.js` is 200 and contains `__NUVIO_CONFIG__`; `GET /some/spa/route` is 200 (SPA fallback); `GET /assets/<any built js file>` is 200 with `immutable`; response headers contain the CSP and `nosniff`; `GET /config.js` is `no-store`; the container runs as a non-root user (`docker exec <id> id -u` is not `0`); then a second run with `-e SUPABASE_URL='https://x.example/"; alert(1);//'  -e SUPABASE_ANON_KEY='a"b\c'` whose `/config.js` parses as valid JSON after stripping the `window.__NUVIO_CONFIG__ = ` prefix and trailing `;` (use `node -e` or `python3 -c` available on the runner) and round-trips both values exactly. Always removes its containers on exit (trap). Exits non-zero on the first failed assertion with a clear message.
- You may run it locally if Docker Desktop is installed (`docker version`); if not, write `NOT RUN` and rely on CI (step 5.4 runs it). Do not install Docker.

### 5.4 GitHub Actions workflow (`CARD-002: build and publish image to GHCR`)

New file `.github/workflows/docker.yml`, workflow name `Docker`, job `build-and-push`. Do **not** change `ci.yml`.

- Triggers: `push` to `main`; `push` of tags matching `v*.*.*`; `pull_request` to `main`; `workflow_dispatch`.
- `permissions: contents: read, packages: write` on the job. `concurrency` group per workflow and ref, `cancel-in-progress: true` only for pull requests.
- Env `IMAGE: ghcr.io/${{ github.repository_owner }}/nuvio-manager` (the owner must be lowercased: compute it in a step, `tr '[:upper:]' '[:lower:]'`, because GHCR rejects uppercase).
- Steps:
  1. checkout; setup-qemu; setup-buildx.
  2. **Smoke test build** (all events): `docker/build-push-action` with `platforms: linux/amd64`, `load: true`, `push: false`, tag `nuvio-manager:ci`, GitHub cache (`cache-from: type=gha`, `cache-to: type=gha,mode=max`). Then run `sh docker/smoke-test.sh nuvio-manager:ci`.
  3. Login to GHCR with `${{ github.actor }}` and `${{ secrets.GITHUB_TOKEN }}`: **only** when the event is not `pull_request`.
  4. `docker/metadata-action` for the lowercased image: tags `type=raw,value=latest,enable={{is_default_branch}}`, `type=sha,format=short,prefix=sha-`, `type=semver,pattern={{version}}`, `type=semver,pattern={{major}}.{{minor}}`; and **also** `latest` on version tags: add `type=raw,value=latest,enable=${{ startsWith(github.ref, 'refs/tags/v') }}`. Add OCI labels `org.opencontainers.image.title=Nuvio Manager` and a description.
  5. Build and push (`push: true`) for `linux/amd64,linux/arm64` only when the event is not `pull_request`, using the metadata tags and labels and the same cache.
- A PR run must never push and must never need the login. Nothing in the workflow may print secrets. Do not add a `latest` tag on pull requests.
- Add a comment block at the top explaining the tag policy in three lines: `latest` always points at the newest build of `main` or the newest version tag; `sha-xxxxxxx` is immutable per commit; `X.Y.Z` and `X.Y` come from `vX.Y.Z` git tags.

### 5.5 Unraid template (`CARD-002: Unraid template`)

New file `unraid/my-nuvio-manager.xml`, Unraid Docker template version 2, with **every** field below filled in, no empty advanced fields. Use these values exactly:

| Element | Value |
|---|---|
| `Name` | `Nuvio Manager` |
| `Repository` | `ghcr.io/jamesgallagher/nuvio-manager:latest` |
| `Registry` | `https://github.com/jamesgallagher/NuvioManager/pkgs/container/nuvio-manager` |
| `Network` | `bridge` |
| `Shell` | `sh` |
| `Privileged` | `false` |
| `Support` | `https://github.com/jamesgallagher/NuvioManager/issues` |
| `Project` | `https://github.com/jamesgallagher/NuvioManager` |
| `ReadMe` | `https://github.com/jamesgallagher/NuvioManager#readme` |
| `Overview` | 2 to 4 sentences: remote management web app for Nuvio TV (catalog order, visibility, titles and addons across managed accounts); no data is stored on the server, accounts are kept in the browser; XML-escape special characters; no marketing fluff |
| `Category` | `Tools: Utilities:` |
| `WebUI` | `http://[IP]:[PORT:8095]/` |
| `TemplateURL` | `https://raw.githubusercontent.com/jamesgallagher/NuvioManager/main/unraid/my-nuvio-manager.xml` |
| `Icon` | `https://raw.githubusercontent.com/jamesgallagher/NuvioManager/main/unraid/nuvio-manager-icon.png` |
| `ExtraParams` | `--health-cmd=none` is **not** wanted; leave `<ExtraParams/>` empty (the image has its own HEALTHCHECK) |
| `PostArgs`, `CPUset`, `MyIP`, `Requires`, `TailscaleStateDir` | present as empty self-closing elements, as Unraid writes them |
| `Changes` | a short first entry: `### 2026-10-28` / `- Initial release` |
| `DonateText`, `DonateLink` | omit (no donations) |

`Config` entries (all `Display="always"`, `Required` as stated, `Mask="false"`):

1. Port: Name `WebUI Port`, Target `8080`, Default `8095`, Mode `tcp`, Type `Port`, Required `true`, Description `Port for the Nuvio Manager web interface.`, value `8095`.
2. Variable: Name `Supabase URL`, Target `SUPABASE_URL`, Default `https://api.nuvio.tv`, Type `Variable`, Required `false`, Description `Default Supabase API URL pre-filled when adding an account. Leave as is for official Nuvio.`, value `https://api.nuvio.tv`.
3. Variable: Name `Supabase anon key`, Target `SUPABASE_ANON_KEY`, Default empty, Type `Variable`, Required `false`, Description `Default Supabase anon (public) key pre-filled when adding an account. It can also be entered per account in the app.`, value empty.

There is no volume: the app is stateless. Do not add a Path config.

### 5.6 Docs (`CARD-002: README docker and unraid section`)

Add a "Docker and Unraid" section to `README.md` (do not rewrite other sections): image name and tags (`latest`, `sha-xxxxxxx`, `X.Y.Z`); a `docker run -d --name nuvio-manager -p 8095:8080 -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... ghcr.io/jamesgallagher/nuvio-manager:latest` example with placeholders; the two env vars and that they only pre-fill defaults; that data stays in the browser; how to install on Unraid (copy `unraid/my-nuvio-manager.xml` to `/boot/config/plugins/dockerMan/templates-user/`, then Docker tab, Add Container, pick the template); a security note that the app should be served only on a trusted network or behind your own HTTPS reverse proxy because it handles Supabase tokens. Add to `.env.example`: a comment that Docker uses `SUPABASE_URL` / `SUPABASE_ANON_KEY` at runtime instead.

## 6. Guardrails

- Never put a real anon key, token, password or account email anywhere (tests and examples use `https://example.invalid` and `test-anon-key`).
- No change to app behaviour beyond 5.1. If `npm test` fails because of 5.1, fix 5.1, not the old tests.
- Do not add `npm` dependencies. Test XML with the DOM already available in jsdom (`DOMParser`).
- Shell scripts and the Dockerfile must have LF line endings (check with `git ls-files --eol`).
- The image must run as non-root and must not need a volume or any write access except `/tmp`.
- Pushing is only done by the workflow after merge; do not run a `docker push` yourself and do not create tags.
- If you are about to change something not named in this card, stop and ask under Blockers.

## 7. Steps

1. Start from the latest `main`:
   ```powershell
   cd C:\Users\james\OpenCode\Testing\NuvioManager
   git checkout main
   git pull origin main
   git checkout -b bob/card-002-docker-unraid
   npm ci
   ```
   After the pull, `docs/cards/CARD-002-docker-unraid.md` and `unraid/nuvio-manager-icon.png` must exist. If not, pull again; if still missing, stop and ask James.
2. Do 5.1 to 5.6 in order, one commit each. After 5.1 run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
3. Run all of section 8.
4. Push and open the PR (section 10). Do not merge. Do not tag.
5. Wait for CI (`gh pr checks <number> --watch`): both `CI / build and test` and `Docker / build-and-push` must be green.
6. Send James the handback report (section 12).

## 8. Acceptance criteria

### 8.1 Commands

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all exit 0; paste the vitest summary lines.
- [ ] `git ls-files --eol docker Dockerfile .gitattributes` shows `w/lf` for `Dockerfile`, `docker/*.sh` and `docker/nginx.conf`.
- [ ] `docker build -t nuvio-manager:local .` succeeds and `sh docker/smoke-test.sh nuvio-manager:local` passes **or** both are `NOT RUN: no Docker installed` (CI then covers it; say so).
- [ ] No `.env` file or `node_modules` is in the image: `docker run --rm --entrypoint sh nuvio-manager:local -c "ls -a /usr/share/nginx/html"` shows only built files (or `NOT RUN`).
- [ ] `git grep -nE "latest" .github/workflows/docker.yml` shows the tag policy as described; paste the lines.
- [ ] `git diff --name-only main...HEAD` lists only the files in section 8.3.

### 8.2 XML

- [ ] `unraid/my-nuvio-manager.xml` parses as XML (the test in section 9 proves it) and each row in the 5.5 table is present with the exact value; list any difference under Deviations.

### 8.3 Repo

- [ ] Both GitHub checks green on the PR (`CI / build and test`, `Docker / build-and-push`).
- [ ] Expected files only (anything else is a deviation):
  ```
  .dockerignore
  .env.example
  .gitattributes
  .github/workflows/docker.yml
  Dockerfile
  README.md
  docker/40-runtime-config.sh
  docker/nginx.conf
  docker/smoke-test.sh
  index.html
  public/config.js
  src/services/runtimeConfig.ts
  src/services/runtimeConfig.test.ts
  src/services/supabaseClient.ts
  src/services/supabaseClient.test.ts
  src/vite-env.d.ts
  src/unraid/template.test.ts
  unraid/my-nuvio-manager.xml
  ```
  (`package.json` and the lockfile must **not** change.)

## 9. Tests (all required)

### 9.1 `src/services/runtimeConfig.test.ts`

1. no `window.__NUVIO_CONFIG__` → both unset, no throw;
2. config with both values → returned, trimmed;
3. empty string, whitespace-only and non-string values (number, null, object) → unset;
4. only one of the two set → the other unset.

### 9.2 `src/services/supabaseClient.test.ts` (add to the existing file; do not edit existing tests)

Use `vi.resetModules()` and a dynamic import after setting `window.__NUVIO_CONFIG__` and `vi.stubEnv`:
1. runtime config wins over `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`;
2. with no runtime config the `VITE_` values are used;
3. with neither, the URL is `https://api.nuvio.tv` and the anon key is `''`;
4. an empty runtime value falls through to the build-time value.

### 9.3 `src/unraid/template.test.ts`

Read `unraid/my-nuvio-manager.xml` with `node:fs`, parse with `DOMParser` (`application/xml`, assert no `parsererror`):
1. root `Container` with `version="2"`;
2. every element in the 5.5 table has exactly the value given (exact string match, not "contains"), and none of `Name`, `Repository`, `Registry`, `Support`, `Project`, `ReadMe`, `Overview`, `Category`, `WebUI`, `TemplateURL`, `Icon`, `Changes` is empty;
3. `WebUI` contains `[IP]` and `[PORT:8095]`, and `[PORT:8095]` equals the port config's `Default`;
4. `Icon` URL ends in `nuvio-manager-icon.png` and the file exists at `unraid/nuvio-manager-icon.png`; the `TemplateURL` path ends in `unraid/my-nuvio-manager.xml` (so it cannot drift from the real file name);
5. exactly three `Config` entries with the Names, Targets, Types, Defaults and Required flags from 5.5; no `Type="Path"`;
6. `Repository` matches `^ghcr\.io/jamesgallagher/nuvio-manager:latest$` and contains no uppercase.

### 9.4 Shell and workflow checks (not Vitest, run by CI through the smoke test)

`docker/smoke-test.sh` is itself the test for the nginx config, the entrypoint script and the non-root requirement (everything listed in 5.3). In the handback paste the final lines of its output (or `NOT RUN`).

## 10. Git and pull request

1. Branch from the latest `main` (step 1).
2. Six commits as named in section 5, messages `CARD-002: <what changed>`.
3. Before pushing, rerun the commands of 8.1.
4. Push: `git push -u origin bob/card-002-docker-unraid`
5. Open the PR into `main` titled `CARD-002: Docker image, GHCR publishing and Unraid template`. Write the body to `C:\Users\james\OpenCode\Testing\temp\pr-body.md` (create the folder first: `New-Item -ItemType Directory -Force C:\Users\james\OpenCode\Testing\temp | Out-Null`) and run `gh pr create --base main --head bob/card-002-docker-unraid --title "CARD-002: Docker image, GHCR publishing and Unraid template" --body-file C:\Users\james\OpenCode\Testing\temp\pr-body.md`. Body: `## Card` (path), `## What I did` (one line per 5.x), `## Acceptance criteria` (tick only what you ran and saw), `## Deviations from the card`, `## Blockers / questions`.
6. **Do not merge the PR.** Do not push to `main`. Do not create tags or releases. Claude reviews, merges, then deploys.
7. Send James the handback report (section 12).

## 11. If something is wrong

If the card is wrong or a command fails in a way you cannot fix within scope: stop, commit what works, and describe it under "Blockers / questions". Paste the first error lines, not the whole log.

Known traps:

- **Container exits immediately / `exec format error` or `not found` on the entrypoint script**: CRLF line endings. Check `git ls-files --eol`; fix with `.gitattributes` and re-add the file.
- **nginx cannot write the pid or cache directories**: the unprivileged image already handles `/tmp`; do not switch to the root `nginx` image.
- **`/config.js` returns the SPA `index.html`**: the `location = /config.js` block must be before `location /`, and `/tmp/config.js` must exist (the entrypoint script runs only if executable; set the executable bit with `git update-index --chmod=+x docker/40-runtime-config.sh` and in the Dockerfile `chmod +x`).
- **White page in the container but fine in `npm run dev`**: usually the CSP. Look at the browser console / `curl -I`; relax only the failing directive and list it.
- **GHCR rejects the tag**: the image name had an uppercase letter.
- **QEMU arm64 build is slow or fails**: first confirm the amd64 smoke build is green; if only arm64 fails, report the first error lines under Blockers and do not drop the platform on your own.
- **Do not run `docker push`, `gh release`, `git tag` or change repository settings.**
- **Temporary files** go in `C:\Users\james\OpenCode\Testing\temp\`, never `$env:TEMP`.
- **Every difference from the card is a deviation**, including comments and how you ran a check. A failing test is reported, not edited.

## 12. Handback report (required)

When the PR is open and CI has finished, your **last message to James** must be the report below inside one fenced code block. Claude checks every line against the PR, CI and its own run, so write only what you actually saw. Real output only; `NOT RUN` plus the reason for anything not run; tick a box only if you ran it.

````text
Claude, here is Bob's handback for CARD-002. Please review and merge if it is good.

CARD: CARD-002 Docker image, GHCR publishing and Unraid template
PR: <full PR URL>
Branch: bob/card-002-docker-unraid
Head commit: <output of `git rev-parse HEAD`>
Docker available locally: <yes (docker version output) / no>

Files changed (`git diff --name-only main...HEAD`):
<paste the list>

Commits (`git log --oneline main..HEAD`):
<paste>

Commands run, with real output:
- npm run lint -> <...>
- npm run typecheck -> <...>
- npm test -> <vitest summary, per-file counts for the three new test files>
- npm run build -> <...>
- git ls-files --eol docker Dockerfile .gitattributes -> <...>
- docker build -t nuvio-manager:local . -> <last lines or NOT RUN>
- sh docker/smoke-test.sh nuvio-manager:local -> <last lines or NOT RUN>
- image contents check -> <output or NOT RUN>
- tag policy lines from docker.yml -> <paste>
- gh pr checks <number> -> <output, both checks>

Work items (5.1 to 5.6):
- [x] 5.1 <one line, or NOT DONE: reason>
- ...

Test cases from section 9 (list any NOT WRITTEN by number):
<None, or each>

Acceptance criteria:
- [x] <criterion> (ran it, output above)
- [ ] <criterion> NOT RUN: <reason>

Template values: <confirm each row of the 5.5 table matches, or list differences>

Deviations from the card:
<None, or each one: file, what differs, why, and whether you verified the reason or are guessing>

Outside the repo:
<None, or each change>

Questions / blockers:
<None, or each one>
````
