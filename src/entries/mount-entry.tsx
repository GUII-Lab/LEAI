import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { App } from '@/app/App'
import { InstructorLoginPage } from '@/app/InstructorLoginPage'
import { InstructorPasswordPage } from '@/app/InstructorPasswordPage'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getEntry, type EntryName } from './entry-registry'
import '@/styles/globals.css'

export function mountEntry(entryName: EntryName, element: HTMLElement): Root {
  const entry = getEntry(entryName)
  const root = createRoot(element)
  const queryClient = new QueryClient()
  root.render(
    <StrictMode>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          {entryName === 'InstructorLogin' ? <InstructorLoginPage /> : entryName === 'InstructorPassword'
            ? <InstructorPasswordPage />
            : <App activeItem={entry.activeItem} description={entry.description} pageTitle={entry.pageTitle} />}
        </QueryClientProvider>
      </TooltipProvider>
    </StrictMode>,
  )
  return root
}

function renderConfigurationError(element: HTMLElement, message: string) {
  element.replaceChildren()
  const alert = document.createElement('p')
  alert.setAttribute('role', 'alert')
  alert.textContent = message
  element.append(alert)
}

const rootElement = document.getElementById('root')
const entryName = rootElement?.dataset.leaiEntry

if (!rootElement || !entryName) {
  throw new Error('LEAI entry configuration error: missing #root or data-leai-entry')
}

try {
  mountEntry(entryName as EntryName, rootElement)
} catch (error) {
  renderConfigurationError(
    rootElement,
    error instanceof Error ? error.message : 'LEAI entry configuration error',
  )
}
