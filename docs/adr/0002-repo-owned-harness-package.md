# Repo-Owned Harness Package

Cognibrain will treat repository-owned harness files as the durable agent
contract for memory use, while keeping user-level installation as a fallback.
This prevents non-trivial agent work from depending on a user reminder or on a
global Codex skill being selected.

The default `config all` flow should write native, commit-ready harness files
into the repository. The first implementation is Codex-first: keep `AGENTS.md`
as the always-on policy surface and add `.agents/skills/cognibrain/SKILL.md` as
the repo-local skill. Later harnesses should use their native discovery paths,
not a hidden Cognibrain-only directory.

Repository contracts use portable commands such as `npx @cognilabz/cognibrain`
instead of absolute local paths. The generated manifest remains the audit
surface for paths, ownership mode, generation version, content hashes, ignored
state, and check results.

Files that Cognibrain owns fully are `managed`; files that may contain team
rules are `advisory` and updated only through marked Cognibrain blocks. Existing
unmarked files are migrated by appending a marked block, never by blind
overwrite. Install/update writes files and warnings, but does not stage, commit,
prune, or edit project docs by default.

`config all --check` is an audit mode, not a default CI gate. It reports missing,
stale, ignored, duplicated, or non-portable contract files and exits
successfully unless a future explicit strict mode is requested.
