import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
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
  { id: 'account', label: 'Account', href: '/LEAI/qa/InstructorHome.html?view=account' },
  { id: 'all-courses', label: 'All Courses', href: '/LEAI/qa/InstructorHome.html' },
]

const courseItems = [
  { id: 'prompt-designer', label: 'Prompt Designer', href: '/LEAI/qa/PromptDesigner.html' },
  { id: 'feedback-analyzer', label: 'Feedback Analyzer', href: '/LEAI/qa/FeedbackAnalyzer.html' },
  { id: 'feedback-chat', label: 'Feedback Chat', href: '/LEAI/qa/FeedbackChat.html' },
  { id: 'settings', label: 'Settings', href: '/LEAI/qa/Customizations.html' },
]

function renderShell(onSignOut?: () => void, activeItem = 'prompt-designer') {
  return render(
    <AppShell
      accountItems={accountItems}
      activeItem={activeItem}
      courseItems={courseItems}
      environment={qaEnvironment}
      onSignOut={onSignOut}
    >
      <p>Page content</p>
    </AppShell>,
  )
}

it('shows only account navigation on the all-courses page', async () => {
  const user = userEvent.setup()
  renderShell(undefined, 'all-courses')

  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Course navigation' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Open navigation' }))
  const dialog = screen.getByRole('dialog', { name: 'Navigation' })
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Course navigation' })).not.toBeInTheDocument()
})

it('exposes sign-out from the shared instructor navigation', async () => {
  const user = userEvent.setup()
  const signOut = vi.fn()
  renderShell(signOut)
  const button = screen.getByRole('button', { name: 'Sign out' })
  expect(button.parentElement).toHaveClass('mt-auto')
  expect(button.querySelector('svg')).toHaveClass('lucide-log-out')
  await user.click(button)
  expect(signOut).toHaveBeenCalledOnce()
})

it('shows desktop account labels below their icons and keeps sign-out readable', () => {
  renderShell(vi.fn(), 'all-courses')

  const accountNavigation = screen.getByRole('navigation', { name: 'Account navigation' })
  for (const label of ['Account', 'All Courses']) {
    const link = within(accountNavigation).getByRole('link', { name: label })
    expect(link).toHaveClass('flex-col', 'items-center')
    expect(link.querySelector('span')).not.toHaveClass('sr-only')
  }

  const signOut = screen.getByRole('button', { name: 'Sign out' })
  expect(signOut).toHaveClass('flex-col', 'items-center')
  expect(signOut.querySelector('span')).not.toHaveClass('sr-only')
})

it('uses dark styling and 16pt type throughout the opened mobile sidebar', async () => {
  const user = userEvent.setup()
  renderShell(vi.fn())
  await user.click(screen.getByRole('button', { name: 'Open navigation' }))

  const dialog = screen.getByRole('dialog', { name: 'Navigation' })
  expect(dialog).toHaveClass('bg-sidebar', 'text-sidebar-foreground')
  expect(within(dialog).getByRole('heading', { name: 'Navigation' })).toHaveClass('text-[16pt]')
  expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveClass('text-sidebar-foreground')

  const accountNavigation = within(dialog).getByRole('navigation', { name: 'Account navigation' })
  expect(accountNavigation.querySelector('p')).toHaveClass('text-[16pt]', 'text-sidebar-foreground/70')
  expect(within(accountNavigation).getByRole('link', { name: 'Account' })).toHaveClass('text-[16pt]')

  const courseNavigation = within(dialog).getByRole('navigation', { name: 'Course navigation' })
  expect(courseNavigation).toHaveClass('bg-sidebar')
  expect(courseNavigation.querySelector('p')).toHaveClass('text-[16pt]', 'text-sidebar-foreground/70')
  expect(within(courseNavigation).getByRole('link', { name: 'Prompt Designer' })).toHaveClass(
    'text-[16pt]', 'text-sidebar-accent-foreground',
  )
  expect(within(dialog).getByRole('button', { name: 'Sign out' })).toHaveClass(
    'text-[16pt]', 'text-sidebar-foreground',
  )
})

it('uses the approved Lucide icon for every account and course menu item', () => {
  renderShell()

  const accountNavigation = screen.getByRole('navigation', { name: 'Account navigation' })
  expect(within(accountNavigation).getByRole('link', { name: 'Account' }).querySelector('svg'))
    .toHaveClass('lucide-circle-user-round')
  expect(within(accountNavigation).getByRole('link', { name: 'All Courses' }).querySelector('svg'))
    .toHaveClass('lucide-library-big')

  const courseNavigation = screen.getByRole('navigation', { name: 'Course navigation' })
  const icons = [
    ['Prompt Designer', 'lucide-file-pen-line'],
    ['Feedback Analyzer', 'lucide-chart-no-axes-combined'],
    ['Feedback Chat', 'lucide-messages-square'],
    ['Settings', 'lucide-sliders-horizontal'],
  ] as const
  for (const [label, iconClass] of icons) {
    expect(within(courseNavigation).getByRole('link', { name: label }).querySelector('svg'))
      .toHaveClass(iconClass)
  }
})

it('keeps All Courses in account navigation and course tools in course navigation', () => {
  renderShell()

  expect(screen.getAllByRole('link', { name: 'All Courses' })).toHaveLength(1)
  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toHaveTextContent(
    'All Courses',
  )
  const courseNavigation = screen.getByRole('navigation', { name: 'Course navigation' })
  expect(courseNavigation).toHaveTextContent(
    'Prompt Designer',
  )
  expect(courseNavigation).toHaveAttribute('aria-label', 'Course navigation')
  expect(within(courseNavigation).getByRole('link', { name: 'Prompt Designer' })).toHaveAttribute(
    'href', '/LEAI/qa/PromptDesigner.html',
  )
  expect(courseNavigation).not.toHaveTextContent(
    'All Courses',
  )
  expect(screen.getByText('QA environment')).toBeInTheDocument()
})

it('opens the mobile navigation in a Sheet and returns focus on Escape', async () => {
  const user = userEvent.setup()
  renderShell(vi.fn())

  const trigger = screen.getByRole('button', { name: 'Open navigation' })
  await user.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Navigation' })
  expect(dialog).toBeInTheDocument()
  const signOut = within(dialog).getByRole('button', { name: 'Sign out' })
  expect(signOut.parentElement).toHaveClass('mt-auto')
  expect(signOut).toHaveClass('text-sidebar-foreground')

  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(trigger).toHaveFocus()
})
