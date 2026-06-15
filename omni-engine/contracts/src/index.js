/**
 * Public entry point for the Honest-Broker contract generators.
 *
 * Given a matched deal, produce BOTH instruments (seller-side Option + builder-side
 * Assignment & Finder's Fee) as Markdown and printable HTML. The matching engine's
 * fee output maps straight onto the `deal` shape used here.
 */

export { generateOptionToPurchase } from './optionToPurchase.js';
export { generateAssignmentFinderFee } from './assignmentFinderFee.js';
export { renderHtml, markdownToHtml } from './render.js';

import { generateOptionToPurchase } from './optionToPurchase.js';
import { generateAssignmentFinderFee } from './assignmentFinderFee.js';
import { renderHtml } from './render.js';

/** Build the full document set for a deal. Returns markdown + html for each. */
export function generateDealPacket(deal) {
  const optionMd = generateOptionToPurchase(deal);
  const assignmentMd = generateAssignmentFinderFee(deal);
  return {
    option: { markdown: optionMd, html: renderHtml(optionMd, 'Exclusive Option to Purchase') },
    assignment: { markdown: assignmentMd, html: renderHtml(assignmentMd, "Assignment & Finder's Fee Agreement") },
  };
}

/** Map a match object from the matching engine onto a contract `deal`. */
export function dealFromMatch(match, { seller = {}, assignee = {} } = {}) {
  const lot = match.lotRef || {};
  return {
    seller: { name: seller.name || lot.ownerName, ...seller },
    assignee: { name: assignee.name || match.parties?.builder || match.parties?.developer, ...assignee },
    property: { address: lot.situsAddress, parcelId: lot.parcelId, county: lot.county },
    netToSeller: seller.netToSeller ?? lot.landValue ?? null,
    finderFee: match.fee?.amount ?? null,
    play: match.play,
    optionDays: match.play === 'Capital Preservation' ? 120 : (match.optionDays || 120),
  };
}
