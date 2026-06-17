/**
 * Skip-trace client — owner name + mailing address -> phone(s)/email(s).
 *
 * Provider-agnostic by design: you point it at a licensed skip-trace provider via
 * a small config (URL + auth + which response fields hold phones/emails), so any
 * provider works without hard-coding an unverified endpoint. Results are cached to
 * disk so the same owner is never traced (or paid for) twice. With no provider
 * configured it returns empty (the pipeline still runs) — never a hard failure.
 *
 * Responsible-use posture: this enriches a lead so Travis can make ONE human call.
 * Nothing here auto-contacts anyone; the routing layer stays internal-only; scrub
 * against DNC and honor TCPA before any outreach. AI prepares; Travis decides.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Normalize a provider's phone field (array of strings or objects) to clean strings. */
export function normalizePhones(value) {
  return toList(value).map((p) => {
    const raw = typeof p === 'string' ? p : (p.number || p.phone || p.phoneNumber || p.value || '');
    const digits = String(raw).replace(/[^\d]/g, '');
    return digits.length >= 10 ? digits.slice(-10) : '';
  }).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
}

/** Normalize a provider's email field to clean, unique addresses. */
export function normalizeEmails(value) {
  return toList(value).map((e) => {
    const raw = typeof e === 'string' ? e : (e.email || e.address || e.value || '');
    return String(raw).trim().toLowerCase();
  }).filter((v) => /.+@.+\..+/.test(v)).filter((v, i, a) => a.indexOf(v) === i);
}

function toList(v) {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** Read a dotted path (e.g. "data.phones") out of an object. */
function pick(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Build a stable cache key for an owner+address. */
export function traceKey({ name, address }) {
  return `${String(name || '').toUpperCase().trim()}::${String(address || '').toUpperCase().replace(/\s+/g, ' ').trim()}`;
}

/** Simple file-backed cache so we never re-trace (or re-pay for) the same owner. */
export class TraceCache {
  constructor(path = null) {
    this.path = path;
    this.map = new Map();
    if (path && existsSync(path)) {
      try { for (const [k, v] of Object.entries(JSON.parse(readFileSync(path, 'utf8')))) this.map.set(k, v); } catch { /* start empty */ }
    }
  }
  get(key) { return this.map.get(key) || null; }
  set(key, val) { this.map.set(key, val); return val; }
  save() {
    if (!this.path) return false;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(Object.fromEntries(this.map), null, 2));
    return true;
  }
}

/**
 * Build a provider config from env (or an explicit object). Returns null if no
 * provider/key is set (caller should treat that as "skip enrichment").
 */
export function providerFromEnv(env = process.env) {
  if (!env.SKIPTRACE_URL || !env.SKIPTRACE_API_KEY) return null;
  return {
    url: env.SKIPTRACE_URL,
    method: env.SKIPTRACE_METHOD || 'POST',
    authHeader: env.SKIPTRACE_AUTH_HEADER || 'Authorization',
    authPrefix: env.SKIPTRACE_AUTH_PREFIX ?? 'Bearer ',
    apiKey: env.SKIPTRACE_API_KEY,
    phonesPath: env.SKIPTRACE_PHONES_PATH || 'phones',
    emailsPath: env.SKIPTRACE_EMAILS_PATH || 'emails',
  };
}

/**
 * Skip-trace one owner. Returns { phones, emails, source, tracedAt, skipped? }.
 * @param query   { name, address, city, state, zip }
 * @param options { provider, cache, fetchImpl }
 */
export async function skipTrace(query, { provider = providerFromEnv(), cache = null, fetchImpl = fetch } = {}) {
  const key = traceKey(query);
  if (cache) { const hit = cache.get(key); if (hit) return { ...hit, cached: true }; }

  if (!provider) {
    const empty = { phones: [], emails: [], source: 'none', tracedAt: new Date().toISOString(), skipped: true, reason: 'no skip-trace provider configured (set SKIPTRACE_URL + SKIPTRACE_API_KEY)' };
    if (cache) cache.set(key, empty);
    return empty;
  }

  const body = JSON.stringify({ name: query.name, address: query.address, city: query.city, state: query.state, zip: query.zip });
  const res = await fetchImpl(provider.url, {
    method: provider.method,
    headers: { 'Content-Type': 'application/json', [provider.authHeader]: `${provider.authPrefix}${provider.apiKey}` },
    body,
  });
  if (!res.ok) throw new Error(`Skip-trace HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();

  const result = {
    phones: normalizePhones(pick(json, provider.phonesPath)),
    emails: normalizeEmails(pick(json, provider.emailsPath)),
    source: provider.url.replace(/^https?:\/\//, '').split('/')[0],
    tracedAt: new Date().toISOString(),
  };
  if (cache) cache.set(key, result);
  return result;
}
