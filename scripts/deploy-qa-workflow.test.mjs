import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('QA deployment reads the pinned backend from GitHub main and pushes only to QA Heroku', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8')

  assert.match(workflow, /git -C "\$backend_dir" fetch --no-tags origin main/)
  assert.match(workflow, /https:\/\/git\.heroku\.com\/guiidata-leai-qa\.git HEAD:main/)
  assert.doesNotMatch(workflow, /git\s+-C\s+"\$backend_dir"\s+push\s+.*github\.com\/GUII-Lab\/guiidatapipelines/)
})
