/**
 * Omni-Engine | Vector A: The Builder Health Sweep
 *
 * Pulls public building-permit records, rolls them up by builder, keeps the
 * MID-MARKET band (5-50 permits/yr, mega-builders excluded), then layers on
 * spec-listing signals (DOM, price drops) to label each builder Choked vs
 * Selling-out vs Building. Emits a builder health roster tagged with the Play
 * the Pain-Point engine should run.
 *
 * Honest-Broker posture: only public permit feeds and listing data the builder
 * already markets publicly. No private MLS scraping beyond authorized feeds.
 */

import { Actor, log } from 'apify';
import { fetchRecords } from './client.js';
import { aggregatePermits, filterMidMarket, classifyHealth } from './builders.js';
import { indexListingsByBuilder, summarizeSpecs } from './specs.js';

await Actor.init();
const input = (await Actor.getInput()) || {};

const config = {
  permitSource: input.permitSource,
  permitFieldMap: input.permitFieldMap || {
    builderName: 'contractor_name',
    issueDate: 'issue_date',
    address: 'address',
    permitType: 'permit_type',
  },
  listingsSource: input.listingsSource || null,
  listingsFieldMap: input.listingsFieldMap || {
    builderName: 'builder',
    address: 'address',
    listDate: 'list_date',
    daysOnMarket: 'dom',
    originalPrice: 'original_price',
    currentPrice: 'price',
    status: 'status',
  },
  windowMonths: input.windowMonths ?? 24,
  minPermitsPerYear: input.minPermitsPerYear ?? 5,
  maxPermitsPerYear: input.maxPermitsPerYear ?? 50,
  staleDomDays: input.staleDomDays ?? 60,
  megaBuilderExcludes: input.megaBuilderExcludes || [
    'D.R. Horton', 'DR Horton', 'Lennar', 'Pulte', 'PulteGroup', 'NVR', 'Ryan Homes',
    'KB Home', 'Taylor Morrison', 'Meritage', 'Century Communities', 'LGI Homes', 'Richmond American',
  ],
  pageSize: input.pageSize ?? 1000,
  maxRecords: input.maxRecords ?? 50000,
  webhookUrl: input.webhookUrl || '',
};

if (!config.permitSource || !config.permitSource.url || !config.permitSource.type) {
  throw new Error('`permitSource` with { type: "socrata"|"arcgis", url } is required.');
}

log.info('Vector A (Builder Health Sweep) starting', {
  windowMonths: config.windowMonths,
  band: [config.minPermitsPerYear, config.maxPermitsPerYear],
  staleDomDays: config.staleDomDays,
});

// 1) Pull + aggregate permits.
const rawPermits = [];
for await (const rec of fetchRecords(config.permitSource, { pageSize: config.pageSize, maxRecords: config.maxRecords })) {
  rawPermits.push(rec);
}
log.info(`Pulled ${rawPermits.length} permit records`);

const byBuilder = aggregatePermits(rawPermits, {
  fieldMap: config.permitFieldMap,
  windowMonths: config.windowMonths,
});

const midMarket = filterMidMarket(byBuilder, {
  minPerYear: config.minPermitsPerYear,
  maxPerYear: config.maxPermitsPerYear,
  windowMonths: config.windowMonths,
  megaExcludes: config.megaBuilderExcludes,
});
log.info(`${midMarket.length} mid-market builders after band + mega exclusion`);

// 2) Optionally pull spec listings and index by builder.
let listingsByBuilder = new Map();
if (config.listingsSource && config.listingsSource.url && config.listingsSource.type) {
  const rawListings = [];
  for await (const rec of fetchRecords(config.listingsSource, { pageSize: config.pageSize, maxRecords: config.maxRecords })) {
    rawListings.push(rec);
  }
  log.info(`Pulled ${rawListings.length} listing records`);
  listingsByBuilder = indexListingsByBuilder(rawListings, config.listingsFieldMap);
}

// 3) Classify + emit.
const dataset = await Actor.openDataset();
let choked = 0;
let sellingOut = 0;

for (const builder of midMarket) {
  const specSummary = summarizeSpecs(listingsByBuilder.get(builder.builderName), { staleDomDays: config.staleDomDays });
  const record = classifyHealth(builder, specSummary, { staleDomDays: config.staleDomDays });
  record.vector = 'A';
  record.scrapedAt = new Date().toISOString();

  if (record.healthStatus.startsWith('Choked')) choked += 1;
  if (record.healthStatus.startsWith('Selling out')) sellingOut += 1;

  await dataset.pushData(record);
  if (config.webhookUrl) {
    try {
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector: 'A', play: record.suggestedPlay, builder: record }),
      });
    } catch (err) {
      log.warning(`Webhook failed for ${record.builderName}: ${err.message}`);
    }
  }
}

const stats = { builders: midMarket.length, choked, sellingOut, permitsPulled: rawPermits.length };
await Actor.setValue('VECTOR_A_RUN_STATS', stats);
log.info('Vector A run complete', stats);
await Actor.exit();
