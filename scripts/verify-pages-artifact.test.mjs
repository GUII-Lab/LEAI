import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function loadVerifier() {
  return import(path.join(repositoryRoot, 'scripts/verify-pages-artifact.mjs'))
}

async function makeArtifact(environment) {
  const root = await mkdtemp(path.join(tmpdir(), `leai-${environment}-artifact-`))
  const basePath = environment === 'qa' ? '/LEAI/qa/' : '/LEAI/'
  const apiHost = environment === 'qa' ? 'leai-qa.invalid' : 'leai-production.invalid'
  const sourceSha = environment === 'qa' ? '1'.repeat(40) : '2'.repeat(40)

  await mkdir(path.join(root, 'assets'), { recursive: true })
  await writeFile(
    path.join(root, 'index.html'),
    `<script type="module" src="${basePath}assets/app.js"></script>`,
  )
  await writeFile(
    path.join(root, 'PromptDesigner.html'),
    `<link rel="stylesheet" href="${basePath}assets/app.css">`,
  )
  await writeFile(
    path.join(root, 'assets/app.js'),
    `globalThis.__LEAI_PUBLIC_API__ = "https://${apiHost}/api/";`,
  )
  await writeFile(path.join(root, 'assets/app.css'), ':root { color-scheme: light; }')
  await writeFile(
    path.join(root, 'leai-build-manifest.json'),
    JSON.stringify({ environment, basePath, apiHost, sourceSha }, null, 2),
  )

  return { root, basePath, apiHost, sourceSha }
}

test('accepts environment artifacts with the intended public base and API host', async (t) => {
  const { verifyEnvironmentArtifact } = await loadVerifier()

  for (const environment of ['qa', 'production']) {
    await t.test(environment, async () => {
      const artifact = await makeArtifact(environment)
      t.after(() => rm(artifact.root, { recursive: true, force: true }))

      const result = await verifyEnvironmentArtifact({
        rootDir: artifact.root,
        environment,
        basePath: artifact.basePath,
        ownApiHost: artifact.apiHost,
        forbiddenApiHost:
          environment === 'qa' ? 'leai-production.invalid' : 'leai-qa.invalid',
        sourceSha: artifact.sourceSha,
      })

      assert.equal(result.environment, environment)
      assert.ok(result.fileCount >= 5)
    })
  }
})

test('rejects HTML that escapes the environment public base', async (t) => {
  const { verifyEnvironmentArtifact } = await loadVerifier()
  const artifact = await makeArtifact('qa')
  t.after(() => rm(artifact.root, { recursive: true, force: true }))
  await writeFile(
    path.join(artifact.root, 'index.html'),
    '<script type="module" src="/LEAI/assets/app.js"></script>',
  )

  await assert.rejects(
    verifyEnvironmentArtifact({
      rootDir: artifact.root,
      environment: 'qa',
      basePath: '/LEAI/qa/',
      ownApiHost: 'leai-qa.invalid',
      forbiddenApiHost: 'leai-production.invalid',
      sourceSha: artifact.sourceSha,
    }),
    /outside expected base \/LEAI\/qa\//,
  )
})

test('rejects API host leakage between QA and Production', async (t) => {
  const { verifyEnvironmentArtifact } = await loadVerifier()
  const artifact = await makeArtifact('qa')
  t.after(() => rm(artifact.root, { recursive: true, force: true }))
  await writeFile(
    path.join(artifact.root, 'assets/app.js'),
    'fetch("https://leai-production.invalid/api/surveys")',
  )

  await assert.rejects(
    verifyEnvironmentArtifact({
      rootDir: artifact.root,
      environment: 'qa',
      basePath: '/LEAI/qa/',
      ownApiHost: 'leai-qa.invalid',
      forbiddenApiHost: 'leai-production.invalid',
      sourceSha: artifact.sourceSha,
    }),
    /forbidden API host leai-production\.invalid/,
  )
})

test('rejects service-worker files and registration code', async (t) => {
  const { verifyEnvironmentArtifact } = await loadVerifier()
  const artifact = await makeArtifact('production')
  t.after(() => rm(artifact.root, { recursive: true, force: true }))
  await writeFile(path.join(artifact.root, 'service-worker.js'), 'self.addEventListener("fetch", () => {})')

  await assert.rejects(
    verifyEnvironmentArtifact({
      rootDir: artifact.root,
      environment: 'production',
      basePath: '/LEAI/',
      ownApiHost: 'leai-production.invalid',
      forbiddenApiHost: 'leai-qa.invalid',
      sourceSha: artifact.sourceSha,
    }),
    /service worker/i,
  )
})

test('accepts a QA-only Pages artifact while Production is disabled', async (t) => {
  const { verifyPagesArtifact } = await loadVerifier()
  const pagesRoot = await mkdtemp(path.join(tmpdir(), 'leai-pages-'))
  const qaArtifact = await makeArtifact('qa')
  const releaseFile = path.join(pagesRoot, 'production-release.json')
  t.after(() => rm(pagesRoot, { recursive: true, force: true }))
  t.after(() => rm(qaArtifact.root, { recursive: true, force: true }))

  await mkdir(path.join(pagesRoot, 'qa'), { recursive: true })
  for (const file of ['index.html', 'PromptDesigner.html', 'leai-build-manifest.json']) {
    await writeFile(path.join(pagesRoot, 'qa', file), await import('node:fs/promises').then((fs) => fs.readFile(path.join(qaArtifact.root, file))))
  }
  await mkdir(path.join(pagesRoot, 'qa/assets'), { recursive: true })
  for (const file of ['app.js', 'app.css']) {
    await writeFile(path.join(pagesRoot, 'qa/assets', file), await import('node:fs/promises').then((fs) => fs.readFile(path.join(qaArtifact.root, 'assets', file))))
  }
  await writeFile(releaseFile, JSON.stringify({ enabled: false, sourceSha: null }))

  const result = await verifyPagesArtifact({ artifactDir: pagesRoot, releaseFile })
  assert.equal(result.productionEnabled, false)
  assert.equal(result.qa.environment, 'qa')
  assert.equal(result.production, null)
})

test('requires the Production artifact to match the approved pinned SHA', async (t) => {
  const { verifyPagesArtifact } = await loadVerifier()
  const pagesRoot = await mkdtemp(path.join(tmpdir(), 'leai-pages-pinned-'))
  const qaArtifact = await makeArtifact('qa')
  const productionArtifact = await makeArtifact('production')
  const releaseFile = path.join(pagesRoot, 'production-release.json')
  t.after(() => rm(pagesRoot, { recursive: true, force: true }))
  t.after(() => rm(qaArtifact.root, { recursive: true, force: true }))
  t.after(() => rm(productionArtifact.root, { recursive: true, force: true }))

  const { cp } = await import('node:fs/promises')
  await cp(qaArtifact.root, path.join(pagesRoot, 'qa'), { recursive: true })
  await cp(productionArtifact.root, pagesRoot, { recursive: true })
  await writeFile(releaseFile, JSON.stringify({ enabled: true, sourceSha: '3'.repeat(40) }))

  await assert.rejects(
    verifyPagesArtifact({ artifactDir: pagesRoot, releaseFile }),
    /does not match approved SHA/,
  )
})
