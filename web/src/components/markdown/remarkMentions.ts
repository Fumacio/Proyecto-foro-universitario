/**
 * Plugin de remark que convierte `@usuario` en links a `/u/usuario`.
 * No toca código (inline o en bloque) ni texto que ya esté dentro de un link.
 */
interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: { hProperties?: Record<string, unknown> };
}

const MENTION = /(^|[^\w@/.])@([a-zA-Z0-9_]{3,20})(?![\w@])/g;
const SKIP = new Set(['link', 'linkReference', 'code', 'inlineCode', 'definition', 'html']);

function splitText(value: string): MdNode[] | null {
  MENTION.lastIndex = 0;
  if (!MENTION.test(value)) return null;
  MENTION.lastIndex = 0;
  const out: MdNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION.exec(value))) {
    const start = m.index + m[1].length;
    if (start > last) out.push({ type: 'text', value: value.slice(last, start) });
    const username = m[2];
    out.push({
      type: 'link',
      url: `/u/${username}`,
      data: { hProperties: { className: 'mention' } },
      children: [{ type: 'text', value: `@${username}` }],
    });
    last = start + username.length + 1;
  }
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

function walk(node: MdNode) {
  if (!node.children || SKIP.has(node.type)) return;
  const next: MdNode[] = [];
  let changed = false;
  for (const child of node.children) {
    if (child.type === 'text' && child.value) {
      const parts = splitText(child.value);
      if (parts) {
        next.push(...parts);
        changed = true;
        continue;
      }
    } else {
      walk(child);
    }
    next.push(child);
  }
  if (changed) node.children = next;
}

export default function remarkMentions() {
  return (tree: unknown) => walk(tree as MdNode);
}

/** Extrae los usernames mencionados (para previsualizaciones, tests, etc.). */
export function extractMentions(text: string) {
  const found = new Set<string>();
  MENTION.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION.exec(text))) found.add(m[2].toLowerCase());
  return [...found];
}
