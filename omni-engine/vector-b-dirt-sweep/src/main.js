/**
 * Omni-Engine | Vector B: The Dirt Sweep
 *
 * Pulls public county tax/parcel records for the KC metro, filters to
 * multi-family / infill-density zoning (and optionally vacant lots, out-of-state
 * owners, or 10-40 ac exurban tracts), enriches each parcel with the signals the
 * Pain-Point matching algorithm needs, and writes skip-trace-ready leads to the
 * Apify dataset (with an optional webhook handoff into n8n / the CRM).
 *
 * Honest-Broker posture: this actor only reads public county assessment/GIS data
 * that the counties already publish to their public parcel viewers. No private
 * data is accessed and nothing is written to county systems.
 */

import { Actor, log } from 'apify';
import { buildZoningWhereClause } from './zoning.js';
import { queryArcgisParcels } from './arcgis.js';
import { buildLead, passesFilters } from './enrich.js';

await Actor.init();

const input = (await Actor.getInput()) || {};

const config = {
  sources: input.sources || [],
  zoningCodes: input.zoningCodes || ['R-2.5', 'R-3', 'R-4', 'R-2', 'R-5', 'MF', 'DUPLEX'],
  vacantOnly: input.vacantOnly ?? false,
  teardownImprovementCeiling: input.teardownImprovementCeiling ?? 25000,
  vacantLandUseCodes: input.vacantLandUseCodes || ['VAC', 'VACANT', '0000', '1000'],
  outOfStateOnly: input.outOfStateOnly ?? false,
  minAcreage: input.minAcreage ?? 0,
  maxAcreage: input.maxAcreage ?? 0,
  minEquityProxy: input.minEquityProxy ?? 0,
  maxRecordsPerCounty: input.maxRecordsPerCounty ?? 5000,
  pageSize: input.pageSize ?? 1000,
  webhookUrl: input.webhookUrl || '',
};

if (!config.sources.length) {
  throw new Error('No `sources` provided. Add at least one county ArcGIS parcel query layer.');
}

log.info('Vector B (The Dirt Sweep) starting', {
  counties: config.sources.map((s) => s.county),
  zoningCodes: config.zoningCodes,
  vacantOnly: config.vacantOnly,
  outOfStateOnly: config.outOfStateOnly,
  acreage: [config.minAcreage, config.maxAcreage],
});

const dataset = await Actor.openDataset();
const stats = { fetched: 0, kept: 0, byCounty: {} };

async function pushWebhook(lead) {
  if (!config.webhookUrl) return;
  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vector: 'B', play: lead.playTarget, lead }),
    });
  } catch (err) {
    log.warning(`Webhook POST failed for parcel ${lead.parcelId}: ${err.message}`);
  }
}

for (const source of config.sources) {
  if (!source.queryUrl || !source.zoningField || !source.fieldMap) {
    log.warning(`Skipping malformed source (needs queryUrl, zoningField, fieldMap): ${source.county || 'unnamed'}`);
    continue;
  }

  const where = buildZoningWhereClause(source.zoningField, config.zoningCodes);
  log.info(`Querying ${source.county}`, { where });
  stats.byCounty[source.county] = { fetched: 0, kept: 0 };

  try {
    for await (const raw of queryArcgisParcels({
      queryUrl: source.queryUrl,
      where,
      pageSize: config.pageSize,
      maxRecords: config.maxRecordsPerCounty,
    })) {
      stats.fetched += 1;
      stats.byCounty[source.county].fetched += 1;

      const lead = buildLead(raw, source, config);
      if (!passesFilters(lead, config)) continue;

      await dataset.pushData(lead);
      await pushWebhook(lead);
      stats.kept += 1;
      stats.byCounty[source.county].kept += 1;
    }
  } catch (err) {
    log.error(`Source failed: ${source.county}: ${err.message}`);
  }

  log.info(`Finished ${source.county}`, stats.byCounty[source.county]);
}

await Actor.setValue('VECTOR_B_RUN_STATS', stats);
log.info('Vector B run complete', stats);

await Actor.exit();
