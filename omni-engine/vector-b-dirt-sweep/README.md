# Omni-Engine — Vector B: The Dirt Sweep

Apify actor that pulls **public county tax/parcel records** for the Kansas City
metro and surfaces dirt that allows for density:

- **Target 1 — Infill:** vacant lots / tear-downs in older KCMO & KCK
  neighborhoods zoned for duplex / multi-family (R-2.5, R-3, R-4, R-2, R-5, MF…).
- **Target 2 — Tracts:** 10–40 ac exurban parcels (Cass / Miami / Platte) held by
  out-of-state heirs or long-term holders.

Output is a skip-trace-ready lead list, tagged with the strategic Play it feeds.

## Why ArcGIS, not HTML scraping

Jackson County (KCMO) and Wyandotte County (KCK) publish their parcel, zoning and
assessment attributes through public **ArcGIS REST `query` endpoints**. The actor
queries those endpoints with a server-side `WHERE` clause on the zoning field —
the same public data the county parcel viewers render, pulled structured and
reliably. No private data, no writes to county systems. This is the "Honest
Broker / Data Broker" posture: aggregate public records, don't spam or trespass.

## Files

| File | Role |
|------|------|
| `src/main.js` | Orchestrator: read input, query each county, enrich, filter, push to dataset + webhook. |
| `src/arcgis.js` | Paginated ArcGIS REST client (retry w/ exponential backoff). |
| `src/zoning.js` | Zoning normalization, boundary-aware prefix matching, `WHERE` clause builder. |
| `src/enrich.js` | Maps raw attributes → normalized lead; derives out-of-state / vacant / equity / Play. |
| `.actor/` | Apify actor + input schema definitions. |

## Configuring a county source

Each entry in `sources` points at a county's ArcGIS parcel `query` layer and maps
that layer's attribute names onto the engine's normalized fields:

```jsonc
{
  "county": "Jackson (KCMO)",
  "state": "MO",
  "queryUrl": "https://<county-arcgis-host>/.../MapServer/0/query",
  "zoningField": "ZONING",
  "fieldMap": {
    "parcelId": "PARCEL_ID",
    "situsAddress": "SITUS_ADDR",
    "ownerName": "OWNER_NAME",
    "ownerMailingState": "MAIL_STATE",
    "improvementValue": "IMPR_VALUE",
    "landValue": "LAND_VALUE",
    "landUse": "LAND_USE",
    "acreage": "ACRES"
  }
}
```

> ⚠️ **Verify endpoints & field names before a production run.** The prefilled
> `queryUrl`s and `fieldMap` keys are realistic placeholders for the KC-metro
> counties, but each county's exact host, layer index and column names must be
> confirmed against its live ArcGIS service directory (open the `…/MapServer`
> root in a browser to list layers and fields). Swap in the verified values and
> the rest of the pipeline runs unchanged.

## Run modes

| Goal | Input |
|------|-------|
| **Infill lot sweep (Target 1)** | `vacantOnly: true`, `minAcreage: 0`, default zoning codes |
| **Exurban tract sweep (Target 2)** | `vacantOnly: false`, `minAcreage: 10`, `maxAcreage: 40`, `outOfStateOnly: true` |
| **High-equity only** | set `minEquityProxy` |

## Local dev

```bash
npm install
echo '{ "sources": [ /* … */ ], "zoningCodes": ["R-2.5","R-3","R-4"] }' > storage/key_value_stores/default/INPUT.json
npm run start:dev
```

Results land in `storage/datasets/default/`. On the Apify platform they land in
the run's dataset (see the **Dirt Sweep leads** view) and, if `webhookUrl` is set,
each lead is POSTed to n8n/the CRM as `{ vector, play, lead }`.

## Output lead shape (key fields)

`county`, `parcelId`, `zoning`, `playTarget`, `situsAddress`, `ownerName`,
`ownerMailingState`, `outOfStateOwner`, `vacantOrTeardown`, `acreage`,
`landValue`, `improvementValue`, `totalAssessedValue`, `equityProxy`,
`skipTraceReady`.

> `equityProxy` is a **screening signal**, not a valuation — county assessment
> data carries no mortgage/lien info, so it approximates equity from assessed
> land/total value. Confirm true equity at title.
