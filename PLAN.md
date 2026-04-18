# Counterexample Studio Plan

## Product

Build a fully local-first open-source workbench for property-based testing JS/TS pure synchronous functions.

## Constraints

- JS/TS only for v1
- Pure synchronous function targets only
- No external APIs or cloud services
- Deterministic seeds, rerun commands, and reproducible reports are mandatory
- Ship both CLI and polished local web UI

## Milestones

### 1. Foundation

- Set up npm workspaces for shared core, CLI, and web UI
- Configure TypeScript, Vitest, ESLint, Playwright, Vite, and GitHub Actions
- Establish shared types for functions, properties, runs, shrink traces, reports, and examples

Validation:

- `npm install`
- `npm run lint`
- `npm run typecheck`

### 2. Core Engine

- Load a target module and typed property definition file
- Generate randomized inputs with `fast-check`
- Detect failures and shrink to a minimal counterexample
- Record search trace, shrink path, deterministic seed, rerun command, and reproduction snippet
- Export JSON and Markdown failure reports from the CLI

Validation:

- `npm run test --workspace @counterexample-studio/core`
- `npm run test --workspace @counterexample-studio/cli`

### 3. Examples

- Bundle at least 6 intentionally buggy algorithms with paired fixed versions
- Include properties that demonstrate both fail and pass states
- Add one especially strong walkthrough example for the README and UI

Validation:

- `npm run demo:examples`

### 4. Web UI

- Build a polished local UI with example picker, run controls, deterministic reruns, and report views
- Show the failing input, shrink path/search trace, invariant vs actual result, and minimal reproduction clearly
- Support loading bundled examples and user-specified local files

Validation:

- `npm run build --workspace @counterexample-studio/web`
- `npm run e2e`

### 5. Polish And Ship

- Write a sharp README with quickstart, screenshots, demo GIF, and one full failure walkthrough
- Commit sample generated reports
- Run the full validation matrix and perform a separate review pass

Validation:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run e2e`
- `npm run build`
- `npm run demo:examples`

## Done Criteria

- Local install and full validation pass
- CI mirrors the local validation bar
- README is copy-paste usable
- Example reports are committed
- Push instructions are ready if remote auth is unavailable
