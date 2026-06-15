/**
 * Assignment & Finder's Fee Agreement (for the Builder / Investor).
 *
 * Mandated elements (mission brief):
 *   - "As-Is Field Professional" clause: the builder is 100% responsible for soil
 *     tests, grading, and utility verification.
 *   - "Double-Signature Title Directive": instruct the Title Company to pay the
 *     Seller their Net price AND wire Manley Systems LLC the fully disclosed
 *     Finder's Fee at closing.
 */

import { BROKER, assertNoProhibitedTerms, money, today, field } from './shared.js';

export function generateAssignmentFinderFee(deal = {}) {
  const {
    assignee = {}, seller = {}, property = {},
    netToSeller, finderFee, play, effectiveDate = today(),
  } = deal;

  const md = `# ASSIGNMENT & FINDER'S FEE AGREEMENT

**Effective Date:** ${effectiveDate}

**Assignor (${BROKER.role}):** ${BROKER.legalName}
**Assignee (Builder/Investor):** ${field(assignee.name)}

**Property:** ${field(property.address)}${property.parcelId ? `  \n**Parcel ID:** ${field(property.parcelId)}` : ''}
**Underlying Instrument:** Exclusive Option to Purchase with ${field(seller.name)} (Seller)${play ? `  \n**Strategic Play:** ${field(play)}` : ''}

---

## 1. Assignment
Assignor assigns to Assignee all of Assignor's right, title and interest in the
Exclusive Option to Purchase the Property. Assignee accepts the assignment and
agrees to perform all obligations of the buyer thereunder.

## 2. Disclosed Finder's Fee
In consideration of the assignment, Assignee shall pay Assignor a fully disclosed
**Finder's Fee of ${money(finderFee)}**, earned at and payable from closing. This
fee is disclosed to all parties and is separate from the Net to Seller amount.

## 3. As-Is Field Professional Clause
Assignee acknowledges it is a sophisticated **field professional** and takes the
Property strictly **AS-IS, WHERE-IS**. Assignee is **100% responsible** for and
shall independently verify, at its sole cost:
- **Soil and geotechnical testing** (bearing capacity, compaction, contamination);
- **Grading, drainage, and site work** feasibility;
- **Utility verification** (water, sewer, gas, electric, stormwater availability and capacity);
- Zoning confirmation, setbacks, and any variance requirements.

Assignor (${BROKER.legalName}) makes **no representation or warranty** as to
buildability, soils, utilities, or development cost, and any approximations
provided (e.g. equity proxies, zoning screening) are **screening signals only**.

## 4. Double-Signature Title Directive
The parties jointly and irrevocably **direct the Title/Escrow Company** to
disburse at closing as follows, and both Assignor and Assignee shall sign this
directive at the title table:
1. **Pay Seller** the agreed **Net to Seller** amount of ${money(netToSeller)},
   free and clear, with the Assignee bearing 100% of closing costs; and
2. **Wire ${BROKER.legalName}** the disclosed **Finder's Fee of ${money(finderFee)}**
   as a separate line on the settlement statement.

Both disbursements shall appear on the closing settlement statement reviewed and
signed by Seller and Assignee.

## 5. No Agency
${BROKER.legalName} acts as a **${BROKER.role}** only, is not a licensed real
estate agent, and represents no party in an agency capacity.

---

**ASSIGNOR (${BROKER.role}):** ____________________________  Date: ____________
${BROKER.legalName}

**ASSIGNEE (Builder/Investor):** ____________________________  Date: ____________
${field(assignee.name)}

**ACKNOWLEDGED — TITLE/ESCROW COMPANY:** ____________________________  Date: ____________
`;

  return assertNoProhibitedTerms(md);
}
