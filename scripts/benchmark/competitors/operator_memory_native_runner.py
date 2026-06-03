#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import importlib.metadata
import json
import os
import re
import sys
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
            output = blocked(args.system, started, f"unsupported operator-memory native competitor: {args.system}")
    except Exception as exc:
        output = {
            "proofLevel": "credential-blocked",
            "adapterMode": "blocked-command",
            "capabilityGaps": [f"{args.system} operator-memory native runner failed: {exc}"],
            "latencyMs": elapsed_ms(started),
            "evidence": {
                "runner": "operator-memory-native-python-runner",
                "system": args.system,
                "failed": True,
                "error": str(exc),
            },
        }

    print(json.dumps(output, default=str))
    return 0


def run_mem0(scenario: dict[str, Any], started: float) -> dict[str, Any]:
    from mem0 import Memory

    runner_root = native_root() / "operator-memory" / "mem0" / slug(scenario["id"])
    vector_path = runner_root / "qdrant"
    history_path = runner_root / "history.db"
    vector_path.mkdir(parents=True, exist_ok=True)
    config = {
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": f"operator_memory_{slug(scenario['id'])}",
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
    user_id = f"operator-memory-{scenario['id']}"
    written = []
    for text in memory_inputs(scenario):
        written.append(memory.add(text, user_id=user_id, infer=False, metadata=metadata(scenario)))
    found = memory.search(scenario["query"], filters={"user_id": user_id}, top_k=5)
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "capabilityGaps": [
            "Mem0 OSS run used real mem0ai add/search with infer=false and local Qdrant/FastEmbed",
            "Mem0 retrieved memories but did not run source-aware Dream, sourceRef revalidation or connector failure accounting",
            "Mem0 does not emit Cognibrain beliefState/superseded evidence in this adapter",
        ],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "operator-memory-mem0-python-oss",
            "package": f"mem0ai=={version('mem0ai')}",
            "vectorStore": "qdrant-local",
            "embedder": "fastembed/BAAI/bge-small-en-v1.5",
            "llm": "openai client constructed but not called because infer=false",
            "note": "Raw runner evidence only. Source-aware checks must be produced by MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND; this runner does not self-score.",
            "written": compact(written),
            "search": compact(found),
        },
    }


def run_langmem(scenario: dict[str, Any], started: float) -> dict[str, Any]:
    from langgraph.store.memory import InMemoryStore
    from langmem import create_manage_memory_tool, create_search_memory_tool

    store = InMemoryStore()
    namespace = ("operator-memory", scenario["id"])
    manage = create_manage_memory_tool(namespace, store=store)
    search = create_search_memory_tool(namespace, store=store)
    written = [manage.invoke({"content": text, "action": "create"}) for text in memory_inputs(scenario)]
    found = search.invoke({"query": scenario["query"], "limit": 5})
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "capabilityGaps": [
            "LangMem run used real create_manage_memory_tool/create_search_memory_tool with LangGraph InMemoryStore",
            "LangMem retrieved memories but did not run source-aware Dream, sourceRef revalidation or connector failure accounting",
            "LangMem does not emit Cognibrain beliefState/superseded evidence in this adapter",
        ],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "operator-memory-langmem-python",
            "package": f"langmem=={version('langmem')}",
            "store": "langgraph.store.memory.InMemoryStore",
            "note": "Raw runner evidence only. Source-aware checks must be produced by MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND; this runner does not self-score.",
            "written": compact(written),
            "search": compact(found),
        },
    }


async def run_graphiti(scenario: dict[str, Any], started: float, system: str) -> dict[str, Any]:
    if system == "zep" and not env_any("ZEP_API_KEY", "MEMORY_OPERATOR_MEMORY_ZEP_API_KEY"):
        return blocked("zep", started, "ZEP_API_KEY is missing; Zep cloud same-run cannot be executed")
    if not env_any("OPENAI_API_KEY", "GRAPHITI_OPENAI_API_KEY", "MEMORY_OPERATOR_MEMORY_GRAPHITI_API_KEY"):
        return blocked("graphiti", started, "OPENAI_API_KEY or GRAPHITI_OPENAI_API_KEY is missing; Graphiti extraction/search cannot be executed honestly")

    from datetime import datetime, timezone
    from graphiti_core import Graphiti
    from graphiti_core.driver.driver import GraphProvider
    from graphiti_core.driver.kuzu_driver import KuzuDriver
    from graphiti_core.graph_queries import get_fulltext_indices
    from graphiti_core.nodes import EpisodeType

    db_dir = native_root() / "operator-memory" / "graphiti" / slug(scenario["id"])
    db_dir.mkdir(parents=True, exist_ok=True)
    db_path = db_dir / "kuzu.db"
    if db_path.exists():
        db_path.unlink()
    group_id = f"operator_memory_{slug(scenario['id'])}"
    graph_driver = KuzuDriver(str(db_path))
    graph_driver._database = group_id
    graphiti = Graphiti(graph_driver=graph_driver)
    await graphiti.build_indices_and_constraints()
    for query in get_fulltext_indices(GraphProvider.KUZU):
        await graph_driver.execute_query(query)
    episodes = []
    for index, text in enumerate(memory_inputs(scenario)):
        episodes.append(await graphiti.add_episode(
            name=f"operator-memory-{scenario['id']}-{index}",
            episode_body=text,
            source_description="Operator Memory Dream Benchmark",
            reference_time=datetime.now(timezone.utc),
            source=EpisodeType.text,
            group_id=group_id,
        ))
    found = await graphiti.search(scenario["query"], group_ids=[group_id], num_results=5)
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "capabilityGaps": [
            "Graphiti run used real graphiti-core with local Kuzu driver",
            "Graphiti retrieved graph memories but did not run Cognibrain source-aware Dream or connector failure accounting in this adapter",
        ],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "operator-memory-graphiti-python-kuzu",
            "package": f"graphiti-core=={version('graphiti-core')}",
            "graphDriver": "kuzu-local",
            "note": "Raw runner evidence only. Source-aware checks must be produced by MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND; this runner does not self-score.",
            "episodes": compact(episodes),
            "search": compact(found),
        },
    }


async def run_cognee(scenario: dict[str, Any], started: float) -> dict[str, Any]:
    if not env_any("OPENAI_API_KEY", "LLM_API_KEY", "COGNEE_LLM_API_KEY", "MEMORY_OPERATOR_MEMORY_COGNEE_API_KEY"):
        return blocked("cognee", started, "OPENAI_API_KEY/LLM_API_KEY is missing; Cognee remember/recall cannot be executed honestly")

    os.environ.setdefault("ENABLE_BACKEND_ACCESS_CONTROL", "false")
    os.environ.setdefault("COGNEE_SKIP_CONNECTION_TEST", "true")
    os.environ.setdefault("CACHING", "false")
    import cognee

    dataset = f"operator_memory_{slug(scenario['id'])}"
    remembered = []
    for text in memory_inputs(scenario):
        remembered.append(await cognee.remember(text, dataset_name=dataset, self_improvement=False))
    recalled = await cognee.recall(scenario["query"], datasets=[dataset], only_context=True, auto_route=False, top_k=5)
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "capabilityGaps": [
            "Cognee run used real remember/recall API with operator-supplied LLM credentials",
            "Cognee retrieved knowledge but did not run Cognibrain source-aware Dream or connector failure accounting in this adapter",
        ],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "operator-memory-cognee-python",
            "package": f"cognee=={version('cognee')}",
            "note": "Raw runner evidence only. Source-aware checks must be produced by MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND; this runner does not self-score.",
            "remember": compact(remembered),
            "recall": compact(recalled),
        },
    }


def memory_inputs(scenario: dict[str, Any]) -> list[str]:
    if scenario["kind"] == "connector_failure":
        return [scenario["currentContent"]]
    if scenario["kind"] == "source_deleted":
        return [scenario["staleContent"]]
    values = [scenario["staleContent"]]
    current = scenario.get("currentContent")
    if current:
        values.append(current)
    return values


def metadata(scenario: dict[str, Any]) -> dict[str, Any]:
    return {
        "benchmark": "operator-memory-dream",
        "scenarioId": scenario["id"],
        "connectorId": scenario.get("connectorId"),
        "kind": scenario["kind"],
    }


def blocked(system: str, started: float, reason: str) -> dict[str, Any]:
    return {
        "proofLevel": "credential-blocked",
        "adapterMode": "blocked-command",
        "capabilityGaps": [reason],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "operator-memory-native-python-runner",
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


def compact(value: Any, limit: int = 3000) -> str:
    text = str(value)
    return text if len(text) <= limit else text[:limit] + "...<truncated>"


def version(package: str) -> str | None:
    try:
        return importlib.metadata.version(package)
    except importlib.metadata.PackageNotFoundError:
        return None


if __name__ == "__main__":
    raise SystemExit(main())
