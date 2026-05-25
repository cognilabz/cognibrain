# cognibrain Python SDK

Dependency-free Python client for the local cognibrain HTTP API.

```python
from cognibrain_client import CognibrainClient

client = CognibrainClient(api_key="dev-secret", actor_id="langgraph-agent")
memory = client.add({
    "userId": "dev",
    "content": "Atlas releases require npm test before publish.",
    "source": {"kind": "human", "confidence": 0.95},
})

pack = client.evidence_pack({
    "userId": "dev",
    "query": "What should Atlas do before release?",
    "tokenBudget": 900,
})

print(pack["context"])
print(client.policy_check("retrieve", memory_id=memory["id"], actor={"userId": "dev"}))
```

Supported v1 surfaces include auth headers, retries, typed HTTP errors, memory CRUD, search, routing, intent, evidence/context packs, graph, connectors, policy, and OpenAPI retrieval.

## Framework Examples

Dependency-free examples live under `examples/`:

- `examples/langgraph_agent.py` shows before-model context injection and after-feedback action recording for a LangGraph-style state graph.
- `examples/crewai_memory_tool.py` exposes a small CrewAI-style tool wrapper that returns an evidence context pack for the current task.

The package is PyPI-style installable from this folder:

```bash
python3 -m pip install .
python3 -m unittest discover -s tests
```
