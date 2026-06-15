/**
 * Contact classification + filing.
 *
 * Every contact is classified as one or more types and filed into exactly one of
 * the four mandated folders. A person can wear several hats (a landowner who also
 * builds); `primaryType` (explicit, else priority order) decides the folder and
 * which template renders the file.
 */

export const CONTACT_TYPES = [
  'Builder', 'Developer', 'Landowner', 'Investor', 'Engineer', 'Surveyor',
  'Title Company', 'Attorney', 'Banker/Lender', 'City/County Contact', 'Broker', 'Other',
];

export const FOLDERS = {
  buildersDevelopers: 'contacts/builders-developers',
  landowners: 'contacts/landowners',
  investors: 'contacts/investors',
  servicePartners: 'contacts/service-partners',
};

// Folder routing precedence when a contact has multiple types.
const PRIORITY = ['Builder', 'Developer', 'Landowner', 'Investor'];

/** Resolve the primary type for filing. */
export function primaryTypeOf(contact) {
  if (contact.primaryType && CONTACT_TYPES.includes(contact.primaryType)) return contact.primaryType;
  const types = (contact.types && contact.types.length ? contact.types : [contact.type]).filter(Boolean);
  for (const t of PRIORITY) if (types.includes(t)) return t;
  return types[0] || 'Other';
}

/** Map a primary type to its folder. */
export function folderForType(primaryType) {
  if (primaryType === 'Builder' || primaryType === 'Developer') return FOLDERS.buildersDevelopers;
  if (primaryType === 'Landowner') return FOLDERS.landowners;
  if (primaryType === 'Investor') return FOLDERS.investors;
  return FOLDERS.servicePartners;
}

/** Which template family renders a given primary type. */
export function templateForType(primaryType) {
  if (primaryType === 'Builder' || primaryType === 'Developer') return 'builder';
  if (primaryType === 'Landowner') return 'landowner';
  if (primaryType === 'Investor') return 'investor';
  return 'partner';
}

function slugPart(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Build the mandated filename: first-name-last-name-company.md, or
 * first-name-last-name-location.md when no company exists.
 */
export function fileNameFor(contact) {
  const name = slugPart(contact.name);
  const tail = slugPart(contact.company) || slugPart(contact.location) || slugPart(contact.propertyAddress) || 'contact';
  const base = [name, tail].filter(Boolean).join('-') || 'unknown-contact';
  return `${base}.md`;
}

/** Full relative path (folder + filename) where this contact files. */
export function pathForContact(contact) {
  const primary = primaryTypeOf(contact);
  return `${folderForType(primary)}/${fileNameFor(contact)}`;
}
