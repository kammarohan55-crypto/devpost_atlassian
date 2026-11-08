import { describe, expect, it } from 'vitest';
import { SEED_DECISIONS, searchDecisions, shortlistForText } from './decisions';
import type { Decision } from './types';

const sample: Decision[] = [
  {
    id: 'DEC-7',
    title: 'Stay on PostgreSQL',
    statement: 'All services store relational data in PostgreSQL.',
    rationale: 'One operational database.',
    rejectedAlternatives: ['MongoDB'],
    status: 'Active',
    tags: ['database', 'postgresql', 'mongodb'],
  },
  {
    id: 'DEC-2',
    title: 'Old logging choice',
    statement: 'Use Loggly for logs.',
    rationale: 'Cheap at the time.',
    rejectedAlternatives: [],
    status: 'Superseded',
    tags: ['logging'],
  },
];

describe('searchDecisions', () => {
  it('ranks decisions by tag, title and text matches', () => {
    const hits = searchDecisions('Should we move to MongoDB?', sample);
    expect(hits.map((d) => d.id)).toEqual(['DEC-7']);
  });

  it('ignores stop words and very short tokens', () => {
    expect(searchDecisions('the a to of', sample)).toEqual([]);
  });

  it('includes non-active decisions in plain search', () => {
    expect(searchDecisions('logging', sample).map((d) => d.id)).toEqual(['DEC-2']);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...sample[0], id: `DEC-${i + 10}` }));
    expect(searchDecisions('database', many, 3)).toHaveLength(3);
  });
});

describe('shortlistForText', () => {
  it('returns only active decisions', () => {
    expect(shortlistForText('migrate logging and database', sample).map((d) => d.id)).toEqual([
      'DEC-7',
    ]);
  });
});

describe('SEED_DECISIONS', () => {
  it('contains the headline demo decision DEC-7', () => {
    const dec7 = SEED_DECISIONS.find((d) => d.id === 'DEC-7');
    expect(dec7?.rejectedAlternatives).toContain('MongoDB');
  });
});
