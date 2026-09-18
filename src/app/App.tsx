import { EnvironmentGate } from './EnvironmentGate'
import { getEnvironment } from '@/config/environment'
import { AppShell } from '@/components/product/AppShell'
import { PageHeader } from '@/components/product/PageHeader'

const accountItems = [
  { id: 'account', label: 'Account', href: '/account' },
  { id: 'all-courses', label: 'All Courses', href: '/InstructorHome.html' },
]

const courseItems = [
  { id: 'prompt-designer', label: 'Prompt Designer', href: '/PromptDesigner.html' },
  { id: 'feedback-analyzer', label: 'Feedback Analyzer', href: '/FeedbackAnalyzer.html' },
  { id: 'feedback-chat', label: 'Feedback Chat', href: '/FeedbackChat.html' },
  { id: 'course-banner', label: 'Course Banner', href: '/CourseBanner.html' },
  { id: 'customizations', label: 'Customizations', href: '/Customizations.html' },
]

export function App() {
  const environment = getEnvironment()

  return (
    <EnvironmentGate environment={environment}>
      <AppShell
        accountItems={accountItems}
        activeItem="prompt-designer"
        courseItems={courseItems}
        courseName="Instructor workspace"
        environment={environment}
      >
        <PageHeader description="Learning experience workspace" title="LEAI" />
      </AppShell>
    </EnvironmentGate>
  )
}
