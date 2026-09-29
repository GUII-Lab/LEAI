import { expect, it, vi } from 'vitest'
import { saveStudentPdfBlob } from './student-document'

it('saves a server-generated student PDF with a safe final filename', () => {
  const previousCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const previousRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:student-pdf') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  const downloads: Array<{ name: string; href: string }> = []
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, href: this.href })
  })
  try {
    saveStudentPdfBlob(new Blob(['%PDF-test'], { type: 'application/pdf' }), 'Planning Reflection / Week 2', true)
    expect(downloads).toEqual([{ name: 'Planning-Reflection-Week-2-final.pdf', href: 'blob:student-pdf' }])
  } finally {
    click.mockRestore()
    if (previousCreate) Object.defineProperty(URL, 'createObjectURL', previousCreate)
    else Reflect.deleteProperty(URL, 'createObjectURL')
    if (previousRevoke) Object.defineProperty(URL, 'revokeObjectURL', previousRevoke)
    else Reflect.deleteProperty(URL, 'revokeObjectURL')
  }
})
