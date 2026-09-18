# LEAI React Rewrite Architecture

**Status:** Revised on 2026-09-17 after independent architecture, backend-contract,
and release-assurance review; awaiting final owner review before implementation planning.

## 1. Decision

LEAI will be rebuilt as a new React application in a new `GUII-Lab/LEAI`
repository. The rewrite will use React, TypeScript, Vite, Tailwind CSS, and
shadcn/ui on Radix primitives. It will reuse the existing Django/Postgres
backend and its persisted domain model rather than rebuilding the backend from
scratch. React will use the isolated QA backend first. Production promotion is
a coordinated frontend, backend-baseline, and migration release, not a
frontend-only path switch.

The new repository begins as a QA-only system. Existing courses are closed, so
the rewrite does not need to resume old drafts or convert active courses. This
is a release-time premise that must be confirmed from authoritative Production
records immediately before cutover. New courses will use the React system after
it is promoted to the appropriate environment. Old data remains intact and may
be exposed read-only where the new backend contract can represent it accurately.

QA remains test-data-only. If a real course must begin before Production
cutover, the React release must first pass its production gate or the course
must remain on the existing Production system; real student data must not be
routed into QA by convenience.

Production will not change until the React QA system passes the acceptance
gates in this document and receives explicit production-cutover approval.

## 2. Goals

- Replace the current collection of page-specific HTML, CSS, and JavaScript
  implementations with one coherent React product.
- Establish one LEAI design system with accessible, source-owned components.
- Support the complete instructor and student experience for Individual Guided,
  Individual Open, and Team Guided feedback.
- Preserve authoritative backend relationships, immutable published revisions,
  anonymous response sessions, and audit behavior.
- Keep QA and Production visibly and technically separate.
- Make every deployment attributable to an exact source commit and build.
- Provide reliable desktop, laptop, iPad, and mobile behavior.
- Preserve a fast recovery path between verified React releases; the retired
  HTML interface is not a fallback product.

## 3. Non-goals

- Migrating unfinished drafts from the old frontend.
- Rewriting closed-course records merely to reproduce the old interface.
- Replacing Django, Postgres, or the existing backend deployment topology.
- Introducing Next.js, server-side rendering, server components, or frontend
  serverless functions.
- Recreating Canvas visual styling.
- Copying the existing frontend implementation file by file.
- Changing the confirmed anonymous-student and team self-selection model.
- Treating QA as a live-course data environment.

## 4. Repository and Deployment Topology

### 4.1 Sole repository

`GUII-Lab/LEAI` will be the only React frontend source and deployment
repository. It will contain application source, tests, build configuration,
release workflows, and the GitHub Pages configuration for both QA and
Production. No legacy frontend repository is a build input, artifact target,
redirect dependency, or recovery path.

The repository will not contain backend source, research datasets, transcripts,
private course exports, generated verification reports, or unrelated GUII Lab
website files.

The repository should be public to match the current open frontend deployment.
No credential, provider key, private dataset, or sensitive runtime value may be
committed or embedded in the client bundle.

### 4.2 One Pages site, two environment paths

GitHub Pages exposes one project site for `GUII-Lab/LEAI`:

`https://guii-lab.github.io/LEAI/`

That site contains two independently configured React builds:

- QA at `https://guii-lab.github.io/LEAI/qa/`;
- Production at `https://guii-lab.github.io/LEAI/`.

Both builds come from the same repository, component system, lockfile, tests,
and release workflow. They differ only through explicit environment manifests,
public base paths, backend identity, storage namespace, and source release SHA.
The deployment workflow composes a complete Pages artifact containing both
paths; it never publishes to or reads from an old QA or website repository.

The QA path may advance from the current candidate SHA while Production remains
pinned to its last approved release SHA. A QA deployment must therefore rebuild
or restore the Production root from that pinned release, rather than implicitly
promoting the current QA source.

Every QA build must be built from an explicit `GUII-Lab/LEAI` source SHA,
contain tracked source output only, identify the QA backend, use a `qa:` browser
storage namespace, and reject any Production API hostname.

### 4.3 Production deployment

After explicit cutover approval, the Production build in the same Pages site
will own the project root:

`https://guii-lab.github.io/LEAI/`

The production artifact must be reproducibly rebuilt from the exact QA-approved
source SHA using Production environment configuration and a `prod:` browser
storage namespace. The QA-approved backend baseline and migrations are promoted
in the same release sequence. Promotion is complete only after frontend,
backend, schema, and database identities match the release manifest and the
real Production acceptance flow passes.

## 5. Technical Stack

- React with TypeScript in strict mode
- Vite for local development and static production builds
- Tailwind CSS v4 for layout and design tokens
- source-owned shadcn/ui components using Radix primitives, with the chosen
  preset and aliases committed in `components.json`
- Lucide for interface icons
- TanStack Query for server state, cache invalidation, and mutation status
- Zod at API and form boundaries where runtime validation is valuable
- React Hook Form for forms with validation or multi-field submission
- `react-markdown` with a restricted, sanitized rendering policy for AI output
- Vitest and Testing Library for unit and component behavior
- Playwright for real-page and cross-browser acceptance

Dependencies will be added only when they own a clear responsibility. The
rewrite will not introduce a global state library until a concrete cross-feature
state problem cannot be handled by server state, route state, or bounded React
context.

## 6. Design System

shadcn/ui is source-owned rather than treated as a locked theme. The project
defines its product patterns first, then installs only the primitives needed by
those patterns. Initial primitives are Button, Input, Input Group, Textarea,
Label, Card, Dialog, AlertDialog, Tooltip, Popover, Tabs, Switch, ScrollArea,
Sheet, DropdownMenu, Badge, Progress, Skeleton, Separator, and Sonner. A
component is not added merely because it appears in the upstream catalog.

LEAI will define semantic tokens for background, surface, text, border, focus,
primary action, warning, success, destructive action, Individual, Team, Guided,
and Open modes. Components must use tokens rather than ad hoc palette classes.

The default instructor and student interface is light. Motion must be purposeful
and respect `prefers-reduced-motion`. Layout, radius, typography, focus rings,
spacing, and component density must be consistent across all screens.

Product-level components include the App Shell, Account Rail, Course Navigation,
Survey Card, Feedback Builder, Wizard Stepper, AI Conversation, Composer,
Autosave Status, Question Editor, Preview Summary, Publication Handoff, Team
Setup, and Student Conversation. These components compose shadcn primitives
instead of reimplementing accessibility behavior.

The companion `2026-09-17-leai-react-ui-system.md` is the normative mapping of
tokens, primitives, product components, interaction states, and page patterns.

## 7. Routing for GitHub Pages

The application will use one React codebase with several real Vite HTML entry
documents instead of relying on a server rewrite:

- `InstructorHome.html`
- `PromptDesigner.html`
- `FeedbackAnalyzer.html`
- `FeedbackChat.html`
- `CourseBanner.html`
- `Customizations.html`
- `feedback.html`

Each entry mounts the shared React shell at the appropriate module. Internal
feature views may use route state, query parameters, or bounded client routing,
but a browser refresh must never depend on GitHub Pages rewriting an arbitrary
path to `index.html`.

Vite base paths are environment-specific. QA uses `/LEAI/qa/` and Production
uses `/LEAI/`. Public links must be constructed through the environment module,
not hardcoded in components.

## 8. Environment and API Boundary

The frontend has explicit `qa`, `production`, and `local` environment manifests.
They define only public values such as API base, public app base, build SHA,
browser-storage prefix, and environment label. The build fails if:

- the environment is unknown;
- a QA build contains a Production API host;
- a Production build contains a QA API host;
- required public bases are missing or malformed; or
- a secret-like variable is referenced by client code.

The QA and Production paths share one `guii-lab.github.io` browser origin.
Every persisted client key, cache key, and `BroadcastChannel` must therefore be
environment-qualified. The first release does not register a service worker:
a Production worker scoped to `/LEAI/` would also control the nested
`/LEAI/qa/` path. Offline/PWA behavior requires a separate design review rather
than entering through a default Vite plugin. React does not import unqualified
legacy storage keys.

Before enabling mutating actions, the running application calls the backend
environment endpoint and verifies the expected environment, backend build,
database/schema identity, and allowed public origin. A mismatch produces a
read-only environment error rather than sending a write to the wrong system.

All AI, authentication, data, and file operations continue through the backend.
The frontend never receives or stores provider secrets. API access lives in a
typed client layer with centralized authentication, error normalization,
request IDs, cancellation, and environment-aware diagnostics.

The QA backend baseline is the authority for course membership, drafts,
immutable revisions, previews, surveys, response sessions, team context,
messages, analysis, and audit events. Missing contracts are implemented and
verified in QA before the coordinated Production promotion. The companion
`2026-09-17-leai-react-api-contract.md` records current endpoints, required
changes, identifiers, authorization, idempotency, and acceptance evidence.

## 9. Product Architecture

### 9.1 Account and course shell

Account-level navigation owns Account and All Courses. Course-level navigation
contains only tools for the active course. Desktop may show a compact account
rail plus course navigation; smaller widths collapse these into deliberate
mobile sections rather than shrinking the desktop layout.

### 9.2 Feedback creation

One Feedback Builder replaces the previous three survey-creation paths:

- Individual Guided maps to structured/form behavior.
- Individual Open maps to open/general feedback.
- Team Guided maps to team feedback.

Team feedback uses one instructor-shared link. Students identify their own team
when entering. Two-person teams are valid, and no minimum participation count,
result delay, rollout flag, or roster integration is required. Team labels may
be configured after publication, but must exist before a student can begin the
conversation.

### 9.3 Builder behavior

The Builder has a stable header, step navigation, content region, and footer.
Only intended inner regions scroll. Footer actions do not move when tabs,
empty states, explanations, or viewport width change.

Clicking the backdrop or pressing Escape does not silently close the Builder.
The close control first finalizes autosave and then explains that progress is
saved. Choosing to keep editing restores focus to the active control.

The editable artifact has one title surface and one nearby save indicator:
`Saving...`, `Saved just now`, then elapsed time. Leaving a field finalizes the
edit. AI Send checkpoints the active edit before invoking AI and does not show a
Save/Discard/Keep-editing conflict modal.

AI deletion does not require confirmation because every applied mutation is
recoverable through version history. Manual and AI changes are visually
attributed without turning every surface into explanatory prose.

### 9.4 AI collaboration

The instructor message uses a quiet same-color bubble. AI responses render as
open, readable Markdown rather than a second boxed bubble. The composer uses a
compact rounded message bar, microphone action, and arrow send action. It does
not expose the reference UI's plus button or model picker; the assistant remains
LEAI.

Voice input must show recording, processing, permission-denied, unsupported,
and retry states. Tooltips and popovers render in portals and never resize the
composer or content panels.

### 9.5 Preview and publish

Preview preparation uses staged progress with believable pauses rather than a
continuous decorative sweep. The Preview page removes repeated titles and
secondary explanations, leaving one concise summary and one clear action.
Output definitions live in accessible popovers. Switches animate smoothly and
respect reduced motion.

Publishing ends with a deliberate completion handoff. The Builder closes or
offers a clear Complete action, the new Survey card receives focus and a
temporary highlight, and its link remains attached to that card. A separate
landing-page success block must not duplicate the same link.

Published content revisions are immutable. `Edit availability & settings`
changes mutable occurrence settings such as open/close dates and outputs.
`Create revised version` changes prompts or structure and produces a new
revision, preserving existing responses on their original revision.

### 9.6 Team setup and templates

When Team configuration is absent, the instructor sees Setup now and Setup
later. Setup later collapses the form and does not block publication or link
creation. The resulting Survey card has one persistent `Team setup required`
status. Copying the link still succeeds and produces one lightweight notice:
`Link copied. Set up teams before students can begin.` The interface does not
repeat the same explanation in additional banners or modals.

If a student opens the link before setup is complete, the student page shows one
clear pending state and cannot start a response. When setup is complete, the
normal self-selection screen appears. The student's selected team is scoped to
that survey occurrence and becomes immutable after the first persisted response.

Saving a reusable template opens a focused modal. Templates are private by
default. Validation, submission progress, error, success, and focus return are
contained inside the modal. Community publication is a separate explicit act.

### 9.7 Survey list

Survey browsing supports All, Individual, and Team filters, with Guided and Open
subfilters for Individual. Cards use subtle accessible mode tints while keeping
status, schedule, session count, sharing, mutable settings, revision creation,
and close/reopen actions legible. Filtered empty states explain how to recover.

## 10. Historical Data and Legacy Behavior

No frontend migration or database backfill is required merely to reproduce the
old interface. Closed-course records remain in the backend unchanged. The React
application may show them read-only when the API supports accurate rendering.
If a historical shape cannot be represented without guessing, React shows an
accurate unavailable/read-only state rather than synthesizing data. The old QA
or Production UI is not retained as an application fallback.

The rewrite must not delete old surveys, response sessions, messages, revisions,
or audit records. Existing links may show an accurate closed state, but reopening
or mutating legacy records is outside the rewrite unless separately approved.

## 11. Security, Privacy, and Accessibility

- The public repository and static bundle contain no secrets.
- QA and Production client storage, caches, and channels are explicitly
  namespaced; no service worker is registered in the first release.
- Authentication and authorization are enforced by the backend, not hidden UI.
- Anonymous student sessions do not become named accounts.
- Preview data remains isolated from course responses and analysis.
- AI output is sanitized before Markdown rendering.
- Every Dialog, Popover, Tooltip, Menu, Switch, Tab, form, and live status has
  correct keyboard, focus, labeling, and screen-reader behavior.
- Microphone access is requested only in response to a real user gesture.
- Sensitive failures do not echo tokens, transcripts, or provider payloads.
- Audit events continue to record consequential instructor actions without
  storing credentials or unnecessary student content.
- Product acceptance targets WCAG 2.2 AA. Radix behavior is a starting point,
  not evidence that composed LEAI screens satisfy the standard.

## 12. Error and Recovery Model

Each asynchronous surface provides an explicit loading, empty, error, retry,
and success state. Mutations are idempotent where duplication would create a
second survey, publication, revision, or response. Network interruption does
not discard locally edited content without warning.

The API layer distinguishes authentication expiry, authorization denial,
validation error, conflict, network failure, and server failure. Recoverable
errors stay in context; global toasts are reserved for cross-surface outcomes.
The frontend includes build SHA and environment identity in diagnostics.

## 13. Verification Strategy

### 13.1 Continuous checks

- TypeScript strict typecheck
- ESLint and formatting checks
- Unit tests for state and API helpers
- Component tests for interaction and accessibility behavior
- Production build for every pull request
- Environment-host and public-base validation
- Dependency and secret scanning
- `git diff --check`

### 13.2 Real QA acceptance

Acceptance uses the deployed React QA pages, real mouse/keyboard gestures, and
the QA backend. It covers:

- Chromium, Firefox, and WebKit/Safari as required release checks;
- representative widths of 390, 820, 1022, and 1440 pixels;
- login, account transition, course creation, and course switching;
- Individual Guided, Individual Open, and Team Guided creation;
- autosave, AI change, deletion, undo, history, and voice input;
- preview completion, output settings, publication, link opening, and card
  highlighting;
- student completion and Team self-selection;
- analyzer and instructor chat access;
- keyboard order, focus return, labels, contrast, reduced motion, and viewport
  adaptation;
- persisted record counts and audit records after each critical flow.

A self-contained HTML verification report records criteria, source SHA, backend
identity, screenshots, and observed limitations. A successful HTTP response or
Actions run is not sufficient evidence of persistence or deployment identity.

## 14. Rollout and Recovery

1. Create the `GUII-Lab/LEAI` repository and enable its single Pages site.
2. Deploy the React QA build at `/LEAI/qa/`, connected only to the QA backend
   and `leai_qa` schema. No legacy repository participates.
3. Verify each milestone on that real QA path.
4. Freeze the accepted frontend source SHA, backend SHA, migration list,
   toolchain, lockfile, environment manifest, and QA evidence bundle.
5. Rehearse the coordinated Production upgrade against a production-shaped
   restore.
6. After action-specific approval, promote the verified backend baseline and
   migrations, then publish the Production build at `/LEAI/` from the accepted
   React source SHA while retaining `/LEAI/qa/` as the QA build.
7. Verify the live Pages deployment, runtime environment handshake, exact record
   counts, and critical instructor/student flows.
8. Recovery uses a previously verified React artifact when schema-compatible or
   a tested forward fix. It does not restore the retired HTML UI.

Every release records source and backend SHAs, lockfile and toolchain versions,
environment-manifest hash, artifact digest, deployment ID, schema identity, and
verification-report location.

## 15. Milestones

### Milestone 0: Foundation

Create the repository, CI, environment boundary, app shell, approved UI system,
design tokens, required shadcn primitives, API contract/client, test harness,
QA artifact workflow, and build identity.

### Milestone 1: Account and course shell

Implement authentication, account state, All Courses, course selection and
creation, account-level navigation, course-level navigation, and responsive
shell behavior.

### Milestone 2: Feedback creation

Implement all three modes, templates, AI/manual workspace, autosave/history,
preview, publish, Team setup deferral, template modal, survey filters, and
post-publication actions.

### Milestone 3: Student experience

Implement the Guided, Open, and Team student flows, self-selection, completion,
downloads, mobile behavior, accessibility, and exact-revision persistence.

### Milestone 4: Analysis and course tools

Implement Feedback Analyzer, Feedback Chat, Course Banner, Customizations, and
accurate read-only historical views.

### Milestone 5: QA acceptance

Complete multi-browser, responsive, accessibility, security, persistence, and
full-flow verification with a reviewable report.

### Milestone 6: Production cutover

Promote the approved frontend and backend baselines, apply rehearsed migrations,
publish the approved build at `/LEAI/`, verify Production, and retain both the
accepted React release evidence and the isolated `/LEAI/qa/` environment.

## 16. Linear Mapping

The current Linear project remains the execution board. Existing items HAR-5
through HAR-16 map primarily to Milestones 0, 1, 2, and 5. Additional issues
will cover the student experience, analysis/course tools, API contract audit,
QA artifact workflow, and production cutover. Dependencies must reflect the
milestone order; visual polish must not obscure missing data, authorization,
or persistence behavior.

## 17. Implementation Gate

This document authorizes planning, not repository creation, deployment, or
Production changes. After owner review, a separate implementation plan will
specify the exact work sequence, acceptance evidence, recovery checkpoints, and
approval boundaries. Creating the new GitHub repository and publishing the
first QA artifact remain explicit execution steps in that plan.
