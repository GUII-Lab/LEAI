import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shaPattern = /^[0-9a-f]{40}$/
const serviceWorkerFilePattern = /(^|\/)(service-worker|sw)(\.[a-z0-9_-]+)?\.(js|mjs|cjs)$/i
const serviceWorkerCodePatterns = [
  /navigator\s*\.\s*serviceWorker/,
  /serviceWorker\s*\.\s*register\s*\(/,
  /workbox/i,
]

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

async function loadPublicEnvironment(environment) {
  const values = parseDotEnv(
    await readFile(path.join(repositoryRoot, `.env.${environment}`), 'utf8'),
  )
  const apiUrl = new URL(values.VITE_LEAI_API_BASE_URL)
  return {
    environment,
    basePath: values.VITE_LEAI_APP_BASE_PATH,
    apiHost: apiUrl.hostname,
  }
}

async function collectFiles(rootDir, excludedPrefixes = []) {
  const files = []

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name)
      const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/')
      if (excludedPrefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`))) {
        continue
      }
      if (entry.isSymbolicLink()) {
        throw new Error(`Artifact must not contain symbolic links: ${relativePath}`)
      }
      if (entry.isDirectory()) {
        await visit(absolutePath)
      } else if (entry.isFile()) {
        files.push({ absolutePath, relativePath })
      }
    }
  }

  await visit(rootDir)
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

function assertRelease(release) {
  if (!release || typeof release !== 'object' || typeof release.enabled !== 'boolean') {
    throw new Error('Production release manifest must contain an enabled boolean')
  }
  if (!release.enabled && release.sourceSha !== null) {
    throw new Error('Disabled Production release must use a null sourceSha')
  }
  if (release.enabled && !shaPattern.test(release.sourceSha ?? '')) {
    throw new Error('Enabled Production release requires an exact 40-character sourceSha')
  }
}

function assertHtmlAssetBases(contents, relativePath, environment, basePath) {
  const references = contents.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)
  for (const [, reference] of references) {
    if (!reference.startsWith('/')) continue
    if (!reference.startsWith(basePath)) {
      throw new Error(`${relativePath} contains ${reference} outside expected base ${basePath}`)
    }
    if (environment === 'production' && reference.startsWith('/LEAI/qa/')) {
      throw new Error(`${relativePath} contains QA path ${reference} in the Production artifact`)
    }
  }
}

export async function verifyEnvironmentArtifact({
  rootDir,
  environment,
  basePath,
  ownApiHost,
  forbiddenApiHost,
  sourceSha,
  excludePrefixes = [],
}) {
  if (!['qa', 'production'].includes(environment)) {
    throw new Error(`Unknown artifact environment: ${environment}`)
  }
  if (!shaPattern.test(sourceSha)) {
    throw new Error(`${environment} artifact requires an exact 40-character source SHA`)
  }

  const manifestPath = path.join(rootDir, 'leai-build-manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (
    manifest.environment !== environment ||
    manifest.basePath !== basePath ||
    manifest.apiHost !== ownApiHost ||
    manifest.sourceSha !== sourceSha
  ) {
    throw new Error(`${environment} build manifest does not match the expected environment identity`)
  }

  const files = await collectFiles(rootDir, excludePrefixes)
  let combinedText = ''
  for (const file of files) {
    if (serviceWorkerFilePattern.test(file.relativePath)) {
      throw new Error(`Artifact contains a forbidden service worker file: ${file.relativePath}`)
    }
    const stats = await lstat(file.absolutePath)
    if (stats.size > 20 * 1024 * 1024) {
      throw new Error(`Artifact file is unexpectedly large: ${file.relativePath}`)
    }
    const contents = await readFile(file.absolutePath, 'utf8')
    combinedText += `\n${contents}`
    if (file.relativePath.endsWith('.html')) {
      assertHtmlAssetBases(contents, file.relativePath, environment, basePath)
    }
    for (const pattern of serviceWorkerCodePatterns) {
      if (pattern.test(contents)) {
        throw new Error(`Artifact contains forbidden service worker code in ${file.relativePath}`)
      }
    }
  }

  if (combinedText.includes(forbiddenApiHost)) {
    throw new Error(`${environment} artifact contains forbidden API host ${forbiddenApiHost}`)
  }
  if (!combinedText.includes(ownApiHost)) {
    throw new Error(`${environment} artifact does not contain its declared API host ${ownApiHost}`)
  }

  return { environment, fileCount: files.length, sourceSha }
}

export async function verifyPagesArtifact({ artifactDir, releaseFile }) {
  const release = JSON.parse(await readFile(releaseFile, 'utf8'))
  assertRelease(release)
  const qaConfig = await loadPublicEnvironment('qa')
  const productionConfig = await loadPublicEnvironment('production')
  const qaManifest = JSON.parse(
    await readFile(path.join(artifactDir, 'qa/leai-build-manifest.json'), 'utf8'),
  )
  const qa = await verifyEnvironmentArtifact({
    rootDir: path.join(artifactDir, 'qa'),
    environment: 'qa',
    basePath: qaConfig.basePath,
    ownApiHost: qaConfig.apiHost,
    forbiddenApiHost: productionConfig.apiHost,
    sourceSha: qaManifest.sourceSha,
  })

  if (!release.enabled) {
    for (const rootEntry of ['index.html', 'leai-build-manifest.json']) {
      try {
        await lstat(path.join(artifactDir, rootEntry))
        throw new Error(`Production is disabled but ${rootEntry} exists at the Pages root`)
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
    }
    return { productionEnabled: false, qa, production: null }
  }

  const productionManifest = JSON.parse(
    await readFile(path.join(artifactDir, 'leai-build-manifest.json'), 'utf8'),
  )
  if (productionManifest.sourceSha !== release.sourceSha) {
    throw new Error(
      `Production artifact SHA ${productionManifest.sourceSha} does not match approved SHA ${release.sourceSha}`,
    )
  }
  const production = await verifyEnvironmentArtifact({
    rootDir: artifactDir,
    environment: 'production',
    basePath: productionConfig.basePath,
    ownApiHost: productionConfig.apiHost,
    forbiddenApiHost: qaConfig.apiHost,
    sourceSha: release.sourceSha,
    excludePrefixes: ['qa'],
  })
  return { productionEnabled: true, qa, production }
}

async function main() {
  const result = await verifyPagesArtifact({
    artifactDir: path.join(repositoryRoot, 'dist/pages'),
    releaseFile: path.join(repositoryRoot, 'deployment/production-release.json'),
  })
  console.log(
    `Verified Pages artifact: QA ${result.qa.sourceSha}; Production ${
      result.productionEnabled ? result.production.sourceSha : 'disabled'
    }`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
