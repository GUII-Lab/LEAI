import { describe, expect, it } from 'vitest'
import { endpointContracts, getEndpointContract } from './catalog'

const expectedIds = [
  'environment', 'authentication', 'courses', 'legacy-access', 'audit-read',
  'drafts', 'ai-authoring', 'revision', 'preview', 'publication',
  'managed-survey', 'team', 'student-entry', 'response-session',
  'public-privacy', 'completion-outputs', 'analysis', 'feedback-chat',
  'voice-ai-proxies', 'pdf-ingest', 'course-tools',
] as const

describe('endpointContracts', () => {
  it('contains every audited capability exactly once with stable identifiers', () => {
    const actualIds = endpointContracts.map(({ id }) => id)
    expect(actualIds).toEqual(expectedIds)
    expect(new Set(actualIds).size).toBe(expectedIds.length)
    expect(endpointContracts).toHaveLength(expectedIds.length)
  })

  it('derives bindability only from an accepted status', () => {
    for (const contract of endpointContracts) {
      expect(contract.bindable).toBe(
        contract.status === 'accepted' || contract.status === 'accepted_with_limits',
      )
    }
  })

  it('links every blocked capability to an approved backend gap issue', () => {
    const approved = new Set(['HAR-29', 'HAR-30', 'HAR-31', 'HAR-32', 'HAR-33'])
    for (const contract of endpointContracts) {
      if (contract.status === 'blocked') {
        expect(contract.gapIssue).toBeDefined()
        expect(approved.has(contract.gapIssue ?? '')).toBe(true)
      }
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

  it.each([
    'environment', 'team', 'response-session', 'analysis',
    'voice-ai-proxies', 'public-privacy',
  ] as const)('keeps %s fail-closed', (id) => {
    expect(getEndpointContract(id).bindable).toBe(false)
  })

  it('returns canonical entries and rejects unknown identifiers', () => {
    expect(getEndpointContract('revision')).toBe(endpointContracts[7])
    expect(() => getEndpointContract('unknown')).toThrow(
      'Unknown endpoint contract: unknown',
    )
  })

  it('provides non-empty audit evidence for every entry', () => {
    for (const contract of endpointContracts) {
      expect(contract.domain.length).toBeGreaterThan(0)
      expect(contract.routeFamily.length).toBeGreaterThan(0)
      expect(contract.methods.length).toBeGreaterThan(0)
      expect(contract.reason.trim().length).toBeGreaterThan(0)
    }
  })

  it('exposes deeply immutable catalog metadata', () => {
    expect(Object.isFrozen(endpointContracts)).toBe(true)
    for (const contract of endpointContracts) {
      expect(Object.isFrozen(contract)).toBe(true)
      expect(Object.isFrozen(contract.methods)).toBe(true)
    }
  })
})
