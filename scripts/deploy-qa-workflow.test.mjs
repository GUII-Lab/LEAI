import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('QA deployment validates backend pins from GitHub main or local QA history and pushes only to QA', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8')

  assert.match(workflow, /git -C "\$backend_dir" fetch --no-tags origin main:refs\/remotes\/origin\/main/)
  assert.match(workflow, /git -C "\$backend_dir" fetch --no-tags heroku main/)
  assert.match(workflow, /merge-base --is-ancestor "\$LEAI_QA_BACKEND_SHA" refs\/remotes\/origin\/main/)
  assert.match(workflow, /merge-base --is-ancestor "\$LEAI_QA_BACKEND_SHA" refs\/remotes\/heroku\/main/)
  assert.match(workflow, /\[ "\$github_pin_ancestor" != true \] && \[ "\$heroku_pin_ancestor" != true \]/)
  assert.match(workflow, /https:\/\/git\.heroku\.com\/guiidata-leai-qa\.git HEAD:main/)
  assert.doesNotMatch(workflow, /git\s+-C\s+"\$backend_dir"\s+push\s+.*github\.com\/GUII-Lab\/guiidatapipelines/)
})

test('QA deployment continues from the current QA release commit after verifying the pinned backend tree', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8')

  assert.match(workflow, /git -C "\$backend_dir" fetch --no-tags heroku main/)
  assert.match(workflow, /HOME="\$heroku_home" GIT_TERMINAL_PROMPT=0 git -C "\$backend_dir" fetch --no-tags heroku main/)
  assert.match(workflow, /git -C "\$backend_dir" diff --quiet "\$LEAI_QA_BACKEND_SHA" refs\/remotes\/heroku\/main/)
  assert.match(workflow, /git -C "\$backend_dir" checkout --detach refs\/remotes\/heroku\/main/)
  assert.match(workflow, /https:\/\/git\.heroku\.com\/guiidata-leai-qa\.git HEAD:main/)
  assert.doesNotMatch(workflow, /push\s+.*\s-f(?:\s|\b)/)
  assert.doesNotMatch(workflow, /git\s+-C\s+"\$backend_dir"\s+push\s+.*github\.com\/GUII-Lab\/guiidatapipelines/)
})
