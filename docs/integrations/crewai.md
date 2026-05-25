# CrewAI Integration

## Install

```bash
./bin/cognibrain.mjs config crewai
```

This writes `crewai.cognibrain.json` and `crewai_cognibrain.py`.

## Verify

```bash
npm run verify:connectors
python3 -m unittest discover -s sdk/python/tests
```

## Maturity

`local-ready`: helper files and the dependency-free Python SDK path are included.

## Troubleshoot

- Set the API key when `MEMORY_REQUIRE_AUTH=true`.
- Verify the Python SDK with the checked-in tests.
- Use evidence packs rather than raw search when prompt budget matters.
