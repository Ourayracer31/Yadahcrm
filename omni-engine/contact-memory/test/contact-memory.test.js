/**
 * Offline tests for the Contact Memory + Relationship Intelligence System.
 * Writes to a temp dir; no network. Run: node test/contact-memory.test.js
 */
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathForContact, fileNameFor, primaryTypeOf, folderForType, CONTACT_TYPES } from '../src/classify.js';
import { ContactFileStore } from '../src/store.js';
import { generateFollowUpBoard, wouldTravisBelieveIt } from '../src/followUpBoard.js';
import { blankRichContact, syncContactMemory, RelationshipMemory } from '../src/index.js';
import { runSynthesis } from '../../synthesis/src/index.js';
import { runOperatorLayer } from '../../operator/src/index.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const root = mkdtempSync(join(tmpdir(), 'omni-contacts-'));

// === classification + filing ===
ok(primaryTypeOf({ types: ['Landowner', 'Builder'] }) === 'Builder', 'priority routes multi-type to Builder');
ok(folderForType('Engineer') === 'contacts/service-partners', 'engineer -> service-partners');
ok(folderForType('Investor') === 'contacts/investors', 'investor -> investors folder');
ok(fileNameFor({ name: 'Jane Heir', company: 'Heir Holdings LLC' }) === 'jane-heir-heir-holdings-llc.md', 'company filename slug');
ok(fileNameFor({ name: 'Bob Farmer', location: 'Cass County' }) === 'bob-farmer-cass-county.md', 'location filename when no company');
ok(pathForContact({ name: 'Acme Build', company: 'Acme', type: 'Builder' }) === 'contacts/builders-developers/acme-build-acme.md', 'full path for builder');
ok(primaryTypeOf({ type: 'builder' }) === 'Builder', 'lowercase "builder" canonicalizes (operator memory convention)');
ok(folderForType(primaryTypeOf({ type: 'title' })) === 'contacts/service-partners', 'lowercase "title" -> Title Company -> service-partners');
ok(primaryTypeOf({ types: ['landowner', 'builder'] }) === 'Builder', 'lowercase multi-type priority works');
ok(CONTACT_TYPES.includes('Title Company') && CONTACT_TYPES.includes('Banker/Lender'), 'contact types include service partners');

// === builder file render + write ===
const store = new ContactFileStore(root);
const builder = blankRichContact({
  name: 'Squeezed Homes', company: 'Squeezed Homes LLC', type: 'Builder', phone: '816-555-0101',
  relationshipStrength: 7, location: 'Kansas City',
  companyProfile: { builderType: 'Infill/duplex', annualPermitRange: '10-15', productType: 'Duplex' },
  painProfile: { specsSitting: '3 over 60 DOM', needDuplexInfill: 'Yes' },
  avoids: { noSewer: 'Hard no', floodplain: 'Avoid' },
  interactions: [{ at: '2026-06-01', method: 'Call', summary: 'Intro at supply yard', painLearned: 'specs aging east side', nextAction: 'send nothing, follow up' }],
});
const w = store.write(builder);
ok(existsSync(w.path), 'builder file written to disk');
const md = readFileSync(w.path, 'utf8');
ok(/## Builder Pain Profile/.test(md) && /## What They Avoid/.test(md) && /## AI Recommendations/.test(md), 'builder file has mandated sections');
ok(/Trust level: Trusted/.test(md), 'trust label derived from strength 7 = Trusted');
ok(/### 2026-06-01 Conversation/.test(md), 'conversation block rendered');
ok(/No sewer: Hard no/.test(md), 'avoid field rendered');
ok(/Spec homes sitting: 3 over 60 DOM/.test(md), 'pain field rendered');

// === APPEND-ONLY: a new interaction must not erase the old block ===
builder.interactions.push({ at: '2026-06-10', method: 'Text', summary: 'He replied, asked about east-side lots', painLearned: 'short on finished lots' });
store.write(builder);
const md2 = readFileSync(w.path, 'utf8');
ok(/2026-06-01 Conversation/.test(md2) && /2026-06-10 Conversation/.test(md2), 'append-only: both conversations present');
ok((md2.match(/### \d{4}-\d{2}-\d{2} Conversation/g) || []).length === 2, 'exactly two conversation blocks, none lost');

// hand-edit the file with an extra historical block; rewrite must preserve it
const injected = md2.replace('## Opportunity Fit', '### 2025-12-15 Conversation\n- Method: In person\n- Summary: Met at HBA event\n\n## Opportunity Fit');
writeFileSync(w.path, injected);
store.write(builder); // record does NOT contain the 2025-12-15 entry
const md3 = readFileSync(w.path, 'utf8');
ok(/2025-12-15 Conversation/.test(md3), 'append-only: manually-added historical block survives a rewrite');
ok((md3.match(/### \d{4}-\d{2}-\d{2} Conversation/g) || []).length === 3, 'merged history now has three blocks');

// === landowner + investor + partner templates ===
const landowner = blankRichContact({
  name: 'Jane Heir', type: 'Landowner', propertyAddress: '123 Vine St', parcelId: 'INFILL1', county: 'Jackson',
  propertyProfile: { acreage: '0.2', zoning: 'R-3', sewer: 'Available' },
  ownershipProfile: { yearsOwned: 14, outOfState: true, heirsInvolved: 'Yes' },
  motivationProfile: { motivationScore: 8, wantsOption: 'Open to it' },
});
const lw = store.write(landowner);
const lmd = readFileSync(lw.path, 'utf8');
ok(lw.relPath === 'contacts/landowners/jane-heir-123-vine-st.md', 'landowner filed under landowners');
ok(/## Property Profile/.test(lmd) && /## Motivation Profile/.test(lmd) && /## Deal Structure Possibilities/.test(lmd), 'landowner sections present');

const partner = blankRichContact({ name: 'Sam Survey', company: 'KC Survey Co', type: 'Surveyor' });
const pw = store.write(partner);
ok(pw.relPath === 'contacts/service-partners/sam-survey-kc-survey-co.md', 'surveyor filed under service-partners');
ok(/Intel They Provide/.test(readFileSync(pw.path, 'utf8')), 'partner file has intel section');

// === field reality rule ===
ok(wouldTravisBelieveIt({ fieldCheck: { buildable: true } }) === true, 'believable when buildable');
ok(wouldTravisBelieveIt({ fieldCheck: { buildable: false } }) === false, 'NOT believable when unbuildable');
ok(wouldTravisBelieveIt({}) === true, 'no land leg -> not a dirt question');

// === follow-up board from a full synthesis -> operator run ===
const builders = [
  { displayName: 'Squeezed Homes LLC', permitsPerYear: 12, healthStatus: 'Choked (sitting inventory)', metro: 'KANSAS CITY',
    specSummary: { activeSpecs: 5, specsOverThreshold: 3, priceDrops: 2, medianDom: 92 } },
  { displayName: 'Sallee Development', permitsPerYear: 40, healthStatus: 'Selling out (fast absorption)', heavyHitter: true, metro: 'CASS',
    specSummary: { activeSpecs: 4, specsOverThreshold: 0, medianDom: 22 } },
];
const lots = [
  { parcelId: 'INFILL1', zoning: 'R-3', situsAddress: '123 Vine', situsCity: 'KANSAS CITY', county: 'Jackson',
    ownerName: 'Jane Heir', ownerMailingState: 'CA', outOfStateOwner: true, vacantOrTeardown: true, acreage: 0.2,
    landValue: 60000, equityProxy: 60000, yearsHeld: 14, sewerAvailable: true, access: 'paved' },
  { parcelId: 'TRACT1', zoning: 'AG', situsAddress: 'County Line Rd', situsCity: 'CASS', county: 'Cass',
    ownerName: 'Family LP', outOfStateOwner: true, vacantOrTeardown: true, acreage: 22, landValue: 220000, equityProxy: 220000, yearsHeld: 30, sewerAvailable: true, access: 'paved' },
];
const buyers = [{ displayName: 'BTR Capital LLC', recentAcquisitions: 12, mailingState: 'TX' }];
const created = runSynthesis({ builders, lots, buyers });
const opResult = runOperatorLayer({ matches: created });

const memory = new RelationshipMemory();
memory.upsert({ name: 'Squeezed Homes LLC', type: 'builder', trustLevel: 6 });
memory.recordInteraction('Squeezed Homes LLC', { summary: 'warm intro', painLearned: 'specs aging', nextFollowUp: '2026-06-15' });

const { board, markdown } = generateFollowUpBoard({ opportunities: opResult.opportunities, memory, date: new Date('2026-06-15') });
ok(/# Travis Follow-Up Board/.test(markdown), 'board renders title');
ok(/## Must Contact Today/.test(markdown) && /## Deals To Kill/.test(markdown) && /## New Matches Found/.test(markdown), 'board has required sections');
ok(/## First Call Recommendation/.test(markdown), 'board has first-call recommendation');
ok(board.firstCall && board.firstCall.name, 'board chose a first call');
ok(board.newMatches.length >= 1, 'board surfaces synthesized matches');

// === one-shot sync writes files + board to disk ===
const sync = syncContactMemory({ operatorResult: opResult, memory, root, date: new Date('2026-06-15') });
ok(sync.filesWritten.length >= 1, 'sync wrote contact files');
ok(existsSync(join(root, 'daily', 'travis-follow-up-board.md')), 'sync wrote the daily board');
ok(existsSync(join(root, 'daily', 'follow-up-board-2026-06-15.md')), 'sync wrote dated board archive');

console.log(`\nCONTACT MEMORY TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
