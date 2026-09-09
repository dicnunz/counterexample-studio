# Property Check

Find and shrink failing inputs for pure synchronous JavaScript and TypeScript functions. Define a property with `fast-check`, run it locally, and inspect the counterexample, shrink trace, and replay command.

[Saved report](https://dicnunz.github.io/demos/counterexample/) · [Report JSON](https://dicnunz.github.io/demos/counterexample/report.json)

[![Counterexample and shrink trace](assets/screenshots/saved-report.jpg)](https://dicnunz.github.io/demos/counterexample/)

The hosted page displays a saved run. Executing tests requires the local CLI or web app.

## Run

Requires Node 22+ and npm 10+.

```bash
npm install
npm run build
npm run studio -- example run chunk-buggy
npm run studio -- ui --open
```

The web app opens at [127.0.0.1:4173](http://127.0.0.1:4173). Package imports and the CLI retain the `counterexample-studio` name.

The chunk example checks that flattening the result recovers the input list. Shrinking reduces its failure to `values = [0]`, `size = 2`: the buggy implementation returns `[]`. The paired `chunk-fixed` example passes with the same seed.

```bash
npm run studio -- example run chunk-fixed
npm run studio -- example list
npm run studio -- report --example chunk-buggy --out-dir reports
```

The six example families cover chunking, maximum, interleaving, rotation, binary search, and range merging. Each has a buggy and fixed implementation. [Committed reports](reports/) contain the generated failures and passing comparison.

## Your own functions

Supply a module and a TypeScript property file. Each property defines an input generator, target export, and invariant. The [property reference](docs/usage.md) includes a complete definition, CLI options, replay behavior, and development commands.

The web app can run local files, import/export JSON reports, inspect individual properties, and replay a failure. Importing JSON does not execute code; replay runs the local files named in the report. Only run files you trust. Reproduction depends on unchanged code and dependencies. Passing a finite sample does not prove a property for every input.

## Check

```bash
npm run verify
```

Includes the buggy/fixed example matrix and browser tests. This is an AI-assisted personal project; the bundled tests establish behavior within that scope.

[MIT](LICENSE)
