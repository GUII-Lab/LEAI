import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Switch } from './switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'
import { Textarea } from './textarea'

// jsdom does not implement scrolling; Radix Select calls this when its menu opens.
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
beforeAll(() => { Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: () => undefined }) })
afterAll(() => {
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

it('switches bounded tab content with the keyboard', async () => {
  const user = userEvent.setup()
  render(<Tabs defaultValue="overview"><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="responses">Responses</TabsTrigger></TabsList><TabsContent value="overview">Overview panel</TabsContent><TabsContent value="responses">Response panel</TabsContent></Tabs>)
  await user.tab()
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { name: 'Responses' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText('Response panel')).toBeVisible()
})

it('selects a course source using the accessible listbox', async () => {
  const user = userEvent.setup()
  render(<Select><SelectTrigger aria-label="Feedback source"><SelectValue placeholder="Choose source" /></SelectTrigger><SelectContent><SelectItem value="week-1">Week 1</SelectItem><SelectItem value="week-2">Week 2</SelectItem></SelectContent></Select>)
  await user.tab()
  expect(screen.getByRole('combobox', { name: 'Feedback source' })).toHaveFocus()
  await user.keyboard('{Enter}{End}{Enter}')
  expect(screen.getByRole('combobox', { name: 'Feedback source' })).toHaveTextContent('Week 2')
})

it('uses semantic foreground color for modal backdrops', async () => {
  const user = userEvent.setup()
  render(<Dialog><DialogTrigger>Open dialog</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Dialog</DialogTitle></DialogHeader></DialogContent></Dialog>)
  await user.click(screen.getByRole('button', { name: 'Open dialog' }))
  await screen.findByRole('dialog', { name: 'Dialog' })
  expect(document.body.querySelector('[data-slot="dialog-overlay"]')).toHaveClass('bg-foreground/10')
})

it('opens secondary citation detail in a dismissible popover', async () => {
  const user = userEvent.setup()
  render(<Popover><PopoverTrigger>Source details</PopoverTrigger><PopoverContent>Week 2 response</PopoverContent></Popover>)
  await user.click(screen.getByRole('button', { name: 'Source details' }))
  expect(await screen.findByText('Week 2 response')).toBeVisible()
  await user.keyboard('{Escape}')
  expect(screen.queryByText('Week 2 response')).not.toBeInTheDocument()
})

it('opens an accessible editor dialog and restores focus on Escape', async () => {
  const user = userEvent.setup()
  render(<Dialog><DialogTrigger>Edit prompt</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Edit prompt</DialogTitle><DialogDescription>Change future turns.</DialogDescription></DialogHeader></DialogContent></Dialog>)
  const trigger = screen.getByRole('button', { name: 'Edit prompt' })
  await user.click(trigger)
  expect(await screen.findByRole('dialog', { name: 'Edit prompt' })).toBeVisible()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('keeps a recoverable close decision in an alert dialog', async () => {
  const user = userEvent.setup()
  render(<AlertDialog><AlertDialogTrigger>Close builder</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Close builder?</AlertDialogTitle><AlertDialogDescription>Saved work remains available.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction>Close</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)
  await user.click(screen.getByRole('button', { name: 'Close builder' }))
  expect(await screen.findByRole('alertdialog', { name: 'Close builder?' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Keep editing' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

it('exposes an output setting as a labelled switch and preserves textarea input', async () => {
  const user = userEvent.setup()
  render(<><label htmlFor="output-switch">Enable output</label><Switch id="output-switch" /><label htmlFor="chat-prompt">Prompt</label><Textarea id="chat-prompt" /></>)
  const toggle = screen.getByRole('switch', { name: 'Enable output' })
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'Explain the response')
  expect(screen.getByRole('textbox', { name: 'Prompt' })).toHaveValue('Explain the response')
})
