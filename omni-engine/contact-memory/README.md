# Contact Memory + Relationship Intelligence System

> A permanent memory file for **every** real-world contact Travis speaks with.
> Not a generic CRM — a relationship-intelligence system built for development
> problem-solving. Remember what people need, what they avoid, what problems they
> have, what may fit them, and when to follow up. **Never a spam machine.**

This module extends the operator layer's in-memory `RelationshipMemory`
(Module 5) into a durable, file-based system and reuses the operator's
trust-first language guard and field-reality logic.

```
operator/ (scored opportunities + memory)  ─▶  [ contact-memory/ ]  ─▶  /contacts/**.md + /daily/board
```

## Filing (the Master Rule)

Every person gets a dedicated markdown file under one of four folders:

| Folder | Primary types |
|--------|---------------|
| `contacts/builders-developers/` | Builder, Developer |
| `contacts/landowners/` | Landowner |
| `contacts/investors/` | Investor |
| `contacts/service-partners/` | Engineer, Surveyor, Title Company, Attorney, Banker/Lender, City/County, Broker, Other |

Filename: `first-name-last-name-company.md` (or `…-location.md` when there's no
company). A contact can hold several types; `primaryType` (Builder ▸ Developer ▸
Landowner ▸ Investor ▸ service) decides the folder and the template.

## Templates

Full intake templates per the spec — **Builder/Developer** and **Landowner** are
exhaustive (identity, profile, pain, wants, avoids, conversation history,
opportunity fit, AI recommendations); **Investor** (buy-box, capital) and
**Service Partner** (the *Intel They Provide* section — who hears about land and
builder stress first) follow the same discipline. Unknown fields render as `—`,
never guessed.

## Append-only conversation history (Universal Memory Rule)

Conversation history is **never overwritten**. The data record's `interactions[]`
is append-only, and on every write the store also re-parses conversation blocks
already on disk and merges them — so even a hand-edited historical note survives a
rewrite. (Covered by tests.)

## Follow-Up Engine — `/daily/travis-follow-up-board.md`

Generated daily from operator opportunities + memory:
- **Must Contact Today** (name, type, reason, opening line, desired outcome)
- **Warm Relationships To Nurture**
- **Opportunities To Revisit**
- **Deals To Kill** (with reasons)
- **New Matches Found** (builder / landowner / investor / why / confidence)
- **First Call Recommendation** — the single most important call

## Field Reality Rule

Before a match reaches the board it passes `wouldTravisBelieveIt(opp)`:
*"Would Travis believe this works after standing on the property?"* If the field
check says unbuildable, it's downgraded off the board.

## Usage

```js
import { runSynthesis } from '../synthesis/src/index.js';
import { runOperatorLayer } from '../operator/src/index.js';
import { RelationshipMemory, syncContactMemory } from './src/index.js';

const created  = runSynthesis({ builders, lots, buyers });
const opResult = runOperatorLayer({ matches: created });

const memory = new RelationshipMemory('./crm.json');
// ...record interactions as Travis talks to people...

syncContactMemory({ operatorResult: opResult, memory, root: '.' });
// writes contacts/**/<contact>.md (append-only) + daily/travis-follow-up-board.md
```

CLI:

```bash
node src/cli.js --memory crm.json --opportunities opps.json --root .
npm test          # 32 passing
npm run examples  # regenerate the committed examples/ files
```

See `examples/` for rendered output (fictional contacts, no real data). Live
runtime data under `/contacts` and `/daily` is git-ignored.
