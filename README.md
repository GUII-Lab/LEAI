# LEAI

Learning Experience AI is GUII Lab's instructor and student application for creating, delivering, and analyzing course feedback experiences.

This repository is the sole frontend source and deployment repository for the React rewrite.

## Environments

- QA: `https://guii-lab.github.io/LEAI/qa/`
- Production: `https://guii-lab.github.io/LEAI/`

QA and Production are built from this repository with separate backend identities, browser-state namespaces, release SHAs, and acceptance evidence. GitHub Pages is not enabled during the initial foundation setup.

## Planned stack

- React and TypeScript
- Vite
- Tailwind CSS v4
- source-owned shadcn/ui components using Radix primitives
- TanStack Query and Zod
- Vitest, Testing Library, and Playwright

Canonical architecture, UI-system, API-contract, and implementation documents live under `docs/`.

## Local prerequisites

- Node.js `22.22.0`
- npm `10.9.4` or a lockfile-compatible later npm 10 release

The application scaffold is added by the first Foundation implementation milestone.
