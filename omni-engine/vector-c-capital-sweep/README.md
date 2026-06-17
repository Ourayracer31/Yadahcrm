# Omni-Engine — Vector C: The Capital Sweep

Builds the **Build-to-Rent (BTR) buyer list**: corporate entities (LLC / Inc /
LP / Holdings…) that have acquired **5+ single-family homes in the trailing 24
months**. These are the buyers the matching engine routes Vector A's stale specs
and Vector B's turnkey doors to (the **Liquidity Bailout** play).

## How it works

1. Pull public assessor/recorder parcels (ArcGIS) — owner name, land-use, sale date.
2. Keep only **corporate-looking owners** (`looksCorporate` — LLC/Inc/Holdings/SFR/…).
3. Keep only **single-family** land-use codes.
4. Roll up by normalized entity, count acquisitions inside the window.
5. Emit entities with `recentAcquisitions >= minRecentBuys` (default 5), sorted desc.

## Output (BTR buyer)

`displayName`, `county`, `totalHoldings`, `recentAcquisitions`, `recentParcels[]`,
`mailingState`, `mailingAddress`, `buyerProfile`.

## Files

| File | Role |
|------|------|
| `src/main.js` | Orchestrator: scan each county, aggregate, filter, emit buyers. |
| `src/client.js` | ArcGIS paginated query client (retry w/ backoff). |
| `src/portfolio.js` | Entity normalization, corporate detection, portfolio roll-up, BTR filter. |

> ⚠️ Push the sale-date window into the source `where` clause when the layer
> supports it (much less data pulled). Verify endpoints + field names against the
> live county service before production. Confirm entity identity at title — name
> matching is a screening signal, not legal confirmation of common ownership.
