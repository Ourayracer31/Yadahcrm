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

// Map loose/lowercase type strings (e.g. operator memory uses "builder", "title")
// onto the canonical CONTACT_TYPES, so filing is case- and synonym-insensitive.
const SYNONYMS = {
  builder: 'Builder', developer: 'Developer', landowner: 'Landowner', investor: 'Investor',
  engineer: 'Engineer', surveyor: 'Surveyor',
  title: 'Title Company', 'title company': 'Title Company',
  attorney: 'Attorney', lawyer: 'Attorney',
  banker: 'Banker/Lender', lender: 'Banker/Lender', 'banker/lender': 'Banker/Lender',
  city: 'City/County Contact', county: 'City/County Contact', 'city/county contact': 'City/County Contact',
  broker: 'Broker', other: 'Other',
};

/** Normalize any type string to a canonical CONTACT_TYPE. */
export function canonicalType(t) {
  if (!t) return null;
  const exact = CONTACT_TYPES.find((c) => c.toLowerCase() === String(t).toLowerCase());
  if (exact) return exact;
  return SYNONYMS[String(t).toLowerCase().trim()] || null;
}

/** Resolve the primary type for filing (case/synonym-insensitive). */
export function primaryTypeOf(contact) {
  const canonPrimary = canonicalType(contact.primaryType);
  if (canonPrimary) return canonPrimary;
  const types = (contact.types && contact.types.length ? contact.types : [contact.type])
    .map(canonicalType)
    .filter(Boolean);
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
