// Atlassian Document Format (ADF) to plain text, for feeding issue
// descriptions to the agent and the keyword matcher.

const BLOCK_CONTAINERS = new Set([
  'doc', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'panel',
  'table', 'tableRow', 'tableCell', 'tableHeader', 'expand', 'layoutSection', 'layoutColumn',
]);

interface AdfNode {
  type?: unknown;
  text?: unknown;
  content?: unknown;
}

function walk(node: AdfNode): string {
  if (node.type === 'text') return typeof node.text === 'string' ? node.text : '';
  if (node.type === 'hardBreak') return '\n';
  const children = Array.isArray(node.content)
    ? node.content.filter((c): c is AdfNode => !!c && typeof c === 'object').map(walk)
    : [];
  const separator = typeof node.type === 'string' && BLOCK_CONTAINERS.has(node.type) ? '\n' : '';
  return children.join(separator);
}

export function adfToText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return walk(value as AdfNode).trim();
}
