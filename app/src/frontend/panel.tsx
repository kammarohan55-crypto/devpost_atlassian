// Jira issue panel (UI Kit). Shows the stored verdict for this issue and a
// "Deep check" button that opens the Precedent agent in Rovo chat.
// Without Rovo on the site, the button is replaced by a notice and the
// verdict view keeps working.

import React, { useCallback, useEffect, useState } from 'react';
import ForgeReconciler, {
  Button,
  Heading,
  Inline,
  List,
  ListItem,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  useProductContext,
} from '@forge/react';
import { requestJira, rovo } from '@forge/bridge';
import { AGENT_KEY, AGENT_NAME, VERDICT_PROPERTY_KEY, type Verdict } from '../shared/types';

type VerdictState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'ready'; verdict: Verdict }
  | { kind: 'error'; message: string };

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

const VerdictView = ({ state }: { state: VerdictState }) => {
  if (state.kind === 'loading') return <Spinner label="Loading verdict" />;
  if (state.kind === 'none') return <Text>Not checked yet.</Text>;
  if (state.kind === 'error') {
    return (
      <SectionMessage appearance="error">
        <Text>{state.message}</Text>
      </SectionMessage>
    );
  }

  const { verdict } = state;
  const isConflict = verdict.status === 'conflict';
  return (
    <Stack space="space.100">
      <Inline space="space.100" alignBlock="center">
        <Lozenge appearance={isConflict ? 'removed' : 'success'}>
          {isConflict ? 'Conflict' : 'Clear'}
        </Lozenge>
        {isConflict && verdict.acknowledged ? <Lozenge appearance="moved">Acknowledged</Lozenge> : null}
        <Text size="small" color="color.text.subtle">
          {`Checked ${formatDate(verdict.checkedAt)}`}
        </Text>
      </Inline>
      {verdict.conflicts.length > 0 ? (
        <List type="unordered">
          {verdict.conflicts.map((c) => (
            <ListItem key={c.decisionId}>{`${c.decisionId}: ${c.reason}`}</ListItem>
          ))}
        </List>
      ) : null}
    </Stack>
  );
};

const App = () => {
  const context = useProductContext();
  const issueKey: string | undefined = context?.extension?.issue?.key;
  const [verdict, setVerdict] = useState<VerdictState>({ kind: 'loading' });
  const [rovoEnabled, setRovoEnabled] = useState<boolean | null>(null);

  const loadVerdict = useCallback(async () => {
    if (!issueKey) return;
    setVerdict({ kind: 'loading' });
    try {
      const res = await requestJira(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}/properties/${VERDICT_PROPERTY_KEY}`,
        { headers: { Accept: 'application/json' } },
      );
      if (res.status === 404) {
        setVerdict({ kind: 'none' });
        return;
      }
      if (!res.ok) {
        setVerdict({ kind: 'error', message: `Jira returned HTTP ${res.status} while reading the verdict.` });
        return;
      }
      const body = await res.json();
      setVerdict({ kind: 'ready', verdict: body.value as Verdict });
    } catch {
      setVerdict({ kind: 'error', message: 'Could not read the verdict for this issue.' });
    }
  }, [issueKey]);

  useEffect(() => {
    void loadVerdict();
  }, [loadVerdict]);

  useEffect(() => {
    rovo
      .isEnabled()
      .then(setRovoEnabled)
      .catch(() => setRovoEnabled(false));
  }, []);

  const openDeepCheck = async () => {
    await rovo.open({
      type: 'forge',
      agentKey: AGENT_KEY,
      agentName: AGENT_NAME,
      prompt: `Deep check ${issueKey} against our team's decisions, then save the verdict.`,
    });
  };

  if (!issueKey) return <Spinner label="Loading issue" />;

  return (
    <Stack space="space.200">
      <Heading size="xsmall">Decision check</Heading>
      <VerdictView state={verdict} />
      {rovoEnabled === false ? (
        <SectionMessage appearance="information" title="Rovo is off on this site">
          <Text>Deep check needs Rovo. The stored verdict still shows here.</Text>
        </SectionMessage>
      ) : null}
      <Inline space="space.100">
        {rovoEnabled ? (
          <Button appearance="rovo" onClick={openDeepCheck}>
            Deep check
          </Button>
        ) : null}
        <Button appearance="subtle" onClick={() => void loadVerdict()}>
          Refresh
        </Button>
      </Inline>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
