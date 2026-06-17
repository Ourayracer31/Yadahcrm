/**
 * Omni-Engine | Vector C: The Capital Sweep
 *
 * Builds the Build-to-Rent (BTR) buyer list: corporate entities (LLCs/Inc/LP)
 * that have acquired 5+ single-family homes in the trailing 24 months. These
 * are the buyers the matching engine routes Vector A's stale specs and Vector
 * B's turnkey doors to (Liquidity Bailout play).
 *
 * Honest-Broker posture: public assessor/recorder ownership + sales data only.
 */

import { Actor, log } from 'apify';
import { queryArcgis } from './client.js';
import { aggregatePortfolios, filterBtrBuyers } from './portfolio.js';

await Actor.init();
const input = (await Actor.getInput()) || {};

const config = {
  sources: input.sources || [],
  windowMonths: input.windowMonths ?? 24,
  minRecentBuys: input.minRecentBuys ?? 5,
  sfhLandUseCodes: input.sfhLandUseCodes || ['SFR', 'SINGLE', 'R1', '1010', '1100'],
  pageSize: input.pageSize ?? 1000,
  maxRecordsPerCounty: input.maxRecordsPerCounty ?? 100000,
  webhookUrl: input.webhookUrl || '',
};

if (!config.sources.length) {
  throw new Error('No `sources` provided. Add at least one county assessor/sales ArcGIS layer.');
}

log.info('Vector C (Capital Sweep) starting', {
  counties: config.sources.map((s) => s.county),
  windowMonths: config.windowMonths,
  minRecentBuys: config.minRecentBuys,
});

const dataset = await Actor.openDataset();
const stats = { counties: config.sources.length, buyers: 0, parcelsScanned: 0 };

for (const source of config.sources) {
  if (!source.queryUrl || !source.fieldMap) {
    log.warning(`Skipping malformed source: ${source.county || 'unnamed'}`);
    continue;
  }

  // Server-side narrowing where the layer supports it: recent sale date window.
  const where = source.where || '1=1';
  log.info(`Scanning ${source.county}`, { where });

  const parcels = [];
  try {
    for await (const raw of queryArcgis({
      queryUrl: source.queryUrl,
      where,
      pageSize: config.pageSize,
      maxRecords: config.maxRecordsPerCounty,
    })) {
      parcels.push(raw);
    }
  } catch (err) {
    log.error(`Source failed: ${source.county}: ${err.message}`);
    continue;
  }
  stats.parcelsScanned += parcels.length;

  const byEntity = aggregatePortfolios(parcels, {
    fieldMap: source.fieldMap,
    sfhLandUseCodes: config.sfhLandUseCodes,
  });
  const buyers = filterBtrBuyers(byEntity, {
    windowMonths: config.windowMonths,
    minRecentBuys: config.minRecentBuys,
  });

  for (const buyer of buyers) {
    buyer.county = source.county;
    await dataset.pushData(buyer);
    stats.buyers += 1;
    if (config.webhookUrl) {
      try {
        await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vector: 'C', buyer }),
        });
      } catch (err) {
        log.warning(`Webhook failed for ${buyer.entity}: ${err.message}`);
      }
    }
  }
  log.info(`${source.county}: ${buyers.length} BTR buyers from ${parcels.length} parcels`);
}

await Actor.setValue('VECTOR_C_RUN_STATS', stats);
log.info('Vector C run complete', stats);
await Actor.exit();
