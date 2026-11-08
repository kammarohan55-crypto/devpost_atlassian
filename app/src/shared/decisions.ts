import type { Decision } from './types';

/**
 * Spike-only demo data for the fictional company "Acme Payments".
 * Real decisions move to Forge storage after the week-1 spikes.
 */
export const SEED_DECISIONS: Decision[] = [
  {
    id: 'DEC-3',
    title: 'Public APIs use REST and JSON',
    statement: 'Every external API is REST over HTTPS with JSON bodies and OpenAPI specs.',
    rationale: 'Partners integrate with plain HTTP tooling; one style keeps docs and SDKs simple.',
    rejectedAlternatives: ['GraphQL for the public API', 'gRPC for partners'],
    status: 'Active',
    tags: ['api', 'rest', 'graphql', 'grpc', 'partners'],
  },
  {
    id: 'DEC-5',
    title: 'Deploy only through the CI pipeline',
    statement: 'Production changes ship only through the CI/CD pipeline with a green build.',
    rationale: 'Audit trail for PCI and fewer late-night hotfix accidents.',
    rejectedAlternatives: ['Manual deploys from laptops', 'Hotfixes over SSH'],
    status: 'Active',
    tags: ['deploy', 'deployment', 'ci', 'pipeline', 'release', 'hotfix'],
  },
  {
    id: 'DEC-7',
    title: 'Stay on PostgreSQL',
    statement: 'All services store their data in PostgreSQL. No new database engines.',
    rationale: 'One engine to run, back up and secure; the team knows it deeply.',
    rejectedAlternatives: ['MongoDB', 'DynamoDB'],
    status: 'Active',
    tags: ['database', 'postgresql', 'postgres', 'mongodb', 'dynamodb', 'storage', 'nosql'],
  },
  {
    id: 'DEC-9',
    title: 'Card numbers are tokenised at the edge',
    statement: 'Raw card numbers never reach internal services; only vault tokens are stored.',
    rationale: 'Keeps most services out of PCI scope.',
    rejectedAlternatives: ['Storing encrypted card numbers in service databases'],
    status: 'Active',
    tags: ['pci', 'security', 'cards', 'payments', 'tokenisation', 'tokenization'],
  },
  {
    id: 'DEC-2',
    title: 'Ship logs to a hosted log service',
    statement: 'Services send logs to a hosted log SaaS.',
    rationale: 'Fast to adopt in 2023.',
    rejectedAlternatives: [],
    status: 'Superseded',
    tags: ['logging', 'logs', 'observability'],
  },
];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'our', 'are', 'was', 'were',
  'should', 'would', 'could', 'can', 'will', 'what', 'have', 'has', 'had', 'not', 'but',
  'all', 'any', 'use', 'using', 'about', 'than', 'then', 'them', 'they', 'you', 'your',
]);

function tokenize(text: string): string[] {
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  return [...new Set(words.filter((w) => w.length >= 3 && !STOP_WORDS.has(w)))];
}

function score(decision: Decision, tokens: string[]): number {
  const tags = new Set(decision.tags.map((t) => t.toLowerCase()));
  const title = new Set(tokenize(decision.title));
  const body = new Set(
    tokenize([decision.statement, decision.rationale, ...decision.rejectedAlternatives].join(' ')),
  );
  let total = 0;
  for (const token of tokens) {
    if (tags.has(token)) total += 3;
    if (title.has(token)) total += 2;
    if (body.has(token)) total += 1;
  }
  return total;
}

/** Keyword search over decisions (any status), best match first. No AI. */
export function searchDecisions(query: string, decisions: Decision[], limit = 5): Decision[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return decisions
    .map((decision) => ({ decision, score: score(decision, tokens) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => hit.decision);
}

/** Instant shortlist for a piece of work: only Active decisions can be contradicted. */
export function shortlistForText(text: string, decisions: Decision[], limit = 5): Decision[] {
  return searchDecisions(
    text,
    decisions.filter((d) => d.status === 'Active'),
    limit,
  );
}
