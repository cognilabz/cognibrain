from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Iterator, Mapping


JSON = dict[str, Any] | list[Any] | str | int | float | bool | None


class CognibrainError(Exception):
    """Base error raised by the cognibrain Python SDK."""


class CognibrainHTTPError(CognibrainError):
    """HTTP error with parsed JSON response details when available."""

    def __init__(self, status_code: int, message: str, body: JSON = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body
        self.code = body.get("code") if isinstance(body, dict) and isinstance(body.get("code"), str) else None


@dataclass(frozen=True)
class CognibrainClientOptions:
    base_url: str = "http://127.0.0.1:8787"
    api_key: str | None = None
    actor_id: str | None = None
    timeout: float = 10.0
    retries: int = 2
    retry_backoff_seconds: float = 0.15


class CognibrainClient:
    """Dependency-free client for the cognibrain HTTP API."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8787",
        *,
        api_key: str | None = None,
        actor_id: str | None = None,
        timeout: float = 10.0,
        retries: int = 2,
        retry_backoff_seconds: float = 0.15,
    ) -> None:
        self.options = CognibrainClientOptions(
            base_url=base_url.rstrip("/"),
            api_key=api_key,
            actor_id=actor_id,
            timeout=timeout,
            retries=max(0, retries),
            retry_backoff_seconds=max(0.0, retry_backoff_seconds),
        )

    def health(self, user_id: str | None = None) -> dict[str, Any]:
        query = f"?userId={urllib.parse.quote(user_id)}" if user_id else ""
        return self._request("GET", f"/health{query}")

    def auth_status(self) -> dict[str, Any]:
        return self._request("GET", "/auth/status")

    def add(self, memory: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/memories", dict(memory))

    def get_memory(self, memory_id: str) -> dict[str, Any]:
        return self._request("GET", f"/memories/{urllib.parse.quote(memory_id)}")

    def list_memories(self, user_id: str | None = None) -> list[dict[str, Any]]:
        query = f"?userId={urllib.parse.quote(user_id)}" if user_id else ""
        return self._request("GET", f"/memories{query}")

    def iter_memories(self, user_id: str | None = None, *, page_size: int = 100) -> Iterator[dict[str, Any]]:
        memories = self.list_memories(user_id)
        for index in range(0, len(memories), max(1, page_size)):
            yield from memories[index : index + page_size]

    def update_memory(self, memory_id: str, patch: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("PATCH", f"/memories/{urllib.parse.quote(memory_id)}", dict(patch))

    def archive(self, memory_id: str) -> dict[str, Any]:
        return self._request("POST", f"/memories/{urllib.parse.quote(memory_id)}/archive")

    def delete_memory(self, memory_id: str) -> bool:
        self._request("DELETE", f"/memories/{urllib.parse.quote(memory_id)}")
        return True

    def search(self, payload: Mapping[str, Any]) -> list[dict[str, Any]]:
        return self._request("POST", "/search", dict(payload))

    def route(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/route", dict(payload))

    def intent(self, query: str) -> dict[str, Any]:
        return self._request("POST", "/intent", {"query": query})

    def evidence_pack(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/evidence-pack", dict(payload))

    def coding_context_pack(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/coding-context-pack", dict(payload))

    def get_evidence_pack(self, context_pack_id: str) -> dict[str, Any]:
        encoded = urllib.parse.quote(context_pack_id)
        return self._request("GET", f"/context-packs/{encoded}/evidence")

    def feedback(self, memory_id: str, kind: str, user_id: str | None = None, note: str | None = None) -> dict[str, Any]:
        return self._request("POST", "/feedback", {"memoryId": memory_id, "kind": kind, "userId": user_id, "note": note})

    def graph(self, user_id: str | None = None) -> dict[str, Any]:
        query = f"?userId={urllib.parse.quote(user_id)}" if user_id else ""
        return self._request("GET", f"/graph{query}")

    def graph_query(self, query: str, user_id: str | None = None) -> dict[str, Any]:
        return self._request("POST", "/graph/query", {"query": query, "userId": user_id})

    def graph_explain(self, from_node: str, to_node: str, **options: Any) -> dict[str, Any]:
        params = {"from": from_node, "to": to_node, **{key: value for key, value in options.items() if value is not None}}
        return self._request("GET", f"/graph/explain?{urllib.parse.urlencode(params)}")

    def connectors(self, kind: str | None = None) -> list[dict[str, Any]]:
        query = f"?kind={urllib.parse.quote(kind)}" if kind else ""
        return self._request("GET", f"/connectors{query}")

    def connector_health(self, connector_id: str | None = None) -> list[dict[str, Any]]:
        query = f"?connectorId={urllib.parse.quote(connector_id)}" if connector_id else ""
        return self._request("GET", f"/connectors/health{query}")

    def sync_connector(self, connector_id: str, events: list[Mapping[str, Any]], scope: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/connectors/sync", {"connectorId": connector_id, "events": [dict(event) for event in events], **dict(scope)})

    def writeback_connector(self, connector_id: str, payload: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/connectors/writeback", {"connectorId": connector_id, **dict(payload)})

    def poll_connector(self, connector_id: str, scope: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/connectors/poll", {"connectorId": connector_id, **dict(scope)})

    def connector_sync_records(self, connector_id: str | None = None) -> list[dict[str, Any]]:
        query = f"?connectorId={urllib.parse.quote(connector_id)}" if connector_id else ""
        return self._request("GET", f"/connectors/sync-records{query}")

    def guard_action(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/code/action-guard", dict(payload))

    def record_action(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/actions", dict(payload))

    def record_code_correction(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/code/corrections", dict(payload))

    def patch_evidence_trail(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/patch-evidence", dict(payload))

    def policy_rules(self) -> list[dict[str, Any]]:
        return self._request("GET", "/policy/rules")

    def set_policy_rule(self, rule: Mapping[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/policy/rules", dict(rule))

    def policy_check(
        self,
        operation: str,
        *,
        memory_id: str | None = None,
        input: Mapping[str, Any] | None = None,
        actor: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._request("POST", "/policy/evaluate", {"operation": operation, "memoryId": memory_id, "input": input, "actor": actor})

    def openapi(self) -> dict[str, Any]:
        return self._request("GET", "/sdk/openapi")

    def _request(self, method: str, path: str, body: Mapping[str, Any] | None = None) -> Any:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(f"{self.options.base_url}{path}", data=data, method=method, headers=self._headers(has_body=body is not None))
        last_error: Exception | None = None
        for attempt in range(self.options.retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=self.options.timeout) as response:
                    if response.status == 204:
                        return None
                    raw = response.read().decode("utf-8")
                    return json.loads(raw) if raw else None
            except urllib.error.HTTPError as error:
                parsed = _parse_error_body(error)
                if error.code < 500 and error.code != 429:
                    raise CognibrainHTTPError(error.code, _error_message(error, parsed), parsed) from error
                last_error = CognibrainHTTPError(error.code, _error_message(error, parsed), parsed)
            except urllib.error.URLError as error:
                last_error = CognibrainError(str(error))
            if attempt < self.options.retries:
                time.sleep(self.options.retry_backoff_seconds * (2**attempt))
        if last_error:
            raise last_error
        raise CognibrainError("cognibrain request failed")

    def _headers(self, *, has_body: bool) -> dict[str, str]:
        headers: dict[str, str] = {}
        if has_body:
            headers["content-type"] = "application/json"
        if self.options.api_key:
            headers["x-api-key"] = self.options.api_key
        if self.options.actor_id:
            headers["x-actor-id"] = self.options.actor_id
        return headers


def _parse_error_body(error: urllib.error.HTTPError) -> JSON:
    try:
        raw = error.read().decode("utf-8")
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw
    finally:
        error.close()


def _error_message(error: urllib.error.HTTPError, body: JSON) -> str:
    if isinstance(body, dict) and isinstance(body.get("error"), str):
        return body["error"]
    return f"cognibrain HTTP {error.code}"
