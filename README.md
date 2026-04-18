# Counterexample Studio

<p align="center">
  <img src="assets/repo-mark.svg" alt="Counterexample Studio mark" width="120" />
</p>

Counterexample Studio is a local-first property-based testing workbench for JS/TS pure synchronous functions.

Point it at:

- a module exporting pure functions
- a typed property definition file

It gives you:

- minimal failing input
- shrink path and search trace
- deterministic seed
- exact rerun command
- minimal reproduction snippet
- side-by-side invariant, expected result, and actual result
- both a CLI and a polished local web UI

Everything runs locally. There are no external APIs, no cloud services, and no telemetry.

![Counterexample Studio workbench](assets/screenshots/workbench.png)

![Counterexample Studio demo](assets/demo.gif)

## v1 scope

- JS/TS targets only
- Pure synchronous functions only
- Typed property config in TypeScript
- Local execution only
- Six bundled algorithm families, each shipped in buggy and fixed form

## Quickstart

Requirements:

- Node 22+
- npm 10+

```bash
npm install
npm run build
npm run studio -- example list
npm run studio -- example run chunk-buggy
npm run studio -- report --example chunk-buggy --out-dir reports
npm run studio -- ui --open
```

The local UI serves at `http://127.0.0.1:4173`.

## CLI

Run a bundled example:

```bash
npm run studio -- example run binary-search-buggy
```

Generate reproducible JSON and Markdown reports:

```bash
npm run studio -- report --example chunk-buggy --out-dir reports
```

Run against your own module and property file:

```bash
npm run studio -- run \
  --module ./src/math.ts \
  --properties ./src/math.properties.ts \
  --case clamp-stays-in-range \
  --seed 424242 \
  --runs 200
```

Useful subcommands:

- `npm run studio -- example list`
- `npm run studio -- example run <example-id>`
- `npm run studio -- run --module <file> --properties <file>`
- `npm run studio -- report --module <file> --properties <file> --out-dir reports`
- `npm run studio -- ui --open`

## Property config

Property files are plain TypeScript. You define the target export, generate inputs with `fast-check`, and describe the invariant in a way the tool can report clearly.

```ts
import { defineProperties, fc } from "@counterexample-studio/core";

interface TargetModule {
  readonly clamp: (value: number, min: number, max: number) => number;
}

export default defineProperties<TargetModule>({
  title: "Clamp contract",
  properties: [
    {
      id: "clamp-stays-in-range",
      label: "Clamp stays in range",
      functionName: "clamp",
      arbitrary: fc.record({
        value: fc.integer(),
        min: fc.integer({ min: -20, max: 0 }),
        max: fc.integer({ min: 1, max: 20 })
      }),
      renderInvariant: () => "clamp(value, min, max) should stay inside [min, max]",
      getArgs: (input) => [input.value, input.min, input.max],
      run: ({ fn, input }) => {
        const actual = fn(input.value, input.min, input.max);
        return {
          pass: actual >= input.min && actual <= input.max,
          expected: { min: input.min, max: input.max },
          actual,
          expectedLabel: "Allowed range",
          actualLabel: "Clamp result"
        };
      }
    }
  ]
});
```

## Web UI

The browser UI runs the same local engine the CLI uses. It keeps the debugging surface visible in one place:

- bundled example picker with paired buggy and fixed implementations
- local-path runner for your own module and property file
- deterministic seed and run count controls
- minimal failing input and actual result
- shrink path and search trace
- rerun command and reproduction snippet
- pass, fail, and blocked states with distinct output

## Bundled examples

Each family ships in buggy and fixed form so you can inspect a real failure and then compare it against the passing variant.

| Family | Property |
| --- | --- |
| `chunk` | flattening the chunk output must reproduce the original list |
| `max` | the reported max must come from the input and dominate it |
| `interleave` | leftover values must be preserved instead of truncated |
| `rotate-left` | full turns must match modulo-by-length rotation |
| `binary-search` | present values must be found in sorted input |
| `merge-ranges` | touching ranges must merge into the canonical result |

## Walkthrough: `chunk-buggy`

This is the sharpest first example in the repo.

Run it:

```bash
npm run studio -- example run chunk-buggy
```

What happens:

- the seeded example starts from `values = [1, 2, 3]` and `size = 2`
- the shrinker drives that down to the minimal failing witness `values = [0]` and `size = 2`
- the invariant is `flatten(chunk(values, size)) should equal the original values`
- the buggy implementation returns `[]`, so the tail value is lost
- the saved counterexample path is `0:0:0`

The committed report shows the full failure with the exact rerun command and minimal reproduction snippet:

- [chunk Markdown report](reports/chunk-buggy-chunk-preserves-values.md)
- [chunk JSON report](reports/chunk-buggy-chunk-preserves-values.json)

For the same property with the fixed implementation, see:

- [fixed chunk Markdown report](reports/chunk-fixed-chunk-preserves-values.md)
- [fixed chunk JSON report](reports/chunk-fixed-chunk-preserves-values.json)

There is a second committed failing report for binary search:

- [binary search Markdown report](reports/binary-search-buggy-binary-search-finds-present-value.md)
- [binary search JSON report](reports/binary-search-buggy-binary-search-finds-present-value.json)

## Validation

These are the project gates and they are mirrored in GitHub Actions:

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run demo:examples
npm run e2e
```

CI lives in `.github/workflows/ci.yml`.

## Repo assets

- Repo mark: `assets/repo-mark.svg` and `assets/repo-mark.png`
- Social preview: `assets/social-preview.svg` and `assets/social-preview.png`
- Screenshot: `assets/screenshots/workbench.png`
- Demo GIF: `assets/demo.gif`

## License

MIT
