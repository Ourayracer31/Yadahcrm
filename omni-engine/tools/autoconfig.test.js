/**
 * Offline test for the auto-config field-merge logic. Run: node tools/autoconfig.test.js
 */
import { applyDiscovered } from './auto-config.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const source = {
  county: 'Jackson (KCMO)', state: 'MO',
  queryUrl: 'https://x/MapServer/0/query',
  zoningField: 'VERIFY_ZONING',
  fieldMap: {
    parcelId: 'VERIFY_PARCEL_ID', situsAddress: 'VERIFY_SITUS_ADDR', ownerName: 'VERIFY_OWNER_NAME',
    ownerMailingState: 'VERIFY_MAIL_STATE', landValue: 'VERIFY_LAND_VALUE', improvementValue: 'VERIFY_IMPR_VALUE',
    landUse: 'VERIFY_LAND_USE', acreage: 'VERIFY_ACRES',
  },
};
const liveFields = ['OBJECTID', 'PARCEL_ID', 'OWNER_NAME', 'MAIL_STATE', 'SITUS_ADDR', 'ZONING', 'LAND_USE', 'LAND_VALUE', 'IMPR_VALUE', 'ACRES'];

const { source: resolved, resolved: changes, stillMissing } = applyDiscovered(source, liveFields);
ok(resolved.zoningField === 'ZONING', 'zoningField auto-resolved');
ok(resolved.fieldMap.parcelId === 'PARCEL_ID', 'parcelId resolved');
ok(resolved.fieldMap.ownerName === 'OWNER_NAME', 'ownerName resolved');
ok(resolved.fieldMap.ownerMailingState === 'MAIL_STATE', 'mailing state resolved');
ok(resolved.fieldMap.improvementValue === 'IMPR_VALUE', 'improvement value resolved');
ok(resolved.fieldMap.acreage === 'ACRES', 'acreage resolved');
ok(stillMissing.length === 0, 'no placeholders left when all fields present, got: ' + stillMissing.join(','));
ok(changes.length >= 8, 'reports the resolved fields');

// a layer missing owner/value: those stay flagged, the rest resolve
const sparse = ['PARCEL', 'ACRE', 'ZONING', 'SITE_ADDRESS'];
const r2 = applyDiscovered(source, sparse);
ok(r2.source.zoningField === 'ZONING', 'zoning resolved from sparse layer');
ok(r2.source.fieldMap.acreage === 'ACRE' && r2.source.fieldMap.situsAddress === 'SITE_ADDRESS', 'sparse fields resolved');
ok(r2.stillMissing.includes('ownerName') && r2.stillMissing.includes('landValue'), 'unmapped fields flagged, not silently wrong');

// idempotent: applying again over already-resolved values keeps them
const r3 = applyDiscovered(resolved, liveFields);
ok(r3.source.fieldMap.parcelId === 'PARCEL_ID', 'idempotent — keeps resolved values');

console.log(`\nAUTO-CONFIG TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
