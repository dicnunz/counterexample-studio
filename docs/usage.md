# Property definitions and replay

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


## Run a property

```bash
npm run studio -- run \
  --module ./src/math.ts \
  --properties ./src/math.properties.ts \
  --case clamp-stays-in-range \
  --seed 424242 \
  --runs 200
```

`--export` overrides the target export. Add `--path` from a saved failure to replay its shrink path. `report` accepts the same target and property files and writes JSON and Markdown with `--out-dir reports`.

## Reports

The browser accepts JSON reports up to 5 MB. Importing a report does not execute code. Replay executes the indicated local JS/TS files, never the report's shell command or reproduction snippet. Paths are relative to the directory where the server started; edit them when moving reports between machines.

Replay requires unchanged target code, property definitions, and dependencies. New reports preserve the sampling budget as `requestedRuns`. Older failing reports omit it and replay with the historical default of 100 samples.

Browser runs stop after 30 seconds and accept at most 10,000 samples. The search table displays up to 300 attempts; JSON exports retain the complete recorded trace. Import remains available when the local API is disconnected.

## Development

Start `npm run studio -- ui` after building, then `npm run dev` in another terminal. Vite proxies `/api` to the local server.

`npm run demo:examples` checks all six buggy/fixed example pairs. `npm run demo:report` regenerates `demo/index.html` and `demo/report.json` from the bundled engine.

`npm run verify` runs lint, type checks, unit tests, the example matrix, a build, and browser tests. It installs Playwright Chromium as part of the browser test command.
