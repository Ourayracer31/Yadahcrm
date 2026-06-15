# n8n / Webhook Routing Layer

> The final box in the pipeline — pushes operator intelligence and the daily
> board into Travis's CRM dashboards.

```
synthesis ─▶ matching ─▶ operator ─▶ contact-memory ─▶ [ routing/ ] ─▶ n8n / CRM dashboards
```

## Internal-only by construction

This layer **never auto-contacts a lead.** Every emitted payload is addressed to
the Travis dashboard (`audience: "travis-dashboard"`), marked `outreach: false`
and `advisory: true`, and `assertInternalOnly()` throws on any payload that claims
otherwise. It moves *intelligence into dashboards*, not messages to people — the
human-final-decision rule holds end-to-end. Human-readable text also passes the
operator's trust-first language guard.

## Events

| Event | When | Channel |
|-------|------|---------|
| `opportunity.routed` | one per opportunity | by classification (below) |
| `warroom.daily` | daily | `dailyDigest` |
| `board.daily` | daily (Follow-Up Board) | `dailyDigest` |
| `firstcall.recommended` | the single first call | `highPriority` |

## Channels → endpoints

`channelForOpportunity()` classifies each opportunity:

| Condition | Channel |
|-----------|---------|
| killed / deprioritized | `dealsToKill` |
| synthesized (created) | `newMatches` |
| priority `high` | `highPriority` |
| otherwise | `default` |

Each channel maps to an endpoint URL in config; missing channels fall back to
`default`.

## Dispatch

`dispatch()` POSTs JSON with retry + exponential backoff (2s/4s/8s/16s) over a
**pluggable transport** (global `fetch` by default; tests inject a mock — the
whole layer runs offline). Supports `dryRun` (record intent, send nothing).

## Usage

```js
import { routeToCrm } from './src/index.js';

await routeToCrm({
  operatorResult,                 // from operator/runOperatorLayer()
  board,                          // from contact-memory/generateFollowUpBoard()
  config: {
    endpoints: {
      default:      'https://n8n.example/webhook/omni',
      highPriority: 'https://n8n.example/webhook/hot',
      dealsToKill:  'https://n8n.example/webhook/kill',
      dailyDigest:  'https://n8n.example/webhook/digest',
    },
    minComposite: 5,   // floor for non-kill events
  },
});
```

CLI:

```bash
node src/cli.js --operator op.json --board board.json --config cfg.json [--dry-run]
npm test   # 19 passing
```

## n8n side

Point each endpoint at an n8n **Webhook** node. The envelope is plain JSON
(`event`, `channel`, `data`, `timestamp`, `advisory`, `outreach:false`), so an
n8n switch on `event` / `channel` fans events out to dashboards, Slack/email
notifications for Travis, or a CRM upsert — all internal, none of it outreach.
