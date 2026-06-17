/**
 * Render Markdown contracts to a self-contained, printable HTML document.
 *
 * Kept dependency-free on purpose: the HTML opens in any browser and "Print to
 * PDF" produces the executable instrument, so no native PDF library (puppeteer /
 * pdfkit) is required to run the generators in a constrained environment. Swap in
 * a PDF renderer later if you want server-side PDF bytes.
 */

/** Minimal, safe Markdown-subset -> HTML (headings, bold, hr, lists, paragraphs). */
export function markdownToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const lines = md.split('\n');
  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^#\s+/.test(line)) { closeList(); out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`); }
    else if (/^##\s+/.test(line)) { closeList(); out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`); }
    else if (/^---\s*$/.test(line)) { closeList(); out.push('<hr>'); }
    else if (/^[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      closeList();
      out.push(`<p class="numbered">${inline(line)}</p>`);
    } else if (line.trim() === '') { closeList(); }
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  return out.join('\n');
}

export function renderHtml(markdown, title = 'Manley Systems LLC — Instrument') {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 7.5in; margin: 1in auto; color: #111; line-height: 1.5; }
  h1 { font-size: 18pt; border-bottom: 2px solid #111; padding-bottom: 6px; }
  h2 { font-size: 13pt; margin-top: 1.4em; }
  hr { border: none; border-top: 1px solid #999; margin: 1.2em 0; }
  ul { margin: 0.4em 0 0.8em 1.2em; }
  .numbered { margin: 0.2em 0 0.2em 1em; }
  @media print { body { margin: 0.75in; } }
</style></head>
<body>
${markdownToHtml(markdown)}
</body></html>`;
}
