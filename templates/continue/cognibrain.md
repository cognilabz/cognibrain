# cognibrain memory policy

Use cognibrain as the project memory source when Continue asks for repo context or prepares a code action.

- Pull `cognibrain context --task "<task>" --json` before applying edits.
- Treat stale or contradicted memories as review-only until revalidated.
- Run `cognibrain guard --action "<command>" --json` before shell commands or file edits with durable side effects.
- Record accepted and rejected suggestions as feedback so repeated mistakes do not come back.
- Finish non-trivial patches with `cognibrain patch-evidence --task "<task>" --json`.
- Cite connector-backed decisions from GitHub, Jira, Confluence, Notion, Slack, or Linear when they affect code.
