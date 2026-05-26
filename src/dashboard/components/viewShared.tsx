import React from "react";
import type { Memory } from "../../core";
import { shortId } from "../utils";

export function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <article className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function MemoryMini({ memory }: { memory: Memory }) {
  return (
    <article className="memory-mini">
      <strong>{shortId(memory)}</strong>
      <p>{memory.content}</p>
      <small>{memory.source.kind} · trust {memory.trust.toFixed(2)} · {memory.layer} · {memory.consent.visibility}</small>
    </article>
  );
}

export function engineeringKindLabel(memory: Memory): string | undefined {
  const engineering = memory.metadata.engineering as { kind?: string; codebase?: { repo?: string; branch?: string; filePattern?: string } } | undefined;
  if (!engineering?.kind) return undefined;
  const scope = [engineering.codebase?.repo, engineering.codebase?.branch, engineering.codebase?.filePattern].filter(Boolean).join(" / ");
  return scope ? `${engineering.kind} · ${scope}` : engineering.kind;
}

export function ActionLog({ actions, empty = "No cleanup actions yet." }: { actions: string[]; empty?: string }) {
  return (
    <div className="action-log">
      <strong>Action Log</strong>
      {(actions.length ? actions : [empty]).map((action) => (
        <span key={action}>{action}</span>
      ))}
    </div>
  );
}

export function OutputGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="output-group">
      <strong>{title}</strong>
      {(items.length ? items : ["None"]).map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}
