/**
 * Offline test for the field-discovery suggester. Run: node tools/discover.test.js
 */
import { suggestFieldMap } from './discover-fields.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// Jackson-style field names
const jackson = ['OBJECTID', 'PARCEL_ID', 'OWNER_NAME', 'MAIL_ADDR', 'MAIL_CITY', 'MAIL_STATE', 'MAIL_ZIP', 'SITUS_ADDR', 'SITUS_CITY', 'ZONING', 'LAND_USE', 'LAND_VALUE', 'IMPR_VALUE', 'TOTAL_VALUE', 'ACRES', 'SALE_DATE', 'SALE_PRICE'];
const sj = suggestFieldMap(jackson);
ok(sj.fieldMap.parcelId === 'PARCEL_ID', 'maps parcelId');
ok(sj.fieldMap.ownerName === 'OWNER_NAME', 'maps ownerName');
ok(sj.fieldMap.ownerMailingState === 'MAIL_STATE', 'maps mailing state');
ok(sj.fieldMap.zoning === 'ZONING', 'maps zoning');
ok(sj.fieldMap.landUse === 'LAND_USE', 'maps land use');
ok(sj.fieldMap.landValue === 'LAND_VALUE', 'maps land value');
ok(sj.fieldMap.improvementValue === 'IMPR_VALUE', 'maps improvement value');
ok(sj.fieldMap.acreage === 'ACRES', 'maps acreage');
ok(sj.fieldMap.saleDate === 'SALE_DATE', 'maps sale date');
ok(sj.missing.length === 0, 'nothing missing for a full schema, got: ' + sj.missing.join(','));

// Wyandotte-style (objects, sparse) — owner/zoning absent
const wyco = [{ name: 'PARCEL_NBR' }, { name: 'ACRE' }, { name: 'FEATURECODE' }, { name: 'SITE_ADDRESS' }];
const sw = suggestFieldMap(wyco);
ok(sw.fieldMap.parcelId === 'PARCEL_NBR', 'maps PARCEL_NBR from objects');
ok(sw.fieldMap.acreage === 'ACRE', 'maps ACRE');
ok(sw.fieldMap.situsAddress === 'SITE_ADDRESS', 'maps SITE_ADDRESS');
ok(sw.missing.includes('zoning') && sw.missing.includes('ownerName'), 'flags missing zoning + owner for hand-mapping');

console.log(`\nDISCOVER TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
