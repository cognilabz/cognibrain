# cognibrain memory policy

Before starting a non-trivial Aider change, use the CLI fallback to pull coding context for the current repo, branch, test command, generated-file rules, and prior reviewer corrections.

```bash
cognibrain context --task "<task>" --app aider --agent aider --json
cognibrain guard --action "<command>" --json
```

This is an active memory pull, not a passive reminder. Parse the returned JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`. If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories.

Treat `review_required` memories as Aider's automated review queue: inspect the targeted files, commands, tests, or artifacts suggested by the memory, then use the memory only after current repo evidence confirms it. If repo evidence contradicts it, ignore the memory and record a correction or patch evidence after the fix.

After the change, record tool outcomes and corrections through the CLI:

```bash
cognibrain outcome --command "<command>" --exit-code <code> --json
cognibrain correction --text "<review correction>" --json
cognibrain patch-evidence --task "<task>" --json
```

Never put API keys or local-only secrets into memory.

For code or agent-behavior changes intended to land, verify locally, commit, push to `main`, ask the live ChatGPT/code-review coworker to review the pushed commit or diff, implement actionable feedback, re-verify, re-push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases, and stop only when that recheck also finds no actionable improvements.
