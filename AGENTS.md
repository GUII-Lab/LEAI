# Codex Instructions

## Repository authority

- This repository is the sole LEAI frontend source and deployment repository.
- Do not use a legacy frontend repository as a build input, artifact destination, redirect dependency, or recovery source.
- Approved hosting target: separate Heroku QA and Production apps, each serving React and Django on one HTTPS origin at `/`. See `docs/deployment/heroku-same-origin.md`. Older Pages paths are historical, not the release target.
- Do not register a service worker.

## Git workflow

- Work directly on the current branch, normally `main`. Never create a branch unless Harvey explicitly requests one.
- Never add `Co-Authored-By` or `Co-authored-by` trailers.
- Use small, focused commits and stage exact owned files only.
- Preserve unrelated and user-owned changes.

## Environment safety

- QA and Production use separate app origins, databases, credentials, storage prefixes, cache keys, build identities, and release SHAs. Their relative API path is `/datapipeline/api/v1/`.
- Fail closed when runtime frontend, backend, schema, or allowed-origin identity does not match.
- Never commit credentials, provider keys, private exports, student transcripts, or secret-bearing `.env` values.
- Publishing QA and promoting Production are separate action-time approval gates.

## LEAI typography standard

- Use `text-base` (16px) for regular body copy, navigation labels, form labels and controls, buttons, tabs, and other normal interface text. Do not use `text-sm` for regular copy.
- LEAI overrides Tailwind `text-sm` to 12px in `src/styles/globals.css`. Reserve it for genuinely secondary captions, metadata, brief helper/status text, and compact component descriptions.
- Keep ordinary content at 16px in student chat and consent UI too; arbitrary 15px overrides are not a substitute for `text-base`. Keep the separately requested mobile navigation drawer at 16pt.
- When adding a component, preserve these semantic roles in its defaults so pages inherit the shared rule without page-by-page overrides.

## Product boundaries

- Student participation remains anonymous unless a separately approved study changes that boundary.
- Assistant-only sessions never count as responses. A response begins after the first persisted student message.
- Team feedback uses one instructor link and student self-selection. It has no minimum team size, participation threshold, result delay, roster-verification claim, or feature flag.
- AI and manual deletion require no confirmation because applied mutations create recoverable version history.
- Keep main surfaces concise. Put secondary explanations in accessible overlay popovers or tooltips without resizing the surrounding layout.

## Implementation and verification

- Use strict TypeScript and source-owned shadcn/Radix components. Install only primitives required by an approved product pattern.
- Use semantic design tokens instead of page-specific palette utilities.
- Use TanStack Query for server state; do not introduce a global state library without an evidenced cross-feature need.
- Use real browser gestures for acceptance. Verify Chromium, Firefox, and WebKit when supported.
- Verify 390, 820, 1022, and 1440 pixel widths without page-level horizontal overflow.
- Run focused tests, the full applicable suite, `npm run typecheck`, both environment builds, and `git diff --check` before claiming completion.
- A successful HTTP response or workflow is not persistence evidence. Compare expected and actual record counts after critical flows.
- Keep generated screenshots and self-contained verification reports out of Git.

## Canonical documents

- `docs/product-strategy/2026-09-21-leai-target-system-architecture.md` — umbrella
  authority for frontend, backend, database, authorization, deployment, imports,
  jobs, and interaction contracts
- `docs/product-strategy/2026-09-17-leai-react-rewrite-architecture.md`
- `docs/product-strategy/2026-09-17-leai-react-ui-system.md`
- `docs/product-strategy/2026-09-17-leai-react-api-contract.md`
- `docs/superpowers/plans/2026-09-17-leai-react-rewrite-master-roadmap.md`
- `docs/superpowers/plans/2026-09-17-leai-react-foundation-implementation-plan.md`
