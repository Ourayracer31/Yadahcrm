# Running the vectors on Apify

You have an Apify account, so the three ingestion actors can run fully automated.
Each `vector-*/` folder is a self-contained Apify actor (`.actor/actor.json`,
`input_schema.json`, `Dockerfile`).

## 1. Deploy (once)
```bash
npm install -g apify-cli
apify login                      # paste your API token
bash tools/deploy-actors.sh      # pushes all three actors
```
Or push one at a time: `cd vector-b-dirt-sweep && apify push`.

## 2. Configure inputs
In the Apify console (or via input JSON), set each actor's input:

- **Vector B (dirt):** `sources[].queryUrl` + `fieldMap` — use the verified values
  from `node tools/discover-fields.js` and `config/county-sources.json`.
- **Vector A (builders):** `permitSource` (a Socrata or ArcGIS permit dataset) +
  `permitFieldMap`; optional `listingsSource` for DOM/price signals.
- **Vector C (buyers):** `sources[]` (assessor/recorder sales layers) + `fieldMap`.

Each actor's `input_schema.json` ships realistic prefilled defaults to edit.

## 3. Run + collect
- **From the Apify console:** click Run, then Export → JSON on the dataset.
- **Via Apify MCP (from your own Claude):** connect Apify's MCP server, then ask
  it to run the actor and fetch the dataset items. Save them as `builders.json`,
  `lots.json`, `buyers.json`.

The actors already emit the exact shape the pipeline expects, so:
```bash
cp <exported builders> samples/builders.json
cp <exported lots>     samples/lots.json
cp <exported buyers>   samples/buyers.json
npm run daily
```

## 4. Schedule (optional)
In Apify, schedule each actor (e.g. weekly) and set its **webhook** to your n8n
endpoint, or run `tools/pull-parcels.js` / the daily runner on a cron. Each actor
also supports a `webhookUrl` input that POSTs leads as they're found.

> No Apify? `tools/pull-parcels.js` pulls Vector B directly with plain Node, and
> you can hand-maintain `builders.json` / `buyers.json`. See SETUP.md.
