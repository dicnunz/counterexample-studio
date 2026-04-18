# Chunk preserves values

Flattening chunk output should reproduce the original list without dropping the tail.

- Generated: 2026-04-18T20:33:11.193Z
- Module: `/Users/nicdunz/Documents/Codex/2026-04-18-build-and-ship-a-polished-local-3/packages/examples/dist/modules/chunk-fixed.js`
- Properties: `/Users/nicdunz/Documents/Codex/2026-04-18-build-and-ship-a-polished-local-3/packages/examples/dist/properties/chunk.properties.js`

## Chunk preserves all values

- Status: **PASS**
- Function: `chunk`
- Seed: `87492311`
- Counterexample path: `n/a`
- Rerun: `npm run studio -- run --module '/Users/nicdunz/Documents/Codex/2026-04-18-build-and-ship-a-polished-local-3/packages/examples/dist/modules/chunk-fixed.js' --properties '/Users/nicdunz/Documents/Codex/2026-04-18-build-and-ship-a-polished-local-3/packages/examples/dist/properties/chunk.properties.js' --case 'chunk-preserves-values' --seed 87492311`

The chunked output should keep every original value in order.

### Invariant

flatten(chunk(values, size)) should equal the original values
