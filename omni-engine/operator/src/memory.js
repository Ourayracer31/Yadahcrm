/**
 * MODULE 5 — Relationship Memory.
 *
 * Persistent CRM memory for every builder, landowner, investor, engineer, title
 * contact and developer. The goal is not volume - it is intelligent follow-up.
 * Backed by a JSON file so it survives between runs; falls back to in-memory when
 * no path is given (e.g. tests). The Daily War Room and 30-Contact OS read
 * `dueFollowUps()` and the trust signals off these records.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** The tracked shape for any relationship. Unknown fields stay null, never guessed. */
export function blankContact(seed = {}) {
  return {
    id: seed.id || null,
    name: seed.name || '',
    type: seed.type || 'builder', // builder | landowner | investor | engineer | title | developer
    builds: seed.builds || null,                 // what they build
    buildsWhere: seed.buildsWhere || null,       // where they build
    avoids: seed.avoids || null,                 // what they avoid
    priceRange: seed.priceRange || null,
    lotSizePreference: seed.lotSizePreference || null,
    municipalityPreference: seed.municipalityPreference || null,
    productType: seed.productType || null,
    pastObjections: seed.pastObjections || [],
    currentPain: seed.currentPain || null,
    lastConversation: seed.lastConversation || null, // ISO date
    nextFollowUp: seed.nextFollowUp || null,         // ISO date
    trustLevel: typeof seed.trustLevel === 'number' ? seed.trustLevel : null, // 1-10
    dealLikelihood: typeof seed.dealLikelihood === 'number' ? seed.dealLikelihood : null, // 1-10
    personalNotes: seed.personalNotes || '',
    preferredCommunicationStyle: seed.preferredCommunicationStyle || null, // text | call | in-person
    authority: typeof seed.authority === 'boolean' ? seed.authority : null,
    conversationCount: seed.conversationCount || 0,
    interactions: seed.interactions || [],
    createdAt: seed.createdAt || new Date().toISOString(),
    updatedAt: seed.updatedAt || new Date().toISOString(),
  };
}

export class RelationshipMemory {
  constructor(filePath = null) {
    this.filePath = filePath;
    /** @type {Map<string, object>} */
    this.contacts = new Map();
    if (filePath && existsSync(filePath)) this._load();
  }

  _key(name) {
    return String(name || '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  _load() {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8'));
      for (const c of raw.contacts || []) this.contacts.set(this._key(c.name), c);
    } catch {
      /* start empty on parse error */
    }
  }

  save() {
    if (!this.filePath) return false;
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify({ contacts: [...this.contacts.values()] }, null, 2));
    return true;
  }

  get(name) {
    return this.contacts.get(this._key(name)) || null;
  }

  /** Insert or merge a contact. Existing non-null fields are preserved unless overwritten. */
  upsert(seed) {
    const key = this._key(seed.name);
    const existing = this.contacts.get(key);
    const merged = existing ? { ...existing } : blankContact(seed);
    for (const [k, v] of Object.entries(seed)) {
      if (v !== undefined && v !== null && k !== 'interactions') merged[k] = v;
    }
    if (!merged.id) merged.id = key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    merged.updatedAt = new Date().toISOString();
    this.contacts.set(key, merged);
    return merged;
  }

  /** Log a conversation/touch and advance counters + next follow-up. */
  recordInteraction(name, { date, channel, summary, painLearned, nextFollowUp, outcome } = {}) {
    const c = this.get(name) || this.upsert({ name });
    const at = date || new Date().toISOString();
    c.interactions.push({ at, channel: channel || 'call', summary: summary || '', painLearned: painLearned || null, outcome: outcome || null });
    c.conversationCount = (c.conversationCount || 0) + 1;
    c.lastConversation = at;
    if (painLearned) c.currentPain = painLearned;
    if (nextFollowUp) c.nextFollowUp = nextFollowUp;
    c.updatedAt = new Date().toISOString();
    this.contacts.set(this._key(name), c);
    return c;
  }

  /** Contacts whose nextFollowUp is on/before `asOf` (default today). Sorted soonest-first. */
  dueFollowUps(asOf = new Date()) {
    const cutoff = asOf instanceof Date ? asOf : new Date(asOf);
    return [...this.contacts.values()]
      .filter((c) => c.nextFollowUp && new Date(c.nextFollowUp) <= cutoff)
      .sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp));
  }

  all() {
    return [...this.contacts.values()];
  }

  byType(type) {
    return this.all().filter((c) => c.type === type);
  }
}
