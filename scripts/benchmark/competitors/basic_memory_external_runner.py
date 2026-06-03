#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ast
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any


QUESTION_NOISE = {
    "the", "and", "that", "this", "with", "from", "about", "what", "when", "where",
    "which", "would", "could", "should", "your", "their", "there", "have", "has",
    "been", "were", "was", "will", "into", "onto", "through", "based", "provided",
    "chat", "conversation", "information", "details", "specific",
}


def native_runner_root() -> Path:
    explicit = os.environ.get("COGNIBRAIN_NATIVE_RUNNER_ROOT")
    if explicit:
        return Path(explicit).expanduser().resolve()
    benchmark_root = os.environ.get("COGNIBRAIN_BENCHMARK_CACHE_ROOT")
    if benchmark_root:
        return (Path(benchmark_root).expanduser() / "native-runners").resolve()
    xdg = os.environ.get("XDG_CACHE_HOME")
    base = Path(xdg).expanduser() if xdg else Path.home() / ".cache"
    return (base / "cognibrain" / "native-runners").resolve()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="artifacts/external-basic-memory.json")
    parser.add_argument("--markdown", default="artifacts/docs/external-basic-memory.md")
    parser.add_argument("--limit-longmemeval", type=int, default=100)
    parser.add_argument("--limit-locomo", type=int, default=0)
    parser.add_argument("--work-dir", default=str(native_runner_root() / "external-basic-memory"))
    args = parser.parse_args()

    started = time.perf_counter()
    configure_environment(args.work_dir)
    from loguru import logger

    logger.remove()

    root = Path(args.work_dir)
    project_home = root / "home"
    if root.exists():
      shutil.rmtree(root)
    project_home.mkdir(parents=True, exist_ok=True)
    add_project(project_home)

    report = asyncio.run(run(args, project_home, started))
    write_json(Path(args.out), report)
    write_markdown(Path(args.markdown), report)
    print(json.dumps(compact_summary(report), indent=2))
    return 0 if report["passed"] else 1


async def run(args: argparse.Namespace, project_home: Path, started: float) -> dict[str, Any]:
    from importlib.metadata import version
    from basic_memory.mcp.tools.search import search_notes

    rows: list[dict[str, Any]] = []

    locomo = load_json("data/benchmarks/locomo/locomo10.json")
    locomo_questions = locomo_question_rows(locomo)
    if args.limit_locomo:
        locomo_questions = locomo_questions[: args.limit_locomo]
    write_locomo_notes(project_home, locomo, {row["sample_id"] for row in locomo_questions})
    progress(f"wrote locomo notes for {len(locomo_questions)} questions")

    lme = load_json("data/benchmarks/longmemeval/longmemeval_s_cleaned.json")
    lme_selected = lme[: args.limit_longmemeval] if args.limit_longmemeval else lme
    write_longmemeval_notes(project_home, lme_selected)
    progress(f"wrote longmemeval notes for {len(lme_selected)} items")

    beam_specs = [
        ("beam-100k-top5", "BEAM 100K", "data/benchmarks/beam/beam-100K.json", "artifacts/external-hard/beam-100k-top5.json", 5),
        ("beam-500k-top5", "BEAM 500K", "data/benchmarks/beam/beam-500K.json", "artifacts/external-hard/beam-500k-top5.json", 5),
        ("beam-1m-top5", "BEAM 1M", "data/benchmarks/beam/beam-1M.json", "artifacts/external-hard/beam-1m-top5.json", 5),
    ]
    beam_questions_by_label: dict[str, list[dict[str, Any]]] = {}
    for _, label, dataset_path, _, _ in beam_specs:
        beam_rows = load_json(dataset_path)
        beam_questions_by_label[label] = beam_question_rows(beam_rows)
        write_beam_notes(project_home, label, beam_rows)
        progress(f"wrote {label} notes for {len(beam_questions_by_label[label])} questions")

    indexed_files = reindex()
    progress(f"reindexed {indexed_files} Basic Memory notes")

    rows.append(await score_locomo(search_notes, locomo_questions, "artifacts/external-hard/locomo-top1-no-summaries.json", indexed_files))
    rows.append(await score_longmemeval(search_notes, lme_selected, "artifacts/external-hard/longmemeval-top1.json", indexed_files))
    for _, label, _, cognibrain_path, top_k in beam_specs:
        rows.append(await score_beam(search_notes, label, beam_questions_by_label[label], cognibrain_path, top_k, indexed_files))

    return {
        "schemaVersion": "1.0",
        "generatedAt": iso_now(),
        "mode": "external-basic-memory",
        "proofLevel": "same-run-native",
        "adapterMode": "basic-memory-markdown-reindex-mcp-search",
        "package": f"basic-memory=={version('basic-memory')}",
        "qualityClaimAllowed": all(row["basicMemory"]["scoreable"] for row in rows),
        "judge": external_public_judge_metadata(),
        "passed": all(row["basicMemory"]["total"] > 0 for row in rows),
        "durationMs": round((time.perf_counter() - started) * 1000),
        "rows": rows,
    }


async def score_locomo(search_notes: Any, questions: list[dict[str, Any]], cognibrain_path: str, indexed_files: int) -> dict[str, Any]:
    details = []
    for row in questions:
        results = await bm_search(search_notes, row["question"], [row["tag"]], 1)
        retrieved = [result.get("content", "") for result in results]
        passed = any(expected in "\n".join(retrieved) for expected in row["expected"])
        details.append({**row, "retrievedEvidence": evidence_ids(retrieved), "passed": passed})
        if len(details) % 100 == 0:
            progress(f"scored LoCoMo {len(details)}/{len(questions)}")
    return row_summary("LoCoMo", "evidence_recall_at_1_session_notes", details, cognibrain_path, indexed_files, {"topK": 1, "noteGranularity": "session"})


async def score_longmemeval(search_notes: Any, items: list[dict[str, Any]], cognibrain_path: str, indexed_files: int) -> dict[str, Any]:
    details = []
    for item in items:
        results = await bm_search(search_notes, item["question"], [user_tag(item["question_id"])], 1)
        retrieved = session_ids([result.get("content", "") for result in results])
        expected = item.get("answer_session_ids") or []
        details.append({
            "id": item["question_id"],
            "question": item["question"],
            "expected": expected,
            "retrievedEvidence": retrieved,
            "passed": any(session_id in retrieved for session_id in expected),
        })
        if len(details) % 25 == 0:
            progress(f"scored LongMemEval {len(details)}/{len(items)}")
    return row_summary("LongMemEval-S", "answer_session_recall_at_1_session_notes", details, cognibrain_path, indexed_files, {"topK": 1, "noteGranularity": "session", "items": len(items)})


async def score_beam(search_notes: Any, label: str, questions: list[dict[str, Any]], cognibrain_path: str, top_k: int, indexed_files: int) -> dict[str, Any]:
    details = []
    for question in questions:
        results = await bm_search(search_notes, question["question"], [user_tag(question["conversationId"]), dataset_tag(label)], top_k)
        retrieved_text = "\n".join(result.get("content", "") for result in results)
        score, threshold = beam_score(question, retrieved_text, len(results))
        details.append({
            "id": question["id"],
            "question": question["question"],
            "category": question["category"],
            "score": score,
            "threshold": threshold,
            "passed": score >= threshold,
        })
        if len(details) % 200 == 0:
            progress(f"scored {label} {len(details)}/{len(questions)}")
    return row_summary(label, "retrieval_nugget_score_at_5_message_notes", details, cognibrain_path, indexed_files, {"topK": top_k, "noteGranularity": "message"})


async def bm_search(search_notes: Any, query: str, tags: list[str], top_k: int) -> list[dict[str, Any]]:
    response = await asyncio.wait_for(
        search_notes(query=query, project="external", page_size=top_k, output_format="json", tags=tags, search_type="text"),
        timeout=30,
    )
    return response.get("results", []) if isinstance(response, dict) else []


def row_summary(dataset: str, metric: str, details: list[dict[str, Any]], cognibrain_path: str, indexed_files: int, config: dict[str, Any]) -> dict[str, Any]:
    correct = sum(1 for detail in details if detail["passed"])
    total = len(details)
    cognibrain = same_sample_cognibrain(cognibrain_path, {detail["id"] for detail in details})
    heuristic_accuracy = correct / max(1, total)
    heuristic = {
        "basicMemory": {"accuracy": heuristic_accuracy, "correct": correct, "total": total},
        "cognibrainSameSample": cognibrain,
        "deltaVsCognibrain": round(heuristic_accuracy - cognibrain["accuracy"], 4),
        "note": "Diagnostic only. These values are produced by evidence-id, token, or substring heuristics and are not quality scores.",
    }
    judged = external_public_judgement(dataset, metric, details, config, heuristic)
    if judged is None:
        basic_memory = {"accuracy": None, "correct": None, "total": total, "scoreable": False}
        cognibrain_scoreable = {"accuracy": None, "correct": None, "total": cognibrain["total"], "scoreable": False}
        delta = None
    else:
        basic_memory = {**judged["basicMemory"], "scoreable": True}
        cognibrain_scoreable = {**judged["cognibrainSameSample"], "scoreable": True}
        delta = round(basic_memory["accuracy"] - cognibrain_scoreable["accuracy"], 4)
    return {
        "dataset": dataset,
        "metric": metric,
        "config": config,
        "indexedFiles": indexed_files,
        "judge": external_public_judge_metadata(scoreable=judged is not None),
        "basicMemory": basic_memory,
        "cognibrainSameSample": cognibrain_scoreable,
        "deltaVsCognibrain": delta,
        "heuristicDiagnostics": heuristic,
        "details": details,
    }


def external_public_judgement(dataset: str, metric: str, details: list[dict[str, Any]], config: dict[str, Any], heuristic: dict[str, Any]) -> dict[str, Any] | None:
    command = os.environ.get("MEMORY_EXTERNAL_PUBLIC_JUDGE_COMMAND")
    if not command:
        return None
    payload = {
        "schemaVersion": "1.0",
        "contract": "cognibrain-external-public-benchmark-judge-v1",
        "dataset": dataset,
        "metric": metric,
        "config": config,
        "heuristicDiagnostics": heuristic,
        "details": details,
        "instructions": [
            "Judge semantic benchmark quality from retrieved evidence, not from exact string/id matches.",
            "Return strict JSON with basicMemory and cognibrainSameSample objects containing finite accuracy in 0..1 plus integer correct/total.",
            "If the evidence is insufficient for a score, return blocked=true with a reason.",
        ],
    }
    result = subprocess.run(command, input=json.dumps(payload), text=True, shell=True, capture_output=True, timeout=int(os.environ.get("MEMORY_EXTERNAL_PUBLIC_JUDGE_TIMEOUT_MS", "120000")) / 1000)
    if result.returncode != 0:
        return None
    try:
        parsed = json.loads(result.stdout.strip().splitlines()[-1])
    except Exception:
        return None
    if parsed.get("blocked"):
        return None
    try:
        return {
            "basicMemory": strict_score(parsed.get("basicMemory"), "basicMemory"),
            "cognibrainSameSample": strict_score(parsed.get("cognibrainSameSample"), "cognibrainSameSample"),
            "judgeRaw": parsed.get("judge"),
        }
    except ValueError:
        return None


def strict_score(value: Any, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} judge score must be an object")
    accuracy = value.get("accuracy")
    correct = value.get("correct")
    total = value.get("total")
    if not isinstance(accuracy, (int, float)) or not 0 <= float(accuracy) <= 1:
        raise ValueError(f"{name}.accuracy must be finite 0..1")
    if not isinstance(correct, int) or correct < 0:
        raise ValueError(f"{name}.correct must be a non-negative integer")
    if not isinstance(total, int) or total <= 0 or correct > total:
        raise ValueError(f"{name}.total must be a positive integer greater than correct")
    return {"accuracy": float(accuracy), "correct": correct, "total": total}


def external_public_judge_metadata(scoreable: bool = False) -> dict[str, Any]:
    command = os.environ.get("MEMORY_EXTERNAL_PUBLIC_JUDGE_COMMAND")
    if not command:
        return {
            "kind": "missing",
            "status": "blocked",
            "scoreable": False,
            "reason": "MEMORY_EXTERNAL_PUBLIC_JUDGE_COMMAND is required for scoreable external public benchmark metrics",
        }
    return {
        "kind": "llm-harness-command",
        "status": "passed" if scoreable else "configured",
        "scoreable": scoreable,
    }


def same_sample_cognibrain(path: str, ids: set[str]) -> dict[str, Any]:
    report = load_json(path)
    details = [detail for detail in report.get("ours", {}).get("details", []) if detail.get("id") in ids]
    if not details:
        details = report.get("ours", {}).get("details", [])
    correct = sum(1 for detail in details if detail.get("passed"))
    total = len(details)
    return {"accuracy": correct / max(1, total), "correct": correct, "total": total}


def write_locomo_notes(project_home: Path, samples: list[dict[str, Any]], selected_sample_ids: set[str]) -> None:
    for sample in samples:
        sample_id = sample["sample_id"]
        if sample_id not in selected_sample_ids:
            continue
        for session_id in session_keys(sample):
            turns = sample["conversation"][session_id]
            lines = [f"sample_id: {sample_id}", f"session_id: {session_id}"]
            for turn in turns:
                caption = f" image_caption: {turn.get('blip_caption')}" if turn.get("blip_caption") else ""
                lines.append(f"dia_id: {turn.get('dia_id')} speaker: {turn.get('speaker')} text: {turn.get('text')}{caption}")
            write_note(project_home, "locomo", f"{sample_id}-{session_id}", f"LoCoMo {sample_id} {session_id}", [dataset_tag("LoCoMo"), user_tag(sample_id)], "\n".join(lines))


def write_longmemeval_notes(project_home: Path, items: list[dict[str, Any]]) -> None:
    for item in items:
        qid = item["question_id"]
        for idx, turns in enumerate(item.get("haystack_sessions", [])):
            session_id = item.get("haystack_session_ids", [])[idx] if idx < len(item.get("haystack_session_ids", [])) else f"session_{idx}"
            date = item.get("haystack_dates", [])[idx] if idx < len(item.get("haystack_dates", [])) else ""
            lines = [f"question_id: {qid}", f"session_id: {session_id}", f"date: {date}"]
            lines.extend(f"{turn.get('role', 'unknown')}: {turn.get('content', '')}" for turn in turns)
            write_note(project_home, "longmemeval", f"{qid}-{idx}", f"LongMemEval {qid} {session_id}", [dataset_tag("LongMemEval-S"), user_tag(qid)], "\n".join(lines))


def write_beam_notes(project_home: Path, label: str, rows: list[dict[str, Any]]) -> None:
    for row in rows:
        conversation_id = row["conversation_id"]
        messages = flatten_messages(row.get("chat", []))
        chunk_size = 80
        for idx in range(0, len(messages), chunk_size):
            chunk = messages[idx : idx + chunk_size]
            lines = [f"conversation_id: {conversation_id}", f"message_range: {idx}-{idx + len(chunk) - 1}"]
            lines.extend(f"message_index: {message.get('index', offset)} role: {message.get('role', 'unknown')} content: {message.get('content', '')}" for offset, message in enumerate(chunk, start=idx))
            write_note(project_home, slug(label), f"{conversation_id}-{idx // chunk_size}", f"{label} {conversation_id} chunk {idx // chunk_size}", [dataset_tag(label), user_tag(conversation_id)], "\n".join(lines))


def locomo_question_rows(samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for sample in samples:
        for index, qa in enumerate(sample.get("qa", [])):
            if qa.get("category") == 5 or not qa.get("evidence"):
                continue
            sample_id = sample["sample_id"]
            rows.append({"id": f"{sample_id}:{index}", "sample_id": sample_id, "tag": user_tag(sample_id), "question": qa.get("question", ""), "expected": qa.get("evidence", [])})
    return rows


def beam_question_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    questions = []
    for row in rows:
        parsed = ast.literal_eval(row["probing_questions"])
        for category, items in parsed.items():
            for index, item in enumerate(items or []):
                ideal = str(item.get("ideal_response") or item.get("ideal_answer") or item.get("answer") or "")
                rubric = [str(value) for value in item.get("rubric", [])]
                questions.append({
                    "id": f"{row['conversation_id']}:{category}:{index}",
                    "conversationId": row["conversation_id"],
                    "category": category,
                    "question": str(item.get("question", "")),
                    "idealResponse": ideal,
                    "rubric": rubric,
                    "abstention": category == "abstention" or bool(item.get("why_unanswerable")) or "no information" in ideal.lower(),
                })
    return questions


def beam_score(question: dict[str, Any], retrieved_text: str, retrieved_count: int) -> tuple[float, float]:
    if question["abstention"]:
        q_tokens = [token for token in tokenize(question["question"]) if token not in QUESTION_NOISE]
        if not q_tokens or retrieved_count == 0:
            return 1.0, 0.72
        retrieved = set(tokenize(retrieved_text))
        support = sum(1 for token in q_tokens if token in retrieved) / len(q_tokens)
        return 1 - support, 0.72
    retrieved = set(tokenize(retrieved_text))
    best = 0.0
    for nugget in [question["idealResponse"], *question["rubric"]]:
        tokens = [token for token in tokenize(nugget) if token not in QUESTION_NOISE]
        if not tokens:
            continue
        best = max(best, sum(1 for token in tokens if token in retrieved) / len(tokens))
    return best, 0.62


def evidence_ids(contents: list[str]) -> list[str]:
    found = []
    for content in contents:
        found.extend(re.findall(r"dia_id:\s*([^\s]+)", content))
    return found


def session_ids(contents: list[str]) -> list[str]:
    found = []
    for content in contents:
        found.extend(re.findall(r"session_id:\s*([^\s]+)", content))
    return found


def flatten_messages(value: Any) -> list[dict[str, Any]]:
    messages = []
    if isinstance(value, list):
        for child in value:
            messages.extend(flatten_messages(child))
    elif isinstance(value, dict):
        if isinstance(value.get("content"), str):
            messages.append(value)
            return messages
        for child in value.values():
            if isinstance(child, (list, dict)):
                messages.extend(flatten_messages(child))
    return messages


def session_keys(sample: dict[str, Any]) -> list[str]:
    return sorted([key for key, value in sample["conversation"].items() if re.match(r"session_\d+$", key) and isinstance(value, list)], key=lambda key: int(key.split("_")[1]))


def write_note(project_home: Path, folder: str, name: str, title: str, tags: list[str], content: str) -> None:
    directory = project_home / folder
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{slug(name)[:120]}.md"
    tag_lines = "\n".join(f"  - {tag}" for tag in tags)
    path.write_text(f"---\ntitle: {json.dumps(title)}\ntype: note\ntags:\n{tag_lines}\n---\n\n{content}\n", encoding="utf-8")


def reindex() -> int:
    progress("starting Basic Memory reindex")
    result = subprocess.run([sys.executable, "-m", "basic_memory.cli.main", "reindex", "--full", "--search", "--project", "external"], text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(f"Basic Memory reindex failed: {result.stderr[-2000:]}")
    match = re.search(r"Indexing files\.\.\. (\d+)/(\d+) files", result.stdout)
    return int(match.group(2)) if match else 0


def progress(message: str) -> None:
    print(f"[basic-memory-external] {message}", file=sys.stderr, flush=True)


def add_project(project_home: Path) -> None:
    result = subprocess.run([sys.executable, "-m", "basic_memory.cli.main", "project", "add", "external", str(project_home), "--default", "--local"], text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(f"Basic Memory project add failed: {result.stderr[-2000:]}")


def configure_environment(work_dir: str) -> None:
    root = Path(work_dir)
    os.environ["BASIC_MEMORY_CONFIG_DIR"] = str(root / "config")
    os.environ["BASIC_MEMORY_ENV"] = "test"
    os.environ["BASIC_MEMORY_NO_PROMOS"] = "1"
    os.environ["BASIC_MEMORY_LOG_LEVEL"] = "ERROR"
    os.environ["BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED"] = "false"
    os.environ["LOGFIRE_IGNORE_NO_CONFIG"] = "1"
    os.environ.pop("BASIC_MEMORY_HOME", None)


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9_]+", text.lower())


def user_tag(value: str) -> str:
    return f"user_{slug(value)}"


def dataset_tag(value: str) -> str:
    return f"dataset_{slug(value)}"


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", value.lower()).strip("-") or "item"


def load_json(path: str) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2), encoding="utf-8")


def write_markdown(path: Path, report: dict[str, Any]) -> None:
    lines = [
        "# Basic Memory External Benchmark",
        "",
        f"Generated: {report['generatedAt']}",
        "",
        "| Dataset | Metric | Basic Memory | Cognibrain same sample | Delta | Notes |",
        "| --- | --- | ---: | ---: | ---: | --- |",
    ]
    for row in report["rows"]:
        bm = row["basicMemory"]["accuracy"]
        cb = row["cognibrainSameSample"]["accuracy"]
        delta = row["deltaVsCognibrain"]
        note = "LLM/harness judged" if row["basicMemory"]["scoreable"] else "diagnostic only; judge blocked"
        lines.append(f"| {row['dataset']} | `{row['metric']}` | {pct(bm)} | {pct(cb)} | {pct(delta, signed=True)} | {row['config']['noteGranularity']} notes; {note} |")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def compact_summary(report: dict[str, Any]) -> dict[str, Any]:
    return {
        "generatedAt": report["generatedAt"],
        "passed": report["passed"],
        "package": report["package"],
        "rows": [
            {
                "dataset": row["dataset"],
                "metric": row["metric"],
                "basicMemory": row["basicMemory"],
                "cognibrainSameSample": row["cognibrainSameSample"],
                "deltaVsCognibrain": row["deltaVsCognibrain"],
                "judge": row["judge"],
            }
            for row in report["rows"]
        ],
    }


def pct(value: float | None, signed: bool = False) -> str:
    if value is None:
        return "not scored"
    sign = "+" if signed and value >= 0 else ""
    return f"{sign}{value * 100:.1f}%"


def iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


if __name__ == "__main__":
    raise SystemExit(main())
