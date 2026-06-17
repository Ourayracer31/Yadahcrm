/**
 * Offline tests for the phone notifier. No network — injected transport.
 * Run: node test/notify.test.js
 */
import { formatDigest, buildRequest, sendDigest, channelFromEnv } from '../src/notify.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const board = {
  date: '2026-06-16',
  firstCall: { name: 'Vance Built LLC', play: 'Margin Squeeze', composite: 7.3, phone: null, landownerName: 'Jane Heir', landownerPhone: '8165550142', angle: 'I have been watching your permits and it looks like you are moving. Are lots or finished inventory the tighter constraint?' },
  mustContact: [
    { name: 'Vance Built LLC', type: 'Builder', play: 'Margin Squeeze', phone: null },
    { name: 'Sallee Development', type: 'Builder', play: 'Pipeline Drought', phone: '8165550111' },
  ],
  newMatches: [{ builder: 'Vance Built LLC', landowner: 'Jane Heir' }],
  dealsToKill: [{ who: 'X', play: 'Margin Squeeze' }],
};

// === formatDigest ===
const text = formatDigest(board);
ok(/FIRST CALL: Vance Built LLC/.test(text), 'digest names the first call');
ok(/🏠 Landowner Jane Heir 8165550142/.test(text), 'digest includes the skip-traced landowner number');
ok(/1 to contact|2 to contact/.test(text), 'digest shows contact count');
ok(/1 new match\b/.test(text), 'digest shows new matches count (singular)');
ok(/1 to skip/.test(text), 'digest shows deals-to-skip count');
ok(/Sallee Development.*☎ 8165550111/.test(text), 'digest lists secondary contact with phone');
ok(/Full board/.test(text), 'digest points to the full board');

// empty board
ok(/No qualified first call today/.test(formatDigest({ date: '2026-06-16' })), 'graceful when no first call');

// === channel request building ===
const tg = buildRequest('telegram', 'hi', { botToken: 'BT', chatId: '99' });
ok(tg.url === 'https://api.telegram.org/botBT/sendMessage' && JSON.parse(tg.options.body).chat_id === '99', 'telegram request built');
const sl = buildRequest('slack', 'hi', { webhookUrl: 'https://hooks.slack/x' });
ok(sl.url === 'https://hooks.slack/x' && JSON.parse(sl.options.body).text === 'hi', 'slack request built');
const wh = buildRequest('webhook', 'hi', { webhookUrl: 'https://n8n/x' });
ok(JSON.parse(wh.options.body).outreach === false, 'webhook payload is internal (outreach:false)');
let threw = false; try { buildRequest('telegram', 'hi', {}); } catch { threw = true; }
ok(threw, 'telegram without token/chat throws a helpful error');

// === sendDigest with injected transport ===
let captured = null;
const mockFetch = async (url, opts) => { captured = { url, body: JSON.parse(opts.body) }; return { ok: true, status: 200, text: async () => '' }; };
const sent = await sendDigest(board, { channel: 'telegram', config: { botToken: 'BT', chatId: '99' }, fetchImpl: mockFetch });
ok(sent.sent === true && sent.channel === 'telegram', 'sendDigest reports sent');
ok(/FIRST CALL/.test(captured.body.text), 'sent message carries the digest text');

// console channel = zero-config no-op (prints, does not send)
const logs = [];
const printed = await sendDigest(board, { channel: 'console', logger: { log: (s) => logs.push(s) } });
ok(printed.sent === false && logs.join('').includes('FIRST CALL'), 'console channel prints without sending');

// === channelFromEnv ===
ok(channelFromEnv({}).channel === 'console', 'no env -> console');
ok(channelFromEnv({ NOTIFY_CHANNEL: 'slack', SLACK_WEBHOOK_URL: 'u' }).config.webhookUrl === 'u', 'slack webhook from env');

console.log(`\nNOTIFY TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
