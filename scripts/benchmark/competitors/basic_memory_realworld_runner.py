#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
from importlib.metadata import version
from pathlib import Path
from typing import Any


PROJECT = "realworld"


def main() -> int:
    payload = json.loads(sys.stdin.read() or "{}")
    manifest = payload.get("manifest") or {}
    started = time.perf_counter()
    work_dir = Path(os.environ.get("MEMORY_REALWORLD_BASICMEMORY_WORK_DIR", ".cognibrain/native-runners/realworld-basic-memory"))
    configure_environment(work_dir)
    from loguru import logger

    logger.remove()
    project_home = reset_project(work_dir)
    add_project(project_home)
    from basic_memory.mcp.tools.search import search_notes

    ingest = ingest_manifest(project_home, manifest)
    reindex()
    raw_outputs = asyncio.run(query_manifest(search_notes, manifest, ingest["idToFile"]))
    judged = run_judge(manifest, raw_outputs)
    report = build_report(manifest, raw_outputs, judged, ingest, started)
    print(json.dumps(report))
    return 0


def configure_environment(work_dir: Path) -> None:
    os.environ["BASIC_MEMORY_CONFIG_DIR"] = str(work_dir / "config")
    os.environ["BASIC_MEMORY_ENV"] = "test"
    os.environ["BASIC_MEMORY_NO_PROMOS"] = "1"
    os.environ["BASIC_MEMORY_LOG_LEVEL"] = "ERROR"
    os.environ["BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED"] = os.environ.get("BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED", "false")
    os.environ["LOGFIRE_IGNORE_NO_CONFIG"] = "1"
    os.environ.pop("BASIC_MEMORY_HOME", None)


def reset_project(work_dir: Path) -> Path:
    if work_dir.exists():
        shutil.rmtree(work_dir)
    project_home = work_dir / "home"
    project_home.mkdir(parents=True, exist_ok=True)
    return project_home


def add_project(project_home: Path) -> None:
    result = subprocess.run(
        [sys.executable, "-m", "basic_memory.cli.main", "project", "add", PROJECT, str(project_home), "--default", "--local"],
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Basic Memory project add failed: {result.stderr[-2000:]}")


def ingest_manifest(project_home: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    id_to_file: dict[str, str] = {}
    operations: list[dict[str, Any]] = []
    for event in manifest.get("events", []):
        event_id = str(event.get("id") or "")
        delete_target = event.get("deleteTargetId")
        if delete_target:
            removed = False
            file_path = id_to_file.pop(str(delete_target), None)
            if file_path:
                path = project_home / file_path
                if path.exists():
                    path.unlink()
                    removed = True
            operations.append({"eventId": event_id, "deleteTargetId": delete_target, "deleted": removed})
            continue
        relative = write_event_note(project_home, event)
        if event_id:
            id_to_file[event_id] = relative
        operations.append({"eventId": event_id, "filePath": relative, "private": event.get("private") is True})
    return {
        "latencyMs": round((time.perf_counter() - started) * 1000),
        "raw": operations,
        "idToFile": id_to_file,
    }


def write_event_note(project_home: Path, event: dict[str, Any]) -> str:
    folder = project_home / "events"
    folder.mkdir(parents=True, exist_ok=True)
    event_id = str(event.get("id") or f"event-{time.time_ns()}")
    path = folder / f"{slug(event_id)}.md"
    tags = ["realworld-blackbox", *[str(tag) for tag in event.get("tags", [])]]
    tag_lines = "\n".join(f"  - {json.dumps(tag)}" for tag in tags)
    title = f"RealWorld {event_id}"
    content = str(event.get("content") or "")
    path.write_text(
        f"---\ntitle: {json.dumps(title)}\ntype: note\ntags:\n{tag_lines}\n---\n\n{content}\n",
        encoding="utf-8",
    )
    return path.relative_to(project_home).as_posix()


def reindex() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "basic_memory.cli.main", "reindex", "--full", "--search", "--project", PROJECT],
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Basic Memory reindex failed: {result.stderr[-2000:]}")


async def query_manifest(search_notes: Any, manifest: dict[str, Any], id_to_file: dict[str, str]) -> list[dict[str, Any]]:
    file_to_id = {file_path: event_id for event_id, file_path in id_to_file.items()}
    outputs = []
    for query in manifest.get("queries", []):
        started = time.perf_counter()
        response = await search_notes(
            query=str(query.get("question") or ""),
            project=PROJECT,
            page_size=int(query.get("topK") or 3),
            output_format="json",
            search_type=os.environ.get("MEMORY_REALWORLD_BASICMEMORY_SEARCH_TYPE", "text"),
        )
        results = response.get("results", []) if isinstance(response, dict) else []
        outputs.append({
            "queryId": query.get("id"),
            "retrievedEvidenceIds": [file_to_id.get(str(item.get("file_path") or ""), "") for item in results if file_to_id.get(str(item.get("file_path") or ""))],
            "retrievedText": [str(item.get("content") or "") for item in results],
            "latencyMs": round((time.perf_counter() - started) * 1000),
            "raw": [{
                "filePath": item.get("file_path"),
                "evidenceId": file_to_id.get(str(item.get("file_path") or "")),
                "score": item.get("score"),
                "title": item.get("title"),
                "permalink": item.get("permalink"),
            } for item in results],
        })
    return outputs


def run_judge(manifest: dict[str, Any], raw_outputs: list[dict[str, Any]]) -> dict[str, Any]:
    command = os.environ.get("MEMORY_REALWORLD_JUDGE_COMMAND")
    if not command:
        return blocked_judge("MEMORY_REALWORLD_JUDGE_COMMAND is required for Basic Memory real-world scoring")
    payload = {
        "schemaVersion": "1.0",
        "task": "realworld-blackbox-judge",
        "manifest": manifest,
        "system": {
            "system": "basicmemory",
            "displayName": "Basic Memory",
            "evidenceClass": "same-run-command",
            "adapterMode": "external-command",
        },
        "rawOutputs": raw_outputs,
    }
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
    correct = sum(1 for decision in decisions if decision["passed"])
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
        "system": "basicmemory",
        "displayName": "Basic Memory",
        "judge": {
            "kind": "llm" if os.environ.get("MEMORY_REALWORLD_JUDGE_KIND") == "llm" else "harness",
            "reason": "quality scores are produced by the configured LLM/harness judge",
            "raw": judged.get("judge"),
        },
        "metrics": {
            "score": ratio(correct, len(decisions)),
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
            "runner": "basic-memory-original-package",
            "package": f"basic-memory=={version('basic-memory')}",
            "searchType": os.environ.get("MEMORY_REALWORLD_BASICMEMORY_SEARCH_TYPE", "text"),
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
        "system": "basicmemory",
        "displayName": "Basic Memory",
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
            "runner": "basic-memory-original-package",
            "package": f"basic-memory=={version('basic-memory')}",
            "searchType": os.environ.get("MEMORY_REALWORLD_BASICMEMORY_SEARCH_TYPE", "text"),
            "ingestRaw": ingest["raw"],
        },
    }


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


def slug(value: str) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "-" for char in value)
    return "-".join(part for part in cleaned.split("-") if part) or "item"


if __name__ == "__main__":
    raise SystemExit(main())
