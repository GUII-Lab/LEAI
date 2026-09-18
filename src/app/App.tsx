import { EnvironmentGate } from './EnvironmentGate'
import { getEnvironment, toAppHref } from '@/config/environment'
import { AppShell } from '@/components/product/AppShell'
import { PageHeader } from '@/components/product/PageHeader'

const accountDestinations = [
  { id: 'account', label: 'Account', path: 'account' },
  { id: 'all-courses', label: 'All Courses', path: 'InstructorHome.html' },
]

const courseDestinations = [
  { id: 'prompt-designer', label: 'Prompt Designer', path: 'PromptDesigner.html' },
  { id: 'feedback-analyzer', label: 'Feedback Analyzer', path: 'FeedbackAnalyzer.html' },
  { id: 'feedback-chat', label: 'Feedback Chat', path: 'FeedbackChat.html' },
  { id: 'course-banner', label: 'Course Banner', path: 'CourseBanner.html' },
  { id: 'customizations', label: 'Customizations', path: 'Customizations.html' },
]

export function App({
  activeItem = 'prompt-designer',
  description = 'Learning experience workspace',
  pageTitle = 'LEAI',
}: {
  activeItem?: string
  description?: string
  pageTitle?: string
}) {
  const environment = getEnvironment()
  const accountItems = accountDestinations.map(({ path, ...item }) => ({
    ...item,
    href: toAppHref(environment, path),
  }))
  const courseItems = courseDestinations.map(({ path, ...item }) => ({
    ...item,
    href: toAppHref(environment, path),
  }))

  return (
    <EnvironmentGate environment={environment}>
      <AppShell
        accountItems={accountItems}
        activeItem={activeItem}
        courseItems={courseItems}
        courseName="Instructor workspace"
        environment={environment}
      >
        <PageHeader description={description} title={pageTitle} />
      </AppShell>
    </EnvironmentGate>
  )
}
