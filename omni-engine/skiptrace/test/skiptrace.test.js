/**
 * Offline tests for skip-trace. No network — mock provider transport.
 * Run: node test/skiptrace.test.js
 */
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skipTrace, normalizePhones, normalizeEmails, traceKey, TraceCache, providerFromEnv } from '../src/skiptrace.js';
import { enrichLeads, syncEnrichedToMemory } from '../src/enrich.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const root = mkdtempSync(join(tmpdir(), 'omni-skiptrace-'));

// === normalization (handles strings and objects from any provider) ===
ok(JSON.stringify(normalizePhones(['(816) 555-0142', '816-555-0142', { number: '18165550199' }])) === JSON.stringify(['8165550142', '8165550199']), 'phones normalized + deduped to 10 digits');
ok(JSON.stringify(normalizeEmails([{ email: 'A@B.com' }, 'a@b.com', 'bad'])) === JSON.stringify(['a@b.com']), 'emails normalized + deduped + validated');
ok(traceKey({ name: 'Jane Heir', address: '9 Palm  St' }) === traceKey({ name: 'jane heir', address: '9 palm st' }), 'trace key is case/space-insensitive');

// === provider config from env ===
ok(providerFromEnv({}) === null, 'no env -> no provider (skip mode)');
const prov = providerFromEnv({ SKIPTRACE_URL: 'https://prov.example/trace', SKIPTRACE_API_KEY: 'K', SKIPTRACE_PHONES_PATH: 'data.phones', SKIPTRACE_EMAILS_PATH: 'data.emails' });
ok(prov && prov.url === 'https://prov.example/trace', 'provider built from env');

// === skipTrace with a mock provider + caching ===
let calls = 0;
const mockFetch = async (url, opts) => {
  calls += 1;
  ok(opts.headers.Authorization === 'Bearer K', 'auth header sent');
  return { ok: true, status: 200, json: async () => ({ data: { phones: ['816-555-0142'], emails: [{ email: 'jane@heir.com' }] } }), text: async () => '' };
};
const cache = new TraceCache(join(root, 'cache.json'));
const r1 = await skipTrace({ name: 'Jane Heir', address: '9 Palm St', state: 'CA' }, { provider: prov, cache, fetchImpl: mockFetch });
ok(r1.phones[0] === '8165550142' && r1.emails[0] === 'jane@heir.com', 'skipTrace returns normalized phone + email');
const r2 = await skipTrace({ name: 'Jane Heir', address: '9 Palm St', state: 'CA' }, { provider: prov, cache, fetchImpl: mockFetch });
ok(r2.cached === true && calls === 1, 'second trace served from cache (no second network call)');
cache.save();
ok(existsSync(join(root, 'cache.json')), 'cache persisted to disk');

// === no provider -> graceful skip, never throws ===
const skipRes = await skipTrace({ name: 'X', address: 'Y' }, { provider: null });
ok(skipRes.skipped === true && skipRes.phones.length === 0, 'no provider -> skipped, empty, no throw');

// === enrichLeads attaches contact info ===
const leads = [
  { parcelId: 'INFILL1', ownerName: 'Jane Heir', ownerMailingAddress: '9 Palm St', ownerMailingState: 'CA', situsAddress: '123 Vine', county: 'Jackson' },
  { parcelId: 'INFILL2', ownerName: '', situsAddress: '5 Oak' }, // no owner name -> skipped gracefully
];
const enriched = await enrichLeads(leads, { provider: prov, cache, skipFn: skipTrace });
ok(enriched[0].ownerPhones[0] === '8165550142' && enriched[0].skipTraced === true, 'lead enriched with owner phone');
ok(enriched[1].skipTraced === false && enriched[1].ownerPhones.length === 0, 'lead with no owner name handled, not crashed');

// === sync to landowner memory writes a contact file with the phone ===
const { filesWritten, withContact } = syncEnrichedToMemory(enriched, { memoryPath: join(root, 'crm.json'), root });
ok(withContact === 1, 'one landowner had contact info');
ok(filesWritten.includes('contacts/landowners/jane-heir-123-vine.md'), 'landowner filed correctly: ' + filesWritten.join(','));
const md = readFileSync(join(root, 'contacts/landowners/jane-heir-123-vine.md'), 'utf8');
ok(/8165550142/.test(md) && /jane@heir\.com/.test(md), 'phone + email written into the landowner memory file');

console.log(`\nSKIPTRACE TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
