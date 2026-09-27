import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHerokuManifest } from './build-heroku.mjs'

test('Heroku QA and production use relative APIs and explicit backend identities', () => {
  for (const environment of ['qa', 'production']) {
    const result = resolveHerokuManifest(environment, 'a'.repeat(40), 'b'.repeat(40))
    assert.equal(result.basePath, '/')
    assert.equal(result.apiBaseUrl, '/datapipeline/api/v1/')
    assert.equal(result.backendBuildSha, 'b'.repeat(40))
    assert.equal(result.schemaIdentity, environment === 'qa' ? 'leai_qa' : 'public')
  }
})

test('a deployable build cannot use unbound identities or an unknown environment', () => {
  assert.throws(() => resolveHerokuManifest('qa', 'a'.repeat(40), 'placeholder'))
  assert.throws(() => resolveHerokuManifest('production', 'dirty', 'b'.repeat(40)))
  assert.throws(() => resolveHerokuManifest('preview', 'a'.repeat(40), 'b'.repeat(40)))
})
