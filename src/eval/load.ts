import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { MemoryService } from "../api/service";

export interface LoadBenchmarkOptions {
  out?: string;
  memories?: number;
  concurrentWrites?: number;
  concurrentSearches?: number;
  connectorEvents?: number;
  dream?: boolean;
}

export interface LoadBenchmarkReport {
  schemaVersion: "1.0";
  generatedAt: string;
  workload: {
    memories: number;
    concurrentWrites: number;
    concurrentSearches: number;
    connectorEvents: number;
    dream: boolean;
  };
  totals: {
    writes: number;
    searches: number;
    connectorEvents: number;
    dreamActions: number;
    failures: number;
  };
  latencyMs: Record<"write" | "search" | "connectorSync" | "dream", LatencySummary>;
  throughputPerSecond: Record<"write" | "search" | "connectorSync", number>;
  memoryUsageMb: {
    rss: number;
    heapUsed: number;
  };
  passed: boolean;
}

interface LatencySummary {
  count: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

export function runProductionLoadBenchmark(options: LoadBenchmarkOptions = {}): LoadBenchmarkReport {
  const memoryCount = options.memories ?? Number(process.env.MEMORY_LOAD_MEMORIES ?? 1_000);
  const concurrentWrites = options.concurrentWrites ?? Number(process.env.MEMORY_LOAD_CONCURRENT_WRITES ?? 25);
  const concurrentSearches = options.concurrentSearches ?? Number(process.env.MEMORY_LOAD_CONCURRENT_SEARCHES ?? 50);
  const connectorEvents = options.connectorEvents ?? Number(process.env.MEMORY_LOAD_CONNECTOR_EVENTS ?? 25);
  const service = new MemoryService();
  const writeLatencies: number[] = [];
  const searchLatencies: number[] = [];
  const connectorLatencies: number[] = [];
  const dreamLatencies: number[] = [];
  let failures = 0;

  const writeStarted = performance.now();
  for (let index = 0; index < memoryCount; index += 1) {
    const started = performance.now();
    try {
      service.add({
        userId: `load-user-${index % Math.max(1, concurrentWrites)}`,
        orgId: "load-org",
        projectId: `project-${index % 10}`,
        content: `Load memory ${index} records production benchmark topic ${index % 17} with graph entity LoadEntity${index % 13}.`,
        tags: [`topic-${index % 17}`],
        entities: [`LoadEntity${index % 13}`, `Project${index % 10}`],
        relations: [{ type: "mentions", sourceEntity: `LoadEntity${index % 13}`, targetEntity: `Project${index % 10}`, confidence: 0.8 }],
        consent: { visibility: "org" },
        source: { kind: "tool", confidence: 0.9 }
      });
    } catch {
      failures += 1;
    }
    writeLatencies.push(performance.now() - started);
  }
  const writeElapsed = performance.now() - writeStarted;

  const searchStarted = performance.now();
  for (let index = 0; index < concurrentSearches; index += 1) {
    const started = performance.now();
    try {
      service.search({
        userId: `load-user-${index % Math.max(1, concurrentWrites)}`,
        orgId: "load-org",
        projectId: `project-${index % 10}`,
        query: `production benchmark topic ${index % 17} LoadEntity${index % 13}`,
        includeSharedBrains: true,
        limit: 5
      });
    } catch {
      failures += 1;
    }
    searchLatencies.push(performance.now() - started);
  }
  const searchElapsed = performance.now() - searchStarted;

  const connectorStarted = performance.now();
  for (let index = 0; index < connectorEvents; index += 1) {
    const started = performance.now();
    try {
      service.syncConnectorEvents(
        "official-github",
        [{
          role: "tool",
          content: `Connector load event ${index} captured CI result and review decision.`,
          timestamp: new Date().toISOString(),
          source: { kind: "import", confidence: 0.88 },
          metadata: { externalId: `load-${index}` }
        }],
        { userId: `load-user-${index % Math.max(1, concurrentWrites)}`, orgId: "load-org" }
      );
    } catch {
      failures += 1;
    }
    connectorLatencies.push(performance.now() - started);
  }
  const connectorElapsed = performance.now() - connectorStarted;

  let dreamActions = 0;
  if (options.dream ?? true) {
    const started = performance.now();
    try {
      const report = service.dream("load-user-0");
      dreamActions = report.lifecycle.actions.length;
    } catch {
      failures += 1;
    }
    dreamLatencies.push(performance.now() - started);
  }

  const usage = process.memoryUsage();
  const report: LoadBenchmarkReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    workload: { memories: memoryCount, concurrentWrites, concurrentSearches, connectorEvents, dream: options.dream ?? true },
    totals: { writes: memoryCount, searches: concurrentSearches, connectorEvents, dreamActions, failures },
    latencyMs: {
      write: summarizeLatencies(writeLatencies),
      search: summarizeLatencies(searchLatencies),
      connectorSync: summarizeLatencies(connectorLatencies),
      dream: summarizeLatencies(dreamLatencies)
    },
    throughputPerSecond: {
      write: rate(memoryCount, writeElapsed),
      search: rate(concurrentSearches, searchElapsed),
      connectorSync: rate(connectorEvents, connectorElapsed)
    },
    memoryUsageMb: {
      rss: round(usage.rss / 1024 / 1024),
      heapUsed: round(usage.heapUsed / 1024 / 1024)
    },
    passed: failures === 0 && writeLatencies.length === memoryCount && searchLatencies.length === concurrentSearches
  };

  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, JSON.stringify(report, null, 2));
  }
  return report;
}

function summarizeLatencies(values: number[]): LatencySummary {
  if (!values.length) return { count: 0, min: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: values.length,
    min: round(sorted[0]),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: round(sorted.at(-1) ?? 0),
    mean: round(values.reduce((total, value) => total + value, 0) / values.length)
  };
}

function percentile(sorted: number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return round(sorted[index]);
}

function rate(count: number, elapsedMs: number): number {
  return round(count / Math.max(0.001, elapsedMs / 1000));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function cliOptions(argv: string[]): LoadBenchmarkOptions {
  const value = (flag: string) => {
    const index = argv.lastIndexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    out: value("--out") ?? "artifacts/load-benchmark.json",
    memories: value("--memories") ? Number(value("--memories")) : undefined,
    concurrentWrites: value("--concurrent-writes") ? Number(value("--concurrent-writes")) : undefined,
    concurrentSearches: value("--concurrent-searches") ? Number(value("--concurrent-searches")) : undefined,
    connectorEvents: value("--connector-events") ? Number(value("--connector-events")) : undefined,
    dream: argv.includes("--no-dream") ? false : undefined
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runProductionLoadBenchmark(cliOptions(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
