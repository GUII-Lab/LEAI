import { describe, expect, it } from 'vitest'
import { endpointContracts, getEndpointContract } from './catalog'

const expectedAuditRows = [
  ['environment', 'environment', 'api/environment/', ['GET'], 'blocked', ['HAR-29'], 'The current DTO does not prove the complete frontend environment identity.'],
  ['authentication', 'instructor', 'instructor_sessions, instructor_me, instructor_password', ['GET', 'POST', 'PATCH', 'DELETE'], 'accepted_with_limits', ['HAR-29'], 'Session, expiry, forced password change, revocation, profile, and password behavior are evidenced; retry and concurrency semantics remain limited.'],
  ['courses', 'instructor', 'api/instructor_courses/', ['GET', 'POST'], 'accepted_with_limits', ['HAR-29'], 'Membership-scoped list and create are evidenced, but complete operation capabilities are absent.'],
  ['legacy-access', 'instructor', 'create_course, verify_course_password', ['POST'], 'excluded', ['HAR-29'], 'Anonymous shared-password compatibility is outside the React product.'],
  ['audit-read', 'instructor', 'instructor audit API', ['GET'], 'blocked', ['HAR-29'], 'Audit rows exist without a reviewed instructor-facing read API.'],
  ['drafts', 'authoring', 'question sets: list, create, detail, save, versions, restore', ['GET', 'POST', 'PATCH'], 'accepted_with_limits', ['HAR-30'], 'Optimistic save, idempotency, checkpoints, and restore are evidenced for active workflows.'],
  ['ai-authoring', 'authoring', 'question-set authoring conversation and runs', ['GET', 'POST'], 'blocked', ['HAR-30'], 'Retry and pre-run checkpoint semantics are not safe enough for a React client.'],
  ['revision', 'authoring', 'question-set revision freeze', ['POST'], 'accepted', [], 'Content-addressed freeze and immutable model/query identity are evidenced.'],
  ['preview', 'authoring', 'preview capability, token, messages, complete, skip, settings', ['GET', 'POST', 'PATCH'], 'accepted_with_limits', ['HAR-30'], 'Frozen-revision isolation and completion evidence are tested; retry semantics remain limited.'],
  ['publication', 'authoring', 'revision survey creation', ['POST'], 'accepted_with_limits', ['HAR-33'], 'Transactional idempotent Individual publication is evidenced; Team setup-later is absent.'],
  ['managed-survey', 'authoring', 'survey cards, status, settings, revised version', ['GET', 'POST'], 'blocked', ['HAR-30'], 'Cards lack capabilities and managed settings/revised-version contracts are incomplete.'],
  ['team', 'authoring', 'team configuration, snapshots, and selection', ['GET', 'POST'], 'blocked', ['HAR-33'], 'Setup-later, immutable snapshots, and occurrence-scoped locked selection are absent.'],
  ['student-entry', 'student', 'public survey lookup', ['GET'], 'blocked', ['HAR-32', 'HAR-33'], 'Lifecycle is not an explicit state union and Team-pending cannot be represented.'],
  ['response-session', 'student', 'message, bulk, resume, completion', ['GET', 'POST'], 'blocked', ['HAR-32'], 'Identity and role are caller-controlled and writes lack authoritative idempotent completion.'],
  ['public-privacy', 'student', 'public transcript and assignment-list reads', ['GET'], 'excluded', ['HAR-32'], 'Unauthenticated routes disclose transcript or session metadata.'],
  ['completion-outputs', 'student', 'completion certificate and completed-response document', ['POST'], 'blocked', ['HAR-32', 'HAR-31'], 'Eligibility is not tied to authoritative completion and the response document is absent.'],
  ['analysis', 'analysis', 'survey/course analysis reads and Quick Take', ['GET', 'POST'], 'blocked', ['HAR-31'], 'Session grouping and denominators disagree, and occurrence identity can be merged.'],
  ['feedback-chat', 'analysis', 'Feedback Chat sessions, turns, and polling', ['GET', 'POST', 'PATCH', 'DELETE'], 'blocked', ['HAR-31'], 'Mutations lack request idempotency and a unified asynchronous contract.'],
  ['voice-ai-proxies', 'student', 'speech-to-text, text-to-speech, and chat proxies', ['POST'], 'blocked', ['HAR-31'], 'Provider proxies lack reviewed capabilities and media/rate policy.'],
  ['pdf-ingest', 'analysis', 'PDF ingest jobs, commit, batches, and revert', ['GET', 'POST', 'DELETE'], 'blocked', ['HAR-31'], 'Commit retry and private-text boundaries lack an accepted contract.'],
  ['course-tools', 'course_tools', 'Course Banner and Customizations', ['GET', 'POST'], 'blocked', ['HAR-31'], 'Writes are unversioned and some invalid types are truthiness-coerced.'],
] as const

describe('endpointContracts', () => {
  it('matches every canonical audit row exactly once', () => {
    expect(endpointContracts.map((contract) => [
      contract.id,
      contract.domain,
      contract.routeFamily,
      contract.methods,
      contract.status,
      contract.gapIssues,
      contract.reason,
    ])).toEqual(expectedAuditRows)
    expect(new Set(endpointContracts.map(({ id }) => id)).size).toBe(expectedAuditRows.length)
  })

  it('derives bindability only from an accepted status', () => {
    for (const contract of endpointContracts) {
      expect(contract.bindable).toBe(
        contract.status === 'accepted' || contract.status === 'accepted_with_limits',
      )
    }
  })

  it('links every blocked capability to all approved backend gap issues', () => {
    const approved = new Set(['HAR-29', 'HAR-30', 'HAR-31', 'HAR-32', 'HAR-33'])
    for (const contract of endpointContracts) {
      if (contract.status === 'blocked') expect(contract.gapIssues.length).toBeGreaterThan(0)
      for (const issue of contract.gapIssues) expect(approved.has(issue)).toBe(true)
    }
  })

  it('keeps excluded legacy/privacy surfaces without client modules', () => {
    const excluded = endpointContracts.filter(({ status }) => status === 'excluded')
    expect(excluded.map(({ id }) => id)).toEqual(['legacy-access', 'public-privacy'])
    for (const contract of excluded) {
      expect(contract.bindable).toBe(false)
      expect('clientModule' in contract).toBe(false)
    }
  })

  it.each(['environment', 'team', 'response-session', 'analysis', 'voice-ai-proxies', 'public-privacy'] as const)(
    'keeps %s fail-closed',
    (id) => expect(getEndpointContract(id).bindable).toBe(false),
  )

  it('returns canonical entries and rejects unknown identifiers', () => {
    expect(getEndpointContract('revision')).toBe(endpointContracts[7])
    expect(() => getEndpointContract('unknown')).toThrow('Unknown endpoint contract: unknown')
  })

  it('exposes deeply immutable catalog metadata', () => {
    expect(Object.isFrozen(endpointContracts)).toBe(true)
    for (const contract of endpointContracts) {
      expect(Object.isFrozen(contract)).toBe(true)
      expect(Object.isFrozen(contract.methods)).toBe(true)
      expect(Object.isFrozen(contract.gapIssues)).toBe(true)
    }
  })
})
