import type { Conflict, Verdict, VerdictStatus } from './types';

const ISSUE_KEY_RE = /^[A-Z][A-Z0-9_]*-[1-9]\d*$/;
const DECISION_ID_RE = /^DEC-\d+$/;
const PLAIN_CONFLICT_RE = /^\s*(DEC-\d+)\s*[:\-–]\s*(.+)$/i;
const MAX_REASON = 500;
const MAX_CONFLICTS = 20;

function normaliseKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toUpperCase();
  return ISSUE_KEY_RE.test(key) ? key : null;
}

/**
 * Picks the issue key to act on. The Rovo context is deterministic, so it wins.
 * The LLM-generated input is only a fallback and must look like a real key.
 */
export function resolveIssueKey(inputKey: unknown, contextKey: unknown): string | null {
  return normaliseKey(contextKey) ?? normaliseKey(inputKey);
}

function toConflict(decisionId: unknown, reason: unknown): Conflict | null {
  if (typeof decisionId !== 'string' || typeof reason !== 'string') return null;
  const id = decisionId.trim().toUpperCase();
  const text = reason.trim().slice(0, MAX_REASON);
  if (!DECISION_ID_RE.test(id) || text.length === 0) return null;
  return { decisionId: id, reason: text };
}

/**
 * Parses the agent's `conflicts` input. Accepts a JSON array of
 * { decisionId, reason } or the plain-text form "DEC-7: reason; DEC-3: reason".
 */
export function parseConflicts(raw: unknown): Conflict[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  const text = raw.trim();

  let candidates: Array<Conflict | null> = [];
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) {
        candidates = parsed.map((item) =>
          item && typeof item === 'object'
            ? toConflict((item as Record<string, unknown>).decisionId, (item as Record<string, unknown>).reason)
            : null,
        );
      }
    } catch {
      // Not valid JSON: fall through to the plain-text parser.
    }
  }

  if (candidates.length === 0) {
    candidates = text.split(/[;\n]/).map((segment) => {
      const match = PLAIN_CONFLICT_RE.exec(segment);
      return match ? toConflict(match[1], match[2]) : null;
    });
  }

  return candidates.filter((c): c is Conflict => c !== null).slice(0, MAX_CONFLICTS);
}

export type BuildVerdictResult = { ok: true; verdict: Verdict } | { ok: false; error: string };

/**
 * Turns the agent's raw inputs into a verdict. New verdicts always start unacknowledged.
 * When `knownIds` is given, conflicts citing decisions outside the register are dropped,
 * so a hallucinated decision id can never block a transition.
 */
export function buildVerdict(
  input: { status: unknown; conflicts?: unknown },
  now: Date,
  knownIds?: ReadonlySet<string>,
): BuildVerdictResult {
  const status = typeof input.status === 'string' ? input.status.trim().toLowerCase() : '';
  if (status !== 'clear' && status !== 'conflict') {
    return { ok: false, error: 'status must be "clear" or "conflict"' };
  }

  const parsed = status === 'conflict' ? parseConflicts(input.conflicts) : [];
  const conflicts = knownIds ? parsed.filter((c) => knownIds.has(c.decisionId)) : parsed;
  if (status === 'conflict' && conflicts.length === 0) {
    return {
      ok: false,
      error: 'a conflict verdict needs at least one conflict, e.g. "DEC-7: reason"',
    };
  }

  return {
    ok: true,
    verdict: {
      checkedAt: now.toISOString(),
      status: status as VerdictStatus,
      conflicts,
      acknowledged: false,
      acknowledgedBy: null,
    },
  };
}
