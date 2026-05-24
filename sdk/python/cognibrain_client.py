from __future__ import annotations

import json
import urllib.request
from typing import Any


class CognibrainClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8787") -> None:
        self.base_url = base_url.rstrip("/")

    def add(self, memory: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/memories", memory)

    def search(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        return self._request("POST", "/search", payload)

    def feedback(self, memory_id: str, kind: str, user_id: str | None = None) -> dict[str, Any]:
        return self._request("POST", "/feedback", {"memoryId": memory_id, "kind": kind, "userId": user_id})

    def graph_query(self, query: str, user_id: str | None = None) -> dict[str, Any]:
        return self._request("POST", "/graph/query", {"query": query, "userId": user_id})

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(f"{self.base_url}{path}", data=data, method=method, headers={"content-type": "application/json"})
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
