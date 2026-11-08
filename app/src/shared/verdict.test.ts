import { describe, expect, it } from 'vitest';
import { buildVerdict, parseConflicts, resolveIssueKey } from './verdict';

describe('resolveIssueKey', () => {
  it('prefers the issue key from the Rovo context over the LLM input', () => {
    expect(resolveIssueKey('ACME-99', 'ACME-7')).toBe('ACME-7');
  });

  it('falls back to a valid input key, normalised to upper case', () => {
    expect(resolveIssueKey(' acme-12 ', undefined)).toBe('ACME-12');
  });

  it('rejects malformed keys', () => {
    expect(resolveIssueKey('not a key', undefined)).toBeNull();
    expect(resolveIssueKey('ACME-12/../../x', undefined)).toBeNull();
    expect(resolveIssueKey(undefined, 42)).toBeNull();
  });
});

describe('parseConflicts', () => {
  it('parses a JSON array of conflicts', () => {
    const raw = '[{"decisionId":"DEC-7","reason":"Proposes MongoDB, which DEC-7 rejected."}]';
    expect(parseConflicts(raw)).toEqual([
      { decisionId: 'DEC-7', reason: 'Proposes MongoDB, which DEC-7 rejected.' },
    ]);
  });

  it('parses the plain-text fallback "DEC-n: reason; DEC-m: reason"', () => {
    expect(parseConflicts('DEC-7: uses MongoDB; dec-3: adds GraphQL')).toEqual([
      { decisionId: 'DEC-7', reason: 'uses MongoDB' },
      { decisionId: 'DEC-3', reason: 'adds GraphQL' },
    ]);
  });

  it('drops entries without a valid decision id and caps reason length', () => {
    const long = 'x'.repeat(900);
    const raw = JSON.stringify([
      { decisionId: 'banana', reason: 'nope' },
      { decisionId: 'DEC-1', reason: long },
    ]);
    const parsed = parseConflicts(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].reason.length).toBe(500);
  });

  it('returns an empty list for empty or missing input', () => {
    expect(parseConflicts(undefined)).toEqual([]);
    expect(parseConflicts('')).toEqual([]);
  });
});

describe('buildVerdict', () => {
  const now = new Date('2026-11-08T10:00:00.000Z');

  it('builds a conflict verdict that starts unacknowledged', () => {
    const result = buildVerdict({ status: 'Conflict', conflicts: 'DEC-7: uses MongoDB' }, now);
    expect(result).toEqual({
      ok: true,
      verdict: {
        checkedAt: '2026-11-08T10:00:00.000Z',
        status: 'conflict',
        conflicts: [{ decisionId: 'DEC-7', reason: 'uses MongoDB' }],
        acknowledged: false,
        acknowledgedBy: null,
      },
    });
  });

  it('clears conflicts when the status is clear', () => {
    const result = buildVerdict({ status: 'clear', conflicts: 'DEC-7: ignored' }, now);
    expect(result.ok && result.verdict.conflicts).toEqual([]);
  });

  it('rejects an unknown status', () => {
    expect(buildVerdict({ status: 'maybe' }, now)).toEqual({
      ok: false,
      error: 'status must be "clear" or "conflict"',
    });
  });

  it('rejects a conflict verdict with no valid conflicts', () => {
    expect(buildVerdict({ status: 'conflict', conflicts: '' }, now).ok).toBe(false);
  });

  it('drops decision ids the register does not know (hallucinated ids)', () => {
    const known = new Set(['DEC-7']);
    const result = buildVerdict(
      { status: 'conflict', conflicts: 'DEC-7: uses MongoDB; DEC-404: made up' },
      now,
      known,
    );
    expect(result.ok && result.verdict.conflicts.map((c) => c.decisionId)).toEqual(['DEC-7']);
  });

  it('fails when every conflict id is unknown', () => {
    const result = buildVerdict({ status: 'conflict', conflicts: 'DEC-404: made up' }, now, new Set(['DEC-7']));
    expect(result.ok).toBe(false);
  });
});
