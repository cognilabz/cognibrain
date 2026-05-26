# cognibrain memory policy

Use cognibrain as the project memory source when Continue asks for repo context or prepares a code action.

- Pull `memory_context_pack`, or `memory_coding_context_pack` when exposed, before applying edits.
- Treat stale or contradicted memories as review-only until revalidated.
- Run `memory_action_guard` before shell commands or file edits with durable side effects when available.
- Record accepted and rejected suggestions as feedback so repeated mistakes do not come back.
- Finish non-trivial patches with `memory_patch_evidence`.
- Cite connector-backed decisions from GitHub, Jira, Confluence, Notion, Slack, or Linear when they affect code.
