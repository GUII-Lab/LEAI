import { toAppHref, type PublicEnvironment } from '@/config/environment'

const instructorPages = [
  'InstructorHome.html',
  'PromptDesigner.html',
  'WizardPreview.html',
  'FeedbackAnalyzer.html',
  'FeedbackChat.html',
  'CourseBanner.html',
  'Customizations.html',
  'NotFound.html',
] as const

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const messageId = /^\d{1,20}$/
const returnOrigin = 'https://leai-return.invalid'

export function safeInstructorDestination(environment: PublicEnvironment, requested: string | null) {
  const home = toAppHref(environment, 'InstructorHome.html')
  if (!requested?.startsWith('/') || requested.startsWith('//') || requested.length > 1024) return home

  let candidate: URL
  try {
    candidate = new URL(requested, returnOrigin)
  } catch {
    return home
  }
  const allowed = instructorPages.map((page) => toAppHref(environment, page))
  if (candidate.origin !== returnOrigin || !allowed.includes(candidate.pathname as (typeof allowed)[number]) || candidate.hash) return home
  if (!candidate.search) return candidate.pathname

  const page = candidate.pathname.split('/').at(-1)
  const accepted = page === 'FeedbackAnalyzer.html'
    ? { course_id: uuid, occurrence_id: uuid, response_id: uuid, response_message_id: messageId }
    : page === 'FeedbackChat.html'
      ? { course_id: uuid, chat_id: uuid, occurrence_id: uuid }
      : page === 'InstructorHome.html'
        ? { view: /^account$/ }
        : null
  if (!accepted || (page !== 'InstructorHome.html' && !candidate.searchParams.has('course_id'))) return home
  const seen = new Set<string>()
  for (const [key, value] of candidate.searchParams) {
    const pattern = accepted[key as keyof typeof accepted]
    if (!pattern || seen.has(key) || !pattern.test(value)) return home
    seen.add(key)
  }
  return candidate.pathname + candidate.search
}

export function loginHref(environment: PublicEnvironment, requested: string) {
  const next = safeInstructorDestination(environment, requested)
  return `${toAppHref(environment, 'InstructorLogin.html')}?${new URLSearchParams({ next })}`
}
