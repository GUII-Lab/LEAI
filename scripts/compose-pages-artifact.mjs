import { cp, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  buildEnvironment,
  resolveBuildManifest,
  resolveSourceSha,
} from './build-environment.mjs'
import { verifyEnvironmentArtifact, verifyPagesArtifact } from './verify-pages-artifact.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseFile = path.join(repositoryRoot, 'deployment/production-release.json')
const distDir = path.join(repositoryRoot, 'dist')
const pagesDir = path.join(distDir, 'pages')

async function exists(target) {
  try {
    await lstat(target)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function readRelease() {
  const release = JSON.parse(await readFile(releaseFile, 'utf8'))
  if (typeof release.enabled !== 'boolean') {
    throw new Error('Production release manifest requires an enabled boolean')
  }
  if (!release.enabled && release.sourceSha !== null) {
    throw new Error('Disabled Production release must use a null sourceSha')
  }
  if (release.enabled && !/^[0-9a-f]{40}$/.test(release.sourceSha ?? '')) {
    throw new Error('Enabled Production release requires an exact 40-character sourceSha')
  }
  return release
}

async function prepareProduction(release, activeSourceSha) {
  if (!release.enabled) return null
  const productionDir = path.join(distDir, 'production')
  if (release.sourceSha === activeSourceSha) {
    return buildEnvironment('production', { sourceSha: release.sourceSha })
  }
  if (!(await exists(path.join(productionDir, 'leai-build-manifest.json')))) {
    throw new Error(
      `Production is pinned to ${release.sourceSha}; provide its verified dist/production artifact before composing from ${activeSourceSha}`,
    )
  }
  const manifest = JSON.parse(
    await readFile(path.join(productionDir, 'leai-build-manifest.json'), 'utf8'),
  )
  const expectedProduction = await resolveBuildManifest('production', release.sourceSha)
  const qaManifest = await resolveBuildManifest('qa', activeSourceSha)
  await verifyEnvironmentArtifact({
    rootDir: productionDir,
    environment: 'production',
    basePath: expectedProduction.basePath,
    ownApiHost: expectedProduction.apiHost,
    forbiddenApiHost: qaManifest.apiHost,
    sourceSha: release.sourceSha,
  })
  return { ...manifest, outDir: productionDir }
}

async function replacePagesArtifact(stagingDir) {
  const backupDir = path.join(distDir, `.pages-backup-${process.pid}`)
  await rm(backupDir, { recursive: true, force: true })
  const hadCurrentArtifact = await exists(pagesDir)
  if (hadCurrentArtifact) await rename(pagesDir, backupDir)
  try {
    await rename(stagingDir, pagesDir)
    await rm(backupDir, { recursive: true, force: true })
  } catch (error) {
    if (!(await exists(pagesDir)) && (await exists(backupDir))) {
      await rename(backupDir, pagesDir)
    }
    throw error
  }
}

export async function composePagesArtifact() {
  const activeSourceSha = resolveSourceSha()
  const release = await readRelease()
  const qa = await buildEnvironment('qa', { sourceSha: activeSourceSha })
  const production = await prepareProduction(release, activeSourceSha)
  const stagingDir = path.join(distDir, `.pages-staging-${process.pid}`)
  await rm(stagingDir, { recursive: true, force: true })
  await mkdir(stagingDir, { recursive: true })

  if (production) await cp(production.outDir, stagingDir, { recursive: true })
  await cp(qa.outDir, path.join(stagingDir, 'qa'), { recursive: true })
  await writeFile(
    path.join(stagingDir, 'pages-release-manifest.json'),
    `${JSON.stringify(
      {
        qaSourceSha: qa.sourceSha,
        productionEnabled: release.enabled,
        productionSourceSha: release.sourceSha,
      },
      null,
      2,
    )}\n`,
  )

  await verifyPagesArtifact({ artifactDir: stagingDir, releaseFile })
  await replacePagesArtifact(stagingDir)
  return { artifactDir: pagesDir, qa, production }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  composePagesArtifact()
    .then((result) => {
      console.log(
        `Composed Pages artifact at ${result.artifactDir}; Production ${
          result.production ? result.production.sourceSha : 'disabled'
        }`,
      )
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
