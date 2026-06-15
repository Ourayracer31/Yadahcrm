# Omni-Engine — Vector A: Builder Health Sweep

Finds the **mid-market builders** (5–50 permits/yr) in the KC metro and reads
whether each one is **choked** by sitting inventory or **selling out** of
subdivisions — the trigger that decides which Pain-Point Play to run.

- **Exclude:** national mega-builders (D.R. Horton, Lennar, Pulte, NVR/Ryan…).
- **Permit roll-up:** count permits per builder over a trailing window (default
  24 mo), annualize, keep the 5–50/yr band.
- **Inventory health:** join optional spec-listing data → Days-On-Market,
  price drops, count of specs over the stale threshold (default 60 days).

## Health → Play

| Signal | `healthStatus` | `suggestedPlay` |
|--------|----------------|-----------------|
| Specs over 60 days | Choked (sitting inventory) | **Liquidity Bailout** → offload to Vector C BTR buyers |
| Active specs, fast DOM | Selling out (fast absorption) | **Margin Squeeze / Pipeline Drought** → feed more dirt |
| Building, no spec exposure | Building, low spec exposure | **Capital Preservation** → paper-lot build-to-suit |

## Data sources

`permitSource` and `listingsSource` each take `{ type, url, where }` where `type`
is **`socrata`** (e.g. `data.kcmo.org` SoQL) or **`arcgis`** (FeatureServer query).
The `client.js` module paginates both. Field names are mapped via
`permitFieldMap` / `listingsFieldMap`.

> ⚠️ Verify the dataset id / endpoint and column names against the live portal
> before a production run — the prefills are realistic placeholders.

## Files

| File | Role |
|------|------|
| `src/main.js` | Orchestrator: pull permits → aggregate → band-filter → attach specs → classify. |
| `src/client.js` | Socrata + ArcGIS paginated fetch (retry w/ backoff). |
| `src/builders.js` | Name normalization, mega-builder exclusion, permit roll-up, health classification. |
| `src/specs.js` | DOM / price-drop / stale-spec signals from listing data. |

## Local dev

```bash
npm install
mkdir -p storage/key_value_stores/default
echo '{ "permitSource": { "type": "socrata", "url": "https://data.kcmo.org/resource/<id>.json" } }' \
  > storage/key_value_stores/default/INPUT.json
npm run start:dev
```
