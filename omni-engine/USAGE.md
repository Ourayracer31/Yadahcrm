# Using the Omni-Engine every day

A practical operator's guide. The system is a **morning prep machine + memory**.
It never talks to anyone — *AI finds the conversations worth having; Travis
creates the opportunity.*

---

## One-time setup

1. **Verify county data endpoints.** The Vector A/B/C inputs ship with realistic
   *placeholder* ArcGIS/Socrata URLs + field names. Confirm the real ones against
   each county's live service directory (Jackson/KCMO, Wyandotte/KCK, Cass/Miami/
   Platte). **This is the one non-optional step.**
2. **Set up Apify** for the three vectors (or run the actors locally with Node).
3. **Create your memory file** `crm.json` → `{ "contacts": [] }`.
4. *(Optional)* **Stand up n8n** and import `routing/n8n/omni-engine.workflow.json`
   for dashboards/notifications.

---

## Try it right now (sample data)

```bash
cd omni-engine
npm run daily        # runs the full pipeline on bundled sample data
```

You'll see the War Room print, and these files appear:
`out/` (war-room, briefings, daily-plan, opportunities, board) and
`daily/travis-follow-up-board.md` + `contacts/**` memory files.

---

## The daily loop

### 🌅 Morning
1. Run the three Apify vectors → export `builders.json`, `lots.json`, `buyers.json`.
2. One command runs everything:
   ```bash
   node runner/src/daily.js --config config/omni.config.json        # add --route to push to n8n
   ```
3. Open **`daily/travis-follow-up-board.md`**. Read it top to bottom:
   - **First Call Recommendation** — make this call first (exact opening line included).
   - **Must Contact Today** · **Warm Relationships** · **Opportunities to Revisit**.
   - **Deals to Kill** — stop chasing these, with the reason.
   - **New Matches Found** — the created chains (Land + Builder + Capital).

### 📞 Midday — work the 30-contact plan
`out/daily-plan.json` splits the day 10 builders / 10 landowners / 5 investors /
5 follow-ups. Each card has the opening line, discovery question, likely
objection + response, what to listen for, and the follow-up action. Open any
contact's brief in `out/briefings.txt` for the full 10-section prep — including
**what NOT to say** and **field concerns to verify**.

### 🌙 Evening — feed the memory (this is what compounds)
After each call, log it so tomorrow is smarter:
```js
import { RelationshipMemory } from './contact-memory/src/index.js';
const m = new RelationshipMemory('crm.json');
m.recordInteraction('Squeezed Homes LLC', {
  method: 'Call', summary: 'East-side specs aging; down to 4 lots',
  painLearned: 'short on finished lots', nextFollowUp: '2026-06-23',
});
m.save();
```
History is **append-only** — nothing is ever overwritten.

### 🤝 When Travis decides a deal is real
Generate the document packet (Option + Assignment, with all mandated clauses):
```bash
echo '{ "seller":{"name":"Jane Heir"}, "assignee":{"name":"Squeezed Homes LLC"},
        "property":{"address":"123 Vine St","parcelId":"INFILL1"},
        "netToSeller":60000, "finderFee":10000, "play":"Margin Squeeze" }' \
  | node contracts/src/cli.js --out ./deals
```

---

## What the system will and won't do

- ✅ Find, create, score, field-check, brief, and remember.
- ✅ Tell Travis the one call to make first — and which deals to kill.
- ✅ Generate compliant Option + Assignment paperwork on demand.
- ❌ Never contacts a lead. Never auto-sends. Never uses "wholesale"/hype language.
- ❌ Never assumes a parcel is good because zoning looks good — Field Reality Rule
  ("would Travis believe it after standing on the property?") gates every match.

**Operator Fit gates everything:** if it isn't a problem Travis's 32 years of
construction experience uniquely solves, the system deprioritizes it. Trust over
volume.

---

## Verify the build

```bash
npm test    # runs all module suites
```
