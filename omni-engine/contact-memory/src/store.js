/**
 * ContactFileStore - reads/writes the per-contact markdown memory files under the
 * mandated /contacts/** folders, with APPEND-ONLY conversation history.
 *
 * The data record's `interactions[]` is the source of truth and is append-only,
 * but we also re-parse any conversation blocks already on disk and merge them in,
 * so a hand-edited file never loses history when the system rewrites it.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathForContact, templateForType, primaryTypeOf } from './classify.js';
import { renderConversation, parseConversationBlocks, mergeConversations, guardFile } from './render.js';
import { renderBuilderFile } from './templates/builder.js';
import { renderLandownerFile } from './templates/landowner.js';
import { renderInvestorFile } from './templates/investor.js';
import { renderPartnerFile } from './templates/partner.js';

const RENDERERS = {
  builder: renderBuilderFile,
  landowner: renderLandownerFile,
  investor: renderInvestorFile,
  partner: renderPartnerFile,
};

export class ContactFileStore {
  /** @param {string} root - output root; the spec's /contacts and /daily live here. */
  constructor(root = process.cwd()) {
    this.root = root;
  }

  relPath(contact) {
    return pathForContact(contact);
  }

  absPath(contact) {
    return join(this.root, this.relPath(contact));
  }

  /**
   * Render a contact file, merging in any conversation blocks already on disk
   * (append-only). Returns { path, relPath, markdown } without writing.
   */
  render(contact) {
    const primary = primaryTypeOf(contact);
    const kind = templateForType(primary);
    const renderer = RENDERERS[kind] || renderPartnerFile;
    const convKind = kind === 'landowner' ? 'landowner' : 'builder';

    const rendered = (contact.interactions || []).map((e) => renderConversation(e, convKind));
    const abs = this.absPath(contact);
    let existing = [];
    if (existsSync(abs)) {
      existing = parseConversationBlocks(readFileSync(abs, 'utf8'));
    }
    const merged = mergeConversations(rendered, existing);
    const markdown = guardFile(renderer(contact, { conversationBlocks: merged }));
    return { path: abs, relPath: this.relPath(contact), markdown };
  }

  /** Render + write the contact file (creating folders as needed). */
  write(contact) {
    const { path, relPath, markdown } = this.render(contact);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown);
    return { path, relPath };
  }

  /** Write many contacts. Returns the list of files written. */
  writeAll(contacts) {
    return contacts.map((c) => this.write(c));
  }

  /** Write the daily follow-up board to /daily/travis-follow-up-board.md. */
  writeFollowUpBoard(markdown, date = new Date()) {
    const day = (date instanceof Date ? date : new Date(date)).toISOString().slice(0, 10);
    const path = join(this.root, 'daily', 'travis-follow-up-board.md');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown);
    // also keep a dated archive copy so the board is never lost
    const archive = join(this.root, 'daily', `follow-up-board-${day}.md`);
    writeFileSync(archive, markdown);
    return { path, archive };
  }
}
