# LEAI React Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the sole `GUII-Lab/LEAI` repository and deliver a tested React foundation that can build isolated QA and Production variants without using any legacy frontend repository.

**Architecture:** A Vite multi-page React application mounts one shared shell into real HTML entry documents. Environment manifests and a typed runtime handshake bind each build to its intended backend. GitHub Actions validates both builds and prepares one Pages artifact with QA under `/LEAI/qa/`; publishing remains a separate gate.

**Tech Stack:** Node `22.22.0`, npm, React, TypeScript strict mode, Vite, Tailwind CSS v4, shadcn/ui/Radix, Lucide, TanStack Query, Zod, Vitest, Testing Library, Playwright, and GitHub Actions.

**Spec:** `docs/product-strategy/2026-09-17-leai-react-rewrite-architecture.md`

## Global Constraints

- Work in `/Users/harveyli/Documents/GitHub/LEAI` on `main`; do not create a branch unless the owner explicitly requests one.
- Do not read from, publish to, redirect through, or recover from a legacy frontend repository.
- Do not enable Pages or publish a QA artifact without the separate action-time approval in Task 10.
- Do not commit secrets, `.env` files containing credentials, private exports, transcripts, screenshots with course data, or generated verification reports.
- Use `npm ci` in CI and commit `package-lock.json`.
- Use strict TypeScript and source-owned components; do not install the entire shadcn catalog.
- QA and Production share an origin but never share unqualified storage, cache, or channel keys.
- Do not register a service worker.
- Commit each accepted task separately without co-author trailers.

---

### Task 1: Create the Sole Repository and Canonical Documentation

**Files:**
- Create: `/Users/harveyli/Documents/GitHub/LEAI/README.md`
- Create: `/Users/harveyli/Documents/GitHub/LEAI/AGENTS.md`
- Create: `/Users/harveyli/Documents/GitHub/LEAI/docs/product-strategy/2026-09-17-leai-react-rewrite-architecture.md`
- Create: `/Users/harveyli/Documents/GitHub/LEAI/docs/product-strategy/2026-09-17-leai-react-ui-system.md`
- Create: `/Users/harveyli/Documents/GitHub/LEAI/docs/product-strategy/2026-09-17-leai-react-api-contract.md`
- Create: `/Users/harveyli/Documents/GitHub/LEAI/docs/superpowers/plans/2026-09-17-leai-react-rewrite-master-roadmap.md`
- Create: `/Users/harveyli/Documents/GitHub/LEAI/docs/superpowers/plans/2026-09-17-leai-react-foundation-implementation-plan.md`

**Interfaces:**
- Consumes: Owner-approved repository name `GUII-Lab/LEAI` and the five canonical planning documents in the current design workspace.
- Produces: Public GitHub repository `GUII-Lab/LEAI`, local checkout `/Users/harveyli/Documents/GitHub/LEAI`, and canonical in-repo specifications used by every later task.

- [x] **Step 1: Confirm targets are absent**

Run:

```bash
gh repo view GUII-Lab/LEAI --json nameWithOwner
test ! -e /Users/harveyli/Documents/GitHub/LEAI
```

Expected: GitHub reports that the repository cannot be resolved and the local path check exits successfully.

- [x] **Step 2: Create and clone the public repository**

Run from `/Users/harveyli/Documents/GitHub`:

```bash
gh repo create GUII-Lab/LEAI --public --description "Learning Experience AI instructor and student application" --clone
```

Expected: GitHub creates `https://github.com/GUII-Lab/LEAI` and clones an empty checkout at `/Users/harveyli/Documents/GitHub/LEAI`.

- [x] **Step 3: Add canonical documentation**

Copy the exact approved contents of the five planning documents into the paths listed above. Write `README.md` with the product purpose, QA and Production URLs, local prerequisites, and a warning that Pages is not enabled yet. Write `AGENTS.md` with the no-branch, verification, public-artifact, and environment-isolation rules that apply to this repository.

- [x] **Step 4: Verify documentation does not retain the rejected topology**

Run:

```bash
rg -n "GUII-Lab/LEAI-QA|/LEAI-QA/|legacy fallback|old repo" docs README.md AGENTS.md
```

Expected: No deployment dependency on an old repository. Historical rationale may mention that legacy repositories are explicitly excluded.

- [x] **Step 5: Commit the repository foundation**

Run:

```bash
git add README.md AGENTS.md docs
git diff --cached --check
git commit -m "docs: establish LEAI React rewrite"
git push -u origin main
```

Expected: One documentation-only commit on `main`; no Pages deployment exists.

### Task 2: Scaffold React, TypeScript, and Vite

**Files:**
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/styles/globals.css`

**Interfaces:**
- Consumes: Node `22.22.0` and npm.
- Produces: `npm run dev`, `npm run typecheck`, and `npm run build` plus a minimal React mount at `#root`.

- [x] **Step 1: Scaffold the Vite React TypeScript template**

Run in the new repository:

```bash
npm create vite@latest . -- --template react-ts
npm install
```

Expected: Vite creates a React TypeScript project and commits no generated dependency directory.

- [x] **Step 2: Pin Node and strict compiler behavior**

Set `.nvmrc` to `22.22.0` and use that exact version in CI. Set `package.json` `engines.node` to `>=22.12.0 <26` and `engines.npm` to `>=10.9.4 <12` so supported local runtimes do not produce false warnings. Keep `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `noUncheckedSideEffectImports` enabled in the TypeScript configuration.

- [x] **Step 3: Replace the demo with the minimal LEAI mount**

`src/app/App.tsx` exports:

```tsx
export function App() {
  return <main><h1>LEAI</h1></main>
}
```

`src/main.tsx` creates the root and renders `<App />` inside `StrictMode`. Remove Vite logos and demo counters.

- [x] **Step 4: Add deterministic scripts**

Set scripts to include:

```json
{
  "dev": "vite",
  "typecheck": "tsc -b --pretty false",
  "build": "npm run typecheck && vite build",
  "preview": "vite preview"
}
```

- [x] **Step 5: Verify the scaffold**

Run:

```bash
npm run typecheck
npm run build
git diff --check
```

Expected: All commands exit zero and `dist/index.html` exists.

- [x] **Step 6: Commit**

```bash
git add .gitignore .nvmrc .oxlintrc.json index.html package.json package-lock.json src tsconfig*.json vite.config.ts
git diff --cached --check
git commit -m "chore: scaffold React application"
```

### Task 3: Install Unit, Component, and Browser Test Harnesses

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/app/App.test.tsx`
- Create: `playwright.config.ts`
- Create: `e2e/app-shell.spec.ts`

**Interfaces:**
- Consumes: `App` from Task 2.
- Produces: `npm run test`, `npm run test:coverage`, and `npm run test:e2e`.

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

it('identifies the LEAI application', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'LEAI' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test before installing the harness**

Run: `npm test -- --run`

Expected: FAIL because the test runner and Testing Library are not configured.

- [ ] **Step 3: Install and configure the harness**

Run:

```bash
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
npx playwright install chromium firefox webkit
```

Configure Vitest with `environment: "jsdom"` and `setupFiles: ["./src/test/setup.ts"]`. Add `test`, `test:coverage`, and `test:e2e` scripts.

- [ ] **Step 4: Add the browser smoke test**

```ts
import { expect, test } from '@playwright/test'

test('loads the LEAI shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'LEAI' })).toBeVisible()
})
```

Configure Playwright projects for Chromium, Firefox, and WebKit and start `npm run dev -- --host 127.0.0.1` through `webServer`.

- [ ] **Step 5: Verify all harnesses**

Run:

```bash
npm run test -- --run
npm run test:coverage
npm run test:e2e
```

Expected: The component test and three browser projects pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts playwright.config.ts src/test src/app/App.test.tsx e2e
git diff --cached --check
git commit -m "test: add React verification harness"
```

### Task 4: Add Tailwind v4 and Semantic Tokens

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/styles/globals.css`
- Create: `src/styles/tokens.test.ts`

**Interfaces:**
- Consumes: Vite CSS pipeline.
- Produces: semantic utility names including `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`, and mode/state tokens.

- [x] **Step 1: Write the failing token-source test**

Read `src/styles/globals.css` and assert that it contains `--color-background`, `--color-primary`, `--color-team`, `--color-guided`, `prefers-reduced-motion`, and no raw Tailwind palette class contract.

- [x] **Step 2: Verify the test fails**

Run: `npm run test -- --run src/styles/tokens.test.ts`

Expected: FAIL because semantic tokens are absent.

- [x] **Step 3: Install Tailwind v4 and define tokens**

Run:

```bash
npm install tailwindcss @tailwindcss/vite
```

Add the Vite plugin. In `globals.css`, import Tailwind and define the approved Pacific, Ink, Slate, Canvas, Paper, Course rail, Team, and Guided values through `@theme` plus light semantic variables. Add reduced-motion rules and visible focus-ring defaults.

- [x] **Step 4: Apply semantic styles to the shell**

Use semantic utilities in `App.tsx`; do not use raw hex values or one-off arbitrary color classes.

- [x] **Step 5: Verify**

Run:

```bash
npm run test -- --run src/styles/tokens.test.ts
npm run typecheck
npm run build
```

Expected: All commands pass and the built CSS contains the semantic variables.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/styles src/app/App.tsx
git diff --cached --check
git commit -m "feat: define LEAI design tokens"
```

### Task 5: Establish Source-Owned shadcn Primitives

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/tooltip.tsx`
- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/ui/button.test.tsx`
- Create: `src/components/ui/tooltip.test.tsx`

**Interfaces:**
- Consumes: semantic tokens and the `cn(...inputs: ClassValue[]): string` helper exported from `src/lib/utils.ts`.
- Produces: accessible source-owned primitives for the first AppShell slice.

- [x] **Step 1: Initialize shadcn for Vite**

Run:

```bash
npx shadcn@latest init
npx shadcn@latest add button card badge tooltip sheet
```

Choose CSS variables, the committed aliases in `components.json`, and the existing `src/styles/globals.css`. Do not add unrelated catalog components.

- [x] **Step 2: Write primitive behavior tests**

Test that Button preserves its accessible name and disabled state. Test Tooltip appears after keyboard focus and disappears on Escape without changing the outer layout container's dimensions.

- [x] **Step 3: Verify**

Run:

```bash
npm run test -- --run src/components/ui
npm run typecheck
npm run build
```

Expected: All primitive tests pass and source files are committed locally rather than imported from a remote runtime.

- [ ] **Step 4: Commit**

```bash
git add components.json package.json package-lock.json src/components src/lib src/styles/globals.css
git diff --cached --check
git commit -m "feat: add initial UI primitives"
```

### Task 6: Implement Environment Manifests and Runtime Handshake

**Files:**
- Create: `src/config/environment.ts`
- Create: `src/config/environment.test.ts`
- Create: `src/api/http-client.ts`
- Create: `src/api/environment.ts`
- Create: `src/api/environment.test.ts`
- Create: `src/app/EnvironmentGate.tsx`
- Create: `.env.local.example`
- Create: `.env.qa`
- Create: `.env.production`

**Interfaces:**
- Produces: `type EnvironmentName = "local" | "qa" | "production"`; `getEnvironment(): PublicEnvironment`; `verifyEnvironment(expected, observed): EnvironmentVerification`; and `EnvironmentGate` that keeps mutations disabled until verification succeeds.
- `PublicEnvironment` contains `name`, `apiBaseUrl`, `appBasePath`, `storagePrefix`, `buildSha`, and `environmentLabel`.
- `EnvironmentVerification` is `{ ok: true } | { ok: false; reason: string }`.

- [x] **Step 1: Write failing environment tests**

Cover these exact cases:

```ts
expect(verifyEnvironment(qaExpected, qaObserved)).toEqual({ ok: true })
expect(verifyEnvironment(qaExpected, prodObserved).ok).toBe(false)
expect(qualifyBrowserKey('qa', 'session')).toBe('leai:qa:session')
expect(qualifyBrowserKey('production', 'session')).toBe('leai:prod:session')
```

- [x] **Step 2: Verify failure**

Run: `npm run test -- --run src/config/environment.test.ts src/api/environment.test.ts`

Expected: FAIL because the modules do not exist.

- [x] **Step 3: Implement typed manifests and Zod response validation**

Install `zod` and implement the exact interfaces above. The QA manifest uses app base `/LEAI/qa/` and rejects the Production API hostname. The Production manifest uses `/LEAI/` and rejects the QA API hostname. No secret-like `VITE_` variable is accepted.

- [x] **Step 4: Implement the fail-closed gate**

Fetch `api/environment/`, validate environment name, backend SHA, schema/database identity, contract version, allowed application origin/base, and server time. Render a read-only mismatch alert and never mount mutating providers when verification fails.

- [x] **Step 5: Verify**

Run:

```bash
npm run test -- --run src/config src/api
npm run typecheck
npm run build
```

Expected: All tests pass; no manifest contains a credential.

- [ ] **Step 6: Commit**

```bash
git add .env.local.example .env.qa .env.production package.json package-lock.json src/config src/api src/app/EnvironmentGate.tsx
git diff --cached --check
git commit -m "feat: enforce environment identity"
```

### Task 7: Build the Shared Responsive App Shell

**Files:**
- Create: `src/components/product/AppShell.tsx`
- Create: `src/components/product/EnvironmentBar.tsx`
- Create: `src/components/product/AccountRail.tsx`
- Create: `src/components/product/CourseNavigation.tsx`
- Create: `src/components/product/PageHeader.tsx`
- Create: `src/components/product/AppShell.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `e2e/app-shell.spec.ts`

**Interfaces:**
- Produces: `AppShellProps { environment; accountItems; courseItems; activeItem; children }`; account navigation owns only Account and All Courses; course navigation owns active-course tools.

- [x] **Step 1: Write failing shell tests**

Test that All Courses renders in the account rail, Prompt Designer renders in course navigation, duplicate labels do not exist, and the mobile menu uses a Sheet with focus return.

- [x] **Step 2: Verify failure**

Run: `npm run test -- --run src/components/product/AppShell.test.tsx`

Expected: FAIL because AppShell does not exist.

- [x] **Step 3: Implement the shell**

Use semantic tokens and the source-owned primitives. Keep the environment bar visible in QA. Reflow based on content pressure and use the Sheet below the approved shell breakpoint. Do not copy Canvas visuals.

- [x] **Step 4: Extend browser coverage**

At 390, 820, 1022, and 1440 pixels, assert there is no page-level horizontal overflow, the active destination remains visible, and the mobile Sheet can be opened and closed with real clicks and Escape.

- [x] **Step 5: Verify**

Run:

```bash
npm run test -- --run src/components/product
npm run test:e2e
npm run typecheck
npm run build
```

Expected: Unit and all three browser projects pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/product src/app/App.tsx e2e/app-shell.spec.ts
git diff --cached --check
git commit -m "feat: add responsive application shell"
```

### Task 8: Add Real Multi-Page Entry Documents

**Files:**
- Create: `InstructorHome.html`
- Create: `PromptDesigner.html`
- Create: `FeedbackAnalyzer.html`
- Create: `FeedbackChat.html`
- Create: `CourseBanner.html`
- Create: `Customizations.html`
- Create: `feedback.html`
- Create: `src/entries/mount-entry.tsx`
- Create: `src/entries/entry-registry.tsx`
- Create: `src/entries/entry-registry.test.tsx`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `mountEntry(entry: EntryName, element: HTMLElement): Root`; `EntryName` is the seven exact entry names. Vite receives all seven HTML files as Rollup inputs.

- [ ] **Step 1: Write the failing registry test**

Assert every `EntryName` returns a page module and an unknown value fails with a visible configuration error rather than silently mounting the wrong page.

- [ ] **Step 2: Verify failure**

Run: `npm run test -- --run src/entries/entry-registry.test.tsx`

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement entries and Vite inputs**

Each HTML document contains its own `#root`, an exact `data-leai-entry`, and the shared mount module. Configure all entries in `build.rollupOptions.input`. Internal navigation uses document URLs and query parameters; refresh never depends on a rewrite to `index.html`.

- [ ] **Step 4: Verify every built entry**

Run:

```bash
npm run test -- --run src/entries
npm run build
for f in InstructorHome.html PromptDesigner.html FeedbackAnalyzer.html FeedbackChat.html CourseBanner.html Customizations.html feedback.html; do test -f "dist/$f"; done
```

Expected: All seven files exist and reference emitted assets under the configured base.

- [ ] **Step 5: Commit**

```bash
git add *.html src/entries vite.config.ts
git diff --cached --check
git commit -m "feat: add GitHub Pages entry documents"
```

### Task 9: Build Isolated QA and Production Artifacts

**Files:**
- Create: `scripts/build-environment.mjs`
- Create: `scripts/compose-pages-artifact.mjs`
- Create: `scripts/verify-pages-artifact.mjs`
- Create: `scripts/verify-pages-artifact.test.mjs`
- Create: `deployment/production-release.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run build:qa` → `dist/qa`; `npm run build:production` → `dist/production`; `npm run build:pages` → `dist/pages`; and `npm run verify:pages`.
- `deployment/production-release.json` begins with `{ "enabled": false, "sourceSha": null }`. Enabling it requires an approved exact 40-character commit SHA.

- [ ] **Step 1: Write the failing artifact-verification tests**

Test that QA HTML uses `/LEAI/qa/`, Production HTML uses `/LEAI/`, QA assets contain no Production API hostname, Production assets contain no QA API hostname, and no service-worker file or registration exists.

- [ ] **Step 2: Verify failure**

Run: `node --test scripts/verify-pages-artifact.test.mjs`

Expected: FAIL because the build scripts do not exist.

- [ ] **Step 3: Implement environment builds**

`build-environment.mjs` invokes Vite with an explicit environment manifest and output directory. It rejects unknown environments, missing build SHA, malformed bases, and forbidden API hosts.

- [ ] **Step 4: Implement composition**

Before Production is enabled, `build:pages` creates `dist/pages/qa/` only. After approval enables Production, composition requires the exact pinned SHA's Production build at the Pages root and the active QA build under `qa/`. It replaces the artifact atomically and never copies from another repository.

- [ ] **Step 5: Verify**

Run:

```bash
node --test scripts/verify-pages-artifact.test.mjs
npm run build:qa
npm run build:pages
npm run verify:pages
```

Expected: QA entries resolve below `/LEAI/qa/`; the root does not claim Production is enabled; no environment host crosses boundaries.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts deployment
git diff --cached --check
git commit -m "build: isolate QA and Production artifacts"
```

### Task 10: Add CI Without Publishing Pages

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/pages.yml`
- Create: `.github/dependabot.yml`
- Create: `scripts/check-client-secrets.mjs`
- Create: `scripts/check-client-secrets.test.mjs`

**Interfaces:**
- Produces: CI checks on pull requests and `main`; a manually gated Pages workflow that cannot deploy until the `github-pages` environment is explicitly approved and Pages is enabled.

- [ ] **Step 1: Write the failing secret-scan tests**

Cover provider-key patterns, forbidden `.env` keys, source maps containing credential-like values, and allowed public API/base/build variables.

- [ ] **Step 2: Implement the scanner and CI workflow**

CI uses Node `22.22.0`, `npm ci`, `npm run typecheck`, unit/component tests, `npm run build:pages`, artifact verification, and Playwright in Chromium, Firefox, and WebKit. Upload only the clean `dist/pages` artifact and test/report artifacts without student data.

- [ ] **Step 3: Configure but do not run deployment**

`pages.yml` uses `workflow_dispatch`, GitHub Pages permissions, concurrency, artifact upload, and deployment actions. It has an explicit `github-pages` environment gate. Do not enable Pages or dispatch this workflow in this task.

- [ ] **Step 4: Verify locally**

Run:

```bash
npm ci
npm run typecheck
npm run test -- --run
npm run build:pages
npm run verify:pages
npm run test:e2e
git diff --check
```

Expected: Every command passes and no deployment occurs.

- [ ] **Step 5: Commit and push**

```bash
git add .github scripts package.json package-lock.json
git diff --cached --check
git commit -m "ci: validate LEAI release artifacts"
git push origin main
```

Expected: GitHub CI passes on the exact pushed SHA. Pages remains unpublished until the owner approves the first QA artifact.

### Task 11: Foundation Acceptance and QA Publication Gate

**Files:**
- Create locally only: `.web-verify/screenshots/`
- Create locally only: `verification-report-react-foundation-2026-09-17.html`
- Modify: `docs/superpowers/plans/2026-09-17-leai-react-rewrite-master-roadmap.md`

**Interfaces:**
- Consumes: Accepted Tasks 1–10 and a reachable QA environment endpoint.
- Produces: A reviewable report and an exact manifest for the separate first-publication approval.

- [ ] **Step 1: Run the real local browser matrix**

Use real clicks and keyboard actions in Chromium, Firefox, and WebKit at 390, 820, 1022, and 1440 pixels. Verify entry loads, account/course hierarchy, mobile Sheet focus behavior, environment label, mismatch fail-closed state, and zero page-level horizontal overflow.

- [ ] **Step 2: Verify the artifact manifest**

Record the source SHA, lockfile hash, Node/npm versions, QA API host, app base, build digest, file manifest, test results, and screenshots. Confirm the artifact contains no secret, student data, private export, or legacy repository content.

- [ ] **Step 3: Generate the self-contained report**

The report must distinguish local browser evidence, CI evidence, and anything not yet verified against a deployed page. Keep it gitignored.

- [ ] **Step 4: Update roadmap status**

Mark only independently verified M0 checkboxes complete. Leave backend contract audit and deployed-page acceptance open until they have direct evidence.

- [ ] **Step 5: Stop for action-time approval**

Present the exact public artifact manifest and ask for authorization to enable `GUII-Lab/LEAI` Pages and dispatch the first QA deployment to `/LEAI/qa/`. Do not publish as part of the local/CI acceptance task.
