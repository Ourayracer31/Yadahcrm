/**
 * Exclusive Option to Purchase (for the Landowner / Seller).
 *
 * Mandated elements (mission brief):
 *   - "Buyer Disclosure of Role": Manley Systems LLC is a procurement finder that
 *     will ASSIGN the contract to a builder. Full transparency, no agency.
 *   - A real Option Consideration fee ($50-$100).
 *   - A "Net to Seller" price; the incoming builder pays 100% of closing costs.
 *
 * Returns a Markdown instrument. The shared compliance guard rejects any output
 * containing the prohibited "Wholesale" family of terms.
 */

import { BROKER, assertNoProhibitedTerms, money, clampOptionConsideration, today, field } from './shared.js';

export function generateOptionToPurchase(deal = {}) {
  const {
    seller = {}, property = {},
    netToSeller, optionConsideration = 100, optionDays = 120,
    effectiveDate = today(),
  } = deal;

  const consideration = clampOptionConsideration(optionConsideration);

  const md = `# EXCLUSIVE OPTION TO PURCHASE REAL ESTATE

**Effective Date:** ${effectiveDate}

**Optionor (Seller):** ${field(seller.name)}
**Optionee (Buyer):** ${BROKER.legalName}

**Property:** ${field(property.address)}${property.parcelId ? `  \n**Parcel ID:** ${field(property.parcelId)}` : ''}${property.county ? `  \n**County:** ${field(property.county)}` : ''}

---

## 1. Buyer Disclosure of Role
${BROKER.legalName} is acting solely as a **${BROKER.role}**. ${BROKER.legalName} is
**not** a licensed real estate broker or agent and is **not** representing the
Seller in any agency capacity. Buyer's purpose in acquiring this Option is to
**assign** its rights under this Option to a third-party builder or investor for a
disclosed fee. Seller acknowledges and consents to this role and to Buyer's right
to assign this Option as set out in Section 5.

## 2. Grant of Option
For the Option Consideration in Section 3, Seller grants Buyer the **exclusive**
right and option to purchase the Property during the Option Period.

## 3. Option Consideration
Buyer shall pay Seller **${money(consideration)}** as non-refundable Option
Consideration upon execution. This is a real, bargained-for payment and is
independent of the Purchase Price. (Option Consideration is fixed by policy
between $50 and $100.)

## 4. Option Period
The Option Period runs **${field(optionDays)} days** from the Effective Date.
Buyer may exercise by written notice at any time during the Option Period.

## 5. Purchase Terms — Net to Seller
Upon exercise, the purchase shall close on a **Net to Seller** basis:
- **Net to Seller Price:** ${money(netToSeller)} — the amount Seller receives free
  and clear at closing.
- **Closing Costs:** the incoming assignee/builder shall pay **100% of all closing costs**, including title, escrow, recording, and transfer charges. Seller pays none of these.

## 6. Assignment
Buyer may freely assign this Option, in whole, to a builder or investor without
further consent. Upon closing by the assignee, this Option is satisfied.

## 7. Condition of Title
Seller shall convey marketable title by general warranty deed, free of liens
except those Seller discloses in writing prior to exercise.

## 8. As-Is
The Property is optioned **AS-IS**. Buyer and any assignee are responsible for
their own due diligence (see the companion Assignment & Finder's Fee Agreement).

---

**SELLER:** ____________________________  Date: ____________
${field(seller.name)}

**BUYER (${BROKER.role}):** ____________________________  Date: ____________
${BROKER.legalName}
`;

  return assertNoProhibitedTerms(md);
}
