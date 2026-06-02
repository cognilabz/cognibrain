#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import time
from importlib.metadata import version
from typing import Any

from langgraph.store.memory import InMemoryStore
from langmem import create_manage_memory_tool, create_search_memory_tool


NAMESPACE = ("realworld-blackbox",)


def main() -> int:
    payload = json.loads(sys.stdin.read() or "{}")
    manifest = payload.get("manifest") or {}
    started = time.perf_counter()
    store = InMemoryStore()
    manage = create_manage_memory_tool(NAMESPACE, store=store)
    search = create_search_memory_tool(NAMESPACE, store=store)
    ingest = ingest_manifest(manage, manifest)
    raw_outputs = query_manifest(search, manifest, ingest["idToKey"])
    judged = run_judge(manifest, raw_outputs)
    print(json.dumps(build_report(manifest, raw_outputs, judged, ingest, started)))
    return 0


def ingest_manifest(manage: Any, manifest: dict[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    id_to_key: dict[str, str] = {}
    operations: list[dict[str, Any]] = []
    for event in manifest.get("events", []):
        event_id = str(event.get("id") or "")
        delete_target = event.get("deleteTargetId")
        if delete_target:
            key = id_to_key.pop(str(delete_target), None)
            deleted = False
            if key:
                manage.invoke({"action": "delete", "id": key})
                deleted = True
            operations.append({"eventId": event_id, "deleteTargetId": delete_target, "deleted": deleted})
            continue
        result = manage.invoke({"content": str(event.get("content") or ""), "action": "create"})
        key = created_key(result)
        if event_id and key:
            id_to_key[event_id] = key
        operations.append({"eventId": event_id, "memoryKey": key, "private": event.get("private") is True})
    return {"latencyMs": round((time.perf_counter() - started) * 1000), "raw": operations, "idToKey": id_to_key}


def query_manifest(search: Any, manifest: dict[str, Any], id_to_key: dict[str, str]) -> list[dict[str, Any]]:
    key_to_id = {key: event_id for event_id, key in id_to_key.items()}
    outputs = []
    for query in manifest.get("queries", []):
        started = time.perf_counter()
        response = search.invoke({"query": str(query.get("question") or ""), "limit": int(query.get("topK") or 3)})
        items = parse_search_response(response)
        outputs.append({
            "queryId": query.get("id"),
            "retrievedEvidenceIds": [key_to_id.get(str(item.get("key") or ""), "") for item in items if key_to_id.get(str(item.get("key") or ""))],
            "retrievedText": [memory_content(item) for item in items],
            "latencyMs": round((time.perf_counter() - started) * 1000),
            "raw": [{
                "key": item.get("key"),
                "evidenceId": key_to_id.get(str(item.get("key") or "")),
                "score": item.get("score"),
                "namespace": item.get("namespace"),
            } for item in items],
        })
    return outputs


def run_judge(manifest: dict[str, Any], raw_outputs: list[dict[str, Any]]) -> dict[str, Any]:
    command = os.environ.get("MEMORY_REALWORLD_JUDGE_COMMAND")
    if not command:
        return blocked_judge("MEMORY_REALWORLD_JUDGE_COMMAND is required for LangMem real-world scoring")
    payload = {
        "schemaVersion": "1.0",
        "task": "realworld-blackbox-judge",
        "manifest": manifest,
        "system": {
            "system": "langmem",
            "displayName": "LangMem",
            "evidenceClass": "same-run-command",
            "adapterMode": "external-command",
        },
        "rawOutputs": raw_outputs,
    }
    import subprocess

    result = subprocess.run(
        command,
        input=json.dumps(payload) + "\n",
        text=True,
        shell=True,
        capture_output=True,
        timeout=int(os.environ.get("MEMORY_REALWORLD_JUDGE_TIMEOUT_MS", "300000")),
    )
    if result.returncode != 0:
        return blocked_judge(result.stderr[-4000:] or "real-world judge command failed")
    parsed = json.loads(result.stdout)
    if not isinstance(parsed.get("decisions"), list):
        return blocked_judge("real-world judge command must return decisions")
    return parsed


def build_report(manifest: dict[str, Any], raw_outputs: list[dict[str, Any]], judged: dict[str, Any], ingest: dict[str, Any], started: float) -> dict[str, Any]:
    if judged.get("blocked"):
        return build_blocked_report(manifest, raw_outputs, judged, ingest, started)
    decisions = decisions_for_manifest(manifest, judged)
    queries = manifest.get("queries", [])
    answer_queries = [query for query in queries if query.get("expectedEvidenceIds")]
    abstention_queries = [query for query in queries if query.get("shouldAbstain") is True]
    latencies = sorted(int(output.get("latencyMs") or 0) for output in raw_outputs)
    buckets: dict[str, dict[str, Any]] = {}
    for bucket in sorted({str(query.get("bucket")) for query in queries}):
        query_ids = {query.get("id") for query in queries if str(query.get("bucket")) == bucket}
        subset = [decision for decision in decisions if decision["queryId"] in query_ids]
        bucket_correct = sum(1 for decision in subset if decision["passed"])
        buckets[bucket] = {"score": ratio(bucket_correct, len(subset)), "correct": bucket_correct, "total": len(subset)}
    return {
        "schemaVersion": "1.0",
        "system": "langmem",
        "displayName": "LangMem",
        "judge": {
            "kind": "llm" if os.environ.get("MEMORY_REALWORLD_JUDGE_KIND") == "llm" else "harness",
            "reason": "quality scores are produced by the configured LLM/harness judge",
            "raw": judged.get("judge"),
        },
        "metrics": {
            "score": ratio(sum(1 for decision in decisions if decision["passed"]), len(decisions)),
            "recall": ratio(sum(1 for decision in decisions if decision["supportsAnswer"] and decision["passed"]), len(answer_queries)),
            "abstentionPrecision": ratio(sum(1 for decision in decisions if decision["queryId"] in {query.get("id") for query in abstention_queries} and decision["abstained"] and not decision["leakedForbiddenEvidence"]), len(abstention_queries)),
            "forbiddenLeakageRate": ratio(sum(1 for decision in decisions if decision["leakedForbiddenEvidence"]), len(decisions)),
            "p50LatencyMs": percentile(latencies, 0.5),
            "p95LatencyMs": percentile(latencies, 0.95),
            "ingestLatencyMs": ingest["latencyMs"],
            "estimatedCostUsd": 0,
            "durationMs": round((time.perf_counter() - started) * 1000),
        },
        "buckets": buckets,
        "retrievalDiagnostics": {
            "deterministicEvidenceIdMatch": True,
            "expectedHits": diagnostic_expected_hits(manifest, raw_outputs),
            "forbiddenHits": diagnostic_forbidden_hits(manifest, raw_outputs),
            "abstentionNoResult": diagnostic_abstentions(manifest, raw_outputs),
            "note": "Diagnostic only. Structured evidence-id matches are not quality scores; metrics come from the configured LLM/harness judge.",
        },
        "rawOutputs": raw_outputs,
        "setup": {
            "runner": "langmem-original-package",
            "package": f"langmem=={version('langmem')}",
            "store": "langgraph.store.memory.InMemoryStore",
            "ingestRaw": ingest["raw"],
        },
    }


def blocked_judge(reason: str) -> dict[str, Any]:
    return {
        "blocked": True,
        "reason": reason,
        "judge": {
            "kind": "missing",
            "status": "blocked",
            "reason": reason,
        },
    }


def build_blocked_report(manifest: dict[str, Any], raw_outputs: list[dict[str, Any]], judged: dict[str, Any], ingest: dict[str, Any], started: float) -> dict[str, Any]:
    latencies = sorted(int(output.get("latencyMs") or 0) for output in raw_outputs)
    reason = str(judged.get("reason") or judged.get("judge", {}).get("reason") or "real-world judge blocked")
    return {
        "schemaVersion": "1.0",
        "system": "langmem",
        "displayName": "LangMem",
        "qualityClaimAllowed": False,
        "blockedReason": reason,
        "judge": {
            "kind": "missing",
            "status": "blocked",
            "reason": reason,
        },
        "metrics": {
            "score": None,
            "recall": None,
            "abstentionPrecision": None,
            "forbiddenLeakageRate": None,
            "p50LatencyMs": percentile(latencies, 0.5),
            "p95LatencyMs": percentile(latencies, 0.95),
            "ingestLatencyMs": ingest["latencyMs"],
            "estimatedCostUsd": 0,
            "durationMs": round((time.perf_counter() - started) * 1000),
        },
        "buckets": {},
        "retrievalDiagnostics": {
            "deterministicEvidenceIdMatch": True,
            "expectedHits": diagnostic_expected_hits(manifest, raw_outputs),
            "forbiddenHits": diagnostic_forbidden_hits(manifest, raw_outputs),
            "abstentionNoResult": diagnostic_abstentions(manifest, raw_outputs),
            "note": "Diagnostic only. Raw outputs were captured, but quality metrics are blocked until the configured LLM/harness judge succeeds.",
        },
        "rawOutputs": raw_outputs,
        "setup": {
            "runner": "langmem-original-package",
            "package": f"langmem=={version('langmem')}",
            "store": "langgraph.store.memory.InMemoryStore",
            "ingestRaw": ingest["raw"],
        },
    }


def created_key(value: Any) -> str:
    text = str(value)
    marker = "created memory "
    if marker in text:
        return text.split(marker, 1)[1].strip().split()[0]
    return ""


def parse_search_response(value: Any) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(str(value))
    except Exception:
        return []
    return parsed if isinstance(parsed, list) else []


def memory_content(item: dict[str, Any]) -> str:
    value = item.get("value")
    if isinstance(value, dict):
        return str(value.get("content") or "")
    return ""


def decisions_for_manifest(manifest: dict[str, Any], judged: dict[str, Any]) -> list[dict[str, Any]]:
    by_id = {str(item.get("queryId") or ""): item for item in judged.get("decisions", [])}
    decisions = []
    for query in manifest.get("queries", []):
        item = by_id.get(str(query.get("id") or ""), {})
        decisions.append({
            "queryId": str(query.get("id") or ""),
            "score": bounded(item.get("score")),
            "passed": item.get("passed") is True,
            "supportsAnswer": item.get("supportsAnswer") is True,
            "abstained": item.get("abstained") is True,
            "leakedForbiddenEvidence": item.get("leakedForbiddenEvidence") is True,
            "reason": str(item.get("reason") or "judge decision"),
            "confidence": bounded(item.get("confidence", item.get("score"))),
        })
    return decisions


def diagnostic_expected_hits(manifest: dict[str, Any], raw_outputs: list[dict[str, Any]]) -> int:
    outputs = {output.get("queryId"): set(output.get("retrievedEvidenceIds") or []) for output in raw_outputs}
    total = 0
    for query in manifest.get("queries", []):
        expected = query.get("expectedEvidenceIds") or []
        if not expected or any(item in outputs.get(query.get("id"), set()) for item in expected):
            total += 1
    return total


def diagnostic_forbidden_hits(manifest: dict[str, Any], raw_outputs: list[dict[str, Any]]) -> int:
    outputs = {output.get("queryId"): set(output.get("retrievedEvidenceIds") or []) for output in raw_outputs}
    return sum(1 for query in manifest.get("queries", []) if any(item in outputs.get(query.get("id"), set()) for item in query.get("forbiddenEvidenceIds", [])))


def diagnostic_abstentions(manifest: dict[str, Any], raw_outputs: list[dict[str, Any]]) -> int:
    outputs = {output.get("queryId"): set(output.get("retrievedEvidenceIds") or []) for output in raw_outputs}
    return sum(1 for query in manifest.get("queries", []) if query.get("shouldAbstain") is True and len(outputs.get(query.get("id"), set())) == 0)


def percentile(values: list[int], q: float) -> int:
    if not values:
        return 0
    index = min(len(values) - 1, max(0, int((len(values) - 1) * q + 0.999999)))
    return values[index]


def ratio(numerator: int, denominator: int) -> float:
    return round(numerator / denominator, 4) if denominator else 0


def bounded(value: Any) -> float:
    return max(0.0, min(1.0, float(value))) if isinstance(value, (int, float)) else 0.0


if __name__ == "__main__":
    raise SystemExit(main())
