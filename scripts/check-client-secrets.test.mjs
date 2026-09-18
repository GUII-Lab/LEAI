import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

async function loadScanner() {
  return import('./check-client-secrets.mjs')
}

async function withFixture(t, name, contents) {
  const root = await mkdtemp(path.join(tmpdir(), 'leai-secret-scan-'))
  const file = path.join(root, name)
  await writeFile(file, contents)
  t.after(() => rm(root, { recursive: true, force: true }))
  return { root, file }
}

test('detects provider credentials without returning the credential value', async (t) => {
  const { scanFiles } = await loadScanner()
  const credential = `sk-${'A'.repeat(48)}`
  const fixture = await withFixture(t, 'client.ts', `export const accidental = '${credential}'`)

  const findings = await scanFiles(fixture.root, [fixture.file])

  assert.deepEqual(findings.map(({ rule }) => rule), ['provider-credential'])
  assert.equal(JSON.stringify(findings).includes(credential), false)
})

test('rejects secret-bearing keys in committed environment files', async (t) => {
  const { scanFiles } = await loadScanner()
  const fixture = await withFixture(
    t,
    '.env.qa',
    'VITE_OPENAI_API_KEY=placeholder-that-must-still-be-rejected\n',
  )

  const findings = await scanFiles(fixture.root, [fixture.file])

  assert.deepEqual(findings.map(({ rule }) => rule), ['forbidden-environment-key'])
})

test('detects credential-like content embedded in source maps', async (t) => {
  const { scanFiles } = await loadScanner()
  const fixture = await withFixture(
    t,
    'app.js.map',
    JSON.stringify({ version: 3, sourcesContent: ['const token = "sensitive-test-value"'] }),
  )

  const findings = await scanFiles(fixture.root, [fixture.file])

  assert.deepEqual(findings.map(({ rule }) => rule), ['credential-like-source-map'])
})

test('allows the reviewed public LEAI build variables', async (t) => {
  const { scanFiles } = await loadScanner()
  const fixture = await withFixture(
    t,
    '.env.qa',
    [
      'VITE_LEAI_ENVIRONMENT=qa',
      'VITE_LEAI_API_BASE_URL=https://leai-qa.invalid/api/',
      'VITE_LEAI_APP_BASE_PATH=/LEAI/qa/',
      `VITE_LEAI_BUILD_SHA=${'1'.repeat(40)}`,
      'VITE_LEAI_BACKEND_BUILD_SHA=qa-backend-placeholder',
      'VITE_LEAI_SCHEMA_IDENTITY=qa-schema-placeholder',
      'VITE_LEAI_CONTRACT_VERSION=2026-09-17',
    ].join('\n'),
  )

  assert.deepEqual(await scanFiles(fixture.root, [fixture.file]), [])
})
