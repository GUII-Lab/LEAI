# LEAI Backend Contract Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the HAR-17 typed, runtime-validated React boundary and a fail-closed catalog that prevents unsupported QA endpoints from being bound as usable clients.

**Architecture:** Small domain contract modules own Zod wire schemas and inferred TypeScript types. A shared response parser normalizes privacy-safe failures. A machine-readable endpoint catalog distinguishes accepted, blocked, and excluded surfaces and links every blocked surface to its backend issue; it exports metadata only, never callable clients.

**Tech Stack:** TypeScript strict mode, Zod 4, Vitest, Vite

**Spec:** `docs/product-strategy/2026-09-21-leai-backend-contract-audit.md`

## Global Constraints

- Work directly on `main`; do not create a branch.
- Use strict TDD: observe the intended RED before writing production code.
- Preserve backend `snake_case` in wire schemas; map only after validation.
- Do not add callable clients for `blocked` or `excluded` catalog entries.
- Do not bind a QA host, deploy, push, access private data, or modify QA/Production.
- Do not add a state library or install a package; Zod and Vitest already exist.
- Diagnostics must never retain raw response bodies, credentials, bearer tokens, transcripts, provider payloads, or uploaded documents.

---

### Task 1: Normalize API responses and failures

**Files:**
- Create: `src/api/contracts/errors.ts`
- Create: `src/api/contracts/errors.test.ts`
- Create: `src/api/contracts/response.ts`
- Create: `src/api/contracts/response.test.ts`

**Interfaces:**
- Produces: `ApiFailureKind`, `ApiFailure`, `isApiFailure()`, `parseJsonResponse<T>(response, schema)`.
- `parseJsonResponse` returns parsed `T` for a successful valid JSON response and throws one privacy-safe `ApiFailure` for HTTP, malformed JSON, or schema errors.

- [x] Add tests that require exact normalization for `401`, `403`, nondisclosing `404`, `409`, `422`, `429`, `5xx`, malformed JSON, and schema-invalid success bodies.
- [x] Add a test proving raw transcript text and an `Authorization`-like value present in an error body are absent from the thrown object and message.
- [x] Run `npm test -- --run src/api/contracts/errors.test.ts src/api/contracts/response.test.ts` and verify RED because the modules do not exist.
- [x] Implement a discriminated `ApiFailure` with `kind`, `status`, optional `code`, optional `requestId`, and `retryable`; retain no raw body.
- [x] Implement `parseJsonResponse` using `response.json()` and a supplied Zod schema. Parse only the safe envelope fields `error`, `code`, `message`, `request_id`, and `retryable`, but do not retain server `message` in diagnostics until its privacy contract is accepted.
- [x] Re-run the focused tests and `npm run typecheck`; keep implementation minimal.
- [x] Commit only the four files as `feat: add typed API response boundary`.

### Task 2: Create the fail-closed endpoint catalog

**Files:**
- Create: `src/api/contracts/catalog.ts`
- Create: `src/api/contracts/catalog.test.ts`

**Interfaces:**
- Produces: `ContractDomain`, `ContractStatus`, `EndpointContract`, `endpointContracts`, `getEndpointContract(id)`.
- Each entry includes stable `id`, domain, route family, methods, status, reason,
  and a complete `gapIssues` array.

- [x] Write tests requiring every capability row in the HAR-17 spec to exist exactly once, stable IDs to be unique, blocked entries to use `HAR-29`–`HAR-33`, excluded entries to have no client module, and only accepted/accepted-with-limits entries to report `bindable: true`.
- [x] Write a test proving `environment`, Team, response-session, analysis, voice, and public transcript surfaces are not bindable.
- [x] Run `npm test -- --run src/api/contracts/catalog.test.ts` and verify RED because the catalog does not exist.
- [x] Implement readonly catalog data and derive `bindable` from status rather than hand-writing it.
- [x] Re-run the focused tests and `npm run typecheck`.
- [x] Commit the two files as `feat: catalog audited backend contracts`.

### Task 3: Type the accepted instructor and course boundary

**Files:**
- Create: `src/api/contracts/instructor.ts`
- Create: `src/api/contracts/instructor.test.ts`

**Interfaces:**
- Produces Zod schemas and inferred wire types for login request/response, profile patch, password change, institution membership, course membership, instructor account, course list, course create request, and course create response.
- Schemas describe the evidenced current backend wire format only. Operation-level target capabilities remain blocked under HAR-29 and are not inferred from `role`.

- [x] Add representative valid fixtures sourced from current backend serializers/tests and malformed fixtures for missing identity, invalid roles, invalid timestamps, and invented capabilities.
- [x] Verify login preserves `token`, `expires_at`, and `must_change_password`; account/course schemas preserve current nullable fields without treating them as target capability truth.
- [x] Run `npm test -- --run src/api/contracts/instructor.test.ts` and verify RED because the schemas do not exist.
- [x] Implement strict Zod wire schemas and inferred exported types. Request schemas reject unknown fields.
- [x] Re-run focused tests and `npm run typecheck`.
- [x] Commit the two files as `feat: type instructor and course contracts`.

### Task 4: Type the accepted authoring, revision, preview, and Individual publication boundary

**Files:**
- Create: `src/api/contracts/authoring.ts`
- Create: `src/api/contracts/authoring.test.ts`

**Interfaces:**
- Produces schemas/types for active draft summary/detail, draft save/restore, immutable revision, preview capability/status/settings, and Individual publication request/response.
- Team publication, managed settings, revised-version creation, and AI runs remain catalog-blocked and are not exported as callable contracts.

- [x] Add valid fixtures sourced from backend serializers/tests for draft versioning, revision identity, preview timing/settings, and idempotent Individual publication.
- [x] Add malformed fixtures for wrong audience/style combinations, non-integer versions, invalid timestamps, missing revision identity, and Team fields on the Individual publication request.
- [x] Run `npm test -- --run src/api/contracts/authoring.test.ts` and verify RED because the schemas do not exist.
- [x] Implement strict schemas with discriminated audience/style and explicit nullable fields. Use `z.unknown()` only for the canonical body until its per-mode schema is implemented by the Builder task.
- [x] Re-run focused tests and `npm run typecheck`.
- [x] Commit the two files as `feat: type accepted authoring contracts`.

### Task 5: Verify and close the audit

**Files:**
- Modify: `docs/product-strategy/2026-09-17-leai-react-api-contract.md`
- Modify: `docs/superpowers/plans/2026-09-17-leai-react-rewrite-master-roadmap.md`
- Modify: `docs/product-strategy/2026-09-21-leai-backend-contract-audit.md` only for evidenced corrections.

**Interfaces:**
- Consumes all prior tasks.
- Produces final HAR-17 evidence and leaves QA fail-closed/read-only.

- [x] Add a short audit-result section to the API baseline linking the detailed audit, catalog, typed modules, and HAR-29–HAR-33.
- [x] Mark M0.11 complete only after independent review accepts the complete change set.
- [x] Run `npm test -- --run`, `npm run typecheck`, `npm run lint`, `npm run build:qa`, `npm run build:production`, and `git diff --check`.
- [x] Inspect both generated artifacts for a bound QA API host, credentials, provider keys, private exports, or service-worker files; fail if any appear.
- [x] Independently review the complete diff against HAR-17 and this plan; fix every Critical/Important finding with a fresh RED→GREEN cycle.
- [x] Commit only the accepted documentation updates as `docs: close HAR-17 contract audit`.
- [x] Update Linear HAR-17 with exact commits, test/build evidence, five gap issues, and the explicit statement that no QA API was bound or deployed.
