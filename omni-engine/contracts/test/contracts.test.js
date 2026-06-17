/**
 * Offline tests for the contract generators. No network.
 * Verifies mandated clauses are present and the "Wholesale" guard fires.
 * Run: node test/contracts.test.js
 */
import { generateOptionToPurchase } from '../src/optionToPurchase.js';
import { generateAssignmentFinderFee } from '../src/assignmentFinderFee.js';
import { generateDealPacket } from '../src/index.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const deal = {
  seller: { name: 'Jane Landowner' },
  assignee: { name: 'Acme Build LLC' },
  property: { address: '123 Vine St, Kansas City MO', parcelId: 'INFILL1', county: 'Jackson' },
  netToSeller: 60000,
  finderFee: 10000,
  play: 'Margin Squeeze',
  optionConsideration: 100,
  optionDays: 120,
};

const option = generateOptionToPurchase(deal);
ok(/Buyer Disclosure of Role/.test(option), 'Option has Buyer Disclosure of Role');
ok(/Procurement Finder/.test(option), 'Option discloses Procurement Finder role');
ok(/Net to Seller/.test(option), 'Option has Net to Seller');
ok(/100% of all closing costs/.test(option), 'Option: builder pays 100% closing costs');
ok(/\$100\.00/.test(option), 'Option consideration shown ($100)');
ok(!/wholesale/i.test(option), 'Option contains NO "wholesale"');

// option consideration clamps to $50-$100
const clamped = generateOptionToPurchase({ ...deal, optionConsideration: 5000 });
ok(/\$100\.00/.test(clamped) && !/\$5,000/.test(clamped), 'Option consideration clamped to $100 ceiling');
const clampedLow = generateOptionToPurchase({ ...deal, optionConsideration: 1 });
ok(/\$50\.00/.test(clampedLow), 'Option consideration clamped to $50 floor');

const assignment = generateAssignmentFinderFee(deal);
ok(/As-Is Field Professional/.test(assignment), 'Assignment has As-Is Field Professional clause');
ok(/Soil and geotechnical testing/i.test(assignment), 'Assignment: soil tests responsibility');
ok(/Utility verification/i.test(assignment), 'Assignment: utility verification responsibility');
ok(/Double-Signature Title Directive/.test(assignment), 'Assignment has Double-Signature Title Directive');
ok(/Wire Manley Systems LLC/.test(assignment), 'Assignment: title wires finder fee to Manley Systems');
ok(/Pay Seller/.test(assignment), 'Assignment: title pays seller net');
ok(/\$10,000\.00/.test(assignment), 'Assignment shows $10k finder fee');
ok(!/wholesale/i.test(assignment), 'Assignment contains NO "wholesale"');

// compliance guard must throw if a prohibited term is injected
let threw = false;
try { generateOptionToPurchase({ ...deal, seller: { name: 'Wholesale Bob' } }); }
catch { threw = true; }
ok(threw, 'Compliance guard throws on injected "Wholesale" term');

// full packet renders HTML
const packet = generateDealPacket(deal);
ok(/<h1>/.test(packet.option.html) && /<h1>/.test(packet.assignment.html), 'Packet renders HTML for both docs');

console.log(`\nCONTRACT TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
