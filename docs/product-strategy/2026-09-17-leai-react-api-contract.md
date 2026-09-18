# LEAI React API Contract Baseline

**Status:** Phase 0 contract-audit specification. The QA backend is the working
baseline; Production is not assumed to contain these contracts until coordinated
promotion is approved and verified.

## 1. Purpose

The React client must consume an explicit backend contract rather than infer
behavior from the old pages. This document separates:

- endpoints already present in the QA backend;
- behavior that must be verified and typed;
- missing behavior that must be added before the corresponding React feature;
- Production promotion evidence.

The backend remains the authority for authentication, authorization, course
membership, immutable revisions, occurrence state, Team context, response
sessions, messages, and audit records. Zod validates backend responses; it does
not redefine backend truth in the browser.

## 2. Observed QA baseline

The current V12 QA source exposes these endpoint families in
`datapipeline/urls.py`:

- environment: `api/environment/`;
- instructor identity and courses: `instructor_sessions`, `instructor_me`,
  `instructor_password`, `instructor_courses`;
- surveys and public entry: `feedback_gpts_by_course`,
  `get_feedback_gpt_by_public_id`, status/update/export endpoints;
- question-set authoring: templates, drafts, draft versions, restore,
  authoring conversation/runs, freeze, preview capability, revision surveys,
  and reusable templates;
- preview: token lookup, messages, completion, skip, and settings;
- student responses: message creation/bulk creation, resume, and response reads;
- Team: configuration CRUD, survey snapshot, session assignment, and assignment
  list;
- AI and voice: chat, structured output, TTS, and STT proxies;
- supporting tools: analysis reads, Feedback Chat, Course Banner,
  Customizations, completion outputs, and PDF ingest.

The exact HTTP method, request DTO, response DTO, error codes, role requirement,
and idempotency behavior for every route must be captured from backend tests or
an OpenAPI-compatible generated schema before its React client module is marked
complete.

## 3. Contract matrix

| Product capability | Current QA surface | Required React contract | Gate |
| --- | --- | --- | --- |
| Environment identity | `api/environment/` | environment, backend SHA, schema/database identity, allowed public origin | writes fail closed on mismatch |
| Instructor session | instructor session/current/me/password endpoints | typed login, expiry, forced password change, logout, revocation | cross-account browser test |
| Course access | `instructor_courses/` and course-scoped endpoints | role/capability flags and stable course identifier | cross-course negative tests |
| Survey list | `feedback_gpts_by_course/` | normalized card DTO with mode, status, schedule, sessions, capability state | list matches persisted records |
| Draft lifecycle | question-set drafts/detail/versions/restore | optimistic version, idempotent save, conflict response, recoverable checkpoint | duplicate-tab and stale-save tests |
| AI authoring | authoring conversation/runs/detail | run ID, source/provenance, pending/success/failure/cancel state, stale-result rejection | manual edit wins over stale AI |
| Freeze/revision | draft freeze | immutable revision ID and exact compiled protocol | mutation rejection tests |
| Preview | preview capability/token/messages/complete/skip/settings | isolated preview identity, exact revision, completion evidence, output settings | preview rows excluded from analysis |
| Publication | revision surveys | idempotent publication and public survey/link DTO | retry creates one survey only |
| Team setup later | current publication requires Team configuration | publish with nullable setup binding and explicit `team_setup_required` state | publication succeeds without labels |
| Team configuration | configuration CRUD and snapshot endpoints | configure a published occurrence, freeze its snapshot, expose readiness | future edits do not rewrite snapshot |
| Team self-selection | current session-team assignment | occurrence-scoped assignment tied to authoritative response session | first response locks selection |
| Student entry | public survey lookup | ready, scheduled, closed, Team-setup-pending, and available states | exact state browser tests |
| Response session | message create/bulk/resume | allocate/resume, ordered idempotent writes, completion transition, duplicate-tab behavior | exact persisted counts |
| Occurrence settings | legacy update endpoint does not own managed surveys | dedicated managed-survey settings PATCH with allowed fields and optimistic concurrency | audited update tests |
| Revised version | no complete published-revision fork contract | create draft from published revision; new publication/link; prior responses remain bound | lineage and isolation tests |
| Voice | STT proxy | supported format/size, consent copy, permission/failure codes, no provider secret | real-gesture browser tests |
| Analysis/tools | existing course endpoints | normalized typed reads and explicit unavailable states | course isolation and parity tests |

## 4. Environment contract

The public environment response must contain enough non-secret data to prove the
frontend is talking to the intended system:

- environment: `qa` or `production`;
- backend build SHA;
- database/schema identity suitable for comparison without exposing credentials;
- API contract version;
- allowed public application base or origin;
- server time for diagnostics.

The React environment manifest contains the expected values. Authentication may
be initialized, but mutating UI remains disabled until the runtime handshake
passes. QA may never accept a Production backend identity and Production may
never accept a QA backend identity.

## 5. Authentication and authorization

Create a role/capability matrix for owner, instructor, and TA. Each operation
declares at least:

- view course;
- create/edit draft;
- run AI authoring;
- preview;
- publish;
- change occurrence settings;
- configure Teams;
- create a revised version;
- export responses;
- publish or withdraw a Community template.

Every object lookup is course-scoped on the server. React Query keys include the
authenticated account and course. Logout, course switch, membership revocation,
and password change clear or invalidate protected caches.

## 6. Draft and autosave contract

Draft save requires:

- draft public ID;
- expected version or ETag-equivalent;
- idempotency/request ID;
- canonical body;
- save reason such as debounce, field exit, AI boundary, preview, or leave.

Responses distinguish saved, unchanged, validation failure, stale version,
authorization expiry, and server failure. Autosave never reports `Saved` before
the backend confirms persistence. AI Send waits for the active edit's save or
checkpoint before starting the AI run.

Client-side recovery storage, if used, is environment-namespaced, bounded,
expires, and never contains credentials or provider payloads.

## 7. Team setup-later contract

The existing QA publication path currently rejects Team publication without a
valid Team configuration. The React product requires an additive change:

1. Publish the immutable Team Guided revision and create its public survey/link
   with no Team snapshot yet.
2. Return `team_setup_status: "required"` and supported actions on the Survey
   card DTO.
3. Allow link copy without a confirmation gate.
4. Public entry returns a non-error `team_setup_pending` state until labels are
   configured.
5. Configuring Teams creates and freezes the occurrence snapshot, then changes
   public entry to Team self-selection.
6. Team assignment references the authoritative response session and a team in
   the same survey snapshot.
7. The assignment becomes immutable after the first persisted student message.

No roster identity, minimum team size, participation threshold, delayed result,
or feature flag is introduced.

## 8. Publication and edit contract

Published prompts and structure are immutable. The card advertises backend
capabilities rather than assuming every survey supports every action.

`Edit availability & settings` may change only explicitly approved occurrence
fields, such as open/close dates and student output options. It requires
optimistic concurrency and an audit event.

`Create revised version` creates a new mutable draft from one immutable source
revision. Publishing that draft creates a new revision and survey link. Existing
responses remain bound to the original survey and revision.

Legacy, managed, and read-only records expose distinct capability states so the
UI never offers an action that can only fail with a generic server error.

## 9. Response-session contract

The implementation audit must define:

- allocation and anonymous client capability;
- survey-occurrence scope;
- resume lookup;
- monotonically ordered messages;
- request-level idempotency for ambiguous retries;
- completion transition;
- survey close/reschedule behavior during an active response;
- duplicate-tab conflict behavior;
- historical rows with nullable normalized links.

A session counts in instructor-facing response totals only after at least one
student message. Preview, assistant-only opening, abandoned zero-response,
PDF-import, and duplicate retry records are not counted as student sessions.

## 10. Errors and diagnostics

The typed client normalizes:

- `401` authentication expiry;
- `403` role/course denial;
- `404` missing or inaccessible object without cross-course disclosure;
- `409` stale version or lifecycle conflict;
- `422` field/domain validation;
- retryable network or server failure;
- environment-identity failure before writes.

Diagnostics may include request ID, frontend SHA, backend SHA, environment, and
contract version. They never include credentials, tokens, student transcript
content, raw provider payloads, or uploaded private documents.

## 11. Production promotion gate

Before Production promotion, record and verify:

- accepted frontend source SHA and artifact digest;
- accepted QA backend SHA;
- exact migration list and clean migration plan;
- Production-shaped backup/restore and migration rehearsal;
- pre/post model and record counts;
- endpoint/DTO contract-test results;
- role/course authorization negative tests;
- QA and Production environment-handshake results;
- critical instructor and student browser flows;
- evidence location and known limitations.

The old UI is not part of the recovery design. Recovery is either a
schema-compatible previous React artifact or a rehearsed forward fix. No
Production mutation or migration occurs without the existing action-specific
approval gate.
