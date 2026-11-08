# Precedent: build guide for Claude Code

Read this first in every session. The full hackathon context (rules, judging, links) is in
`CODEGEIST_2026_CONTEXT.md`, which is gitignored. Read it only when you need a rule, date or link.
The living plan is the Claude Doc "Codegeist 2026 — Win Plan":
https://claude.ai/artifact/RstJXvkj5tdUoCEwgHSbTm

## What we're building

**Precedent** is a Forge app that remembers what a team has already decided. It flags new work
that contradicts a past decision: in Jira, in Rovo chat, and in AI coding agents over MCP.

- Pitch: "Your team's decisions as guardrails, for people *and* AI coding agents."
- Hackathon: Atlassian **Codegeist 2026** (Devpost). Category: **Apps for Software Teams**.
- Bonus targets: **MCP** (main), **Rovo Agents**, **Teamwork Graph**. We skip the Marketplace bonus.
- Deadline: 22 Dec 2026, 12:00 PT (23 Dec, 01:30 IST). Internal submit date: **19 Dec**.
- Owner: Rohan (RVCE student). He prefers direct, complete execution and clean, fast-to-scan output.

## Hard rules

1. **$0 budget.** Never add the Forge `llm` module (Forge LLMs bill from the first token) or any paid
   API. All AI reasoning happens in our **Rovo agent** on the site's own Rovo.
2. **No external egress** unless Rohan agrees. All data stays on Atlassian.
3. **Secrets:** `.env` is gitignored. Never print, log or commit tokens. The repo is **public**.
4. **Private notes** (strategy, spike notes) go in `notes/` or `CODEGEIST_2026_CONTEXT.md`. Both are gitignored.
5. **Teamwork Graph:**
   - Use only `api.asUser().requestTeamworkGraph()` (backend) or the `requestTeamworkGraph` bridge (frontend).
   - Declare one scope per object type, e.g. `read:graph:issue:jira`. A missing scope returns
     **empty results, not an error**.
   - Check both `data` and `errors`; HTTP 200 can carry an error.
   - Operation names follow `company_operation` (e.g. `precedent_teamMembers`).
   - Pages hold 25 rows. Back off on rate limits.
6. **Rovo actions:**
   - Inputs are LLM-generated, so never trust them for authorisation. Take the user from `context`.
   - Keep replies under 1 MB and under about 5 s. Heavy work goes to async events.
   - Agents run from **automation** won't call CREATE, UPDATE, DELETE or TRIGGER actions. There, use
     `{{agentResponse}}` in later rule steps instead.
7. **Scope or permission changes** are a major version: run `forge deploy`, then `forge install --upgrade`.
8. **Judge-proof:**
   - Every feature must work after a fresh install from the share link on a *different* site.
   - Without Rovo enabled (`rovo.isEnabled()` is false), the non-AI features must still work, with a clear notice.

## Architecture (MVP)

| Piece | Key | Purpose |
| --- | --- | --- |
| `action` (GET) | `search-decisions`, `check-change`, `get-decision` | Read decisions; shortlist candidates for a change or issue |
| `action` (CREATE) | `propose-decision` | Agent or MCP client proposes a decision (status Proposed) |
| `action` (UPDATE) | `save-verdict` | Agent stores its conflict verdict on an issue |
| `rovo:agent` | `precedent-agent` | The AI brain: extraction and conflict reasoning |
| `rovo:skill` | `decision-review` | Playbook: how to judge conflicts and write decisions (ADR style) |
| `rovo:mcp` | `precedent-mcp` | Exposes the search, check, get and propose actions to Claude Code, Cursor, Rovo Dev and Rovo Studio |
| `jira:issuePanel` (UI Kit) | `precedent-panel` | Instant related decisions (no AI) plus a **Deep check** button (`rovo.open`) |
| `jira:globalPage` (UI Kit) | `precedent-register` | Register, review inbox, **Scan space** button |
| `jira:workflowValidator` (Jira expression) | `precedent-guardrail` | Blocks *Start work* while the verdict shows an unacknowledged conflict |
| `trigger` | issue created | Precompute related decisions |
| Forge SQL | `decisions`, `decision_links`, `verdict_cache` | Storage |

**Decision record:**

- `id` (DEC-n), `title`, `statement`, `rationale`, `rejected_alternatives`
- `status` (Proposed, Active, Superseded, Revoked)
- `owner_account_id`, `team_ari`, `decided_on`, `review_by`
- `tags`, `source_urls`, `supersedes_id`, `created_by` (human or AI), `confidence`

**Verdict:** stored in issue property `precedent-verdict` as
`{ checkedAt, status: "clear" | "conflict", conflicts: [{ decisionId, reason }], acknowledged, acknowledgedBy }`.

**Conflict check:**

1. **Instant shortlist, no AI:** tags, keywords and Teamwork Graph neighbours (same team, project or goal).
2. **Deep check:** the Rovo agent labels each candidate conflicts, related or unrelated, then calls `save-verdict`.
3. **Enforce:** the panel and the validator read the stored verdict.

Confluence access (multi-app optional Confluence vs. REST vs. Teamwork Graph) is decided by spike 2 below.

## Repo layout

| Path | Contents |
| --- | --- |
| `app/` | The Forge app root (`manifest.yml`, `package.json`, `src/`, `static/`). **Run every `forge` command from here.** |
| `skills/` | Open-source `skill.md` for third-party agents using our MCP server |
| `scripts/` | Seed demo data, helpers |
| `docs/` | Judge setup guide, architecture notes (public) |
| `notes/` | Private notes (gitignored) |

## Workflow

- **Daily loop:** `forge deploy`, `forge install --demo-site` (first time) or `forge install --upgrade`,
  then `forge logs`. Use `forge tunnel` for fast UI iteration.
- **Environments:** `development` day to day. `production` only for the judge build, from December.
- **Tests:** Vitest for pure logic (matching, verdict parsing, scoring). Run them before every deploy.
- **Skills to use:**
  - `forge-skills`:
    - forge-app-builder for new modules
    - forge-debugger on any error
    - forge-app-review and forge-security-review before the 8 Dec freeze
  - `superpowers`: plan, then TDD, then verify before claiming done.
- **Commits:** small, with clear messages. Push to `origin main`.
- **Demo data:** the fictional company "Acme Payments". The headline decision: "stay on PostgreSQL, reject
  MongoDB" (DEC-7).

## Current phase: week-1 spikes (gate: 13 Nov 2026)

Write the smallest throwaway code that proves or disproves each point. Record the results in `notes/spikes.md`.

1. **Teamwork Graph:** a curated query returns data on the demo site via `asUser`. Note the scopes,
   operation naming and rate limits.
2. **Multi-app:**
   - One app with Jira required and Confluence optional installs from **one share link**.
   - Storage is shared between the two.
   - The app can read Confluence page bodies.
3. **Rovo:**
   - The agent calls a GET action and the `save-verdict` UPDATE action from chat.
   - `rovo.open` in the issue panel opens our agent with a prompt.
   - The agent runs in a Jira automation rule, and `{{agentResponse}}` is posted as a comment.
4. **MCP:**
   - A `rovo:mcp` hello tool is reachable from Claude at `https://mcp.atlassian.com/forge/<appId>`.
   - An admin must first enable external exposure: Atlassian Administration > Apps > Sites > site >
     Connected apps.
5. **Guardrail:** a `jira:workflowValidator` Jira expression that reads an issue property blocks a transition.

## Milestones

| Date | Gate |
| --- | --- |
| 13 Nov | Spikes pass |
| 17 Nov | Build Session Q&A (22:30 IST) |
| 27 Nov | End-to-end MVP |
| 4 Dec | Bonus features done |
| 8 Dec | Feature freeze |
| 12 Dec | Judge dry run on the second site |
| 18 Dec | Video public |
| 19 Dec | Submitted |

## Key docs

- Rovo agent: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/
- Action: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/
- Skill: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-skill/
- MCP: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/
- Teamwork Graph API: https://developer.atlassian.com/platform/teamwork-graph/call-the-teamwork-graph-api/
  (scopes: /platform/teamwork-graph/scopes/)
- Bridge `rovo.open`: https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/rovo/
- Workflow validator: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-workflow-validator/
- Multi-app compatibility: https://developer.atlassian.com/platform/forge/app-compatibility/
- Share link: https://developer.atlassian.com/platform/forge/distribute-your-apps/
- Limits: https://developer.atlassian.com/platform/forge/limits-invocation/
