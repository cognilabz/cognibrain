# cognibrain memory policy

Before starting a non-trivial Aider change, use the CLI fallback to pull coding context for the current repo, branch, test command, generated-file rules, and prior reviewer corrections.

```bash
cognibrain context --task "<task>" --json
cognibrain guard --action "<command>" --json
```

After the change, record tool outcomes and corrections through the CLI:

```bash
cognibrain outcome --command "<command>" --exit-code <code> --json
cognibrain correction --text "<review correction>" --json
cognibrain patch-evidence --task "<task>" --json
```

Never put API keys or local-only secrets into memory.
