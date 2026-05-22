# Security Policy

cognibrain is local-first, but memory systems can still expose sensitive information if host applications store too much.

## Supported Versions

The project is pre-1.0. Security fixes target the current `main` branch.

## Reporting a Vulnerability

If you find a vulnerability, open a private report through the repository host if available. If private reporting is not available, open a minimal public issue that does not include exploit details or sensitive data.

Include:

- affected version or commit,
- setup steps,
- impact,
- reproduction steps using synthetic data,
- suggested fix if known.

## Sensitive Data Rules

- Do not store secrets, API keys, private keys, passwords, or raw credentials as memories.
- Do not commit real user transcripts, production memory dumps, or private benchmark data.
- Prefer project-local memory scope before team or global scope.
- Use `pinned` only for durable policy memories that should not be faded or archived.
- Keep provenance for every stored memory so users can audit where claims came from.

## Connector Safety

Connectors should:

- make durable writes explicit,
- support opt-out,
- default to local project scope,
- respect `MEMORY_NEVER_STORE_SECRETS=true`,
- avoid writing raw tool output unless a user or project policy allows it.
