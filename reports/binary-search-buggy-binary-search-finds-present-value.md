# Binary search finds present values

When the target is known to be in the sorted input, a correct binary search should return a valid index.

- Generated: 2026-04-19T02:38:41.889Z
- Module: `./packages/examples/dist/modules/binary-search-buggy.js`
- Properties: `./packages/examples/dist/properties/binary-search.properties.js`

## Binary search returns a valid index for present values

- Status: **FAIL**
- Function: `binarySearch`
- Seed: `4881`
- Counterexample path: `0`
- Rerun: `npm run studio -- run --module './packages/examples/dist/modules/binary-search-buggy.js' --properties './packages/examples/dist/properties/binary-search.properties.js' --case 'binary-search-finds-present-value' --seed 4881 --path '0'`

Binary search returns a valid index for present values

### Invariant

binarySearch(values, target) should point at the present target

### Failing Input

```json
{
  "values": [
    0
  ],
  "targetIndex": 0
}
```

### Expected vs Actual

- Expected index contract
```json
{
  "target": 0,
  "oneOf": [
    0
  ]
}
```
- Returned index
```json
-1
```

### Shrink Trace

- Step 1: Minimal counterexample
  Input: `{   "values": [     0   ],   "targetIndex": 0 }`

### Minimal Reproduction

```ts
import * as targetModule from "./packages/examples/dist/modules/binary-search-buggy.js";

const actual = targetModule.binarySearch([
  0
], 0);
console.log(actual);
```
