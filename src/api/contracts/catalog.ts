export type ContractDomain =
  | 'environment'
  | 'instructor'
  | 'authoring'
  | 'student'
  | 'analysis'
  | 'course_tools'

export type ContractStatus =
  | 'accepted'
  | 'accepted_with_limits'
  | 'blocked'
  | 'excluded'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type GapIssue = 'HAR-29' | 'HAR-30' | 'HAR-31' | 'HAR-32' | 'HAR-33'

type EndpointContractSource = Readonly<{
  id: string
  domain: ContractDomain
  routeFamily: string
  methods: readonly HttpMethod[]
  status: ContractStatus
  reason: string
  gapIssues: readonly GapIssue[]
}>

export type EndpointContract = EndpointContractSource & Readonly<{ bindable: boolean }>

const sources = [
  {
    id: 'environment', domain: 'environment', routeFamily: 'api/environment/',
    methods: ['GET'], status: 'blocked', gapIssues: ['HAR-29'],
    reason: 'The current DTO does not prove the complete frontend environment identity.',
  },
  {
    id: 'authentication', domain: 'instructor',
    routeFamily: 'instructor_sessions, instructor_me, instructor_password',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'], status: 'accepted_with_limits', gapIssues: ['HAR-29'],
    reason: 'Session, expiry, forced password change, revocation, profile, and password behavior are evidenced; retry and concurrency semantics remain limited.',
  },
  {
    id: 'courses', domain: 'instructor', routeFamily: 'api/instructor_courses/',
    methods: ['GET', 'POST'], status: 'accepted_with_limits', gapIssues: ['HAR-29'],
    reason: 'Membership-scoped list and create are evidenced, but complete operation capabilities are absent.',
  },
  {
    id: 'legacy-access', domain: 'instructor',
    routeFamily: 'create_course, verify_course_password', methods: ['POST'],
    status: 'excluded', gapIssues: ['HAR-29'],
    reason: 'Anonymous shared-password compatibility is outside the React product.',
  },
  {
    id: 'audit-read', domain: 'instructor', routeFamily: 'instructor audit API',
    methods: ['GET'], status: 'blocked', gapIssues: ['HAR-29'],
    reason: 'Audit rows exist without a reviewed instructor-facing read API.',
  },
  {
    id: 'drafts', domain: 'authoring',
    routeFamily: 'question sets: list, create, detail, save, versions, restore',
    methods: ['GET', 'POST', 'PATCH'], status: 'accepted_with_limits', gapIssues: ['HAR-30'],
    reason: 'Optimistic save, idempotency, checkpoints, and restore are evidenced for active workflows.',
  },
  {
    id: 'ai-authoring', domain: 'authoring',
    routeFamily: 'question-set authoring conversation and runs', methods: ['GET', 'POST'],
    status: 'blocked', gapIssues: ['HAR-30'],
    reason: 'Retry and pre-run checkpoint semantics are not safe enough for a React client.',
  },
  {
    id: 'revision', domain: 'authoring', routeFamily: 'question-set revision freeze',
    methods: ['POST'], status: 'accepted', gapIssues: [],
    reason: 'Content-addressed freeze and immutable model/query identity are evidenced.',
  },
  {
    id: 'preview', domain: 'authoring',
    routeFamily: 'preview capability, token, messages, complete, skip, settings',
    methods: ['GET', 'POST', 'PATCH'], status: 'accepted_with_limits', gapIssues: ['HAR-30'],
    reason: 'Frozen-revision isolation and completion evidence are tested; retry semantics remain limited.',
  },
  {
    id: 'publication', domain: 'authoring', routeFamily: 'revision survey creation',
    methods: ['POST'], status: 'accepted_with_limits', gapIssues: ['HAR-33'],
    reason: 'Transactional idempotent Individual publication is evidenced; Team setup-later is absent.',
  },
  {
    id: 'managed-survey', domain: 'authoring',
    routeFamily: 'survey cards, status, settings, revised version',
    methods: ['GET', 'POST'], status: 'blocked', gapIssues: ['HAR-30'],
    reason: 'Cards lack capabilities and managed settings/revised-version contracts are incomplete.',
  },
  {
    id: 'team', domain: 'authoring',
    routeFamily: 'team configuration, snapshots, and selection',
    methods: ['GET', 'POST'], status: 'blocked', gapIssues: ['HAR-33'],
    reason: 'Setup-later, immutable snapshots, and occurrence-scoped locked selection are absent.',
  },
  {
    id: 'student-entry', domain: 'student', routeFamily: 'public survey lookup',
    methods: ['GET'], status: 'blocked', gapIssues: ['HAR-32', 'HAR-33'],
    reason: 'Lifecycle is not an explicit state union and Team-pending cannot be represented.',
  },
  {
    id: 'response-session', domain: 'student',
    routeFamily: 'message, bulk, resume, completion', methods: ['GET', 'POST'],
    status: 'blocked', gapIssues: ['HAR-32'],
    reason: 'Identity and role are caller-controlled and writes lack authoritative idempotent completion.',
  },
  {
    id: 'public-privacy', domain: 'student',
    routeFamily: 'public transcript and assignment-list reads', methods: ['GET'],
    status: 'excluded', gapIssues: ['HAR-32'],
    reason: 'Unauthenticated routes disclose transcript or session metadata.',
  },
  {
    id: 'completion-outputs', domain: 'student',
    routeFamily: 'completion certificate and completed-response document',
    methods: ['POST'], status: 'blocked', gapIssues: ['HAR-32', 'HAR-31'],
    reason: 'Eligibility is not tied to authoritative completion and the response document is absent.',
  },
  {
    id: 'analysis', domain: 'analysis',
    routeFamily: 'survey/course analysis reads and Quick Take', methods: ['GET', 'POST', 'DELETE'],
    status: 'blocked', gapIssues: ['HAR-31'],
    reason: 'Session grouping and denominators disagree, and occurrence identity can be merged.',
  },
  {
    id: 'feedback-chat', domain: 'analysis',
    routeFamily: 'Feedback Chat sessions, turns, and polling', methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    status: 'blocked', gapIssues: ['HAR-31'],
    reason: 'Mutations lack request idempotency and a unified asynchronous contract.',
  },
  {
    id: 'voice-ai-proxies', domain: 'student',
    routeFamily: 'speech-to-text, text-to-speech, and chat proxies', methods: ['POST'],
    status: 'blocked', gapIssues: ['HAR-31'],
    reason: 'Provider proxies lack reviewed capabilities and media/rate policy.',
  },
  {
    id: 'pdf-ingest', domain: 'analysis',
    routeFamily: 'PDF ingest jobs, commit, batches, and revert',
    methods: ['GET', 'POST', 'DELETE'], status: 'blocked', gapIssues: ['HAR-31'],
    reason: 'Commit retry and private-text boundaries lack an accepted contract.',
  },
  {
    id: 'course-tools', domain: 'course_tools',
    routeFamily: 'Course Banner and Customizations', methods: ['GET', 'POST'],
    status: 'blocked', gapIssues: ['HAR-31'],
    reason: 'Writes are unversioned and some invalid types are truthiness-coerced.',
  },
] as const satisfies readonly EndpointContractSource[]

export type EndpointContractId = (typeof sources)[number]['id']

export const endpointContracts: readonly EndpointContract[] = Object.freeze(
  sources.map((source) => Object.freeze({
    ...source,
    methods: Object.freeze([...source.methods]),
    gapIssues: Object.freeze([...source.gapIssues]),
    bindable: source.status === 'accepted' || source.status === 'accepted_with_limits',
  })),
)

export function getEndpointContract(id: string): EndpointContract {
  const contract = endpointContracts.find((candidate) => candidate.id === id)
  if (!contract) {
    throw new Error(`Unknown endpoint contract: ${id}`)
  }
  return contract
}
