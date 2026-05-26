# cognibrain memory policy

Before starting an Aider change, use the CLI fallback to pull coding context for the current repo, branch, test command, generated-file rules, and prior reviewer corrections.

```bash
cognibrain memories coding-context "<task>"
cognibrain memory action-guard "<command>"
```

After the change, record tool outcomes and corrections through the CLI:

```bash
cognibrain memory action "<command>"
cognibrain memory code-correction "<review correction>"
cognibrain memory patch-evidence "<task>"
```

Never put API keys or local-only secrets into memory.
