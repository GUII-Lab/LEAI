import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EnvironmentGate, useEnvironmentWriteAccess } from './EnvironmentGate'
import { getEnvironment, qualifyBrowserKey, toAppHref } from '@/config/environment'
import type { PublicEnvironment } from '@/config/environment'
import { AppShell } from '@/components/product/AppShell'
import { PageHeader } from '@/components/product/PageHeader'
import { FeedbackAnalyzerPage } from './FeedbackAnalyzerPage'
import { FeedbackChatPage } from './FeedbackChatPage'
import { PromptDesignerPage } from './PromptDesignerPage'
import { CustomizationsPage } from './CustomizationsPage'
import { StudentSurveyPage } from './StudentSurveyPage'
import { InstructorAuthGate } from '@/auth/InstructorAuthGate'
import { AuthenticationRequiredError, createInstructorApi } from '@/api/instructor-v1'
import { loginHref } from '@/auth/navigation'
import { InstructorHomePage } from './InstructorHomePage'
import { CourseRouteGate } from './CourseRouteGate'
import { PageNotFound } from './PageNotFound'
import { WizardPreviewPage } from './WizardPreviewPage'

function Analyzer({ environment }: { environment: PublicEnvironment }) {
  const verified = useEnvironmentWriteAccess()
  const api = useMemo(() => createInstructorApi(environment, () => verified), [environment, verified])
  return <FeedbackAnalyzerPage api={api} environment={environment} verified={verified} />
}

function FeedbackChat({ environment }: { environment: PublicEnvironment }) {
  const verified = useEnvironmentWriteAccess()
  const api = useMemo(() => createInstructorApi(environment, () => verified), [environment, verified])
  return <FeedbackChatPage api={api} environment={environment} verified={verified} />
}

function PromptDesigner({ environment }: { environment: PublicEnvironment }) {
  const verified = useEnvironmentWriteAccess()
  const api = useMemo(() => createInstructorApi(environment, () => verified), [environment, verified])
  return <PromptDesignerPage api={api} environment={environment} verified={verified} />
}

function WizardPreview({ environment }: { environment: PublicEnvironment }) {
  const verified = useEnvironmentWriteAccess()
  const api = useMemo(() => createInstructorApi(environment, () => verified), [environment, verified])
  return <WizardPreviewPage api={api} environment={environment} />
}

function StudentSurvey({ environment }: { environment: PublicEnvironment }) {
  const verified = useEnvironmentWriteAccess()
  return <StudentSurveyPage environment={environment} verified={verified} />
}

function Customizations({ environment }: { environment: PublicEnvironment }) {
  const verified = useEnvironmentWriteAccess()
  return <CustomizationsPage environment={environment} verified={verified} />
}

const accountDestinations = [
  { id: 'account', label: 'Account', path: 'InstructorHome.html?view=account' },
  { id: 'all-courses', label: 'All Courses', path: 'InstructorHome.html' },
]

const courseDestinations = [
  { id: 'prompt-designer', label: 'Prompt Designer', path: 'PromptDesigner.html' },
  { id: 'feedback-analyzer', label: 'Feedback Analyzer', path: 'FeedbackAnalyzer.html' },
  { id: 'feedback-chat', label: 'Feedback Chat', path: 'FeedbackChat.html' },
  { id: 'settings', label: 'Settings', path: 'Customizations.html' },
]

export function App({
  activeItem = 'all-courses',
  description = 'Learning experience workspace',
  pageTitle = 'LEAI',
}: {
  activeItem?: string
  description?: string
  pageTitle?: string
}) {
  const environment = getEnvironment()
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const accountItems = accountDestinations.map(({ path, ...item }) => ({
    ...item,
    href: toAppHref(environment, path),
  }))
  const courseItems = courseDestinations.map(({ path, ...item }) => ({
    ...item,
    href: toAppHref(environment, path),
  }))
  const isCourseRoute = courseDestinations.some(({ id }) => id === activeItem)

  async function signOut() {
    setSigningOut(true)
    setSignOutError('')
    try {
      await createInstructorApi(environment, () => true).logout()
    } catch (error) {
      if (!(error instanceof AuthenticationRequiredError)) {
        setSignOutError('Could not sign out. Please try again.')
        setSigningOut(false)
        return
      }
    }
    await queryClient.cancelQueries()
    queryClient.clear()
    sessionStorage.removeItem(qualifyBrowserKey(environment.name, 'selected-course'))
    sessionStorage.removeItem(qualifyBrowserKey(environment.name, 'instructor-token'))
    window.location.replace(loginHref(environment, window.location.pathname))
  }

  return (
    <EnvironmentGate environment={environment}>
      {activeItem === 'feedback' ? (
        <StudentSurvey environment={environment} />
      ) : activeItem === 'wizard-preview' ? (
        <InstructorAuthGate environment={environment}>
          <CourseRouteGate environment={environment}><WizardPreview environment={environment} /></CourseRouteGate>
        </InstructorAuthGate>
      ) : activeItem === 'not-found' ? (
        renderWorkspace()
      ) : (
        <InstructorAuthGate environment={environment}>
          {isCourseRoute ? (
            <CourseRouteGate environment={environment}>
              {renderWorkspace()}
            </CourseRouteGate>
          ) : renderWorkspace()}
        </InstructorAuthGate>
      )}
    </EnvironmentGate>
  )

  function renderWorkspace() {
    return (
      <AppShell
        accountItems={accountItems}
        activeItem={activeItem}
        courseItems={courseItems}
        courseName="Instructor workspace"
        environment={environment}
        onSignOut={() => { void signOut() }}
        showCourseNavigation={activeItem !== 'not-found' && activeItem !== 'account' && activeItem !== 'all-courses'}
        signingOut={signingOut}
        signOutError={signOutError}
      >
        {activeItem === 'all-courses'
          ? <InstructorHomePage environment={environment} verified />
          : activeItem === 'not-found'
            ? <PageNotFound environment={environment} />
            : <PageHeader badge={activeItem === 'prompt-designer' ? 'Feedback' : undefined} description={activeItem === 'feedback-chat' ? <>Chat with your survey data. <a className="text-primary hover:underline" href={toAppHref(environment, 'FeedbackAnalyzer.html')}>← Back to Analyzer</a></> : description} title={pageTitle} />}
        {activeItem === 'feedback-analyzer' && <Analyzer environment={environment} />}
        {activeItem === 'feedback-chat' && <FeedbackChat environment={environment} />}
        {activeItem === 'prompt-designer' && <PromptDesigner environment={environment} />}
        {activeItem === 'settings' && <Customizations environment={environment} />}
      </AppShell>
    )
  }
}
