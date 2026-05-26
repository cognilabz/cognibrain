export async function renderCliPanel(kind, payload, options = {}) {
  renderPlainPanel(kind, payload, options);
}

export async function renderCliSurface(kind, payload, options = {}) {
  renderPlainSurface(kind, payload, options);
}

function surfaceLines(kind, payload, options = {}) {
  if (kind === "doctor") {
    const summary = payload.summary ?? {};
    return {
      metrics: [
        ["checks", `${summary.ok ?? 0} ok / ${summary.warn ?? 0} warn / ${summary.fail ?? 0} fail`, (summary.fail ?? 0) ? "red" : (summary.warn ?? 0) ? "yellow" : "green"],
        ["publish", payload.publish ? "enabled" : "local", payload.publish ? "cyan" : "gray"],
        ["runtime", payload.runtime?.mode ?? "unknown", payload.runtime?.api?.alive ? "green" : "yellow"],
        ["fixed", payload.fixed?.length ? payload.fixed.join(", ") : "none", payload.fixed?.length ? "green" : "gray"]
      ],
      sections: [
        { title: "Checks", items: compactItems(payload.checks ?? [], checkLine, 14) },
        { title: "Commands", items: payload.commands ?? [] }
      ]
    };
  }
  if (kind === "skill") {
    return {
      metrics: [
        ["skill", payload.installed ? "installed" : "missing", payload.installed ? "green" : "yellow"],
        ["path", payload.path, payload.installed ? "green" : "gray"]
      ],
      sections: [
        { title: "Commands", items: payload.commands ?? [] },
        { title: "Docs", items: [payload.docs].filter(Boolean) },
        { title: "Next", items: [payload.installed ? "cognibrain memories coding-context <query>" : payload.installCommand, payload.doctorCommand].filter(Boolean) }
      ]
    };
  }
  if (kind === "proof") {
    const summary = payload.summary ?? {};
    return {
      metrics: [
        ["truth gate", payload.passed ? "claims bounded" : "overclaim found", payload.passed ? "green" : "red"],
        ["plan state", payload.planComplete ? "complete" : `${summary.openGaps ?? 0} open code gaps`, payload.planComplete ? "green" : "yellow"],
        ["arena", `${summary.realCompetitorRuns ?? 0} real competitors / ${summary.apiShapeCompetitors ?? 0} api-shape`, summary.realCompetitorRuns ? "green" : "yellow"],
        ["connectors", `${summary.hermeticDrivers ?? 0} hermetic / ${summary.tenantLiveSmokes ?? 0} live / ${summary.productionCertifiedConnectors ?? 0} certified`, summary.tenantLiveSmokes ? "green" : "yellow"]
      ],
      sections: [
        { title: "Truth Tuples", items: compactItems(payload.truthTuples ?? [], (item) => `${item[0]} = ${item[1]} (${item[2]})`, 12) },
        { title: "Checks", items: compactItems(payload.checks ?? [], truthCheckLine, 10) },
        { title: "Open Gaps", items: payload.openGaps?.length ? payload.openGaps.map((item) => `${item.id} - ${item.message}`) : ["none"] },
        { title: "Commands", items: payload.commands ?? [] }
      ]
    };
  }
  if (kind === "config") {
    return {
      metrics: [
        ["runtime", payload.runtimeRoot, "cyan"],
        ["setup", payload.setupState?.profile ?? "missing", payload.setupState ? "green" : "yellow"],
        ["harness", payload.harnessManifest ? "present" : "missing", payload.harnessManifest ? "green" : "yellow"],
        ["skill", payload.skill?.installed ? "installed" : "missing", payload.skill?.installed ? "green" : "yellow"]
      ],
      sections: [
        { title: "Connectors", items: payload.connectors?.length ? payload.connectors.map((item) => item.provider ?? item.connectorId ?? "connector") : ["none configured"] },
        { title: "Adapters", items: payload.adapters?.length ? payload.adapters.map((item) => item.adapter ?? item.adapterId ?? "adapter") : ["none configured"] },
        { title: "Files", items: Object.entries(options.configPaths?.() ?? {}).map(([name, value]) => `${name}: ${value}`) },
        { title: "Commands", items: ["cognibrain config list", "cognibrain config doctor", "cognibrain config all", "cognibrain connections"] }
      ]
    };
  }
  if (kind === "config-catalog") {
    return {
      metrics: [
        ["runtime", payload.runtimeRoot, "cyan"],
        ["harnesses", payload.harnesses?.length ?? 0, "green"],
        ["connectors", payload.connectors?.length ?? 0, "green"],
        ["adapters", payload.adapters?.length ?? 0, "green"]
      ],
      sections: [
        { title: "Harnesses", items: compactItems(payload.harnesses ?? [], (item) => `${item.target} - ${item.command}`, 10) },
        { title: "Connectors", items: compactItems(payload.connectors ?? [], (item) => `${item.provider} (${item.status})`, 12) },
        { title: "Adapters", items: compactItems(payload.adapters ?? [], (item) => `${item.adapter} (${item.status})`, 8) },
        { title: "Skill", items: [payload.skill?.command, payload.skill?.path].filter(Boolean) }
      ]
    };
  }
  if (kind === "config-paths") {
    return {
      metrics: [["paths", Object.keys(payload).length, "cyan"]],
      sections: [{ title: "Files", items: Object.entries(payload).map(([name, value]) => `${name}: ${value}`) }]
    };
  }
  if (kind === "config-doctor") {
    return {
      metrics: [
        ["status", payload.ok ? "ready" : "needs attention", payload.ok ? "green" : "yellow"],
        ["checks", payload.checks?.length ?? 0, "cyan"]
      ],
      sections: [
        { title: "Checks", items: compactItems(payload.checks ?? [], checkLine, 12) },
        { title: "Commands", items: ["cognibrain doctor --fix", "cognibrain config all", "cognibrain connections"] }
      ]
    };
  }
  if (kind === "connections-doctor") {
    return {
      metrics: [
        ["status", payload.ok ? "ready" : "needs attention", payload.ok ? "green" : "yellow"],
        ["config", payload.config?.ok ? "ok" : "warn", payload.config?.ok ? "green" : "yellow"],
        ["connectors", payload.connectors?.checks?.length ?? 0, "cyan"],
        ["adapters", payload.adapters?.checks?.length ?? 0, "cyan"]
      ],
      sections: [
        { title: "Config", items: compactItems(payload.config?.checks ?? [], checkLine, 6) },
        { title: "Connectors", items: compactItems(payload.connectors?.checks ?? [], connectorCheckLine, 8) },
        { title: "Adapters", items: compactItems(payload.adapters?.checks ?? [], adapterCheckLine, 8) }
      ]
    };
  }
  if (kind === "connector-catalog") {
    const configured = payload.filter((item) => item.configured);
    const available = payload.filter((item) => !item.configured);
    const vendor = payload.filter((item) => item.status === "vendor-driver");
    return {
      metrics: [
        ["configured", `${configured.length}/${payload.length}`, configured.length ? "green" : "yellow"],
        ["native drivers", vendor.length, "cyan"],
        ["available", available.length, "white"]
      ],
      sections: [
        { title: "Configured", items: configured.length ? configured.map((item) => `${item.provider} - ${item.connectorId}`) : ["none yet"] },
        { title: "Available", items: compactItems(available, (item) => `${item.provider} (${item.status})`, 25) },
        { title: "Commands", items: ["cognibrain connections add <provider> --set key=value", "cognibrain connector show <provider>", "cognibrain connector doctor <provider>"] }
      ]
    };
  }
  if (kind === "connector-show") {
    return {
      metrics: [
        ["provider", payload.provider, "cyan"],
        ["status", payload.definition?.status ?? "unknown", payload.config ? "green" : "yellow"],
        ["config", payload.config ? "present" : "missing", payload.config ? "green" : "yellow"]
      ],
      sections: [
        { title: "Required Env", items: payload.definition?.requiredEnv?.length ? payload.definition.requiredEnv : ["none"] },
        { title: "Settings", items: payload.config?.settings ? Object.entries(payload.config.settings).map(([key, value]) => `${key}: ${value}`) : ["not configured"] },
        { title: "Preview", items: payload.definition?.sampleEvents ?? [] },
        { title: "Docs", items: [payload.definition?.docs].filter(Boolean) }
      ]
    };
  }
  if (kind === "connector-doctor") {
    return {
      metrics: [
        ["status", payload.ok ? "ready" : "needs attention", payload.ok ? "green" : "yellow"],
        ["checks", payload.checks?.length ?? 0, "cyan"]
      ],
      sections: [
        { title: "Checks", items: compactItems(payload.checks ?? [], connectorCheckLine, 12) },
        { title: "Commands", items: ["cognibrain connections add github --set repo=owner/repo", "cognibrain memory connector-health <connector-id>"] }
      ]
    };
  }
  if (kind === "adapter-catalog") {
    const configured = payload.filter((item) => item.configured);
    const available = payload.filter((item) => !item.configured);
    return {
      metrics: [
        ["configured", `${configured.length}/${payload.length}`, configured.length ? "green" : "yellow"],
        ["storage", payload.filter((item) => item.kind === "storage").length, "cyan"],
        ["providers", payload.filter((item) => item.kind === "provider").length, "cyan"]
      ],
      sections: [
        { title: "Configured", items: configured.length ? configured.map((item) => `${item.adapter} - ${item.adapterId}`) : ["none yet"] },
        { title: "Available", items: compactItems(available, (item) => `${item.adapter} (${item.kind}, ${item.status})`, 20) },
        { title: "Commands", items: ["cognibrain connections add <adapter> --set key=value", "cognibrain adapter show <adapter>", "cognibrain adapter doctor <adapter>"] }
      ]
    };
  }
  if (kind === "adapter-show") {
    return {
      metrics: [
        ["adapter", payload.adapter, "cyan"],
        ["kind", payload.definition?.kind ?? "unknown", "white"],
        ["config", payload.config ? "present" : "missing", payload.config ? "green" : "yellow"]
      ],
      sections: [
        { title: "Required Env", items: payload.definition?.requiredEnv?.length ? payload.definition.requiredEnv : ["none"] },
        { title: "Settings", items: payload.config?.settings ? Object.entries(payload.config.settings).map(([key, value]) => `${key}: ${value}`) : ["not configured"] },
        { title: "Preview", items: payload.definition?.sampleEvents ?? [] },
        { title: "Docs", items: [payload.definition?.docs].filter(Boolean) }
      ]
    };
  }
  if (kind === "adapter-doctor") {
    return {
      metrics: [
        ["status", payload.ok ? "ready" : "needs attention", payload.ok ? "green" : "yellow"],
        ["checks", payload.checks?.length ?? 0, "cyan"]
      ],
      sections: [
        { title: "Checks", items: compactItems(payload.checks ?? [], adapterCheckLine, 12) },
        { title: "Commands", items: ["cognibrain connections add storage-sqlite", "cognibrain connections adapters doctor"] }
      ]
    };
  }
  if (kind === "sdk-catalog") {
    return {
      metrics: [
        ["surfaces", payload.length, "cyan"],
        ["platform sdk", payload.some((item) => item.sdk === "platform") ? "available" : "missing", "green"]
      ],
      sections: [
        { title: "SDKs", items: payload.map((item) => `${item.sdk} (${item.status}) - ${item.command}`) },
        { title: "Includes", items: compactItems(payload.flatMap((item) => item.includes ?? []), (item) => item, 10) },
        { title: "Commands", items: ["cognibrain sdk platform acme --kind project_management --out integrations/acme", "cognibrain sdk doctor"] }
      ]
    };
  }
  if (kind === "sdk-doctor") {
    return {
      metrics: [
        ["status", payload.ok ? "ready" : "needs attention", payload.ok ? "green" : "yellow"],
        ["checks", payload.checks?.length ?? 0, "cyan"]
      ],
      sections: [
        { title: "Checks", items: compactItems(payload.checks ?? [], checkLine, 10) },
        { title: "Commands", items: ["cognibrain sdk platform acme --kind project_management --out integrations/acme"] }
      ]
    };
  }
  if (kind === "sdk-scaffold") {
    return {
      metrics: [
        ["sdk", payload.sdk, "cyan"],
        ["name", payload.slug, "white"],
        ["mode", payload.dryRun ? "dry run" : "written", payload.dryRun ? "yellow" : "green"]
      ],
      sections: [
        { title: "Summary", items: [`${payload.dryRun ? "would scaffold" : "scaffolded"} platform SDK: ${payload.slug}`] },
        { title: "Files", items: payload.files ?? [] },
        { title: "Commands", items: payload.commands ?? [] },
        { title: "Docs", items: [payload.docs].filter(Boolean) }
      ]
    };
  }
  if (kind === "service") {
    return {
      metrics: [
        ["platform", `${payload.platform} (${payload.manager})`, "cyan"],
        ["installed", payload.installed ? "yes" : "no", payload.installed ? "green" : "yellow"],
        ["runtime", payload.runtime?.mode ?? "unknown", payload.runtime?.api?.alive ? "green" : "yellow"],
        ["dashboard", payload.dashboard?.enabled ? "enabled" : "optional/off", payload.dashboard?.enabled ? "green" : "gray"]
      ],
      sections: [
        { title: "Files", items: [payload.files?.descriptor, payload.files?.metadata].filter(Boolean) },
        { title: "Commands", items: payload.actions ?? [] },
        { title: "Native Enable", items: payload.commands?.enable ?? [] },
        { title: "Notes", items: payload.notes ?? [] }
      ]
    };
  }
  if (kind === "memories") {
    const health = payload.health ?? {};
    return {
      metrics: [
        ["user", payload.userId ?? "local", "cyan"],
        ["memories", health.memories ?? health.total ?? payload.recent?.length ?? 0, "green"],
        ["quality", health.qualityScore ?? health.freshness ?? "n/a", "white"]
      ],
      sections: [
        { title: "Recent", items: (payload.recent ?? []).slice(0, 5).map((memory) => `${shortMemoryId(memory)} ${memory.content}`) },
        { title: "Commands", items: payload.commands ?? [] },
        { title: "Dashboard Parity", items: payload.dashboardParity ?? [] }
      ]
    };
  }
  if (kind === "connections") {
    const configuredConnectors = payload.connectors?.configured ?? [];
    const configuredAdapters = payload.adapters?.configured ?? [];
    return {
      metrics: [
        ["connectors", `${configuredConnectors.length}/${payload.connectors?.available?.length ?? 0}`, configuredConnectors.length ? "green" : "yellow"],
        ["adapters", `${configuredAdapters.length}/${payload.adapters?.available?.length ?? 0}`, configuredAdapters.length ? "green" : "yellow"],
        ["skill", payload.harnesses?.skill?.installed ? "installed" : "missing", payload.harnesses?.skill?.installed ? "green" : "yellow"]
      ],
      sections: [
        { title: "Configured Connectors", items: configuredConnectors.length ? configuredConnectors : ["none yet"] },
        { title: "Configured Adapters", items: configuredAdapters.length ? configuredAdapters : ["none yet"] },
        { title: "Commands", items: payload.commands ?? [] }
      ]
    };
  }
  const runtime = payload.runtime ?? {};
  const config = payload.config ?? {};
  return {
    metrics: [
      ["package", `${payload.package?.name ?? "cognibrain"} ${payload.package?.version ?? ""}`.trim(), "cyan"],
      ["runtime", runtime.mode ?? "unknown", runtime.api?.alive ? "green" : "yellow"],
      ["dashboard", runtime.dashboard?.alive ? "running" : "optional", runtime.dashboard?.alive ? "green" : "gray"],
      ["setup", config.setupState?.profile ?? "missing", config.setupState ? "green" : "yellow"]
    ],
    sections: [
      { title: "Memories", items: [`${payload.memories?.health?.memories ?? payload.memories?.recent?.length ?? 0} stored`, "cognibrain memories search <query>", "cognibrain memories add <text>"] },
      { title: "Connections", items: [`${payload.connections?.connectors?.configured?.length ?? 0} connectors configured`, `${payload.connections?.adapters?.configured?.length ?? 0} adapters configured`, "cognibrain connections add github --set repo=owner/repo"] },
      { title: "Service", items: [`${payload.service?.platform ?? "local"} ${payload.service?.installed ? "installed" : "not installed"}`, "cognibrain service plan", "cognibrain service install --activate"] },
      { title: "Commands", items: payload.commands ?? [] }
    ]
  };
}

function renderPlainSurface(kind, payload, options = {}) {
  const lines = surfaceLines(kind, payload, options);
  const width = terminalWidth();
  console.log(clipText(options.title ?? "cognibrain", width));
  for (const [label, value] of lines.metrics) console.log(clipText(`${label}: ${value}`, width));
  for (const section of lines.sections) {
    console.log(`\n${clipText(section.title, width)}`);
    for (const item of compactItems(section.items ?? [], (entry) => entry, 8)) console.log(clipText(`  - ${item}`, width));
  }
}


function shortMemoryId(memory) {
  return String(memory?.id ?? "memory").slice(0, 8);
}

function compactItems(items, formatter = (item) => String(item), limit = 10) {
  const rendered = items.slice(0, limit).map(formatter);
  if (items.length > limit) rendered.push(`and ${items.length - limit} more`);
  return rendered.length ? rendered : ["none"];
}

function terminalWidth() {
  return Math.max(48, Math.min(Number(process.stdout.columns ?? 88), 100));
}

function clipText(value, width = terminalWidth()) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= width) return text;
  if (width <= 4) return text.slice(0, width);
  return `${text.slice(0, width - 1)}…`;
}

function checkLine(check) {
  const state = check.level === "warn" ? "warn" : check.ok ? "ok" : "fail";
  const detail = check.detail || check.path || check.fix || "";
  return `${state} ${check.name}${detail ? ` - ${detail}` : ""}`;
}

function truthCheckLine(check) {
  const state = check.passed ? "ok" : check.severity === "gap" ? "gap" : "fail";
  return `${state} ${check.id} - ${check.message}`;
}

function connectorCheckLine(check) {
  const state = check.ok ? "ok" : "fail";
  const missing = [...(check.missingSettings ?? []), ...(check.missingEnv ?? [])];
  return `${state} ${check.provider ?? check.connectorId} - ${missing.length ? `missing ${missing.join(", ")}` : check.healthCommand ?? check.path ?? "ready"}`;
}

function adapterCheckLine(check) {
  const state = check.ok || check.status === "available-contract" ? "ok" : "fail";
  const missing = [...(check.missingSettings ?? []), ...(check.missingEnv ?? [])];
  return `${state} ${check.adapter ?? check.adapterId} - ${missing.length ? `missing ${missing.join(", ")}` : check.healthCommand ?? check.path ?? "ready"}`;
}

function renderPlainPanel(kind, payload, options = {}) {
  const width = terminalWidth();
  const print = (value) => console.log(clipText(value, width));
  if (kind === "connector") {
    print(`${options.title ?? "connector"}: ${payload.connectorId} (${payload.status})`);
    print(`docs: ${payload.docs}`);
    if (payload.preview?.sampleMemoryEvents?.length) print(`preview: ${payload.preview.sampleMemoryEvents.join(", ")}`);
    return;
  }
  if (kind === "adapter") {
    print(`${options.title ?? "adapter"}: ${payload.adapterId} (${payload.kind}, ${payload.status})`);
    print(`docs: ${payload.docs}`);
    if (payload.preview?.sampleMemoryEvents?.length) print(`preview: ${payload.preview.sampleMemoryEvents.join(", ")}`);
    return;
  }
  print(`${options.title ?? "cognibrain init"}: ${payload.label}`);
  print(`runtime root: ${options.runtimeRoot ?? "local"}`);
  print(`profile: ${payload.name}`);
}
