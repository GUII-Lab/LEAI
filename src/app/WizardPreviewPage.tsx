import { useEffect, useState } from 'react'
import type { createInstructorApi } from '@/api/instructor-v1'
import { qualifyBrowserKey, toAppHref, type PublicEnvironment } from '@/config/environment'

// Compatibility for previously copied preview URLs; the student route owns all UI and behavior.
export function WizardPreviewPage({ api, environment }: {
  api: ReturnType<typeof createInstructorApi>; environment: PublicEnvironment
}) {
  const [error, setError] = useState('')
  useEffect(() => {
    const courseId = sessionStorage.getItem(qualifyBrowserKey(environment.name, 'selected-course')) ?? ''
    const revisionId = new URLSearchParams(window.location.search).get('revision') ?? ''
    if (!courseId || !revisionId) { setError('Open this preview from the Feedback Builder.'); return }
    let active = true
    void api.wizardPreview(courseId, revisionId).then((preview) => {
      if (active) window.location.replace(toAppHref(environment, preview.direct_url))
    }).catch(() => { if (active) setError('Could not open this preview. Return to the Builder and try again.') })
    return () => { active = false }
  }, [api, environment])
  return <main role={error ? 'alert' : 'status'} className="p-6">{error || 'Opening student preview…'}</main>
}
