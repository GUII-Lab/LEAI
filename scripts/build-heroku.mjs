import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveSourceSha } from './build-environment.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha = /^[0-9a-f]{40}$/

export function resolveHerokuManifest(environment, sourceSha, backendBuildSha) {
  if (!['qa', 'production'].includes(environment)) throw new Error('Choose qa or production explicitly')
  if (!sha.test(sourceSha) || !sha.test(backendBuildSha)) throw new Error('Exact frontend and backend commit SHAs are required')
  return {
    environment, basePath: '/', apiBaseUrl: '/datapipeline/api/v1/',
    sourceSha, backendBuildSha,
    schemaIdentity: environment === 'qa' ? 'leai_qa' : 'public',
    contractVersion: '2026-09-21',
  }
}

export async function buildHeroku(environment, backendBuildSha) {
  const manifest = resolveHerokuManifest(environment, resolveSourceSha(), backendBuildSha)
  const outDir = path.join(root, 'dist', 'heroku', environment)
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' })
  if (status.status !== 0) throw new Error('Unable to verify source working tree')
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--mode', environment,
    '--base', '/', '--outDir', outDir, '--emptyOutDir',
  ], {
    cwd: root, stdio: 'inherit', env: {
      ...process.env,
      VITE_LEAI_ENVIRONMENT: environment, VITE_LEAI_API_BASE_URL: manifest.apiBaseUrl,
      VITE_LEAI_APP_BASE_PATH: '/', VITE_LEAI_BUILD_SHA: manifest.sourceSha,
      VITE_LEAI_BACKEND_BUILD_SHA: manifest.backendBuildSha,
      VITE_LEAI_SCHEMA_IDENTITY: manifest.schemaIdentity,
      VITE_LEAI_CONTRACT_VERSION: manifest.contractVersion,
    },
  })
  if (result.status !== 0) throw new Error('Heroku frontend build failed')
  // Local previews may contain unfinished work. Never claim they equal a commit.
  const artifact = { ...manifest, workingTreeDirty: Boolean(status.stdout.trim()) }
  await writeFile(path.join(outDir, 'leai-build-manifest.json'), JSON.stringify(artifact, null, 2) + '\n')
  return { ...artifact, outDir }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  buildHeroku(process.argv[2], process.argv[3]).then((result) => {
    console.log(`Heroku frontend: ${result.outDir}${result.workingTreeDirty ? ' (local preview only: dirty source)' : ''}`)
  }).catch((error) => { console.error(error.message); process.exitCode = 1 })
}
