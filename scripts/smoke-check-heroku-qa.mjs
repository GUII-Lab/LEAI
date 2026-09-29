const [baseUrl, expectedFrontendSha, expectedBackendSha] = process.argv.slice(2)
const expectedSha = /^[0-9a-f]{40}$/

if (!baseUrl || !expectedSha.test(expectedFrontendSha ?? '') || !expectedSha.test(expectedBackendSha ?? '')) {
  throw new Error('Usage: node scripts/smoke-check-heroku-qa.mjs <qa-url> <frontend-sha> <backend-sha>')
}

const origin = new URL(baseUrl)
if (origin.protocol !== 'https:') throw new Error('QA smoke checks require HTTPS')

const attempts = 30
const delayMs = 10_000
let lastError = 'QA release did not become available'

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const page = await fetch(new URL('/', origin), { redirect: 'error' })
    if (!page.ok) throw new Error(`QA page returned HTTP ${page.status}`)
    const html = await page.text()
    if (!html.includes('<div id="root">')) throw new Error('QA page is missing the React root')

    const manifestResponse = await fetch(new URL('/leai-build-manifest.json', origin), { redirect: 'error' })
    if (!manifestResponse.ok) throw new Error(`QA build manifest returned HTTP ${manifestResponse.status}`)
    const manifest = await manifestResponse.json()
    if (manifest.environment !== 'qa' || manifest.schemaIdentity !== 'leai_qa'
      || manifest.basePath !== '/' || manifest.apiBaseUrl !== '/datapipeline/api/v1/'
      || manifest.workingTreeDirty !== false) {
      throw new Error('QA build manifest has the wrong environment or schema')
    }
    if (manifest.sourceSha !== expectedFrontendSha || manifest.backendBuildSha !== expectedBackendSha) {
      throw new Error('QA build manifest does not match the requested frontend/backend commits')
    }

    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
    if (assets.length === 0) throw new Error('QA page has no fingerprinted assets')
    for (const asset of assets) {
      const response = await fetch(new URL(asset, origin), { redirect: 'error' })
      if (!response.ok) throw new Error(`QA asset ${asset} returned HTTP ${response.status}`)
      const expectedType = asset.endsWith('.css') ? 'text/css' : 'javascript'
      if (!response.headers.get('content-type')?.includes(expectedType)) {
        throw new Error(`QA asset ${asset} has an unexpected content type`)
      }
      await response.arrayBuffer()
    }

    const backendResponse = await fetch(new URL('/datapipeline/api/v1/environment/', origin), {
      headers: { Accept: 'application/json' }, redirect: 'error',
    })
    if (!backendResponse.ok) throw new Error(`QA backend handshake returned HTTP ${backendResponse.status}`)
    const backend = await backendResponse.json()
    if (backend.environment !== 'qa' || backend.schema_identity !== 'leai_qa'
      || backend.backend_build_sha !== expectedBackendSha
      || backend.contract_version !== manifest.contractVersion
      || !Array.isArray(backend.allowed_app_bases) || !backend.allowed_app_bases.includes('/')) {
      throw new Error('QA backend handshake does not match the expected QA deployment')
    }

    console.log(`QA smoke check passed: frontend ${expectedFrontendSha}, backend ${expectedBackendSha}`)
    process.exit(0)
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
    if (attempt < attempts) {
      if (attempt === 1 || attempt % 5 === 0) console.warn(`QA not ready (attempt ${attempt}/${attempts}): ${lastError}`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

throw new Error(`QA smoke check failed after ${attempts} attempts: ${lastError}`)
