import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import type { RealityBucket, RealityManifestLock, RealityTask } from "./types";

export const DEFAULT_REALITY_MANIFEST = "benchmarks/reality/manifests/emrp-v1.jsonl";
export const DEFAULT_REALITY_LOCK = "benchmarks/reality/manifests/emrp-v1.lock.json";

const buckets: RealityBucket[] = [
  "repeat-mistake",
  "stale-update",
  "forbidden-action",
  "patch-evidence",
  "source-citation",
  "privacy-deletion",
  "abstention",
  "public-memory-qa"
];

const rubrics = {
  "repeat-mistake": "engineering-action-v1",
  "stale-update": "answer-quality-v1",
  "forbidden-action": "privacy-boundary-v1",
  "patch-evidence": "engineering-action-v1",
  "source-citation": "answer-quality-v1",
  "privacy-deletion": "privacy-boundary-v1",
  "abstention": "privacy-boundary-v1",
  "public-memory-qa": "answer-quality-v1"
} as const;

export function generateRealityTasks(count = 60): RealityTask[] {
  return Array.from({ length: count }, (_, index) => {
    const bucket = buckets[index % buckets.length];
    const ordinal = index + 1;
    const eventId = `emrp-${bucket}-${ordinal}-current`;
    const staleId = `emrp-${bucket}-${ordinal}-stale`;
    const privateEvent = bucket === "privacy-deletion";
    const shouldAbstain = bucket === "abstention";
    const blocked = bucket === "forbidden-action";
    const patch = bucket === "patch-evidence";
    const cite = bucket === "source-citation" || bucket === "public-memory-qa";
    return {
      schemaVersion: "1.0",
      id: `emrp-v1-${String(ordinal).padStart(3, "0")}`,
      bucket,
      corpusEvents: [
        {
          id: staleId,
          source: `fixture://emrp/${bucket}/${ordinal}/stale`,
          occurredAt: `2026-01-${String((ordinal % 27) + 1).padStart(2, "0")}T08:00:00.000Z`,
          content: `Stale engineering memory ${ordinal}: use the old ${bucket} procedure and do not cite the newer correction.`,
          tags: [bucket, "stale"]
        },
        {
          id: eventId,
          source: `fixture://emrp/${bucket}/${ordinal}/current`,
          occurredAt: `2026-02-${String((ordinal % 25) + 1).padStart(2, "0")}T09:30:00.000Z`,
          content: `Current engineering memory ${ordinal}: for ${bucket}, select ${eventId}, suppress stale guidance, cite this source, and ${patch ? "touch src/example.ts" : blocked ? "block the unsafe action" : shouldAbstain ? "abstain when evidence is missing" : "answer from current evidence"}.`,
          tags: [bucket, "current"],
          private: privateEvent,
          deleteTargetId: privateEvent ? staleId : undefined
        }
      ],
      query: {
        text: `Task ${ordinal}: resolve the ${bucket} engineering-memory scenario using current evidence only.`,
        expectedEvidenceIds: shouldAbstain ? [] : [eventId],
        forbiddenEvidenceIds: [staleId],
        expectedAction: shouldAbstain ? "abstain" : blocked ? "block-action" : patch ? "propose-patch" : cite ? "cite-source" : "answer",
        expectedFiles: patch ? ["src/example.ts"] : undefined
      },
      scoring: {
        deterministicChecks: [
          "expected-evidence",
          "forbidden-evidence",
          shouldAbstain ? "abstention" : "action",
          ...(cite ? ["source-citation" as const] : []),
          ...(patch ? ["patch-files" as const] : [])
        ],
        judgeRubric: rubrics[bucket]
      }
    };
  });
}

export function freezeRealityManifest(options: { manifestPath?: string; lockPath?: string; count?: number; frozenAt?: string } = {}) {
  const manifestPath = options.manifestPath ?? DEFAULT_REALITY_MANIFEST;
  const lockPath = options.lockPath ?? DEFAULT_REALITY_LOCK;
  const tasks = generateRealityTasks(options.count ?? 60);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${tasks.map((task) => JSON.stringify(task)).join("\n")}\n`);
  const lock = createLock(tasks, manifestPath, options.frozenAt);
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  return { manifestPath, lockPath, lock };
}

export function loadRealityManifest(manifestPath = DEFAULT_REALITY_MANIFEST, lockPath = DEFAULT_REALITY_LOCK) {
  const tasks = readFileSync(manifestPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RealityTask);
  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as RealityManifestLock;
  const actual = hashTasks(tasks);
  if (actual !== lock.sha256) {
    throw new Error(`Reality manifest hash mismatch: expected ${lock.sha256}, got ${actual}`);
  }
  if (tasks.length !== lock.taskCount) {
    throw new Error(`Reality manifest task count mismatch: expected ${lock.taskCount}, got ${tasks.length}`);
  }
  return { tasks, lock };
}

export function hashTasks(tasks: RealityTask[]) {
  return createHash("sha256").update(`${tasks.map((task) => JSON.stringify(task)).join("\n")}\n`).digest("hex");
}

function createLock(tasks: RealityTask[], manifestPath: string, frozenAt = "2026-06-11T00:00:00.000Z"): RealityManifestLock {
  return {
    schemaVersion: "1.0",
    protocol: "emrp-v1",
    manifestPath: relative(process.cwd(), manifestPath) || manifestPath,
    frozenAt,
    taskCount: tasks.length,
    taskBuckets: tasks.reduce<Record<RealityBucket, number>>((counts, task) => {
      counts[task.bucket] = (counts[task.bucket] ?? 0) + 1;
      return counts;
    }, Object.fromEntries(buckets.map((bucket) => [bucket, 0])) as Record<RealityBucket, number>),
    sha256: hashTasks(tasks)
  };
}
