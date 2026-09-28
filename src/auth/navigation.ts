import { toAppHref, type PublicEnvironment } from '@/config/environment'

const instructorPages = [
  'InstructorHome.html',
  'PromptDesigner.html',
  'FeedbackAnalyzer.html',
  'FeedbackChat.html',
  'CourseBanner.html',
  'Customizations.html',
  'NotFound.html',
] as const

export function safeInstructorDestination(environment: PublicEnvironment, requested: string | null) {
  const allowed = instructorPages.map((page) => toAppHref(environment, page))
  return requested && allowed.includes(requested as (typeof allowed)[number])
    ? requested
    : toAppHref(environment, 'InstructorHome.html')
}

export function loginHref(environment: PublicEnvironment, requested: string) {
  const next = safeInstructorDestination(environment, requested)
  return `${toAppHref(environment, 'InstructorLogin.html')}?${new URLSearchParams({ next })}`
}
