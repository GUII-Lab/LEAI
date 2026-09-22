import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveBuildManifest } from './build-environment.mjs'

test('both committed environment manifests target the canonical API namespace', async () => {
  const sourceSha = 'a'.repeat(40)
  for (const environment of ['qa', 'production']) {
    const manifest = await resolveBuildManifest(environment, sourceSha)
    assert.equal(new URL(manifest.apiBaseUrl).pathname, '/datapipeline/api/v1/')
  }
})
