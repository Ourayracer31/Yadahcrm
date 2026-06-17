/**
 * Push the morning digest to Travis's phone.
 *
 * Channel-agnostic: Telegram (free, instant to the phone), Slack incoming webhook,
 * or any generic webhook. The message is the actionable core of the board — the
 * one first call WITH the number to dial, today's contact count, new matches, and
 * how many to skip — so Travis can act without opening the computer.
 *
 * This notifies the OPERATOR (Travis), never a lead. It's a one-way heads-up; the
 * human still decides and dials.
 */

import { assertCompliantLanguage } from '../../operator/src/language.js';

const trunc = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

/** Build a short, phone-friendly digest from a follow-up board object (board.board). */
export function formatDigest(board = {}) {
  const lines = [];
  lines.push(`🏗️ Omni-Engine — ${board.date || new Date().toISOString().slice(0, 10)}`);

  const fc = board.firstCall;
  if (fc) {
    lines.push('');
    lines.push(`☎️ FIRST CALL: ${fc.name} (${fc.play})`);
    if (fc.phone) lines.push(`   📱 ${fc.phone}`);
    if (fc.landownerPhone) lines.push(`   🏠 Landowner ${fc.landownerName || ''} ${fc.landownerPhone}`.trimEnd());
    if (fc.angle) lines.push(`   "${trunc(fc.angle, 160)}"`);
  } else {
    lines.push('No qualified first call today.');
  }

  const must = board.mustContact || [];
  const matches = board.newMatches || [];
  const kill = board.dealsToKill || board.killed || [];
  lines.push('');
  lines.push(`📋 ${must.length} to contact · 🤝 ${matches.length} new match${matches.length === 1 ? '' : 'es'} · 🛑 ${kill.length} to skip`);

  if (must.length > 1) {
    lines.push('');
    lines.push('Also today:');
    for (const c of must.slice(1, 4)) {
      lines.push(`• ${c.name} (${c.type})${c.phone ? ` ☎ ${c.phone}` : ''} — ${c.play}`);
    }
  }
  lines.push('');
  lines.push('Full board: daily/travis-follow-up-board.md');

  return assertCompliantLanguage(lines.join('\n'), 'phone digest');
}

/** Channel adapters: build the request for a given channel + config. */
export function buildRequest(channel, text, config = {}) {
  switch (channel) {
    case 'telegram': {
      if (!config.botToken || !config.chatId) throw new Error('Telegram needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.');
      return {
        url: `https://api.telegram.org/bot${config.botToken}/sendMessage`,
        options: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: config.chatId, text, disable_web_page_preview: true }) },
      };
    }
    case 'slack': {
      if (!config.webhookUrl) throw new Error('Slack needs SLACK_WEBHOOK_URL.');
      return { url: config.webhookUrl, options: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) } };
    }
    case 'webhook': {
      if (!config.webhookUrl) throw new Error('Generic webhook needs NOTIFY_WEBHOOK_URL.');
      return { url: config.webhookUrl, options: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'daily.digest', audience: 'travis', outreach: false, text }) } };
    }
    default:
      return null; // console
  }
}

/** Resolve channel config from env. */
export function channelFromEnv(env = process.env) {
  const channel = env.NOTIFY_CHANNEL || 'console';
  return {
    channel,
    config: {
      botToken: env.TELEGRAM_BOT_TOKEN,
      chatId: env.TELEGRAM_CHAT_ID,
      webhookUrl: channel === 'slack' ? env.SLACK_WEBHOOK_URL : env.NOTIFY_WEBHOOK_URL,
    },
  };
}

/**
 * Send the digest. Returns { sent, channel, status }.
 * `console` (default) just prints — works with zero config.
 */
export async function sendDigest(board, { channel = 'console', config = {}, fetchImpl = fetch, logger = console } = {}) {
  const text = formatDigest(board);
  if (channel === 'console' || !channel) {
    logger.log('\n' + text + '\n');
    return { sent: false, channel: 'console', status: 'printed' };
  }
  const req = buildRequest(channel, text, config);
  const res = await fetchImpl(req.url, req.options);
  if (!res.ok) throw new Error(`Notify ${channel} failed: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
  return { sent: true, channel, status: res.status };
}
