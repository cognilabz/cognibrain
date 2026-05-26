# cognibrain memory policy

Use cognibrain as the evidence handoff for Amp-style external agent work.

- Pull a context pack before changing code; use the coding-specific context path when the host exposes it.
- Run an action guard before shell commands or file edits with durable side effects when the integration supports it.
- Preserve source references for issue, PR, CI, doc, chat, and incident evidence.
- Store review corrections, command failures, and release-gate decisions, then write patch evidence for non-trivial changes.
- Do not claim tenant or production proof unless the checked artifacts contain it.
