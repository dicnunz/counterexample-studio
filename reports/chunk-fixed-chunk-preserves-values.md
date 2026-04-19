# Chunk preserves values

Flattening chunk output should reproduce the original list without dropping the tail.

- Generated: 2026-04-19T02:38:41.863Z
- Module: `./packages/examples/dist/modules/chunk-fixed.js`
- Properties: `./packages/examples/dist/properties/chunk.properties.js`

## Chunk preserves all values

- Status: **PASS**
- Function: `chunk`
- Seed: `87492311`
- Counterexample path: `n/a`
- Rerun: `npm run studio -- run --module './packages/examples/dist/modules/chunk-fixed.js' --properties './packages/examples/dist/properties/chunk.properties.js' --case 'chunk-preserves-values' --seed 87492311`

The chunked output should keep every original value in order.

### Invariant

flatten(chunk(values, size)) should equal the original values
