# Codex Instructions

## Repository authority

- This repository is the sole LEAI frontend source and deployment repository.
- Do not use a legacy frontend repository as a build input, artifact destination, redirect dependency, or recovery source.
- QA is served from `/LEAI/qa/`; Production is served from `/LEAI/`.
- Do not register a service worker. A Production worker scoped to `/LEAI/` would also control the nested QA path.

## Git workflow

- Work directly on the current branch, normally `main`. Never create a branch unless Harvey explicitly requests one.
- Never add `Co-Authored-By` or `Co-authored-by` trailers.
- Use small, focused commits and stage exact owned files only.
- Preserve unrelated and user-owned changes.

## Environment safety

- QA and Production use separate API hosts, public bases, storage prefixes, cache keys, channel names, build identities, and release SHAs.
- Fail closed when runtime frontend, backend, schema, or allowed-origin identity does not match.
- Never commit credentials, provider keys, private exports, student transcripts, or secret-bearing `.env` values.
- Publishing QA and promoting Production are separate action-time approval gates.

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

- `docs/product-strategy/2026-09-17-leai-react-rewrite-architecture.md`
- `docs/product-strategy/2026-09-17-leai-react-ui-system.md`
- `docs/product-strategy/2026-09-17-leai-react-api-contract.md`
- `docs/superpowers/plans/2026-09-17-leai-react-rewrite-master-roadmap.md`
- `docs/superpowers/plans/2026-09-17-leai-react-foundation-implementation-plan.md`
