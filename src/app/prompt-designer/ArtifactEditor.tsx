import { ArrowDown, ArrowUp, History, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { WizardProtocol, WizardVersion } from '@/api/contracts/wizard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useState } from 'react'

function newId(prefix: 's' | 'q') {
  return `${prefix}${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`
}

export function ArtifactEditor({ body, collectionStyle, onChange, saveStatus, versions, onRestore, disabled }: {
  body: WizardProtocol
  collectionStyle: 'guided' | 'open'
  onChange: (next: WizardProtocol) => void
  saveStatus: string
  versions: WizardVersion[]
  onRestore: (version: WizardVersion) => void
  disabled: boolean
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const edit = (apply: (draft: WizardProtocol) => void) => {
    const next = structuredClone(body)
    apply(next)
    onChange(next)
  }
  const move = (sectionIndex: number, itemIndex: number, direction: -1 | 1) => {
    edit((next) => {
      const items = next.sections[sectionIndex].items
      const [item] = items.splice(itemIndex, 1)
      items.splice(itemIndex + direction, 0, item)
    })
  }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-lg font-semibold">Feedback artifact</h3>
        <p className="text-sm text-muted-foreground">Edit the student-facing questions directly.</p>
      </div>
      <div className="flex items-center gap-2">
        <span aria-live="polite" className="text-sm text-muted-foreground">{saveStatus}</span>
        <Button onClick={() => setHistoryOpen(true)} size="sm" type="button" variant="outline"><History className="size-4" />History</Button>
      </div>
    </header>

    <label className="block space-y-1.5">
      <span className="font-medium">Title</span>
      <Input disabled={disabled} maxLength={200} onChange={(event) => edit((next) => { next.title = event.target.value })} value={body.title} />
    </label>
    <label className="block space-y-1.5">
      <span className="font-medium">Student introduction</span>
      <Textarea disabled={disabled} maxLength={4000} onChange={(event) => edit((next) => { next.intro = event.target.value })} rows={2} value={body.intro} />
    </label>

    {collectionStyle === 'open' ? <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Open conversation follows topics students raise. Its opening, listening goal, and closing are editable here.</p>
      <label className="block space-y-1.5"><span className="font-medium">Opening question</span>
        <Textarea disabled={disabled} maxLength={4000} onChange={(event) => edit((next) => {
          next.sections[0].items[0].prompt = event.target.value
        })} rows={2} value={body.sections[0].items[0].prompt} /></label>
      <label className="block space-y-1.5"><span className="font-medium">What LEAI should listen for</span>
        <Textarea disabled={disabled} maxLength={1000} onChange={(event) => edit((next) => {
          next.sections[0].items[0].reflection_goal = event.target.value
        })} rows={2} value={body.sections[0].items[0].reflection_goal} /></label>
      <label className="block space-y-1.5"><span className="font-medium">Closing question</span>
        <Textarea disabled={disabled} maxLength={4000} onChange={(event) => edit((next) => {
          next.sections[0].items[1].prompt = event.target.value
        })} rows={2} value={body.sections[0].items[1]?.prompt ?? ''} /></label>
    </div> : <>
    <div className="space-y-4">
      {body.sections.map((section, sectionIndex) => <Card className="min-w-0" key={section.id}>
        <CardContent className="space-y-4 p-4">
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <label className="min-w-40 flex-1 space-y-1">
              <span className="text-sm font-medium">Section {sectionIndex + 1}</span>
              <Input aria-label={`Section ${sectionIndex + 1} title`} disabled={disabled} maxLength={200}
                onChange={(event) => edit((next) => { next.sections[sectionIndex].title = event.target.value })} value={section.title} />
            </label>
            <Button aria-label={`Move section ${sectionIndex + 1} up`} disabled={disabled || sectionIndex === 0}
              onClick={() => edit((next) => { const [value] = next.sections.splice(sectionIndex, 1); next.sections.splice(sectionIndex - 1, 0, value) })}
              size="icon" type="button" variant="ghost"><ArrowUp /></Button>
            <Button aria-label={`Move section ${sectionIndex + 1} down`} disabled={disabled || sectionIndex === body.sections.length - 1}
              onClick={() => edit((next) => { const [value] = next.sections.splice(sectionIndex, 1); next.sections.splice(sectionIndex + 1, 0, value) })}
              size="icon" type="button" variant="ghost"><ArrowDown /></Button>
            <Button aria-label={`Remove section ${sectionIndex + 1}`} disabled={disabled || body.sections.length === 1}
              onClick={() => edit((next) => { next.sections.splice(sectionIndex, 1) })}
              size="icon" type="button" variant="ghost"><Trash2 /></Button>
          </div>

          {section.items.map((item, itemIndex) => <div className="rounded-lg border border-border bg-background p-3" key={item.id}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Question {itemIndex + 1}</span>
              <div className="flex items-center">
                <Button aria-label={`Move question ${itemIndex + 1} up`} disabled={disabled || itemIndex === 0}
                  onClick={() => move(sectionIndex, itemIndex, -1)} size="icon" type="button" variant="ghost"><ArrowUp /></Button>
                <Button aria-label={`Move question ${itemIndex + 1} down`} disabled={disabled || itemIndex === section.items.length - 1}
                  onClick={() => move(sectionIndex, itemIndex, 1)} size="icon" type="button" variant="ghost"><ArrowDown /></Button>
                <Button aria-label={`Remove question ${itemIndex + 1}`} disabled={disabled || section.items.length === 1}
                  onClick={() => edit((next) => { next.sections[sectionIndex].items.splice(itemIndex, 1) })}
                  size="icon" type="button" variant="ghost"><Trash2 /></Button>
              </div>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm">Student-facing question</span>
              <Textarea disabled={disabled} maxLength={4000} onChange={(event) => edit((next) => {
                next.sections[sectionIndex].items[itemIndex].prompt = event.target.value
              })} rows={2} value={item.prompt} />
            </label>
            <label className="mt-3 block space-y-1.5">
              <span className="text-sm">What this question should uncover</span>
              <Input disabled={disabled} maxLength={1000} onChange={(event) => edit((next) => {
                next.sections[sectionIndex].items[itemIndex].reflection_goal = event.target.value
              })} value={item.reflection_goal} />
            </label>
          </div>)}
          <Button disabled={disabled || section.items.length >= 24} onClick={() => edit((next) => {
            next.sections[sectionIndex].items.push({
              id: newId('q'), prompt: 'What would you like to share?',
              wording: 'adaptive', response: { kind: 'text' },
              reflection_goal: 'Understand the learner’s experience.',
              coverage_targets: [], example_probes: [], max_additional_probes: 1,
            })
          })} size="sm" type="button" variant="outline"><Plus className="size-4" />Add question</Button>
        </CardContent>
      </Card>)}
    </div>
    <Button disabled={disabled || body.sections.length >= 12} onClick={() => edit((next) => {
      next.sections.push({
        id: newId('s'), title: 'New section',
        items: [{
          id: newId('q'), prompt: 'What would you like to share?',
          wording: 'adaptive', response: { kind: 'text' },
          reflection_goal: 'Understand the learner’s experience.',
          coverage_targets: [], example_probes: [], max_additional_probes: 1,
        }],
      })
    })} type="button" variant="outline"><Plus className="size-4" />Add section</Button>
    </>}

    <Dialog onOpenChange={setHistoryOpen} open={historyOpen}>
      <DialogContent className="legacy-builder-theme max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>Version history</DialogTitle>
        <DialogDescription>Restoring a version creates a new saved version. Published revisions stay unchanged.</DialogDescription>
        <ol className="space-y-2">
          {versions.map((version) => <li className="flex items-center justify-between gap-2 rounded-lg border p-3" key={version.id}>
            <div>
              <span className="font-medium">Version {version.number}</span>
              <p className="text-sm text-muted-foreground">{version.change_kind} · {new Date(version.created_at).toLocaleString()}</p>
            </div>
            <Button disabled={disabled} onClick={() => { onRestore(version); setHistoryOpen(false) }} size="sm" type="button" variant="outline">
              <RotateCcw className="size-4" />Restore
            </Button>
          </li>)}
        </ol>
      </DialogContent>
    </Dialog>
  </div>
}
