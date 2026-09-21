# LEAI Environment, Authentication, and Capability Contract Design

**Date:** 2026-09-21
**Status:** Approved design for HAR-29
**Frontend baseline:** `c4b34a1bec0e73265b87add4418035816569926e`
**Backend baseline:** `c252f7c517cfae8e8015e910e660602642c2f657`

## Purpose

HAR-29 makes the clean LEAI backend directly consumable by the React
application without asking the browser to infer authorization from a role or
from legacy shared-password behavior. It completes the environment handshake,
defines one backend-owned operation-capability policy, removes the two public
legacy course-access routes, and makes authentication retry and concurrency
behavior deterministic.

This work changes source code and tests only. It does not bind a QA hostname,
deploy either repository, access QA or Production data, or change either
database.

## Chosen approach

Use a central backend policy to derive a complete, ordered capability list for
each active course membership. The backend continues to store the existing
course role plus `can_publish` and `can_export`; React receives the resolved
operation list and never derives permissions itself. This avoids a premature
database column or JSON-policy migration while still making authorization
explicit and testable at every endpoint.

The alternatives were rejected for this milestone:

- Per-membership capability columns or JSON policy would be flexible, but add a
  migration and admin surface before a real exception model exists.
- A new instructor-facing audit endpoint would enlarge the privacy and
  pagination surface before the product has an approved audit UI. Audit access
  remains immutable and Admin-only.
- Retaining anonymous course creation or shared-password authorization behind a
  compatibility flag would preserve a flow the replacement product explicitly
  excludes. The clean backend removes those routes.

## Environment handshake

`GET api/environment/` is public and read-only. A successful response contains
exactly these non-secret fields:

```json
{
  "environment": "qa",
  "backend_build_sha": "40 lowercase hexadecimal characters",
  "schema_identity": "non-secret deployment schema identifier",
  "contract_version": "reviewed API contract identifier",
  "allowed_app_bases": ["/LEAI/qa/"],
  "server_time": "RFC 3339 timestamp with offset"
}
```

The backend obtains the values from validated public settings:

- `LEAI_BACKEND_BUILD_SHA` is an exact 40-character lowercase Git SHA.
- `LEAI_SCHEMA_IDENTITY` is a non-secret deployment identifier with a bounded
  safe-character grammar.
- `LEAI_CONTRACT_VERSION` is a bounded non-secret contract identifier.
- `LEAI_ALLOWED_APP_BASES` is a comma-separated list of absolute path bases;
  each value starts and ends with `/`, contains no query, fragment, wildcard,
  backslash, or traversal segment, and is unique after parsing.

Local development receives explicit safe defaults. QA and Production fail
startup checks when any required value is absent or malformed. The endpoint
first verifies the configured database schema. Runtime verification failure
returns a no-store `503` response containing only
`{"error":"environment_unavailable"}`. Successful and failed responses never
expose a database URL, credential, provider key, Django secret, raw exception,
or internal connection detail.

The React schema in `src/api/environment.ts` remains the response authority.
The environment gate stays read-only until all six values match the selected
frontend manifest.

## Course operation capabilities

The canonical course operations are:

1. `course.view`
2. `draft.create`
3. `draft.edit`
4. `authoring.run`
5. `preview.run`
6. `survey.publish`
7. `occurrence.settings.update`
8. `team.configure`
9. `revision.create`
10. `responses.export`
11. `community_template.publish`
12. `community_template.withdraw`
13. `template.create`
14. `course.settings.update`
15. `analysis.run`

The backend exports this closed vocabulary from one module. Unknown capability
names fail closed. Capability arrays are deterministic, contain no duplicates,
and appear on every course entry returned by `instructor_me`, course list, and
course creation responses.

The role policy is:

| Operation group | Owner | Instructor | TA |
| --- | --- | --- | --- |
| View, draft create/edit, AI authoring, preview, private-template create, analysis | allow | allow | allow |
| Publish, occurrence settings, Team configuration, revised version, Community publish/withdraw | allow | allow | allow only when `can_publish` is true |
| Course settings | allow | allow | deny |
| Export responses | allow | allow | allow only when `can_export` is true |

`owner` and `instructor` are teacher-equivalent for product operations. The
owner distinction remains available for future ownership-transfer and
membership-management work. This also supports a researcher such as Ulia
receiving teacher-equivalent access to a specified course through an active
`instructor` membership, while institution-wide researcher access remains
owned by HAR-24.

Every protected endpoint declares one canonical operation when it calls the
course authorization helper. Reads use `course.view`; Builder, publication,
settings, Team, export, and Community mutations use their corresponding
operation. Authentication, active institution membership, active course
membership, institution/course identity, and operation permission are all
rechecked server-side on every request. Cross-course object identifiers never
substitute for course authorization.

The endpoint-family mapping is fixed for this issue:

| Endpoint family | Read operation | Mutation operation |
| --- | --- | --- |
| Course Banner and Customizations | `course.view` | `course.settings.update` |
| Survey cards and response reads | `course.view` | — |
| Legacy survey create/publish | — | `survey.publish` |
| Survey status/update/delete | `course.view` | `occurrence.settings.update` |
| Survey clone/revision freeze | — | `revision.create` |
| Response export | — | `responses.export` |
| Analysis chat, Quick Take, and PDF ingest | `course.view` | `analysis.run` |
| Team configuration | `course.view` | `team.configure` |
| Question-set draft list/detail/versions | `course.view` | `draft.create` or `draft.edit` |
| Authoring conversation/run | `course.view` | `authoring.run` |
| Preview capability | — | `preview.run` |
| Publish immutable revision | — | `survey.publish` |
| Save private template | — | `template.create` |
| Community publish/withdraw | — | `community_template.publish` or `community_template.withdraw` |

Public student and preview-token routes continue to use their separate
capability-token/session boundaries and do not accept instructor course
capabilities.

## Authentication state and retries

The authentication boundary keeps opaque bearer sessions whose raw token is
returned once and stored only as a digest.

- Login accepts exactly `email` and `password`. Invalid JSON, unknown fields,
  missing values, and invalid types return `400 invalid_request`. Unknown email,
  wrong password, inactive user, and inactive account all return the same
  `401 invalid_credentials` response. Each successful login creates one new
  independent session and returns `201`; login is not automatically retried by
  the React client.
- Protected requests treat missing, malformed, unknown, expired, and revoked
  bearer credentials as `401 authentication_required`. They do not disclose
  which condition occurred.
- Accounts with `must_change_password=true` may read their own profile, change
  the password, or log out. Course and other protected product operations
  return `403 password_change_required`.
- Logout is idempotent for a recognized session token. The first DELETE revokes
  the session and writes one audit event; an exact retry returns `204` without
  a second audit event. Missing, malformed, or unknown tokens still return
  `401 authentication_required`.
- Password change validates the current password and password policy, locks the
  relevant account, user, and current session rows, then rechecks session and
  password state inside the transaction. The winner changes the password,
  clears the forced-change gate, preserves the current session, revokes all
  other active sessions, and records one audit event atomically. A request that
  authenticated with the old password but loses a same-session race returns
  `409 password_change_conflict`; a request whose session was revoked by the
  winner returns `401 authentication_required`. Ordinary wrong-current-password
  input remains `400 invalid_current_password`.

No error payload includes an email address, bearer token, password value,
password hash, raw exception, or session digest.

## Legacy route removal

The clean backend URL configuration no longer exposes:

- `api/create_course/`
- `api/verify_course_password/`

Requests to either path return the normal Django `404`; there is no compatibility
flag and no React client. Authenticated course creation remains available only
through `POST api/instructor_courses/`. HAR-29 deletes the two unreferenced
legacy view functions after route removal; route-absence regression tests are
the security boundary.

## Audit visibility

Instructor audit events remain immutable and visible only through Django Admin
to authorized administrators. HAR-29 adds no instructor audit route and no
course audit payload. Tests assert that the proposed API route is absent and
that Admin retains read-only, newest-first behavior. A future instructor-facing
audit UI requires a separate reviewed issue covering course scope, pagination,
field allowlists, and privacy.

## React contract synchronization

The React repository updates its runtime schemas and fail-closed catalog only
after backend tests establish the wire contract:

- course membership/list/create schemas accept the canonical capability array;
- capability values are a closed Zod enum and unknown values are rejected;
- environment, authentication, and courses become `accepted` with no HAR-29
  gap ownership;
- legacy access remains `excluded`, with the reason updated to state that the
  routes are absent;
- audit read becomes `excluded` because the approved contract is Admin-only;
- no authenticated API client or QA hostname is added by HAR-29.

## TDD and acceptance evidence

Implementation is divided into independently reviewable RED-to-GREEN tasks:

1. Environment settings validation and exact handshake DTO.
2. Closed capability registry, role matrix, and serialized course DTOs.
3. Explicit operation authorization on every currently protected endpoint,
   including owner/instructor/TA and cross-course negative tests.
4. Legacy route removal and Admin-only audit boundary.
5. Strict login inputs, idempotent logout, and transactional password-change
   concurrency.
6. React Zod schemas/catalog synchronization and complete verification.

Backend acceptance requires the focused tests for each task, the full Django
suite, environment system checks, and cross-course authorization tests. React
acceptance requires focused Vitest tests, the full Vitest suite, typecheck,
lint, QA and Production builds, artifact identity checks, and client-secret
scanning. An independent reviewer must accept every task and the final combined
diff. QA and Production remain untouched until a separate deployment approval.
