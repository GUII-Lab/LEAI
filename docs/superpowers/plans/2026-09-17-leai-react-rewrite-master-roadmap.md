# LEAI React Rewrite Master Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every LEAI frontend with one React application in the sole `GUII-Lab/LEAI` repository, validate it against QA, and promote the accepted frontend, backend baseline, and migrations to Production together.

**Architecture:** One React/TypeScript/Vite codebase produces a QA build at `/LEAI/qa/` and a Production build at `/LEAI/`. Both builds use the same source-owned shadcn/Radix design system but separate environment manifests, backend identities, browser-state namespaces, release SHAs, and acceptance evidence. No legacy frontend repository participates in build, deployment, redirect, or recovery.

**Tech Stack:** React, TypeScript strict mode, Vite, Tailwind CSS v4, shadcn/ui with Radix primitives, Lucide, TanStack Query, Zod, React Hook Form, react-markdown, Vitest, Testing Library, and Playwright.

**Specs:**
- `docs/product-strategy/2026-09-17-leai-react-rewrite-architecture.md`
- `docs/product-strategy/2026-09-17-leai-react-ui-system.md`
- `docs/product-strategy/2026-09-17-leai-react-api-contract.md`

## Global Constraints

- `GUII-Lab/LEAI` is the only frontend source and deployment repository.
- QA is served from `/LEAI/qa/`; Production is served from `/LEAI/`.
- QA may advance independently; Production stays pinned to its last approved React source SHA.
- The first release registers no service worker because the Production scope would contain the nested QA path.
- QA and Production use separate API hosts, storage prefixes, cache keys, `BroadcastChannel` names, build identities, and visible environment labels.
- Runtime environment mismatch disables all mutating actions.
- Existing backend records remain authoritative; the client never guesses unavailable historical structure.
- Student participation remains anonymous; analytics never capture transcript text, keystrokes, session replay, raw URLs, IP addresses, or unnecessary device identifiers.
- Assistant-only sessions never count as responses. A response begins only after the first persisted student message.
- AI and manual deletion require no confirmation because applied mutations create recoverable version history.
- Team Guided keeps one shareable link, student self-selection, no minimum team size, no participation threshold, no delayed results, and no feature flag.
- Team setup may happen after publication; the reminder appears only on the Survey card, after Copy link, and on the student pending page.
- Main surfaces show short essential copy; secondary explanation belongs in accessible popovers or tooltips that overlay rather than resize layout.
- Every milestone requires `git diff --check`, focused tests, the full applicable test suite, and real deployed-page verification before acceptance.
- Repository creation is authorized by the owner. QA publication and Production promotion remain separate action-time gates.

---

## Milestone 0 — Repository and Foundation

Detailed plan: `docs/superpowers/plans/2026-09-17-leai-react-foundation-implementation-plan.md`

- [x] **M0.1 Create the sole repository.** Create public `GUII-Lab/LEAI`, clone it to `/Users/harveyli/Documents/GitHub/LEAI`, use `main`, and add no legacy repo dependency.
- [x] **M0.2 Establish canonical documentation.** Move the three approved specs and both implementation plans into the new repo; add README, contribution rules, architecture index, and decision log.
- [x] **M0.3 Scaffold the application.** Create React + TypeScript + Vite with strict compiler settings, Node `22.22.0`, npm lockfile, and deterministic scripts.
- [ ] **M0.4 Install quality gates.** Configure the official Vite Oxlint baseline, Vitest, Testing Library, Playwright, typecheck, build checks, accessibility smoke checks, and `git diff --check` CI.
- [x] **M0.5 Define the UI system.** Add Tailwind v4 semantic tokens, typography, spacing, responsive breakpoints, reduced-motion behavior, and the first source-owned shadcn/Radix primitives.
- [ ] **M0.6 Build the shared shell.** Implement environment bar, account rail, course navigation, page header, responsive Sheet navigation, loading/error boundaries, and stable content geometry.
- [x] **M0.7 Implement environment safety.** Add typed local/QA/Production manifests, Zod validation, backend handshake, fail-closed write guard, and environment-qualified browser state. QA/Production identity values remain deliberately unbound until the backend-contract audit supplies verified public values.
- [ ] **M0.8 Create real entry documents.** Add `InstructorHome.html`, `PromptDesigner.html`, `FeedbackAnalyzer.html`, `FeedbackChat.html`, `CourseBanner.html`, `Customizations.html`, and `feedback.html` without relying on SPA rewrite behavior.
- [ ] **M0.9 Build dual-environment artifacts.** QA uses base `/LEAI/qa/`; Production uses `/LEAI/`. Compose one Pages artifact while keeping Production pinned to the approved release SHA.
- [ ] **M0.10 Configure GitHub Actions.** Run install, typecheck, unit/component tests, both builds, artifact manifest checks, and Playwright smoke tests. Do not publish Pages until the separate QA publication gate.
- [ ] **M0.11 Audit the backend contract.** Capture exact QA methods, request/response DTOs, status codes, roles, idempotency, and missing contracts in a generated or checked schema.
- [ ] **M0.12 Foundation acceptance.** Verify Chromium, Firefox, and WebKit at 390, 820, 1022, and 1440 widths; generate a self-contained HTML report.

## Milestone 1 — Instructor Account and Course Shell

- [ ] **M1.1 Authentication.** Implement sign-in, forced first-password change, expiry, logout, revocation, and privacy-safe errors.
- [ ] **M1.2 Account-level hierarchy.** Put Account and All Courses in the account rail; do not copy Canvas styling, but preserve the account-versus-course hierarchy.
- [ ] **M1.3 Course-level hierarchy.** Put Prompt Designer, Feedback Analyzer, Feedback Chat, Course Banner, Customizations, and Instructor Guide inside the active-course navigation.
- [ ] **M1.4 Course selection and creation.** Implement current/recent courses, create course, switch course, empty account, role/capability rendering, and negative cross-course tests.
- [ ] **M1.5 Responsive navigation.** Desktop rails collapse to an accessible mobile Sheet; content width drives reflow rather than named device categories.
- [ ] **M1.6 Session transitions.** Clear protected TanStack Query caches and view-specific state on logout, account change, password change, and course switch.
- [ ] **M1.7 Account acceptance.** Test two sequential accounts, zero-course and many-course states, revoked membership, mobile navigation, keyboard order, and backend audit events.

## Milestone 2 — Feedback Creation and Survey Management

- [ ] **M2.1 Feedback home.** Create a balanced Builder card and survey-list card with stable spacing and responsive stacking.
- [ ] **M2.2 Continue-session visibility.** Show Continue previous session only when the backend confirms a resumable draft; empty or invalid drafts never open a blank modal.
- [ ] **M2.3 Builder dialog behavior.** Backdrop clicks do not close it. Only the close control initiates exit, explains that autosave protects work, and returns focus correctly.
- [ ] **M2.4 Stable wizard frame.** Keep header, stepper, Back, and primary action fixed; scroll only the intended inner region. Empty tabs never shrink the frame or move the footer.
- [ ] **M2.5 Audience.** Support equal Individual and Team choices plus concise How LEAI works help without outer-page scrolling.
- [ ] **M2.6 Format.** Individual supports Guided or Open; Team is Guided-only. Copy remains concise and detailed boundaries stay in accessible overlays.
- [ ] **M2.7 Starting point.** Implement LEAI templates, My templates, Community, and Start from scratch with fixed-height content regions and meaningful empty states.
- [ ] **M2.8 AI/manual workspace.** Use a ChatGPT-like MessageThread: same-color user bubbles, open Markdown AI responses, an expanding composer, microphone, and arrow-send action.
- [ ] **M2.9 Voice input.** Use the backend STT proxy, real user permission gestures, visible recording/transcription states, supported format limits, and recoverable failures.
- [ ] **M2.10 Artifact identity.** Keep exactly one editable feedback title; remove duplicated title treatments and use one responsive artifact header for mode, History, and save status.
- [ ] **M2.11 Autosave.** Display `Saving…`, `Saved just now`, and elapsed save age beside the form editor. AI Send checkpoints the active edit before applying AI output.
- [ ] **M2.12 Editing and recovery.** Add/reorder/remove sections and questions; deletion is immediate and recoverable through Undo/version history without confirmation.
- [ ] **M2.13 AI concurrency.** Manual edits win over stale AI results; runs expose provenance, pending/success/failure/cancel states, and no hidden destructive mutation.
- [ ] **M2.14 Preview preparation.** Use meaningful staged progress with bounded pauses; do not fake completion through a single smooth timer.
- [ ] **M2.15 Preview screen.** Remove duplicated titles and explanatory blocks. Keep one preview action, one concise status, visible safety copy, and output details in accessible info controls.
- [ ] **M2.16 Output settings.** Completion certificate and response-form switches use shared animated primitives, reduced-motion support, backend persistence, and clear applied state.
- [ ] **M2.17 Publish.** Preserve optional open/close dates, responsive field wrapping, immutable revision publication, and idempotent retries.
- [ ] **M2.18 Publish completion.** Close the Builder after success, focus/highlight the newly created Survey card, and avoid a dead-end fifth-step success page.
- [ ] **M2.19 Survey cards.** Restore Edit/Create revised version, Copy link, open/close/reopen, schedule, session count, output state, and concise publication outcome on the card itself.
- [ ] **M2.20 Survey filters.** Add All, Individual, Team, then Guided/Open subfilters for Individual. Use subtle accessible category tints without relying on color alone.
- [ ] **M2.21 Team setup later.** Allow publication and link copy before labels exist; show one card status, one lightweight Copy reminder, and one blocking student pending state.
- [ ] **M2.22 Save as template.** Replace the inline expanding section with a smaller focused Dialog; templates are private by default and Community publication is separate.
- [ ] **M2.23 Builder acceptance.** Exercise Individual Guided, Individual Open, and Team Guided end to end with persisted counts, version recovery, stale-AI rejection, real voice gesture, and responsive screenshots.

## Milestone 3 — Student Experience

- [ ] **M3.1 Public entry state machine.** Render available, scheduled, closed, completed, Team-setup-pending, and authorization/error states from explicit backend values.
- [ ] **M3.2 Anonymous session authority.** Allocate/resume occurrence-scoped sessions, order writes server-side, make retries idempotent, and reject cross-survey reuse.
- [ ] **M3.3 Individual Guided.** Render the immutable authored sequence, contextual follow-ups, closing prompt, final acknowledgement, and evidence-based completion.
- [ ] **M3.4 Individual Open.** Render the open conversation while preserving survey/revision attribution and completion behavior.
- [ ] **M3.5 Team Guided.** Present the anonymity notice, student self-selection, any configured group size including two, and lock selection after the first persisted student message.
- [ ] **M3.6 Student voice and streaming.** Support permission-safe voice input and optional streamed AI responses without exposing provider credentials.
- [ ] **M3.7 Outputs.** Generate the configured completion certificate and completed-response document with exact survey/revision/session attribution.
- [ ] **M3.8 Mobile and accessibility.** Verify keyboard, screen reader, zoom, reduced motion, long content, network interruption, duplicate tabs, and 390-pixel interaction.
- [ ] **M3.9 Student acceptance.** Persist exact message/session/output counts for all three modes and prove preview rows and assistant-only openings stay outside course analysis.

## Milestone 4 — Analyzer, Realtime Data, and Course Tools

- [ ] **M4.1 Analyzer contract.** Normalize course/survey/session reads, exact denominators, unavailable states, and structured question/section identifiers.
- [ ] **M4.2 Near-realtime refresh.** Use TanStack Query visibility-aware 10–15 second polling, refetch on focus/reconnect, and precise query invalidation after mutations.
- [ ] **M4.3 New-feedback UX.** Update counts immediately but avoid moving content while it is being read; show `N new responses` and apply the new result set intentionally.
- [ ] **M4.4 SSE readiness.** Define privacy-bounded event types carrying IDs, counts, and version tokens rather than transcript text. Add SSE only if sub-second QA behavior is approved and backend operations are verified.
- [ ] **M4.5 Analysis integrity.** Exclude assistant-only sessions, begin counts at the first persisted student message, use metric-specific denominators, and never reconstruct missing schema identity from transcript order.
- [ ] **M4.6 Feedback Chat.** Use the same instructor MessageThread and AIComposer patterns, sanitized Markdown, optional token streaming, and course-scoped sources.
- [ ] **M4.7 Course Banner.** Rebuild editing, preview, upload, validation, and persistence through shared components.
- [ ] **M4.8 Customizations.** Rebuild supported course settings with explicit save state, typed contracts, and no placeholder controls.
- [ ] **M4.9 Background jobs.** Surface PDF ingest, export, preview generation, and other long-running status with polling first and event-driven invalidation when justified.
- [ ] **M4.10 Cross-tab coordination.** Use environment-qualified `BroadcastChannel` messages for logout, course switch, draft version, and cache invalidation; never share QA and Production state.
- [ ] **M4.11 Tools acceptance.** Verify real new-feedback arrival, chart stability, course isolation, exact persisted counts, stream failure recovery, and responsive layouts.

## Milestone 5 — QA Release Candidate

- [ ] **M5.1 Security review.** Verify no secrets in source/bundle, backend authorization on every protected operation, sanitized Markdown, safe file handling, and environment fail-closed behavior.
- [ ] **M5.2 Privacy review.** Verify anonymity, preview isolation, no surveillance data, bounded logs/events, and Team wording that does not imply roster verification.
- [ ] **M5.3 Accessibility review.** Run automated checks plus keyboard, focus, label, dialog, popover, switch, live-region, zoom, contrast, and reduced-motion acceptance.
- [ ] **M5.4 Cross-browser matrix.** Run Chromium, Firefox, and WebKit at 390, 820, 1022, and 1440 widths using real clicks, typing, microphone/file gestures where supported, and no JS-dispatched substitutes.
- [ ] **M5.5 Persistence audit.** Count every created course, draft, version, revision, preview, survey, response session, message, team snapshot, output, and audit event against expected totals.
- [ ] **M5.6 Performance.** Measure initial load, route entry, analyzer refresh, Builder editing, long threads, and low-end mobile behavior; fix only evidenced bottlenecks.
- [ ] **M5.7 QA report.** Generate a self-contained HTML report containing criteria, screenshots, frontend/backend SHAs, schema identity, browser matrix, limitations, and exact commands.
- [ ] **M5.8 Owner acceptance.** Complete visual and product review on the deployed `/LEAI/qa/` pages before freezing the release candidate.

## Milestone 6 — Coordinated Production Promotion

- [ ] **M6.1 Freeze release manifest.** Record the accepted React SHA, backend SHA, migration list, lockfile/toolchain versions, environment hash, artifact digest, and QA report.
- [ ] **M6.2 Backup and rehearsal.** Back up Production, restore a production-shaped copy, apply migrations in order, run parity/count checks, and prove the recovery procedure.
- [ ] **M6.3 Production build.** Rebuild `/LEAI/` from the exact accepted React SHA with the Production manifest and `prod:` namespace; retain `/LEAI/qa/` from the active QA SHA.
- [ ] **M6.4 Action-time approval.** Present the exact frontend artifact, backend release, migration set, public paths, and recovery checkpoint before any Production mutation.
- [ ] **M6.5 Promote backend and schema.** Apply only the approved baseline and migrations; verify environment identity before enabling frontend writes.
- [ ] **M6.6 Publish Production Pages.** Deploy the composed artifact from `GUII-Lab/LEAI`; no old repo redirect or artifact is involved.
- [ ] **M6.7 Live acceptance.** Verify real Production login, course selection, creation, preview, publication, student completion, Team pending/setup/self-selection, Analyzer, outputs, record counts, and audit events.
- [ ] **M6.8 Closeout.** Preserve release evidence, document known limitations, keep the previous compatible React artifact for recovery, and continue QA at `/LEAI/qa/`.

## Ordered Execution Rule

Work proceeds M0 → M1 → M2 → M3 → M4 → M5 → M6. A task may begin only when its consumed interfaces are accepted. UI polish never bypasses an environment, authorization, persistence, privacy, or migration gate. Each checkbox is updated in the canonical copy in `GUII-Lab/LEAI` as work is verified.
