#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import importlib.metadata
import json
import os
import re
import shutil
import subprocess
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
        elif args.system == "basicmemory":
            output = run_basicmemory(scenario, started)
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
            "capabilityGaps": [f"{args.system} native runner failed: {exc}"],
            "runnerContract": arena_runner_contract(),
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
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "runnerContract": arena_runner_contract(),
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
            "note": "Raw runner evidence only. Scenario checks must be produced by MEMORY_ARENA_JUDGE_COMMAND; this runner does not self-score.",
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
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "runnerContract": arena_runner_contract(),
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
            "note": "Raw runner evidence only. Scenario checks must be produced by MEMORY_ARENA_JUDGE_COMMAND; this runner does not self-score.",
            "created": str(created),
            "search": compact(found),
        },
    }


def run_basicmemory(scenario: dict[str, Any], started: float) -> dict[str, Any]:
    """Run the same scenario through Basic Memory's local CLI/MCP-backed path."""
    version_value = version("basic-memory")
    if not version_value:
        return blocked("basicmemory", started, "basic-memory package is not installed in the native competitor venv")

    runner_root = native_root() / "basicmemory" / slug(scenario["id"])
    config_dir = runner_root / "config"
    project_home = runner_root / "home"
    if runner_root.exists():
        shutil.rmtree(runner_root)
    config_dir.mkdir(parents=True, exist_ok=True)
    project_home.mkdir(parents=True, exist_ok=True)

    env = {
        **os.environ,
        "BASIC_MEMORY_CONFIG_DIR": str(config_dir),
        "BASIC_MEMORY_ENV": "test",
        "BASIC_MEMORY_NO_PROMOS": "1",
        "BASIC_MEMORY_LOG_LEVEL": "ERROR",
        "BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED": "false",
    }
    env.pop("BASIC_MEMORY_HOME", None)

    title = f"CogniCode {scenario['id']}"
    content = basicmemory_note_text(scenario)
    commands = [
        cli_command(["project", "add", "arena", str(project_home), "--default", "--local"], env),
        cli_command(["tool", "write-note", "--title", title, "--folder", "cognicode", "--content", content, "--project", "arena", "--local"], env),
        cli_command(["tool", "search-notes", f"{scenario['nextTask']} {scenario['correction']['correctAction']}", "--project", "arena", "--local", "--page-size", "5"], env),
        cli_command(["tool", "build-context", "memory://arena/cognicode/*", "--project", "arena", "--local", "--depth", "2"], env),
    ]
    failed = [entry for entry in commands if entry["status"] != 0]
    if failed:
        return {
            "proofLevel": "credential-blocked",
            "adapterMode": "blocked-command",
            "capabilityGaps": ["Basic Memory CLI runner failed before completing write/search/context"],
            "runnerContract": arena_runner_contract(),
            "latencyMs": elapsed_ms(started),
            "evidence": {
                "runner": "basic-memory-cli",
                "package": f"basic-memory=={version_value}",
                "commands": commands,
            },
        }

    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "runnerContract": arena_runner_contract(),
        "capabilityGaps": [
            "Basic Memory run used the real local CLI/MCP/API path with an isolated SQLite-backed project",
            "Basic Memory stores durable Markdown notes and graph context, but this adapter found no typed pre-tool action guard",
            "Basic Memory does not emit Cognibrain Patch Evidence Trail objects for commands/files",
        ],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "basic-memory-cli",
            "package": f"basic-memory=={version_value}",
            "projectHome": str(project_home),
            "configDir": str(config_dir),
            "note": "Raw runner evidence only. Scenario checks must be produced by MEMORY_ARENA_JUDGE_COMMAND; this runner does not self-score.",
            "commands": commands,
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
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "runnerContract": arena_runner_contract(),
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
            "note": "Raw runner evidence only. Scenario checks must be produced by MEMORY_ARENA_JUDGE_COMMAND; this runner does not self-score.",
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
    return {
        "proofLevel": "same-run-native",
        "adapterMode": "native-command",
        "runnerContract": arena_runner_contract(),
        "capabilityGaps": [
            "Cognee run used real remember/recall API with operator-supplied LLM credentials",
            "Cognee does not expose Cognibrain's typed pre-tool action guard in this adapter",
            "Cognee does not emit Cognibrain Patch Evidence Trail objects for commands/files",
        ],
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "cognee-python",
            "package": f"cognee=={version('cognee')}",
            "note": "Raw runner evidence only. Scenario checks must be produced by MEMORY_ARENA_JUDGE_COMMAND; this runner does not self-score.",
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


def basicmemory_note_text(scenario: dict[str, Any]) -> str:
    expected = scenario["expected"]
    return "\n".join(
        [
            f"# CogniCode {scenario['id']}",
            "",
            "## Observations",
            f"- [repository] {scenario['repoSeed']['name']}",
            f"- [correction] {scenario['correction']['content']}",
            f"- [correct_action] {scenario['correction']['correctAction']}",
            f"- [expected_command] {expected['command']}",
            f"- [expected_files] {', '.join(expected['filesChanged'])}",
            f"- [wrong_action] {scenario['wrongAction'].get('command') or scenario['wrongAction']['reason']}",
            "",
            "## Relations",
            "- applies_to [[CogniCode Arena]]",
            "- relates_to [[Patch Evidence]]",
        ]
    )


def blocked(system: str, started: float, reason: str) -> dict[str, Any]:
    return {
        "proofLevel": "credential-blocked",
        "adapterMode": "blocked-command",
        "capabilityGaps": [reason],
        "runnerContract": arena_runner_contract(),
        "latencyMs": elapsed_ms(started),
        "evidence": {
            "runner": "native-python-runner",
            "system": system,
            "blocked": True,
            "reason": reason,
            "packages": package_versions(system),
        },
    }


def arena_runner_contract() -> dict[str, Any]:
    return {
        "rawEvidenceOnly": True,
        "selfScoredChecksAllowed": False,
        "scoreableChecksRequireJudge": True,
        "judgeEnv": "MEMORY_ARENA_JUDGE_COMMAND",
        "judgeProtocol": "cognibrain-arena-llm-harness-judge-v1",
    }


def package_versions(system: str) -> dict[str, str | None]:
    names = {
        "mem0": ["mem0ai"],
        "langmem": ["langmem", "langgraph"],
        "graphiti": ["graphiti-core", "kuzu"],
        "zep": ["graphiti-core", "kuzu"],
        "cognee": ["cognee"],
        "basicmemory": ["basic-memory"],
    }.get(system, [])
    return {name: version(name) for name in names}


def native_root() -> Path:
    explicit = os.environ.get("COGNIBRAIN_NATIVE_RUNNER_ROOT")
    if explicit:
        return Path(explicit).expanduser().resolve()
    benchmark_root = os.environ.get("COGNIBRAIN_BENCHMARK_CACHE_ROOT")
    if benchmark_root:
        return (Path(benchmark_root).expanduser() / "native-runners").resolve()
    xdg = os.environ.get("XDG_CACHE_HOME")
    base = Path(xdg).expanduser() if xdg else Path.home() / ".cache"
    return (base / "cognibrain" / "native-runners").resolve()


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


def cli_command(args: list[str], env: dict[str, str]) -> dict[str, Any]:
    result = subprocess.run(
        [sys.executable, "-m", "basic_memory.cli.main", *args],
        env=env,
        text=True,
        capture_output=True,
        timeout=int(os.environ.get("MEMORY_ARENA_BASICMEMORY_CLI_TIMEOUT_MS", "30000")) / 1000,
    )
    return {
        "argv": ["python", "-m", "basic_memory.cli.main", *args],
        "status": result.returncode,
        "stdout": compact(result.stdout, 3000),
        "stderr": compact(result.stderr, 2000),
    }


if __name__ == "__main__":
    raise SystemExit(main())
