# Repository Guidance

## Scope

Counterexample Studio is a local-first developer tool for property-based testing JS/TS pure synchronous functions. Keep v1 focused and sharp.

## Hard Rules

- Stay fully local
- No external APIs, hosted services, telemetry, or auth flows
- JS/TS only for runtime support in v1
- Prioritize deterministic behavior and reproducibility
- Do not add support for async functions or side-effectful targets in v1

## Architecture

- Keep the core engine separate from CLI and UI concerns
- Prefer clean typed adapters over premature generalization
- If broader runtime support starts creating drag, stop and keep the adapter seam clean instead

## Quality Bar

- No placeholder examples
- No fake performance claims
- No academic framing
- Prefer simple, explicit APIs over clever abstractions
- Every user-facing failure path should help the developer rerun or understand the issue immediately

## Review Guidance

Review for:

- incorrect shrink or trace reporting
- nondeterministic seeds or reruns
- confusing property configuration ergonomics
- misleading UI output when a run passes vs fails
- report generation gaps that block reproduction
- docs that drift from actual commands

Flag regressions before style issues. Missing validation is a real bug.

## Contributor Expectations

- Keep changes scoped and typed
- Add or update tests with behavior changes
- Run the narrowest relevant checks while iterating
- Before finalizing, ensure the root validation commands pass
