# cognibrain for Hermes

Use the local cognibrain runtime for durable project memory. Start it with `node /opt/homebrew/lib/node_modules/@cognilabz/cognibrain/bin/cognibrain.mjs --runtime-root /Users/michaelhubeny/homespace/memory start` when the API is unavailable.

Before non-trivial coding, debugging, CI repair, benchmark, connector, or user-preference-sensitive tasks, call `node /opt/homebrew/lib/node_modules/@cognilabz/cognibrain/bin/cognibrain.mjs --runtime-root /Users/michaelhubeny/homespace/memory context --task "<task>" --json`. Use delivered context first: if the returned context or evidence pack already answers the question, act from that evidence and avoid rediscovering it with another search.

Before shell commands, dependency changes, migrations, or file edits with durable side effects, call `node /opt/homebrew/lib/node_modules/@cognilabz/cognibrain/bin/cognibrain.mjs --runtime-root /Users/michaelhubeny/homespace/memory guard --action "<command>" --json`.

For code or agent-behavior changes that are intended to land, complete local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish. After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Implement actionable feedback, verify, commit, push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for an explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases. Stop only after that recheck also returns no actionable improvements, then record both review results.

After durable discoveries, record source-backed facts with `node /opt/homebrew/lib/node_modules/@cognilabz/cognibrain/bin/cognibrain.mjs --runtime-root /Users/michaelhubeny/homespace/memory memory add "<fact>"`. Finish non-trivial patches with `node /opt/homebrew/lib/node_modules/@cognilabz/cognibrain/bin/cognibrain.mjs --runtime-root /Users/michaelhubeny/homespace/memory patch-evidence --task "<task>" --json`.

Hermes should also use the configured `cognibrain` MCP server when MCP tools are available. Treat MCP tools as native adapters for the same lifecycle contract, not as a replacement for source-backed verification.
