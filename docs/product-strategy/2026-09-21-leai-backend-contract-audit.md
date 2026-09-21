# LEAI Backend Contract Audit

**Date:** 2026-09-21
**Status:** Implemented and independently reviewed; QA remains unbound
**Frontend baseline:** `0f22f69dc7059988bffa031e394cb77beb0218e9`
**Backend audit baseline:** `c252f7c517cfae8e8015e910e660602642c2f657`

## Goal

Create a typed React boundary for the QA backend without treating unsafe,
ambiguous, or missing behavior as available. This audit does not bind the QA
API, deploy either repository, or preserve compatibility for the retired UI.

## Contract status model

Every product-facing endpoint family has exactly one status:

- `accepted`: current backend behavior is evidenced and may receive a runtime
  parser and typed client wrapper;
- `accepted_with_limits`: the evidenced subset may receive a runtime parser,
  while cataloged limitations remain owned by a backend gap issue;
- `blocked`: the React product requires a backend contract change before any
  live client binding;
- `excluded`: a legacy or unsafe surface receives no React client wrapper.

Blocked and excluded endpoints may be documented and typed as audit metadata,
but they must not be exported as callable production clients. The frontend
never infers a capability from a role, a successful legacy request, or the
presence of a field in an old page.

## Shared boundary rules

1. Wire schemas preserve backend `snake_case`. Feature adapters may map one
   validated wire DTO into a camelCase domain model.
2. Zod validates responses at consequential boundaries. A parser failure is a
   contract error, not an empty state.
3. Errors normalize into authentication, authorization, not-found, conflict,
   validation, unavailable, retryable-server, network, and environment
   categories while retaining a privacy-safe request ID when supplied.
4. Diagnostics never retain credentials, bearer tokens, transcript text,
   provider payloads, uploaded documents, or raw response bodies.
5. An empty result, an unavailable capability, loading, and failure are
   distinct states.
6. QA remains fail-closed/read-only until the environment DTO matches the
   reviewed handshake and the selected frontend manifest.

## Audited endpoint catalog

| Domain | Endpoint family | Status | Evidence-based result | Follow-up |
| --- | --- | --- | --- | --- |
| Environment | `GET api/environment/` | blocked | Current DTO lacks backend SHA, contract version, allowed app bases, and server time. | HAR-29 |
| Authentication | instructor session, current session, profile, password | accepted with documented limits | Manual bearer session, expiry, forced password change, revocation, and profile/password writes are tested. Retry and concurrency semantics remain backend work. | HAR-29 |
| Courses | `GET/POST api/instructor_courses/` | accepted with documented limits | Membership-scoped list/create exists; complete operation capabilities do not. | HAR-29 |
| Legacy access | `create_course`, `verify_course_password` | excluded | Anonymous shared-password compatibility is not part of the React product. | HAR-29 |
| Audit read | instructor audit API | blocked | Audit rows exist, but no reviewed instructor-facing read API exists. | HAR-29 |
| Drafts | Question Set list/create/detail/save/versions/restore | accepted with documented limits | Optimistic save, idempotency, checkpoints, and restore exist for active workflows. | HAR-30 |
| AI authoring | authoring conversation/runs | blocked | Stale protection exists, but identical retries can fail stale and pre-run checkpoint semantics are incomplete. | HAR-30 |
| Revision | freeze immutable revision | accepted | Content-addressed freeze and model/query immutability are tested. | none |
| Preview | capability, token read, messages, complete, skip, settings | accepted with documented limits | Frozen-revision isolation and completion evidence are tested; message/settings retry semantics remain limited. | HAR-30 |
| Publication | revision survey creation | accepted for Individual | Transactional idempotent publication is tested. Team setup-later is absent. | HAR-33 |
| Managed survey | cards, status, settings, revised version | blocked | Cards lack capabilities; managed settings/fork are absent; reopen invents a close date. | HAR-30 |
| Team | configuration, snapshots, selection | blocked | Publication requires setup, source edits rewrite snapshots, and selection is caller-controlled/global. | HAR-33 |
| Student entry | public survey lookup | blocked | Lifecycle is not an explicit state union and Team-pending cannot exist. | HAR-32, HAR-33 |
| Response session | message, bulk, resume, completion | blocked | Caller controls identity/role; no capability or write idempotency; normal completion transition is absent. | HAR-32 |
| Public privacy | transcript and assignment-list reads | excluded | Unauthenticated routes expose transcript/session metadata. | HAR-32 |
| Completion outputs | certificate | blocked | Eligibility is one student message rather than authoritative completion; completed-response document is missing. | HAR-32, HAR-31 |
| Analysis | survey/course reads and Quick Take | blocked | Session grouping/count denominators disagree and bare client IDs can merge occurrences. | HAR-31 |
| Feedback Chat | sessions, turns, polling | blocked | Course checks exist, but mutations lack request idempotency and a unified async contract. | HAR-31 |
| Voice/AI proxies | STT, TTS, chat | blocked | Public provider proxies lack student/instructor capability and reviewed media/rate policy. | HAR-31 |
| PDF ingest | jobs, commit, batches, revert | blocked | Course checks exist, but commit retry and private-text boundaries need a reviewed contract. | HAR-31 |
| Course tools | Banner and Customizations | blocked | Writes are unversioned and some wrong types are truthiness-coerced. | HAR-31 |

## Accepted schema scope for HAR-17

HAR-17 creates runtime schemas only for:

- instructor login, current-account/profile, password change,
  institution membership, course membership, course list, and course create;
- active Question Set draft summary/detail/save/restore, immutable revision,
  preview capability/status/settings, and Individual publication;
- normalized privacy-safe error envelopes and the identifiers/timestamps used
  by those accepted domain schemas.

Accepted-with-limits schemas carry those limits in the endpoint catalog. No
feature may call an accepted endpoint until its owning UI task adds a typed
wrapper and the environment handshake is verified.

## Backend gap ownership

- **HAR-29:** environment, authentication, operation capabilities, legacy
  access isolation, and audit visibility.
- **HAR-30:** authoring retry/recovery, managed occurrence settings,
  capability cards, and revised-version creation.
- **HAR-33:** Team setup-later, immutable snapshots, and locked
  occurrence-scoped self-selection.
- **HAR-32:** anonymous authoritative response sessions, idempotent writes,
  privacy, exact counts, and completion.
- **HAR-31:** Analyzer, Feedback Chat, voice, downloads, PDF ingest, Banner,
  and Customizations.

## Acceptance

Implementation lives in `src/api/contracts/`. All four implementation tasks
completed RED-to-GREEN cycles and independent review/fix loops. The final
catalog covers all 21 audited capability families, keeps blocked/excluded rows
non-bindable, and records complete HAR-29 through HAR-33 ownership. QA and
Production manifests remain on non-routable `.invalid` hosts.

- A machine-readable catalog covers every product capability in the approved
  API baseline and links each blocked capability to a Linear issue.
- Blocked/excluded entries cannot be mistaken for bindable clients.
- Accepted wire schemas reject malformed consequential responses.
- Error normalization distinguishes authentication, authorization, not-found,
  conflict, validation, unavailable, retryable server, network, and contract
  failures without copying sensitive bodies into diagnostics.
- Frontend unit tests, typecheck, lint, QA build, Production build, and
  `git diff --check` pass.
- No QA endpoint is bound and no QA/Production data, deployment, migration,
  push, or public release occurs in HAR-17.
