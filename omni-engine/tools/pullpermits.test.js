/**
 * Offline test for the builder-from-permits scrape logic. Run: node tools/pullpermits.test.js
 */
import { buildersFromPermits } from './pull-permits.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const NOW = new Date('2026-06-16');

// realistic permit rows over a 24-mo window
const permits = [
  ...Array(24).fill().map((_, i) => ({ contractor_name: 'Summit Custom Homes LLC', issue_date: '2025-09-01', address: `${i} A St`, permit_type: 'RESIDENTIAL' })), // ~12/yr -> mid
  ...Array(4).fill().map((_, i) => ({ contractor_name: 'Tiny Build Co', issue_date: '2025-09-01', address: `${i} T St` })), // 2/yr -> below floor
  ...Array(200).fill().map((_, i) => ({ contractor_name: 'D.R. Horton', issue_date: '2025-09-01', address: `${i} M St` })), // mega -> excluded
];
const config = {
  permitFieldMap: { builderName: 'contractor_name', issueDate: 'issue_date', address: 'address', permitType: 'permit_type' },
  windowMonths: 24, minPerYear: 5, maxPerYear: 50, staleDomDays: 60, metro: 'Kansas City',
};

const builders = buildersFromPermits(permits, [], config, NOW);
const names = builders.map((b) => b.displayName);
ok(builders.length === 1, `kept exactly the mid-market builder, got ${builders.length}`);
ok(/Summit Custom Homes/i.test(names[0]), 'kept Summit (12/yr)');
ok(!names.some((n) => /Tiny/i.test(n)), 'dropped Tiny (2/yr, below 5)');
ok(!names.some((n) => /Horton/i.test(n)), 'excluded mega-builder D.R. Horton');
ok(builders[0].permitsPerYear >= 10 && builders[0].permitsPerYear <= 14, `annualized ~12/yr, got ${builders[0].permitsPerYear}`);
ok(builders[0].healthStatus && builders[0].suggestedPlay, 'classified with health + suggested play');
ok(builders[0].metro === 'KANSAS CITY', 'metro set for geo-matching to lots');
ok(builders[0].vector === 'A', 'tagged Vector A');

// with spec listings -> choked classification
const listings = [
  { builder: 'Summit Custom Homes LLC', address: '1 A St', list_date: '2026-01-01', original_price: '400000', price: '370000', status: 'Active' },
  { builder: 'Summit Custom Homes LLC', address: '2 A St', list_date: '2026-03-01', original_price: '400000', price: '400000', status: 'Active' },
];
const withListings = buildersFromPermits(permits, listings, { ...config, listingsFieldMap: { builderName: 'builder', address: 'address', listDate: 'list_date', originalPrice: 'original_price', currentPrice: 'price', status: 'status' } }, NOW);
ok(withListings[0].specSummary && withListings[0].specSummary.specsOverThreshold >= 1, 'spec DOM signal attached from listings');

console.log(`\nPULL-PERMITS TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
