import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shaPattern = /^[0-9a-f]{40}$/
const environmentSettings = {
  qa: { expectedBasePath: '/LEAI/qa/', forbiddenEnvironment: 'production' },
  production: { expectedBasePath: '/LEAI/', forbiddenEnvironment: 'qa' },
}

function parseDotEnv(contents) {
  const values = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) throw new Error(`Malformed environment line: ${rawLine}`)
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[match[1]] = value
  }
  return values
}

async function readEnvironmentFile(environment) {
  return parseDotEnv(
    await readFile(path.join(repositoryRoot, `.env.${environment}`), 'utf8'),
  )
}

function currentGitSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`Unable to resolve source SHA: ${result.stderr.trim()}`)
  }
  return result.stdout.trim().toLowerCase()
}

export function resolveSourceSha(source = process.env) {
  const sourceSha = (source.LEAI_BUILD_SHA || source.GITHUB_SHA || currentGitSha()).toLowerCase()
  if (!shaPattern.test(sourceSha)) {
    throw new Error('Build requires an exact 40-character source SHA')
  }
  return sourceSha
}

export async function resolveBuildManifest(environment, sourceSha = resolveSourceSha()) {
  const settings = environmentSettings[environment]
  if (!settings) throw new Error(`Unknown LEAI build environment: ${environment}`)
  if (!shaPattern.test(sourceSha)) {
    throw new Error('Build requires an exact 40-character source SHA')
  }

  const values = await readEnvironmentFile(environment)
  const forbiddenValues = await readEnvironmentFile(settings.forbiddenEnvironment)
  if (values.VITE_LEAI_ENVIRONMENT !== environment) {
    throw new Error(`Environment file identity must be ${environment}`)
  }
  if (values.VITE_LEAI_APP_BASE_PATH !== settings.expectedBasePath) {
    throw new Error(`${environment} base must be ${settings.expectedBasePath}`)
  }

  let apiUrl
  let forbiddenApiUrl
  try {
    apiUrl = new URL(values.VITE_LEAI_API_BASE_URL)
    forbiddenApiUrl = new URL(forbiddenValues.VITE_LEAI_API_BASE_URL)
  } catch {
    throw new Error(`${environment} API base must be an absolute URL`)
  }
  if (
    apiUrl.protocol !== 'https:' ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash ||
    !apiUrl.pathname.endsWith('/')
  ) {
    throw new Error(`${environment} API base is malformed`)
  }
  if (apiUrl.hostname === forbiddenApiUrl.hostname) {
    throw new Error(`${environment} API host must differ from ${settings.forbiddenEnvironment}`)
  }
  if (
    (environment === 'qa' && /(^|[-.])prod(uction)?([-.]|$)/i.test(apiUrl.hostname)) ||
    (environment === 'production' && /(^|[-.])qa([-.]|$)/i.test(apiUrl.hostname))
  ) {
    throw new Error(`${environment} build targets a forbidden API host`)
  }

  return {
    environment,
    basePath: settings.expectedBasePath,
    apiBaseUrl: apiUrl.href,
    apiHost: apiUrl.hostname,
    sourceSha,
  }
}

export async function buildEnvironment(environment, options = {}) {
  const manifest = await resolveBuildManifest(environment, options.sourceSha)
  const outDir = options.outDir ?? path.join(repositoryRoot, 'dist', environment)
  const viteBin = path.join(repositoryRoot, 'node_modules/vite/bin/vite.js')
  const result = spawnSync(
    process.execPath,
    [viteBin, 'build', '--mode', environment, '--base', manifest.basePath, '--outDir', outDir, '--emptyOutDir'],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        VITE_LEAI_BUILD_SHA: manifest.sourceSha,
      },
      encoding: 'utf8',
      stdio: options.quiet ? 'pipe' : 'inherit',
    },
  )
  if (result.status !== 0) {
    const detail = options.quiet ? `\n${result.stdout}\n${result.stderr}` : ''
    throw new Error(`Vite ${environment} build failed${detail}`)
  }
  await writeFile(
    path.join(outDir, 'leai-build-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  return { ...manifest, outDir }
}

async function main() {
  const environment = process.argv[2]
  const result = await buildEnvironment(environment)
  console.log(`Built ${result.environment} artifact ${result.sourceSha} at ${result.outDir}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
