# Rules for coding agents

This file is for any coding agent working in this repository (for example "Bob", the local coder LLM). Read it before starting a card.

## What this repo is

Nuvio Remote Support Hub: a browser app (Vite, React 19, TypeScript, Tailwind, Supabase) for remotely managing a Nuvio TV account: home catalog order/visibility/titles, installed addons, and several managed accounts. See `README.md`. Work is split into cards in `docs/cards/`.

## How to work

1. Do **exactly one card** per branch and pull request. The card file is the instruction.
2. Branch from the latest `main` as `bob/card-NNN-<slug>`.
3. Never push to `main`. Never merge a pull request. Never force-push to someone else's branch.
4. Do only what the card asks. Do not refactor unrelated code, rename things, reformat files, upgrade dependencies or add features the card does not mention.
5. If the card is unclear or wrong, stop and write the question in the PR under "Blockers / questions". Do not invent a different design.
6. Run every acceptance command before pushing, and paste the key output into the PR body.
7. Never commit secrets (`.env`, keys, tokens, real account emails or passwords). Use placeholder values.
8. Put every temporary file (a PR body, scratch output, downloads) in `C:\Users\james\OpenCode\Testing\temp\`, never in `$env:TEMP` or `AppData\Local\Temp`. Create the folder if it is missing. It sits next to the repo, so nothing in it gets committed.
9. When the PR is open, finish with the card's **handback report** (the last section of every card) as your last message to James. Report only what you actually ran and saw; write `NOT RUN` for anything you did not run.
10. A test that fails is reported, not edited to pass and not skipped.

## Conventions

- **Line endings / indentation:** LF; 2 spaces for TypeScript, TSX, JSON, YAML and Markdown.
- **TypeScript:** ESM, `strict` on (already in `tsconfig.json`; do not loosen it). No new `any`. Services never import from components.
- **Names:** Supabase RPC names, parameters and table columns are snake_case and must be copied exactly from the existing code; app-side fields are camelCase.
- **Persisted data:** the `localStorage` keys `nuvio_managed_accounts_v1` and `nuvio_active_account_id_v1` and the shape of stored `ManagedAccount` objects must stay readable by older builds unless a card says otherwise.
- **Styling:** do not change Tailwind classes except where a card asks (for example adding `aria-label`s does not touch classes).
- **Tests:** every card that adds logic adds tests. Vitest, files named `*.test.ts` / `*.test.tsx` next to the code they test.
- **Commits:** `CARD-NNN: <what changed>`.

## Commands

Run from the repo root in PowerShell:

```powershell
npm ci             # install exactly what package-lock.json says
npm run dev        # http://localhost:5173
npm run build      # tsc, then vite build
npm run typecheck  # tsc --noEmit (added by CARD-001)
npm run lint       # eslint (added by CARD-001)
npm test           # vitest run (added by CARD-001)
```

Use PowerShell, not `cmd.exe`.
