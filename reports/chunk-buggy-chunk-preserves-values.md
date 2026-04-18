# Chunk preserves values

Flattening chunk output should reproduce the original list without dropping the tail.

- Generated: 2026-04-18T20:33:11.157Z
- Module: `/Users/nicdunz/Documents/Codex/2026-04-18-build-and-ship-a-polished-local-3/packages/examples/dist/modules/chunk-buggy.js`
- Properties: `/Users/nicdunz/Documents/Codex/2026-04-18-build-and-ship-a-polished-local-3/packages/examples/dist/properties/chunk.properties.js`

## Chunk preserves all values

- Status: **FAIL**
- Function: `chunk`
- Seed: `87492311`
- Counterexample path: `0:0:0`
- Rerun: `npm run studio -- run --module '/Users/nicdunz/Documents/Codex/2026-04-18-build-and-ship-a-polished-local-3/packages/examples/dist/modules/chunk-buggy.js' --properties '/Users/nicdunz/Documents/Codex/2026-04-18-build-and-ship-a-polished-local-3/packages/examples/dist/properties/chunk.properties.js' --case 'chunk-preserves-values' --seed 87492311 --path '0:0:0'`

The chunked output should keep every original value in order.

### Invariant

flatten(chunk(values, size)) should equal the original values

### Failing Input

```json
{
  "values": [
    0
  ],
  "size": 2
}
```

### Expected vs Actual

- Original values
```json
[
  0
]
```
- Flattened chunks
```json
[]
```

### Shrink Trace

- Step 1: Shrunk failing case
  Input: `{   "values": [     1,     2,     3   ],   "size": 2 }`
- Step 2: Shrunk failing case
  Input: `{   "values": [     3   ],   "size": 2 }`
- Step 3: Minimal counterexample
  Input: `{   "values": [     0   ],   "size": 2 }`

### Minimal Reproduction

```ts
import * as targetModule from "/Users/nicdunz/Documents/Codex/2026-04-18-build-and-ship-a-polished-local-3/packages/examples/dist/modules/chunk-buggy.js";

const values = [0];
const size = 2;
const actual = targetModule.chunk(values, size).flat();
console.log(actual);
```
