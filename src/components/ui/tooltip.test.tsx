import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

it('opens from keyboard focus, closes with Escape, and does not resize its layout container', async () => {
  const user = userEvent.setup()
  render(
    <div data-testid="layout" style={{ width: 240 }}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>AI access</TooltipTrigger>
          <TooltipContent>LEAI can use course configuration and approved templates.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>,
  )

  const layout = screen.getByTestId('layout')
  const initialWidth = layout.getBoundingClientRect().width
  await user.tab()

  expect(await screen.findByRole('tooltip')).toHaveTextContent('LEAI can use course configuration')
  expect(layout.getBoundingClientRect().width).toBe(initialWidth)

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  expect(layout.getBoundingClientRect().width).toBe(initialWidth)
})
