// Backend handlers for the Rovo actions. Each export is wired to a `function`
// module in manifest.yml and receives the action inputs in `payload`.
//
// Security: inputs are written by an LLM, so they are never trusted for
// authorisation. Every Jira call runs asUser(), which means Jira itself checks
// that the person chatting with the agent may read or edit the issue.

import api, { route } from '@forge/api';
import { adfToText } from './shared/adf';
import { SEED_DECISIONS, searchDecisions as findDecisions, shortlistForText } from './shared/decisions';
import { buildVerdict, resolveIssueKey } from './shared/verdict';
import { VERDICT_PROPERTY_KEY, type Decision } from './shared/types';

interface ActionPayload {
  [input: string]: unknown;
  context?: {
    cloudId?: string;
    jira?: { issueKey?: unknown; issueId?: unknown; projectKey?: unknown };
  };
}

const KNOWN_DECISION_IDS = new Set(SEED_DECISIONS.map((d) => d.id));

function toSummary(d: Decision) {
  return {
    id: d.id,
    title: d.title,
    statement: d.statement,
    rejectedAlternatives: d.rejectedAlternatives,
    status: d.status,
  };
}

function issueKeyFrom(payload: ActionPayload): string | null {
  return resolveIssueKey(payload.issueKey, payload.context?.jira?.issueKey);
}

/** GET action `search-decisions`: keyword search over the decision register. */
export async function searchDecisions(payload: ActionPayload) {
  const query = typeof payload.query === 'string' ? payload.query.slice(0, 500) : '';
  const hits = findDecisions(query, SEED_DECISIONS);
  return { query, count: hits.length, decisions: hits.map(toSummary) };
}

/** GET action `check-change`: reads a work item and shortlists decisions it might contradict. */
export async function checkChange(payload: ActionPayload) {
  // Spike evidence: record what the Rovo context really contains (issue/project ids only).
  console.log('check-change context.jira', JSON.stringify(payload.context?.jira ?? null));

  const issueKey = issueKeyFrom(payload);
  if (!issueKey) {
    return { error: 'No valid issue key. Ask the user which work item to check, for example ACME-12.' };
  }

  const res = await api
    .asUser()
    .requestJira(route`/rest/api/3/issue/${issueKey}?fields=summary,description,labels`, {
      headers: { Accept: 'application/json' },
    });
  if (!res.ok) {
    return { error: `Could not read ${issueKey} (HTTP ${res.status}). The user may not have access.` };
  }

  const issue = await res.json();
  const summary = String(issue?.fields?.summary ?? '');
  const description = adfToText(issue?.fields?.description).slice(0, 4000);
  const labels: string[] = Array.isArray(issue?.fields?.labels) ? issue.fields.labels : [];
  const candidates = shortlistForText(`${summary} ${description} ${labels.join(' ')}`, SEED_DECISIONS);

  return {
    issueKey,
    summary,
    description,
    labels,
    candidates: candidates.map(toSummary),
    note:
      candidates.length === 0
        ? 'No active decision matched this work item, so the verdict is most likely clear.'
        : 'Judge each candidate: conflicts, related or unrelated.',
  };
}

/** UPDATE action `save-verdict`: stores the agent's verdict in the issue property. */
export async function saveVerdict(payload: ActionPayload) {
  const issueKey = issueKeyFrom(payload);
  if (!issueKey) {
    return { saved: false, error: 'No valid issue key. Ask the user which work item this verdict is for.' };
  }

  const built = buildVerdict(
    { status: payload.status, conflicts: payload.conflicts },
    new Date(),
    KNOWN_DECISION_IDS,
  );
  if (!built.ok) {
    return { saved: false, error: built.error };
  }

  const res = await api
    .asUser()
    .requestJira(route`/rest/api/3/issue/${issueKey}/properties/${VERDICT_PROPERTY_KEY}`, {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(built.verdict),
    });
  if (!res.ok) {
    return { saved: false, error: `Jira refused the update for ${issueKey} (HTTP ${res.status}).` };
  }

  console.log(`save-verdict stored ${built.verdict.status} on ${issueKey}`);
  return { saved: true, issueKey, verdict: built.verdict };
}
