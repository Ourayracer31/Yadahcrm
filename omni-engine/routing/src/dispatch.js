/**
 * HTTP dispatch with retry/backoff and a pluggable transport.
 *
 * The transport defaults to global fetch but is injectable, so the routing layer
 * is fully unit-testable offline (tests pass a recording mock). Honors a dryRun
 * mode that records intent without sending.
 */

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * POST one payload to one endpoint.
 * @returns {{ status:'sent'|'failed'|'skipped', endpoint, attempts, error? }}
 */
export async function dispatch(endpoint, payload, {
  transport = globalThis.fetch,
  maxRetries = 4,
  dryRun = false,
  sleepFn = defaultSleep,
  logger = null,
} = {}) {
  if (dryRun) return { status: 'skipped', endpoint, attempts: 0, reason: 'dryRun' };
  if (!endpoint) return { status: 'skipped', endpoint: null, attempts: 0, reason: 'no-endpoint' };

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await transport(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res || res.ok !== true) {
        throw new Error(`HTTP ${res ? res.status : 'no-response'}`);
      }
      return { status: 'sent', endpoint, attempts: attempt };
    } catch (err) {
      lastError = err;
      if (logger) logger.warn?.(`dispatch attempt ${attempt}/${maxRetries} to ${endpoint} failed: ${err.message}`);
      if (attempt < maxRetries) await sleepFn(2 ** attempt * 1000); // 2s,4s,8s,16s
    }
  }
  return { status: 'failed', endpoint, attempts: maxRetries, error: lastError?.message };
}
