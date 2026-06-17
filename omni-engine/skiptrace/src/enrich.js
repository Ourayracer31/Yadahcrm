/**
 * Attach skip-traced contact info to Vector B leads, and file it into the
 * landowner's relationship memory so the board/briefing has a number to call.
 */

import { skipTrace, TraceCache } from './skiptrace.js';
import { RelationshipMemory, blankRichContact, ContactFileStore } from '../../contact-memory/src/index.js';

/**
 * Enrich an array of leads with owner phone/email.
 * @param leads parcel leads (need ownerName + a mailing/situs address)
 * @param opts  { provider, cache, skipFn, onTrace }
 * @returns the leads with ownerPhones/ownerEmails/skipTraced attached
 */
export async function enrichLeads(leads, { provider, cache, skipFn = skipTrace, onTrace } = {}) {
  const out = [];
  for (const lead of leads) {
    const name = lead.ownerName;
    if (!name) { out.push({ ...lead, ownerPhones: [], ownerEmails: [], skipTraced: false }); continue; }
    const query = {
      name,
      address: lead.ownerMailingAddress || lead.situsAddress,
      city: lead.ownerMailingCity || lead.situsCity,
      state: lead.ownerMailingState,
      zip: lead.ownerMailingZip,
    };
    const r = await skipFn(query, { provider, cache });
    const enriched = { ...lead, ownerPhones: r.phones, ownerEmails: r.emails, skipTraced: !r.skipped, skipTraceSource: r.source };
    out.push(enriched);
    if (onTrace) onTrace(enriched, r);
  }
  return out;
}

/**
 * File enriched leads into landowner relationship memory (so the contact file
 * carries the phone/email and the board can surface "call this number").
 * @returns { filesWritten, withContact }
 */
export function syncEnrichedToMemory(enrichedLeads, { memoryPath = null, root = process.cwd() } = {}) {
  const memory = new RelationshipMemory(memoryPath);
  const store = new ContactFileStore(root);
  const filesWritten = [];
  let withContact = 0;

  for (const lead of enrichedLeads) {
    if (!lead.ownerName) continue;
    const hasContact = (lead.ownerPhones && lead.ownerPhones.length) || (lead.ownerEmails && lead.ownerEmails.length);
    if (hasContact) withContact += 1;
    const contact = memory.upsert({
      name: lead.ownerName,
      type: 'landowner',
      phone: (lead.ownerPhones || []).join(', ') || null,
      email: (lead.ownerEmails || []).join(', ') || null,
      propertyAddress: lead.situsAddress,
      parcelId: lead.parcelId,
      county: lead.county,
    });
    const rich = blankRichContact(contact);
    rich.interactions = contact.interactions || [];
    filesWritten.push(store.write(rich).relPath);
  }
  memory.save();
  return { filesWritten, withContact };
}

export { TraceCache };
