import { spawnSync } from 'node:child_process'
import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const allowedEnvironmentKeys = new Set([
  'VITE_LEAI_ENVIRONMENT',
  'VITE_LEAI_API_BASE_URL',
  'VITE_LEAI_APP_BASE_PATH',
  'VITE_LEAI_BUILD_SHA',
  'VITE_LEAI_BACKEND_BUILD_SHA',
  'VITE_LEAI_SCHEMA_IDENTITY',
  'VITE_LEAI_CONTRACT_VERSION',
])
const ignoredDirectories = new Set(['.git', 'node_modules', 'coverage', 'playwright-report', 'test-results'])
const providerCredentialPatterns = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
]
const credentialLikeSourceMapPattern =
  /(?:api[_-]?key|access[_-]?token|auth[_-]?token|token|secret|password)\s*["']?\s*[:=]\s*["'][^"'\r\n]{8,}["']/i
const forbiddenEnvironmentKeyPattern =
  /(?:^|_)(?:API_?KEY|ACCESS_?KEY|SECRET|TOKEN|PASSWORD|PRIVATE_?KEY|CLIENT_?SECRET)(?:_|$)/i

async function collectPath(target, files) {
  const stats = await lstat(target)
  if (stats.isSymbolicLink()) {
    throw new Error(`Secret scan does not follow symbolic links: ${target}`)
  }
  if (stats.isFile()) {
    files.add(path.resolve(target))
    return
  }
  if (!stats.isDirectory()) return

  for (const entry of await readdir(target, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    await collectPath(path.join(target, entry.name), files)
  }
}

function trackedFiles(rootDir) {
  const result = spawnSync('git', ['ls-files', '--cached', '-z'], {
    cwd: rootDir,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`Unable to list tracked files: ${result.stderr.trim()}`)
  }
  return result.stdout
    .split('\0')
    .filter(Boolean)
    .map((relativePath) => path.join(rootDir, relativePath))
}

function environmentKeyFindings(relativePath, contents) {
  if (!path.basename(relativePath).startsWith('.env')) return []
  const findings = []
  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (!match) continue
    const key = match[1]
    if (allowedEnvironmentKeys.has(key)) continue
    if (key.startsWith('VITE_') || forbiddenEnvironmentKeyPattern.test(key)) {
      findings.push({ file: relativePath, line: index + 1, rule: 'forbidden-environment-key' })
    }
  }
  return findings
}

function sourceMapContainsCredential(contents) {
  try {
    const sourceMap = JSON.parse(contents)
    if (Array.isArray(sourceMap.sourcesContent)) {
      return sourceMap.sourcesContent.some(
        (source) => typeof source === 'string' && credentialLikeSourceMapPattern.test(source),
      )
    }
  } catch {
    // A malformed map is still checked as text below; build verification owns map validity.
  }
  return credentialLikeSourceMapPattern.test(contents)
}

export async function scanFiles(rootDir, inputPaths) {
  const findings = []
  const files = new Set()
  for (const inputPath of inputPaths) await collectPath(inputPath, files)

  for (const absolutePath of [...files].sort()) {
    const stats = await lstat(absolutePath)
    if (stats.size > 20 * 1024 * 1024) continue
    const buffer = await readFile(absolutePath)
    if (buffer.includes(0)) continue
    const contents = buffer.toString('utf8')
    const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/')
    findings.push(...environmentKeyFindings(relativePath, contents))

    for (const pattern of providerCredentialPatterns) {
      if (pattern.test(contents)) {
        findings.push({ file: relativePath, rule: 'provider-credential' })
        break
      }
    }
    if (relativePath.endsWith('.map') && sourceMapContainsCredential(contents)) {
      findings.push({ file: relativePath, rule: 'credential-like-source-map' })
    }
  }

  return findings
}

async function main() {
  const args = process.argv.slice(2)
  const includeTracked = args.includes('--tracked')
  const requestedPaths = args.filter((argument) => argument !== '--tracked')
  const files = includeTracked ? trackedFiles(repositoryRoot) : []
  for (const requestedPath of requestedPaths) {
    files.push(path.resolve(repositoryRoot, requestedPath))
  }
  if (files.length === 0) {
    throw new Error('Secret scan requires --tracked or at least one path')
  }

  const findings = await scanFiles(repositoryRoot, files)
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.file}${finding.line ? `:${finding.line}` : ''}: ${finding.rule}`)
    }
    throw new Error(`Client secret scan found ${findings.length} issue(s)`)
  }
  console.log(`Client secret scan passed for ${new Set(files).size} input path(s)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
