/**
 * Spec-home inventory signals for Vector A.
 *
 * Given a stream of new-construction listings (from an MLS export, a Zillow
 * new-construction Apify run, or any listings feed), compute the signals that
 * reveal builder health: Days-On-Market, price drops, and how many specs have
 * gone stale. Listings are matched to a builder by normalized name.
 */

import { normalizeBuilderName } from './builders.js';

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Normalize one raw listing into the fields we reason about. */
export function normalizeListing(raw, fieldMap, now = new Date()) {
  const listDate = raw[fieldMap.listDate] ? new Date(raw[fieldMap.listDate]) : null;
  const dom = listDate && !Number.isNaN(listDate.valueOf())
    ? Math.max(0, Math.round((now - listDate) / 86400000))
    : num(raw[fieldMap.daysOnMarket]);
  const originalPrice = num(raw[fieldMap.originalPrice]) || num(raw[fieldMap.currentPrice]);
  const currentPrice = num(raw[fieldMap.currentPrice]);
  const priceDropPct = originalPrice > 0 && currentPrice > 0 && currentPrice < originalPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 1000) / 10
    : 0;
  return {
    builderName: normalizeBuilderName(raw[fieldMap.builderName]),
    address: raw[fieldMap.address] ? String(raw[fieldMap.address]).trim() : '',
    status: raw[fieldMap.status] ? String(raw[fieldMap.status]).toUpperCase() : 'ACTIVE',
    dom,
    originalPrice,
    currentPrice,
    priceDropPct,
  };
}

/** Index normalized listings by builder name -> array of listings. */
export function indexListingsByBuilder(rawListings, fieldMap, now = new Date()) {
  const byBuilder = new Map();
  for (const raw of rawListings) {
    const listing = normalizeListing(raw, fieldMap, now);
    if (!listing.builderName) continue;
    if (!byBuilder.has(listing.builderName)) byBuilder.set(listing.builderName, []);
    byBuilder.get(listing.builderName).push(listing);
  }
  return byBuilder;
}

/** Summarize a builder's spec inventory health. */
export function summarizeSpecs(listings, { staleDomDays }) {
  if (!listings || !listings.length) return null;
  const active = listings.filter((l) => l.status === 'ACTIVE' || l.status === 'FOR SALE' || l.status === 'NEW');
  const stale = active.filter((l) => l.dom >= staleDomDays);
  const drops = listings.filter((l) => l.priceDropPct > 0);
  return {
    activeSpecs: active.length,
    specsOverThreshold: stale.length,
    staleAddresses: stale.map((l) => l.address).filter(Boolean),
    priceDrops: drops.length,
    maxPriceDropPct: drops.reduce((m, l) => Math.max(m, l.priceDropPct), 0),
    medianDom: median(active.map((l) => l.dom)),
  };
}
