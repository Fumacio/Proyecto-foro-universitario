/** Convierte markdown en texto plano (para extractos y notificaciones). */
export function stripMarkdown(md: string): string {
  let s = md.replace(/\r\n?/g, '\n');
  s = s.replace(/(```|~~~)[\s\S]*?(?:\1|$)/g, ' '); // bloques de código (también sin cerrar)
  s = s.replace(/`([^`\n]*)`/g, '$1'); // código inline → texto
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, ' '); // imágenes
  s = s.replace(/!\[([^\]]*)\]\[[^\]]*\]/g, ' ');
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // links → texto
  s = s.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  s = s.replace(/^\s{0,3}\[[^\]]+\]:\s*\S+.*$/gm, ' '); // definiciones de links
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, ' '); // HTML
  s = s.replace(/^\s{0,3}#{1,6}\s*/gm, ''); // títulos
  s = s.replace(/^\s{0,3}(?:>\s?)+/gm, ''); // citas
  s = s.replace(/^\s*(?:[-*_]\s*){3,}$/gm, ' '); // separadores
  s = s.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, ''); // tareas
  s = s.replace(/^\s*[-*+]\s+/gm, ''); // viñetas
  s = s.replace(/^\s*\d+[.)]\s+/gm, ''); // listas numeradas
  s = s.replace(/^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-*:?\s*\|?\s*$/gm, ' '); // separador de tablas
  s = s.replace(/\|/g, ' ');
  s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2'); // negrita
  s = s.replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, '$1$2'); // itálica *x*
  s = s.replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, '$1$2'); // itálica _x_
  s = s.replace(/~~([\s\S]*?)~~/g, '$1'); // tachado
  s = s.replace(/[*~]+/g, '');
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1'); // escapes
  return s.replace(/\s+/g, ' ').trim();
}

/** Texto plano truncado (por defecto ≤ 280 caracteres incluyendo "…"). */
export function excerpt(md: string, max = 280): string {
  const plain = stripMarkdown(md);
  if (plain.length <= max) return plain;
  let cut = plain.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
  return `${cut.replace(/[\s.,;:!?¿¡-]+$/u, '')}…`;
}

/** "Análisis Matemático I" → "analisis-matematico-i" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const MENTION_RE = /(^|[^\w@/.])@([a-zA-Z0-9_]{3,20})(?![\w])/g;

/** Usernames mencionados con `@usuario` (en minúsculas, únicos, ignora código). */
export function extractMentions(md: string, max = 10): string[] {
  const text = md
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_RE)) {
    const name = match[2];
    if (!name) continue;
    found.add(name.toLowerCase());
    if (found.size >= max) break;
  }
  return [...found];
}

/** sign(score)*log10(max(|score|,1)) + createdAtEpochSec/45000 */
export function hotScore(score: number, createdAt: Date): number {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  return sign * order + createdAt.getTime() / 1000 / 45000;
}
