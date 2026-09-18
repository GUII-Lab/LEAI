import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { Button } from './button'

it('preserves its accessible name and disabled state', async () => {
  const user = userEvent.setup()
  render(<Button disabled>Save feedback</Button>)

  const button = screen.getByRole('button', { name: 'Save feedback' })
  expect(button).toBeDisabled()

  await user.click(button)
  expect(button).toBeDisabled()
})
