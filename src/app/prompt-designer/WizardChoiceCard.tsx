export function WizardChoiceCard({ value, groupName, title, description, selected, disabled = false, onSelect }: {
  value: string
  groupName: string
  title: string
  description: string
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  return <label className={`flex min-w-0 cursor-pointer items-start gap-4 rounded-[14px] border bg-card p-[22px] text-left transition-colors hover:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${selected ? 'border-primary ring-2 ring-primary/10' : 'border-border'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
    <input checked={selected} className="sr-only" disabled={disabled} name={groupName} onChange={onSelect} type="radio" value={value} />
    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-secondary text-xl font-extrabold text-secondary-foreground">{value}</span>
    <span><strong className="block text-[19px] leading-tight">{title}</strong>
      <span className="mt-2 block text-[13px] leading-[1.48] text-muted-foreground">{description}</span></span>
  </label>
}
