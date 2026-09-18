import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import type { EnvironmentManifest } from '@/config/environment'
import { AppShell } from './AppShell'

const qaEnvironment: EnvironmentManifest = {
  name: 'qa',
  apiBaseUrl: 'https://leai-qa.invalid/api/',
  appBasePath: '/LEAI/qa/',
  storagePrefix: 'leai:qa',
  buildSha: 'test-build',
  environmentLabel: 'QA',
  expectedBackend: {
    buildSha: 'test-backend',
    schemaIdentity: 'test-schema',
    contractVersion: '2026-09-17',
  },
}

const accountItems = [
  { id: 'account', label: 'Account', href: '/account' },
  { id: 'all-courses', label: 'All Courses', href: '/InstructorHome.html' },
]

const courseItems = [
  { id: 'prompt-designer', label: 'Prompt Designer', href: '/PromptDesigner.html' },
  { id: 'feedback-analyzer', label: 'Feedback Analyzer', href: '/FeedbackAnalyzer.html' },
]

function renderShell() {
  return render(
    <AppShell
      accountItems={accountItems}
      activeItem="prompt-designer"
      courseItems={courseItems}
      environment={qaEnvironment}
    >
      <p>Page content</p>
    </AppShell>,
  )
}

it('keeps All Courses in account navigation and course tools in course navigation', () => {
  renderShell()

  expect(screen.getAllByRole('link', { name: 'All Courses' })).toHaveLength(1)
  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toHaveTextContent(
    'All Courses',
  )
  expect(screen.getByRole('navigation', { name: 'Course navigation' })).toHaveTextContent(
    'Prompt Designer',
  )
  expect(screen.getByRole('navigation', { name: 'Course navigation' })).not.toHaveTextContent(
    'All Courses',
  )
  expect(screen.getByText('QA environment')).toBeInTheDocument()
})

it('opens the mobile navigation in a Sheet and returns focus on Escape', async () => {
  const user = userEvent.setup()
  renderShell()

  const trigger = screen.getByRole('button', { name: 'Open navigation' })
  await user.click(trigger)
  expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument()

  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(trigger).toHaveFocus()
})
