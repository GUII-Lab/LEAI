import { useEffect, useRef, useState } from 'react'

export function StudentConsentDialog({ onContinue, busy, verified, error, termsHref, privacyHref, teamChoices = [] }: {
  onContinue: (researchConsent: boolean, teamId?: string) => void
  busy: boolean
  verified: boolean
  error: string
  termsHref: string
  privacyHref: string
  teamChoices?: { id: string; label: string }[]
}) {
  const [required, setRequired] = useState(false)
  const [research, setResearch] = useState(false)
  const [teamId, setTeamId] = useState('')
  const firstCheckbox = useRef<HTMLInputElement>(null)
  useEffect(() => firstCheckbox.current?.focus(), [])

  return <div aria-labelledby="student-consent-title" aria-modal="true" className="student-consent-overlay" role="dialog">
    <div className="student-consent-card">
      <div className="student-consent-header">
        <h2 id="student-consent-title">Before you begin</h2>
        <p>LEAI is an <strong>anonymous</strong> mid-course feedback tool. Your responses help your
          instructor improve your experience <em>while the course is still running</em> — not
          at the end of the quarter.</p>
      </div>
      <div className="student-consent-checkboxes">
        {teamChoices.length > 0 && <label className="student-consent-checkbox">
          <span>Select your team. This choice groups your private feedback with that team.</span>
          <select aria-label="Your team" onChange={(event) => setTeamId(event.target.value)} required value={teamId}>
            <option value="">Choose a team</option>
            {teamChoices.map((team) => <option key={team.id} value={team.id}>{team.label}</option>)}
          </select>
        </label>}
        <label className="student-consent-checkbox">
          <input checked={required} onChange={(event) => setRequired(event.target.checked)} ref={firstCheckbox} type="checkbox" />
          <span>I have read and agree to the <a href={termsHref} rel="noopener noreferrer" target="_blank">Terms of Use</a> and{' '}
            <a href={privacyHref} rel="noopener noreferrer" target="_blank">Privacy Policy</a>. I understand my feedback is{' '}
            <strong>anonymous</strong> and will be used by my instructor to improve the course while it is running.
            If completion certificates are enabled, the certificate verifies that a code was issued for this survey but
            does not reveal my responses.</span>
        </label>
        <label className="student-consent-checkbox">
          <input checked={research} onChange={(event) => setResearch(event.target.checked)} type="checkbox" />
          <span><em>(Optional)</em> I also consent to my anonymous responses being analyzed by the GUII Lab for research
            to improve this tool in the future.
            <small>You can change your choice each time you start a new feedback session.</small></span>
        </label>
      </div>
      <div className="student-consent-actions">
        {error && <p role="alert">{error}</p>}
        <button disabled={!required || !verified || busy || (teamChoices.length > 0 && !teamId)} onClick={() => onContinue(research, teamId || undefined)} type="button">
          {busy ? 'Starting…' : 'Continue'}
        </button>
      </div>
    </div>
  </div>
}
