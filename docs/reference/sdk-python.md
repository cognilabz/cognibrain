# Python SDK

The Python SDK is a dependency-free HTTP client aimed at Python agent frameworks. It provides the same capabilities as the TypeScript SDK without requiring any third-party packages.

## Installation

```bash
cd sdk/python
python3 -m pip install .
```

Or install directly from the project:

```bash
pip install ./sdk/python
```

## Quick Start

```python
from cognibrain_client import CognibrainClient

client = CognibrainClient(
    base_url="http://localhost:8787",
    api_key="dev-secret",
    actor_id="agent",
)

# Get context for a task
pack = client.evidence_pack({
    "userId": "dev",
    "query": "What should I remember before release?",
    "tokenBudget": 900,
})
print(pack["context"])
```

## Client Initialization

```python
from cognibrain_client import CognibrainClient

# Minimal (local dev, no auth)
client = CognibrainClient()

# With auth
client = CognibrainClient(
    base_url="http://localhost:8787",
    api_key="your-api-key",
    actor_id="my-agent",
)

# With bearer token
client = CognibrainClient(
    base_url="http://localhost:8787",
    bearer_token="your-jwt-token",
    actor_id="my-agent",
)
```

## Memory Operations

### Add a Memory

```python
memory = client.add_memory(
    content="Always run tests before release",
    scope="repo",
)
```

### List Memories

```python
memories = client.list_memories(scope="repo", limit=50)
for m in memories:
    print(f"[{m['scope']}] {m['content']}")
```

### Get Coding Context

```python
context = client.coding_context(
    task="prepare the release patch",
    token_budget=1200,
)
print(context["context"])
```

## Lifecycle Operations

### Request Context Pack

```python
pack = client.get_context(
    task="fix auth token refresh",
    repo="cognilabz/cognibrain",
)
```

### Guard an Action

```python
result = client.guard(action="edit src/api/server.ts")

if not result["allowed"]:
    print("Action blocked:", result["warnings"])
```

### Record Outcome

```python
client.record_outcome(
    command="npm test",
    exit_code=0,
)
```

### Record Patch Evidence

```python
client.record_patch_evidence(
    task="release patch",
    files=["package.json", "CHANGELOG.md"],
    commands=["npm test", "npm run build"],
)
```

### End Session

```python
client.end_session(run_dream_if_due=True)
```

## Evidence Pack

```python
pack = client.evidence_pack({
    "userId": "dev",
    "query": "What should I remember before release?",
    "tokenBudget": 900,
})

print(f"Context ({pack['tokenCount']} tokens):")
print(pack["context"])
```

## Error Handling

```python
from cognibrain_client import CognibrainClient, CognibrainError

try:
    client.add_memory(content="test")
except CognibrainError as e:
    print(f"Error [{e.code}]: {e.message}")
except ConnectionError:
    print("Cannot reach Cognibrain daemon")
```

## Running Tests

```bash
cd sdk/python
python3 -m unittest discover -s tests
```

## Examples

Example scripts are available in `sdk/python/examples/`:

```bash
python3 sdk/python/examples/basic_usage.py
python3 sdk/python/examples/agent_lifecycle.py
```

## Design Notes

- **Zero dependencies** — uses only Python standard library (`urllib`, `json`)
- **Python 3.10+** — uses modern type hints
- **Synchronous** — no async/await required (keeps integration simple)
- **Thread-safe** — client instances can be shared across threads

## Integration with Agent Frameworks

### LangChain

```python
from cognibrain_client import CognibrainClient

client = CognibrainClient(api_key="dev-secret")

def get_cognibrain_context(task: str) -> str:
    """Tool for LangChain agents to retrieve Cognibrain context."""
    pack = client.get_context(task=task)
    return pack["context"]
```

### Custom Agent Loop

```python
from cognibrain_client import CognibrainClient

client = CognibrainClient(api_key="dev-secret")

def agent_step(task: str, action: str):
    # Pre-action
    context = client.get_context(task=task)
    guard = client.guard(action=action)

    if not guard["allowed"]:
        return {"blocked": True, "reason": guard["warnings"]}

    # Execute action
    result = execute(action)

    # Post-action
    client.record_outcome(command=action, exit_code=result.exit_code)
    return {"blocked": False, "result": result}
```
