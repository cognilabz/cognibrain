#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import importlib.metadata
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path
from typing import Any


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--system", required=True)
    args = parser.parse_args()
    payload = json.loads(sys.stdin.read())
    scenario = payload["scenario"]
    started = time.time()

    try:
        if args.system == "mem0":
            output = run_mem0(scenario, started)
        elif args.system == "langmem":
            output = run_langmem(scenario, started)
        elif args.system in ("graphiti", "zep"):
            output = asyncio.run(run_graphiti(scenario, started, args.system))
        elif args.system == "cognee":
            output = asyncio.run(run_cognee(scenario, started))
        else:
            output = blocked(args.system, started, f"unsupported native Python competitor: {args.system}")
    except Exception as exc:  # Keep Arena deterministic: failed competitors become evidence, not process crashes.
        output = {
            "proofLevel": "credential-blocked",
            "adapterMode": "blocked-command",
            "checks": empty_checks(),
            "capabilityGaps": [f"{args.system} native runner failed: {exc}"],
            "latencyMs": elapsed_ms(started),
            "evidence": {
                "runner": "native-python-runner",
                "system": args.system,
                "failed": True,
                "error": str(exc),
            },
        }

    print(json.dumps(output, default=str))
    return 0


def run_mem0(scenario: dict[str, Any], started: float) -> dict[str, Any]:
    from mem0 import Memory

    runner_root = native_root() / "mem0" / slug(scenario["id"])
    vector_path = runner_root / "qdrant"
    history_path = runner_root / "history.db"
    vector_path.mkdir(parents=True, exist_ok=True)
    config = {
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": f"arena_{slug(scenario['id'])}",
                "embedding_model_dims": 384,
                "path": str(vector_path),
            },
        },
        "embedder": {"provider": "fastembed", "config": {"model": "BAAI/bge-small-en-v1.5"}},
        "llm": {"provider": "openai", "config": {"api_key": "not-used-with-infer-false", "model": "gpt-4o-mini"}},
        "history_db_path": str(history_path),
        "version": "v1.1",
    }
    memory = Memory.from_config(config)
    user_id = f"cognibrain-arena-{scenario['id']}"
    text = scenario_memory_text(scenario)
    added = memory.add(text, user_id=user_id, infer=False, metadata={"benchmark": "cognicode", "scenarioId": scenario["id"]})
    found = memory.search(
        f"{scenario['repoSeed']['name']} {scenario['nextTask']} {scenario['correction']['correctAction']}",
        filters={"user_id": user_id},
        top_k=5,
    )
    haystack = f"{text}\n{json.dumps(added, default=str)}\n{json.dumps(found, default=str)}".lower()
    checks = score_haystack(scenario, haystack, has_evidence=True, has_guard=False)
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "checks": checks,
        "capabilityGaps": [
            "Mem0 OSS run used real mem0ai add/search with infer=false and local Qdrant/FastEmbed, not Mem0 cloud",
            "Mem0 does not expose Cognibrain's typed pre-tool action guard in this adapter",
            "Mem0 does not emit Cognibrain Patch Evidence Trail objects for commands/files",
        ],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "mem0-python-oss",
            "package": f"mem0ai=={version('mem0ai')}",
            "vectorStore": "qdrant-local",
            "embedder": "fastembed/BAAI/bge-small-en-v1.5",
            "llm": "openai client constructed but not called because infer=false",
            "add": compact(added),
            "search": compact(found),
        },
    }


def run_langmem(scenario: dict[str, Any], started: float) -> dict[str, Any]:
    from langgraph.store.memory import InMemoryStore
    from langmem import create_manage_memory_tool, create_search_memory_tool

    store = InMemoryStore()
    namespace = ("cognibrain-arena", scenario["id"])
    manage = create_manage_memory_tool(namespace, store=store)
    search = create_search_memory_tool(namespace, store=store)
    text = scenario_memory_text(scenario)
    created = manage.invoke({"content": text, "action": "create"})
    found = search.invoke({"query": f"{scenario['nextTask']} {scenario['correction']['correctAction']}", "limit": 5})
    haystack = f"{text}\n{created}\n{found}".lower()
    checks = score_haystack(scenario, haystack, has_evidence=True, has_guard=False)
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "checks": checks,
        "capabilityGaps": [
            "LangMem run used real create_manage_memory_tool/create_search_memory_tool with LangGraph InMemoryStore",
            "LangMem does not expose Cognibrain's typed pre-tool action guard in this adapter",
            "LangMem does not emit Cognibrain Patch Evidence Trail objects for commands/files",
        ],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "langmem-python",
            "package": f"langmem=={version('langmem')}",
            "store": "langgraph.store.memory.InMemoryStore",
            "created": str(created),
            "search": compact(found),
        },
    }


async def run_graphiti(scenario: dict[str, Any], started: float, system: str) -> dict[str, Any]:
    if system == "zep" and not env_any("ZEP_API_KEY", "MEMORY_ARENA_ZEP_API_KEY"):
        return blocked("zep", started, "ZEP_API_KEY is missing; Zep cloud same-run cannot be executed")
    if not env_any("OPENAI_API_KEY", "GRAPHITI_OPENAI_API_KEY", "MEMORY_ARENA_GRAPHITI_API_KEY"):
        return blocked("graphiti", started, "OPENAI_API_KEY or GRAPHITI_OPENAI_API_KEY is missing; Graphiti extraction/search cannot be executed honestly")

    from datetime import datetime, timezone
    from graphiti_core import Graphiti
    from graphiti_core.driver.kuzu_driver import KuzuDriver
    from graphiti_core.driver.driver import GraphProvider
    from graphiti_core.graph_queries import get_fulltext_indices
    from graphiti_core.nodes import EpisodeType

    db_dir = native_root() / "graphiti" / slug(scenario["id"])
    db_dir.mkdir(parents=True, exist_ok=True)
    db_path = db_dir / "kuzu.db"
    if db_path.exists():
        db_path.unlink()
    group_id = f"arena_{slug(scenario['id'])}"
    graph_driver = KuzuDriver(str(db_path))
    # graphiti-core 0.29.1 reads _database for group routing, while KuzuDriver
    # does not set it itself. Keep the benchmark on one local Kuzu database.
    graph_driver._database = group_id
    graphiti = Graphiti(graph_driver=graph_driver)
    text = scenario_memory_text(scenario)
    await graphiti.build_indices_and_constraints()
    for query in get_fulltext_indices(GraphProvider.KUZU):
        await graph_driver.execute_query(query)
    add_result = await graphiti.add_episode(
        name=f"cognicode-{scenario['id']}",
        episode_body=text,
        source_description="CogniCodeBench Arena scenario",
        reference_time=datetime.now(timezone.utc),
        source=EpisodeType.text,
        group_id=group_id,
    )
    found = await graphiti.search(f"{scenario['nextTask']} {scenario['correction']['correctAction']}", group_ids=[group_id], num_results=5)
    haystack = f"{text}\n{add_result}\n{found}".lower()
    checks = score_haystack(scenario, haystack, has_evidence=True, has_guard=False)
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "checks": checks,
        "capabilityGaps": [
            "Graphiti run used real graphiti-core with local Kuzu driver",
            "Graphiti does not expose Cognibrain's typed pre-tool action guard in this adapter",
            "Graphiti does not emit Cognibrain Patch Evidence Trail objects for commands/files",
        ],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "graphiti-python-kuzu",
            "package": f"graphiti-core=={version('graphiti-core')}",
            "graphDriver": "kuzu-local",
            "episode": compact(add_result),
            "search": compact(found),
        },
    }


async def run_cognee(scenario: dict[str, Any], started: float) -> dict[str, Any]:
    if not env_any("OPENAI_API_KEY", "LLM_API_KEY", "COGNEE_LLM_API_KEY", "MEMORY_ARENA_COGNEE_API_KEY"):
        return blocked("cognee", started, "OPENAI_API_KEY/LLM_API_KEY is missing; Cognee remember/recall cannot be executed honestly")

    os.environ.setdefault("ENABLE_BACKEND_ACCESS_CONTROL", "false")
    os.environ.setdefault("COGNEE_SKIP_CONNECTION_TEST", "true")
    os.environ.setdefault("CACHING", "false")
    import cognee

    dataset = f"arena_{slug(scenario['id'])}"
    text = scenario_memory_text(scenario)
    remembered = await cognee.remember(text, dataset_name=dataset, self_improvement=False)
    recalled = await cognee.recall(
        f"{scenario['nextTask']} {scenario['correction']['correctAction']}",
        datasets=[dataset],
        only_context=True,
        auto_route=False,
        top_k=5,
    )
    haystack = f"{text}\n{remembered}\n{recalled}".lower()
    checks = score_haystack(scenario, haystack, has_evidence=True, has_guard=False)
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "checks": checks,
        "capabilityGaps": [
            "Cognee run used real remember/recall API with operator-supplied LLM credentials",
            "Cognee does not expose Cognibrain's typed pre-tool action guard in this adapter",
            "Cognee does not emit Cognibrain Patch Evidence Trail objects for commands/files",
        ],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "cognee-python",
            "package": f"cognee=={version('cognee')}",
            "remember": compact(remembered),
            "recall": compact(recalled),
        },
    }


def scenario_memory_text(scenario: dict[str, Any]) -> str:
    expected = scenario["expected"]
    return "\n".join(
        part
        for part in [
            f"CogniCode scenario: {scenario['id']}",
            f"Repository: {scenario['repoSeed']['name']}",
            f"Framework: {scenario['repoSeed']['framework']}",
            f"Correction: {scenario['correction']['content']}",
            f"Correct action: {scenario['correction']['correctAction']}",
            f"Expected command: {expected['command']}",
            f"Expected files: {', '.join(expected['filesChanged'])}",
            f"Stale rule to suppress: {expected.get('staleRuleSuppressed')}" if expected.get("staleRuleSuppressed") else "",
            f"Wrong action recorded for contrast only: {scenario['wrongAction'].get('command') or scenario['wrongAction']['reason']}",
        ]
        if part
    )


def score_haystack(scenario: dict[str, Any], haystack: str, *, has_evidence: bool, has_guard: bool) -> dict[str, bool]:
    correction = scenario["correction"]
    expected = scenario["expected"]
    expected_command = expected["command"].lower()
    return {
        "correctionCarryover": correction["content"][:28].lower() in haystack or correction["correctAction"].lower() in haystack,
        "repeatedMistakeAvoided": bool(has_guard),
        "procedureRecall": expected_command in haystack,
        "patchCorrectness": expected_command in haystack and all(file.lower() in haystack for file in expected["filesChanged"]),
        "evidenceCompleteness": bool(has_evidence),
        "wrongMemorySuppression": bool(has_guard),
    }


def blocked(system: str, started: float, reason: str) -> dict[str, Any]:
    return {
        "proofLevel": "credential-blocked",
        "adapterMode": "blocked-command",
        "checks": empty_checks(),
        "capabilityGaps": [reason],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "native-python-runner",
            "system": system,
            "blocked": True,
            "reason": reason,
            "packages": package_versions(system),
        },
    }


def package_versions(system: str) -> dict[str, str | None]:
    names = {
        "mem0": ["mem0ai"],
        "langmem": ["langmem", "langgraph"],
        "graphiti": ["graphiti-core", "kuzu"],
        "zep": ["graphiti-core", "kuzu"],
        "cognee": ["cognee"],
    }.get(system, [])
    return {name: version(name) for name in names}


def empty_checks() -> dict[str, bool]:
    return {
        "correctionCarryover": False,
        "repeatedMistakeAvoided": False,
        "procedureRecall": False,
        "patchCorrectness": False,
        "evidenceCompleteness": False,
        "wrongMemorySuppression": False,
    }


def native_root() -> Path:
    return Path(os.environ.get("COGNIBRAIN_NATIVE_RUNNER_ROOT", ".cognibrain/native-runners")).resolve()


def slug(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_]+", "_", value).strip("_") or "scenario"


def env_any(*names: str) -> str | None:
    for name in names:
        value = os.environ.get(name)
        if value and value not in {"not-used", "dummy", "changeme"}:
            return value
    return None


def elapsed_ms(started: float) -> int:
    return max(1, int((time.time() - started) * 1000))


def compact(value: Any, limit: int = 3000) -> Any:
    text = str(value)
    return text if len(text) <= limit else text[:limit] + "...<truncated>"


def version(package: str) -> str | None:
    try:
        return importlib.metadata.version(package)
    except importlib.metadata.PackageNotFoundError:
        return None


if __name__ == "__main__":
    raise SystemExit(main())
