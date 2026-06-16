# Skip-Trace Enrichment

> Turns a parcel into a **person you can call.** Given an owner name + mailing
> address, it looks up phone/email through a licensed data provider, caches the
> result (so you never pay twice), and files it into the landowner's memory so the
> board shows **"call this number."**

```
lots.json (owner + address)  ─▶  skip-trace provider  ─▶  phones/emails
                                       │
                                       ▼
            lead.ownerPhones  +  landowner memory file  +  ☎ on the daily board
```

## Provider-agnostic by design

Point it at **any** licensed skip-trace provider — no endpoint is hard-coded.
Set four env vars and it adapts to that provider's request/response shape:

```bash
SKIPTRACE_URL=https://your-provider.example/skiptrace
SKIPTRACE_API_KEY=...
SKIPTRACE_PHONES_PATH=data.phones      # where phones live in the response
SKIPTRACE_EMAILS_PATH=data.emails
# optional: SKIPTRACE_METHOD, SKIPTRACE_AUTH_HEADER, SKIPTRACE_AUTH_PREFIX
```

Phones/emails are normalized (10-digit, deduped, validated) regardless of whether
the provider returns plain strings or objects. With **no provider set, it no-ops**
(empty results) so the pipeline still runs.

## Use

```bash
# enrich a leads file and file phones into landowner memory
node src/cli.js --in samples/lots.json --out samples/lots.json --memory crm.json --root .
```

It runs automatically inside `tools/run-all.sh` / the daemon when a provider is
configured (right after the parcel pull, before the daily pipeline), so the
board's landowner opportunities and First-Call carry the number.

## Caching

Every trace is cached to `.cache/skiptrace.json` keyed by owner+address
(case/space-insensitive). Re-runs hit the cache — no duplicate lookups, no
duplicate charges.

## Responsible use (read this)

Skip-tracing returns personal contact data. This system is built for **one human
operator making one thoughtful call at a time** — never bulk outreach:

- **Nothing auto-contacts anyone.** The routing layer stays internal-only; the
  number lands on Travis's board, not in an autodialer.
- **Scrub against DNC and honor TCPA** before calling/texting. Manual calls only.
- Only trace owners of parcels you have a legitimate business interest in.

`AI prepares; Travis decides.`

```bash
npm test    # 15 passing (normalization, caching, no-key skip, lead + memory enrichment)
```
