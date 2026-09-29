function safeFilename(label: string) {
  return label.trim().replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'reflection'
}

export function saveStudentPdfBlob(blob: Blob, label: string, finalized: boolean) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeFilename(label)}-${finalized ? 'final' : 'draft'}.pdf`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
