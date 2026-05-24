import type { GraphActivationResult, GraphExportOptions, GraphExportResult, GraphPath, GraphQueryResult, InferenceReport, InferenceRule, Memory, MemoryRelation, RelationType } from "./types";

interface GraphEdge {
  from: string;
  to: string;
  type: RelationType | "mentions";
  confidence: number;
  memoryId?: string;
  trust?: number;
  timestamp?: Date | string;
  source?: Memory["source"];
}

const DEFAULT_RULES: InferenceRule[] = [
  {
    id: "depends-imports-transitive",
    label: "depends_on + imports -> transitive_depends_on",
    when: { left: "depends_on", right: "imports" },
    then: "transitive_depends_on",
    confidence: 0.56
  }
];

export function findGraphPaths(
  memories: Memory[],
  from: string,
  to: string,
  options: { maxDepth?: number; relationTypes?: RelationType[]; limit?: number } = {}
): GraphPath[] {
  const graph = buildGraph(memories);
  const fromNode = resolveNode(graph.labels, from);
  const toNode = resolveNode(graph.labels, to);
  if (!fromNode || !toNode) return [];
  const relationTypes = new Set(options.relationTypes ?? []);
  const maxDepth = options.maxDepth ?? 3;
  const queue: Array<{ node: string; edges: GraphEdge[]; seen: Set<string> }> = [{ node: fromNode, edges: [], seen: new Set([fromNode]) }];
  const paths: GraphPath[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    if (current.edges.length >= maxDepth) continue;
    for (const edge of graph.adj.get(current.node) ?? []) {
      if (relationTypes.size && edge.type !== "mentions" && !relationTypes.has(edge.type)) continue;
      if (current.seen.has(edge.to)) continue;
      const edges = [...current.edges, edge];
      if (edge.to === toNode) {
        paths.push(toPath(edges, graph.labels));
        continue;
      }
      queue.push({ node: edge.to, edges, seen: new Set([...current.seen, edge.to]) });
    }
  }
  return paths.sort((a, b) => b.score - a.score || a.edges.length - b.edges.length).slice(0, options.limit ?? 5);
}

export function activateGraph(
  memories: Memory[],
  query: string,
  options: { maxDepth?: number; relationTypes?: RelationType[]; limit?: number; damping?: number } = {}
): GraphActivationResult {
  const graph = buildGraph(memories);
  const queryTokens = new Set(query.toLowerCase().split(/[^a-z0-9_./-]+/).filter(Boolean));
  const seeds = [...graph.labels.entries()]
    .filter(([, value]) => [...queryTokens].some((token) => value.label.toLowerCase().includes(token)))
    .map(([id]) => id);
  const relationTypes = new Set(options.relationTypes ?? []);
  const damping = options.damping ?? 0.72;
  const scores = new Map<string, number>();
  const explanations = new Map<string, string[]>();
  const boundedSeeds = seeds.slice(0, 24);
  const queue: Array<{ node: string; score: number; depth: number; path: string[] }> = boundedSeeds.map((node) => ({ node, score: 1, depth: 0, path: [node] }));
  const bestAtDepth = new Map<string, number>();
  for (const seed of boundedSeeds) {
    scores.set(seed, Math.max(scores.get(seed) ?? 0, 1));
    bestAtDepth.set(`${seed}:0`, 1);
  }
  let iterations = 0;
  while (queue.length && iterations < 2500) {
    iterations += 1;
    const current = queue.shift()!;
    if (current.depth >= (options.maxDepth ?? 3)) continue;
    for (const edge of graph.adj.get(current.node) ?? []) {
      if (relationTypes.size && edge.type !== "mentions" && !relationTypes.has(edge.type)) continue;
      if (current.path.includes(edge.to)) continue;
      const score = current.score * damping * edge.confidence;
      if (score <= 0.02) continue;
      const depth = current.depth + 1;
      const bestKey = `${edge.to}:${depth}`;
      if (score <= (bestAtDepth.get(bestKey) ?? 0) + 0.005) continue;
      bestAtDepth.set(bestKey, score);
      scores.set(edge.to, Math.max(scores.get(edge.to) ?? 0, score));
      const label = graph.labels.get(edge.to)?.label ?? edge.to;
      const from = graph.labels.get(edge.from)?.label ?? edge.from;
      explanations.set(edge.to, [...(explanations.get(edge.to) ?? []), `${from} -${edge.type}-> ${label}`].slice(0, 4));
      queue.push({ node: edge.to, score, depth, path: [...current.path, edge.to] });
    }
  }
  return {
    query,
    seeds: boundedSeeds,
    ranked: [...scores.entries()]
      .filter(([nodeId]) => !seeds.includes(nodeId))
      .map(([nodeId, score]) => {
        const label = graph.labels.get(nodeId) ?? { kind: "entity" as const, label: nodeId };
        return { nodeId, label: label.label, kind: label.kind, memoryId: label.memoryId, score, explanation: explanations.get(nodeId) ?? [] };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit ?? 10)
  };
}

export function queryMemoryGraph(memories: Memory[], query: string): GraphQueryResult {
  const relation = query.match(/:\s*([a-z_]+)/i)?.[1] as RelationType | undefined;
  const minTrust = Number(query.match(/trust\s*>\s*(0(?:\.\d+)?|1(?:\.0+)?)/i)?.[1] ?? "0");
  const entity = query.match(/entity\s*=\s*['"]([^'"]+)['"]/i)?.[1]?.toLowerCase();
  const returnFields = query.match(/return\s+(.+)$/i)?.[1]?.split(",").map((field) => field.trim().toLowerCase()) ?? [];
  const matches = memories
    .filter((memory) => memory.trust >= minTrust)
    .flatMap((memory) => {
      const relationMatches = memory.relations.filter((item) => (!relation || item.type === relation) && (!entity || memory.entities.includes(entity) || item.targetEntity === entity || item.sourceEntity === entity));
      if (!relationMatches.length && !relation && (!entity || memory.entities.includes(entity))) {
        return [{ memoryId: memory.id, content: memory.content, entities: memory.entities, trust: memory.trust, createdAt: memory.createdAt.toISOString(), source: memory.source }];
      }
      return relationMatches.map((item) => ({ memoryId: memory.id, content: memory.content, relation: item, entities: memory.entities, trust: memory.trust, createdAt: memory.createdAt.toISOString(), source: memory.source }));
    });
  return {
    query,
    matches,
    warnings: [
      ...(relation || entity || minTrust ? [] : ["No relation/entity/trust filter found; returned broad memory graph matches."]),
      ...(returnFields.length && !returnFields.some((field) => ["a", "b", "memory", "relation", "entities", "trust"].includes(field)) ? [`Unsupported RETURN fields ignored: ${returnFields.join(", ")}`] : [])
    ]
  };
}

export function inferGraphRelations(memories: Memory[], rules: InferenceRule[] = DEFAULT_RULES): InferenceReport {
  const inferred: InferenceReport["inferred"] = [];
  for (const rule of rules) {
    for (const leftMemory of memories) {
      for (const left of leftMemory.relations.filter((relation) => relation.type === rule.when.left && relation.targetEntity)) {
        for (const rightMemory of memories) {
          if (rightMemory.id === leftMemory.id) continue;
          for (const right of rightMemory.relations.filter((relation) => relation.type === rule.when.right && relation.sourceEntity === left.targetEntity && relation.targetEntity)) {
            const relation: MemoryRelation = {
              type: rule.then,
              sourceEntity: left.sourceEntity ?? leftMemory.entities[0],
              targetEntity: right.targetEntity,
              confidence: Math.min(left.confidence ?? 0.5, right.confidence ?? 0.5, rule.confidence ?? 0.5),
              evidence: `${rule.label}: ${leftMemory.id} + ${rightMemory.id}`
            };
            if (leftMemory.relations.some((existing) => existing.type === relation.type && existing.targetEntity === relation.targetEntity)) continue;
            inferred.push({ memoryId: leftMemory.id, relation, ruleId: rule.id, evidence: [leftMemory.id, rightMemory.id] });
          }
        }
      }
    }
  }
  return { rulesEvaluated: rules.length, inferred };
}

export function exportMemoryGraph(memories: Memory[], options: GraphExportOptions = {}): GraphExportResult | string {
  const filtered = filterGraphMemories(memories, options);
  const graph = buildGraph(filtered);
  const nodes = [...graph.labels.entries()].map(([id, value]) => ({ id, ...value }));
  const edges = [...graph.adj.values()].flat().filter((edge, index, all) => all.findIndex((candidate) => candidate.from === edge.from && candidate.to === edge.to && candidate.type === edge.type && candidate.memoryId === edge.memoryId) === index);
  if (options.format === "graphml") return toGraphML(nodes, edges);
  return { nodes, edges };
}

function buildGraph(memories: Memory[]) {
  const adj = new Map<string, GraphEdge[]>();
  const labels = new Map<string, { kind: "memory" | "entity"; label: string; memoryId?: string }>();
  for (const memory of memories) {
    const memoryNode = `memory:${memory.id}`;
    labels.set(memoryNode, { kind: "memory", label: memory.content, memoryId: memory.id });
    for (const entity of memory.entities) {
      const entityNode = `entity:${entity}`;
      labels.set(entityNode, { kind: "entity", label: entity });
      connect(adj, edgeWithProvenance(memory, { from: memoryNode, to: entityNode, type: "mentions", confidence: memory.trust, memoryId: memory.id }));
      connect(adj, edgeWithProvenance(memory, { from: entityNode, to: memoryNode, type: "mentions", confidence: memory.trust, memoryId: memory.id }));
    }
    for (const relation of memory.relations) {
      const source = relation.sourceEntity ? `entity:${relation.sourceEntity}` : memoryNode;
      const target = relation.targetId ? `memory:${relation.targetId}` : relation.targetEntity ? `entity:${relation.targetEntity}` : undefined;
      if (!target) continue;
      labels.set(source, labels.get(source) ?? { kind: source.startsWith("entity:") ? "entity" : "memory", label: source.replace(/^(entity|memory):/, ""), memoryId: source.startsWith("memory:") ? memory.id : undefined });
      labels.set(target, labels.get(target) ?? { kind: target.startsWith("entity:") ? "entity" : "memory", label: target.replace(/^(entity|memory):/, ""), memoryId: target.startsWith("memory:") ? relation.targetId : undefined });
      connect(adj, edgeWithProvenance(memory, { from: source, to: target, type: relation.type, confidence: relation.confidence ?? 0.5, memoryId: memory.id }));
      if (relation.direction === "undirected") connect(adj, edgeWithProvenance(memory, { from: target, to: source, type: relation.type, confidence: relation.confidence ?? 0.5, memoryId: memory.id }));
    }
  }
  return { adj, labels };
}

function edgeWithProvenance(memory: Memory, edge: GraphEdge): GraphEdge {
  return {
    ...edge,
    trust: memory.trust,
    timestamp: memory.temporal.eventAt ?? memory.createdAt.toISOString(),
    source: memory.source
  };
}

function connect(adj: Map<string, GraphEdge[]>, edge: GraphEdge): void {
  const edges = adj.get(edge.from) ?? [];
  edges.push(edge);
  adj.set(edge.from, edges);
}

function resolveNode(labels: Map<string, { label: string }>, value: string): string | undefined {
  const normalized = value.toLowerCase();
  if (labels.has(value)) return value;
  return [...labels.entries()].find(([id, label]) => id.toLowerCase() === normalized || label.label.toLowerCase() === normalized || id.toLowerCase().endsWith(`:${normalized}`))?.[0];
}

function toPath(edges: GraphEdge[], labels: Map<string, { kind: "memory" | "entity"; label: string; memoryId?: string }>): GraphPath {
  const nodeIds = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))];
  const score = edges.reduce((product, edge) => product * edge.confidence, 1) ** (1 / Math.max(1, edges.length));
  return {
    nodes: nodeIds.map((id) => ({ id, ...(labels.get(id) ?? { kind: "entity", label: id }) })),
    edges,
    score,
    explanation: edges.map((edge) => `${labels.get(edge.from)?.label ?? edge.from} -${edge.type}-> ${labels.get(edge.to)?.label ?? edge.to}`)
  };
}

function filterGraphMemories(memories: Memory[], options: GraphExportOptions): Memory[] {
  const after = options.after ? new Date(options.after) : undefined;
  const before = options.before ? new Date(options.before) : undefined;
  const relationTypes = new Set(options.relationTypes ?? []);
  return memories
    .filter((memory) => !options.minTrust || memory.trust >= options.minTrust)
    .filter((memory) => !options.sourceKind || memory.source.kind === options.sourceKind)
    .filter((memory) => {
      const eventAt = new Date(memory.temporal.eventAt ?? memory.createdAt);
      if (after && eventAt < after) return false;
      if (before && eventAt >= before) return false;
      return true;
    })
    .map((memory) => ({
      ...memory,
      relations: relationTypes.size ? memory.relations.filter((relation) => relationTypes.has(relation.type)) : memory.relations
    }));
}

function toGraphML(nodes: GraphExportResult["nodes"], edges: GraphEdge[]): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
    '  <graph edgedefault="directed">'
  ];
  for (const node of nodes) {
    lines.push(`    <node id="${xml(node.id)}"><data key="label">${xml(node.label)}</data><data key="kind">${node.kind}</data></node>`);
  }
  for (const [index, edge] of edges.entries()) {
    lines.push(`    <edge id="e${index}" source="${xml(edge.from)}" target="${xml(edge.to)}"><data key="type">${edge.type}</data><data key="confidence">${edge.confidence.toFixed(3)}</data>${edge.memoryId ? `<data key="memoryId">${xml(edge.memoryId)}</data>` : ""}</edge>`);
  }
  lines.push("  </graph>", "</graphml>");
  return lines.join("\n");
}

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
