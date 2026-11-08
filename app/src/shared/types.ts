// Shared types. Keep this file free of backend-only (@forge/api) and
// frontend-only (@forge/bridge) imports so both sides can use it.

export type DecisionStatus = 'Proposed' | 'Active' | 'Superseded' | 'Revoked';

export interface Decision {
  id: string; // DEC-n
  title: string;
  statement: string;
  rationale: string;
  rejectedAlternatives: string[];
  status: DecisionStatus;
  tags: string[];
}

export interface Conflict {
  decisionId: string;
  reason: string;
}

export type VerdictStatus = 'clear' | 'conflict';

/** Stored in the Jira issue property `precedent-verdict`. */
export interface Verdict {
  checkedAt: string; // ISO timestamp
  status: VerdictStatus;
  conflicts: Conflict[];
  acknowledged: boolean;
  acknowledgedBy: string | null; // accountId
}

export const VERDICT_PROPERTY_KEY = 'precedent-verdict';
export const AGENT_KEY = 'precedent-agent';
export const AGENT_NAME = 'Precedent';
