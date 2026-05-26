from __future__ import annotations

import json
import urllib.request
from typing import Any


def cognibrain_coding_context_pack(
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
        f"{api_url}/coding-context-pack",
        {
            "userId": user_id,
            "query": query,
            "appId": app_id,
            "projectId": project_id,
            "orgId": org_id,
            "tokenBudget": token_budget,
        },
    )


cognibrain_context_pack = cognibrain_coding_context_pack


def guard_crewai_action(
    user_id: str,
    action: str,
    *,
    api_url: str = "http://localhost:8787",
    agent_id: str | None = None,
    session_id: str | None = None,
    project_id: str | None = None,
    org_id: str | None = None,
) -> dict[str, Any]:
    return _post_json(
        f"{api_url}/code/action-guard",
        {
            "userId": user_id,
            "action": action,
            "appId": "crewai",
            "agentId": agent_id,
            "sessionId": session_id,
            "projectId": project_id,
            "orgId": org_id,
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


def record_crewai_patch_evidence(
    user_id: str,
    task: str,
    *,
    api_url: str = "http://localhost:8787",
    files_changed: list[str] | None = None,
    commands_run: list[str] | None = None,
    memory_ids: list[str] | None = None,
    project_id: str | None = None,
    org_id: str | None = None,
) -> dict[str, Any]:
    return _post_json(
        f"{api_url}/patch-evidence",
        {
            "userId": user_id,
            "task": task,
            "appId": "crewai",
            "filesChanged": files_changed,
            "commandsRun": commands_run,
            "memoryIds": memory_ids,
            "projectId": project_id,
            "orgId": org_id,
        },
    )


def _post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))
