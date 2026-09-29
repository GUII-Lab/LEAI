import { ArrowDown, ArrowUp, ChevronDown, History, MoreHorizontal, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { WizardProtocol, WizardVersion } from '@/api/contracts/wizard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { useState } from 'react'

function newId(prefix: 's' | 'q') {
  return `${prefix}${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`
}

function ItemActions({ label, disabled, canMoveUp, canMoveDown, canRemove, onMoveUp, onMoveDown, onRemove }: {
  label: string
  disabled: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const action = (run: () => void) => { run(); setOpen(false) }
  return <Popover onOpenChange={setOpen} open={open}>
    <PopoverTrigger asChild><Button aria-label={`${label} actions`} className="size-8 text-[#62777c]" disabled={disabled} size="icon" type="button" variant="ghost"><MoreHorizontal className="size-5" /></Button></PopoverTrigger>
    <PopoverContent align="end" className="w-40 gap-0 p-1">
      <Button className="w-full justify-start" disabled={!canMoveUp} onClick={() => action(onMoveUp)} size="sm" type="button" variant="ghost"><ArrowUp className="size-4" />Move up</Button>
      <Button className="w-full justify-start" disabled={!canMoveDown} onClick={() => action(onMoveDown)} size="sm" type="button" variant="ghost"><ArrowDown className="size-4" />Move down</Button>
      <Button className="w-full justify-start text-destructive hover:text-destructive" disabled={!canRemove} onClick={() => action(onRemove)} size="sm" type="button" variant="ghost"><Trash2 className="size-4" />Remove</Button>
    </PopoverContent>
  </Popover>
}

export function ArtifactEditor({ body, audience, collectionStyle, onChange, saveStatus, versions, onRestore, disabled }: {
  body: WizardProtocol
  audience: 'individual' | 'team'
  collectionStyle: 'guided' | 'open'
  onChange: (next: WizardProtocol) => void
  saveStatus: string
  versions: WizardVersion[]
  onRestore: (version: WizardVersion) => void
  disabled: boolean
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [expandedQuestions, setExpandedQuestions] = useState<string[]>([])
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

  return <div className="space-y-4">
    <h3 className="sr-only">Feedback artifact</h3>
    <header className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border pb-3">
      <Input aria-label="Feedback title" className="h-9 min-w-32 flex-1 border-transparent bg-transparent px-1 text-[21px] font-extrabold shadow-none hover:border-border focus-visible:border-primary" disabled={disabled} maxLength={200}
        onChange={(event) => edit((next) => { next.title = event.target.value })} value={body.title} />
      <span className="rounded-full bg-[#e8f3f8] px-2 py-1 text-[11px] font-bold text-[#006b93]">{audience === 'team' ? 'Team' : 'Individual'} · {collectionStyle === 'open' ? 'Open' : 'Guided'}</span>
      <span aria-live="polite" className="ml-auto whitespace-nowrap text-xs font-bold text-[#1b7657]">{saveStatus}</span>
      <Button onClick={() => setHistoryOpen(true)} size="sm" type="button" variant="outline"><History className="size-4" />History · v{versions[0]?.number ?? 1}</Button>
    </header>
    <div>
      <Button aria-expanded={detailsOpen} className="px-1 text-xs text-muted-foreground" onClick={() => setDetailsOpen(!detailsOpen)} size="sm" type="button" variant="ghost"><ChevronDown className={`size-3 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />Student introduction</Button>
      {detailsOpen && <label className="block space-y-1.5 pb-2"><span className="sr-only">Student introduction</span>
        <Textarea disabled={disabled} maxLength={4000} onChange={(event) => edit((next) => { next.intro = event.target.value })} rows={2} value={body.intro} /></label>}
    </div>

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
    <div className="space-y-3">
      {body.sections.map((section, sectionIndex) => <section className="min-w-0 overflow-hidden rounded-[10px] border border-border" key={section.id}>
        <div className="flex min-w-0 items-center gap-2 bg-[#f0f5f6] px-3 py-2">
          <Input aria-label={`Section ${sectionIndex + 1} title`} className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-1 font-bold shadow-none hover:border-border focus-visible:border-primary" disabled={disabled} maxLength={200}
            onChange={(event) => edit((next) => { next.sections[sectionIndex].title = event.target.value })} value={section.title} />
          <ItemActions canMoveDown={sectionIndex < body.sections.length - 1} canMoveUp={sectionIndex > 0} canRemove={body.sections.length > 1} disabled={disabled} label={`Section ${sectionIndex + 1}`}
            onMoveDown={() => edit((next) => { const [value] = next.sections.splice(sectionIndex, 1); next.sections.splice(sectionIndex + 1, 0, value) })}
            onMoveUp={() => edit((next) => { const [value] = next.sections.splice(sectionIndex, 1); next.sections.splice(sectionIndex - 1, 0, value) })}
            onRemove={() => edit((next) => { next.sections.splice(sectionIndex, 1) })} />
        </div>
        {section.items.map((item, itemIndex) => <div className="relative border-t border-border py-3 pr-11 pl-11" key={item.id}>
          <span className="absolute top-4 left-3 grid size-6 place-items-center rounded-full bg-[#e9f0f2] text-[11px] font-extrabold text-[#51666c]">{body.sections.slice(0, sectionIndex).reduce((count, previous) => count + previous.items.length, 0) + itemIndex + 1}</span>
          <div className="absolute top-2 right-2"><ItemActions canMoveDown={itemIndex < section.items.length - 1} canMoveUp={itemIndex > 0} canRemove={section.items.length > 1} disabled={disabled} label={`Question ${itemIndex + 1}`}
            onMoveDown={() => move(sectionIndex, itemIndex, 1)} onMoveUp={() => move(sectionIndex, itemIndex, -1)}
            onRemove={() => edit((next) => { next.sections[sectionIndex].items.splice(itemIndex, 1) })} /></div>
          <label className="block"><span className="mb-1 block text-xs font-extrabold">Question {itemIndex + 1}</span>
            <Textarea aria-label={`Student-facing question ${itemIndex + 1}`} className="min-h-10 resize-y border-transparent bg-transparent px-0 py-1 text-sm leading-6 shadow-none hover:border-border focus-visible:border-primary" disabled={disabled} maxLength={4000} onChange={(event) => edit((next) => {
              next.sections[sectionIndex].items[itemIndex].prompt = event.target.value
            })} rows={2} value={item.prompt} /></label>
          <Button aria-expanded={expandedQuestions.includes(item.id)} className="h-auto px-0 text-xs text-muted-foreground" onClick={() => setExpandedQuestions((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} size="sm" type="button" variant="ghost">
            <ChevronDown className={`size-3 transition-transform ${expandedQuestions.includes(item.id) ? 'rotate-180' : ''}`} />Question details</Button>
          {expandedQuestions.includes(item.id) && <label className="mt-2 block space-y-1.5"><span className="text-xs">What this question should uncover</span>
            <Input disabled={disabled} maxLength={1000} onChange={(event) => edit((next) => { next.sections[sectionIndex].items[itemIndex].reflection_goal = event.target.value })} value={item.reflection_goal} /></label>}
        </div>)}
        <div className="p-2"><Button className="w-full border-dashed text-[#006c70]" disabled={disabled || section.items.length >= 24} onClick={() => edit((next) => {
            next.sections[sectionIndex].items.push({
              id: newId('q'), prompt: 'What would you like to share?',
              wording: 'adaptive', response: { kind: 'text' },
              reflection_goal: 'Understand the learner’s experience.',
              coverage_targets: [], example_probes: [], max_additional_probes: 1,
            })
          })} size="sm" type="button" variant="outline"><Plus className="size-4" />Add a question</Button></div>
      </section>)}
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
    })} className="w-full border-dashed text-[#006c70]" type="button" variant="outline"><Plus className="size-4" />Add a section</Button>
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
