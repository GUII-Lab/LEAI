import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const globals = readFileSync('src/styles/globals.css', 'utf8')

it('defines semantic LEAI tokens and a reduced-motion fallback', () => {
  expect(globals).toContain('--color-background')
  expect(globals).toContain('--color-primary')
  expect(globals).toContain('--color-team')
  expect(globals).toContain('--color-guided')
  expect(globals).toContain('prefers-reduced-motion: reduce')
})
