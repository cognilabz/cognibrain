from __future__ import annotations

import json
import urllib.request
from typing import Any


def cognibrain_context_pack(
    user_id: str,
    query: str,
    *,
    api_url: str = "http://localhost:8787",
    app_id: str = "crewai",
    project_id: str | None = None,
    org_id: str | None = None,
    token_budget: int = 1200,
) -> dict[str, Any]:
    return _post_json(
        f"{api_url}/evidence-pack",
        {
            "userId": user_id,
            "query": query,
            "appId": app_id,
            "projectId": project_id,
            "orgId": org_id,
            "tokenBudget": token_budget,
        },
    )


def record_crewai_tool_outcome(
    user_id: str,
    command: str,
    *,
    api_url: str = "http://localhost:8787",
    content: str | None = None,
    files_changed: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return _post_json(
        f"{api_url}/connectors/telemetry",
        {
            "connectorId": "official-code",
            "harnessId": "crewai",
            "userId": user_id,
            "kind": "tool_outcome",
            "command": command,
            "content": content,
            "filesChanged": files_changed,
            "metadata": metadata,
        },
    )


def _post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))
