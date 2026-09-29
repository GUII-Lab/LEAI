import { useId } from 'react'

export function WizardChoiceCard({ value, groupName, title, description, details, selected, disabled = false, onSelect }: {
  value: string
  groupName: string
  title: string
  description: string
  details: readonly string[]
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  const id = useId()
  return <label className={`block min-h-[210px] min-w-0 cursor-pointer rounded-xl border-2 p-6 text-left transition-colors hover:border-primary hover:ring-[3px] hover:ring-primary/8 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${selected ? 'border-primary bg-[#fbffff] ring-[3px] ring-primary/8' : 'border-border bg-card'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
    <input aria-describedby={`${id}-description ${id}-details`} aria-labelledby={`${id}-title`} checked={selected} className="sr-only" disabled={disabled} name={groupName} onChange={onSelect} type="radio" value={value} />
    <span aria-hidden="true" className="grid size-[42px] place-items-center rounded-[10px] bg-secondary text-[19px] font-black text-secondary-foreground">{value}</span>
    <strong className="mt-[10px] mb-[7px] block text-[19px] leading-tight" id={`${id}-title`}>{title}</strong>
    <span className="block text-[14px] leading-[1.48] text-muted-foreground" id={`${id}-description`}>{description}</span>
    <ul className="mt-[14px] list-disc pl-[18px] text-[13px] leading-[1.65] text-[#44575c]" id={`${id}-details`}>
      {details.map(detail => <li key={detail}>{detail}</li>)}
    </ul>
  </label>
}
