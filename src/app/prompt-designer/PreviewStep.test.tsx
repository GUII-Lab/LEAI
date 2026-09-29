import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { PreviewStep } from './PreviewStep'

it('opens student-output help without changing the output setting', async () => {
  const user = userEvent.setup()
  const onCertificateChange = vi.fn()
  render(<PreviewStep
    revision={{
      id: 'revision', question_set_id: 'question-set', revision_number: 1, source_draft_version: 1,
      content_hash: 'a'.repeat(64), preview_decision: null, created_at: '2026-09-28T12:00:00Z',
      body: { version: 1, title: 'Weekly reflection', intro: '', scales: {}, sections: [] },
    }}
    previewOpened={false}
    onLaunch={vi.fn()}
    onDecision={vi.fn()}
    busy={false}
    certificateEnabled={false}
    downloadEnabled={false}
    onCertificateChange={onCertificateChange}
    onDownloadChange={vi.fn()}
  />)

  const certificate = screen.getByRole('switch', { name: 'Completion certificate' })
  expect(certificate).toHaveAttribute('aria-checked', 'false')
  await user.click(screen.getByRole('button', { name: 'About Completion certificate' }))
  expect(await screen.findByText(/contains no response text or teammate data/)).toBeVisible()
  expect(certificate).toHaveAttribute('aria-checked', 'false')
  expect(onCertificateChange).not.toHaveBeenCalled()
})
