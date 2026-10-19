// Small text helpers shared by ingest and the app.

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™',
  eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç', ouml: 'ö', uuml: 'ü', auml: 'ä',
  amacr: 'ā', emacr: 'ē', imacr: 'ī', omacr: 'ō', umacr: 'ū', Amacr: 'Ā', Emacr: 'Ē', Imacr: 'Ī', Omacr: 'Ō', Umacr: 'Ū',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML (or Markdown-ish) to readable plain text with paragraph breaks and bullets. */
export function htmlToText(html: string): string {
  if (!html) return '';
  // Some APIs (Greenhouse) send entity-escaped HTML: decode once before stripping tags.
  if (!/<[a-z!/]/i.test(html) && /&lt;[a-z!/]/i.test(html)) html = decodeEntities(html);
  let s = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/\s*(p|div|h[1-6]|ul|ol|li|tr|section|article|header|footer|blockquote)\s*>/gi, '\n')
    .replace(/<\s*(p|div|h[1-6]|ul|ol|tr|section|article|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  // Markdown emphasis / headings used by some sources (e.g. Trade Me ExtendedBody).
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^\s*[*-]\s+/gm, '• ');
  s = s
    .replace(/\r/g, '')
    .replace(/[ \t ​]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}

export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, '') + '…';
}

/** Lowercase, strip diacritics (macrons included), unify quotes, collapse spaces. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fold + keep only letters/digits/spaces. */
export function slugText(s: string): string {
  return fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
}

export function titleCase(s: string): string {
  return s.replace(/\b([a-z])([a-z']*)/g, (_, a: string, b: string) => a.toUpperCase() + b);
}

/** Stable short hash (FNV-1a 64 via two 32-bit lanes), hex. */
export function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) ^ (h2 >>> 15);
  }
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')).slice(0, 16);
}
