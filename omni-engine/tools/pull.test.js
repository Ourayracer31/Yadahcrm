/**
 * Offline test for the standalone parcel puller's pure assembly logic.
 * Run: node tools/pull.test.js
 */
import { leadsFromFeatures } from './pull-parcels.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const source = {
  county: 'Jackson (KCMO)', state: 'MO', queryUrl: 'http://x', zoningField: 'ZONING',
  fieldMap: { parcelId: 'PID', situsAddress: 'SA', ownerName: 'ON', ownerMailingState: 'OMS', landValue: 'LV', improvementValue: 'IV', landUse: 'LU', acreage: 'AC' },
};
// raw ArcGIS rows (as f.attributes)
const rows = [
  { ZONING: 'R-3', PID: '1', SA: '123 Vine', ON: 'Jane Heir', OMS: 'CA', LV: 60000, IV: 0, LU: 'VAC', AC: 0.2 },
  { ZONING: 'R-3', PID: '2', SA: '5 Oak', ON: 'Local', OMS: 'MO', LV: 30000, IV: 120000, LU: 'RES', AC: 0.15 },
];

const all = leadsFromFeatures(rows, source, { vacantOnly: false, teardownImprovementCeiling: 25000, vacantLandUseCodes: ['VAC'], minAcreage: 0, maxAcreage: 0, minEquityProxy: 0 });
ok(all.length === 2, 'maps both parcels into leads');
ok(all[0].outOfStateOwner === true && all[1].outOfStateOwner === false, 'derives out-of-state owner');
ok(all[0].vacantOrTeardown === true, 'derives vacant');

const vacantOnly = leadsFromFeatures(rows, source, { vacantOnly: true, teardownImprovementCeiling: 25000, vacantLandUseCodes: ['VAC'], minAcreage: 0, maxAcreage: 0, minEquityProxy: 0 });
ok(vacantOnly.length === 1 && vacantOnly[0].parcelId === '1', 'vacantOnly filter keeps the infill lot');

console.log(`\nPULL TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
