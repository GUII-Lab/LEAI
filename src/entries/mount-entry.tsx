import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { App } from '@/app/App'
import { getEntry, type EntryName } from './entry-registry'

export function mountEntry(entryName: EntryName, element: HTMLElement): Root {
  const entry = getEntry(entryName)
  const root = createRoot(element)
  root.render(
    <StrictMode>
      <App activeItem={entry.activeItem} description={entry.description} pageTitle={entry.pageTitle} />
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
