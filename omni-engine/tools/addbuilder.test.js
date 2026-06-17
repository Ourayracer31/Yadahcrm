/**
 * Offline test for the add-a-builder logic. Run: node tools/addbuilder.test.js
 */
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBuilderRecord, appendBuilder } from './add-builder.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const dir = mkdtempSync(join(tmpdir(), 'omni-addb-'));
const file = join(dir, 'builders.json');

// === record mapping ===
const choked = buildBuilderRecord({ name: 'Vance Built LLC', area: 'KCMO', product: 'duplex', situation: 'choked', specsSitting: '3' });
ok(choked.displayName === 'Vance Built LLC' && choked.metro === 'KCMO', 'name + area captured');
ok(choked.healthStatus === 'Choked (sitting inventory)' && choked.specSummary.specsOverThreshold === 3, 'choked maps to specs-sitting with his count');
const hungry = buildBuilderRecord({ name: 'Momentum', area: 'Olathe', product: 'infill', situation: 'hungry' });
ok(hungry.healthStatus === 'Selling out (fast absorption)', 'hungry maps to selling-out');
const cautious = buildBuilderRecord({ name: 'Cautious Co', area: 'KCK', product: 'sfh', situation: 'cautious' });
ok(cautious.healthStatus === 'Building, low spec exposure', 'cautious maps to low-spec-exposure');

// === append clears the bundled samples on first real add ===
writeFileSync(file, JSON.stringify([{ displayName: 'Squeezed Homes LLC' }, { displayName: 'Momentum Build Co' }, { displayName: 'Sallee Development' }]));
let list = appendBuilder(file, choked);
ok(list.length === 1 && list[0].displayName === 'Vance Built LLC', 'sample builders cleared on first real add');

// === second add appends; de-dupes by name ===
list = appendBuilder(file, hungry);
ok(list.length === 2, 'second builder appended');
list = appendBuilder(file, buildBuilderRecord({ name: 'Vance Built LLC', area: 'KCMO', product: 'duplex', situation: 'hungry' }));
ok(list.length === 2 && list.find((b) => b.displayName.toUpperCase() === 'VANCE BUILT LLC').healthStatus === 'Selling out (fast absorption)', 'same name de-duped + updated, not doubled');
ok(JSON.parse(readFileSync(file, 'utf8')).length === 2, 'persisted to disk');

console.log(`\nADD-BUILDER TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
