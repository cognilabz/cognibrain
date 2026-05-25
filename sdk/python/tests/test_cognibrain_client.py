from __future__ import annotations

import json
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cognibrain_client import CognibrainClient, CognibrainHTTPError


class MockCognibrainHandler(BaseHTTPRequestHandler):
    calls: list[dict[str, Any]] = []
    failures_remaining = 0

    def do_GET(self) -> None:
        self._record()
        if self.path == "/auth/status":
            self._json({"protected": True, "mode": "api-key"})
        elif self.path == "/context-packs/ctx_123/evidence":
            self._json({"id": "ctx_123", "context": "[mem_1] release checks"})
        elif self.path == "/connectors/health":
            self._json([{"connectorId": "official-github", "status": "idle"}])
        elif self.path == "/sdk/openapi":
            self._json({"openapi": "3.1.0", "paths": {"/memories": ["GET", "POST"]}})
        elif self.path == "/memories?userId=dev":
            self._json([{"id": "mem_1"}, {"id": "mem_2"}])
        else:
            self._json({"ok": True})

    def do_POST(self) -> None:
        body = self._record()
        if self.path == "/flaky":
            if MockCognibrainHandler.failures_remaining:
                MockCognibrainHandler.failures_remaining -= 1
                self._json({"error": "temporary"}, status=503)
            else:
                self._json({"ok": True})
        elif self.path == "/memories":
            self._json({"id": "mem_1", **body}, status=201)
        elif self.path == "/evidence-pack":
            self._json({"id": "ctx_123", "query": body["query"], "policyDecisions": []})
        elif self.path == "/policy/evaluate":
            self._json({"operation": body["operation"], "allowed": True})
        elif self.path == "/connectors/writeback":
            self._json({"status": "queued", "connectorId": body["connectorId"]}, status=202)
        elif self.path == "/feedback":
            self._json({"id": body["memoryId"], "feedback": body["kind"]}, status=202)
        else:
            self._json({"received": body})

    def do_PATCH(self) -> None:
        body = self._record()
        self._json({"id": self.path.rsplit("/", 1)[-1], **body})

    def do_DELETE(self) -> None:
        self._record()
        self.send_response(204)
        self.end_headers()

    def log_message(self, *_args: Any) -> None:
        return

    def _record(self) -> dict[str, Any]:
        length = int(self.headers.get("content-length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8") if length else ""
        body = json.loads(raw) if raw else {}
        MockCognibrainHandler.calls.append({"method": self.command, "path": self.path, "body": body, "headers": dict(self.headers)})
        return body

    def _json(self, payload: Any, status: int = 200) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class CognibrainClientTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = HTTPServer(("127.0.0.1", 0), MockCognibrainHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.thread.join(timeout=2)
        cls.server.server_close()

    def setUp(self) -> None:
        MockCognibrainHandler.calls.clear()
        MockCognibrainHandler.failures_remaining = 0

    def test_auth_headers_memory_and_evidence(self) -> None:
        client = CognibrainClient(self.base_url, api_key="secret", actor_id="py-agent")
        memory = client.add({"userId": "dev", "content": "Release checks need proof."})
        self.assertEqual(memory["id"], "mem_1")

        pack = client.evidence_pack({"userId": "dev", "query": "release proof"})
        self.assertEqual(pack["id"], "ctx_123")
        self.assertEqual(client.get_evidence_pack("ctx_123")["context"], "[mem_1] release checks")
        self.assertEqual(MockCognibrainHandler.calls[0]["headers"]["X-Api-Key"], "secret")
        self.assertEqual(MockCognibrainHandler.calls[0]["headers"]["X-Actor-Id"], "py-agent")

    def test_policy_connectors_pagination_and_delete(self) -> None:
        client = CognibrainClient(self.base_url)
        self.assertEqual([item["id"] for item in client.iter_memories("dev", page_size=1)], ["mem_1", "mem_2"])
        self.assertTrue(client.policy_check("retrieve", memory_id="mem_1", actor={"userId": "dev"})["allowed"])
        self.assertEqual(client.connector_health()[0]["connectorId"], "official-github")
        self.assertEqual(client.writeback_connector("official-github", {"dryRun": True})["status"], "queued")
        self.assertTrue(client.delete_memory("mem_1"))

    def test_typed_http_error(self) -> None:
        client = CognibrainClient(self.base_url, retries=0)
        MockCognibrainHandler.failures_remaining = 1
        with self.assertRaises(CognibrainHTTPError) as raised:
            client._request("POST", "/flaky", {})
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.body, {"error": "temporary"})

    def test_retries_transient_errors(self) -> None:
        client = CognibrainClient(self.base_url, retries=1, retry_backoff_seconds=0)
        MockCognibrainHandler.failures_remaining = 1
        self.assertTrue(client._request("POST", "/flaky", {})["ok"])


if __name__ == "__main__":
    unittest.main()
