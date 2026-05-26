const palette = {
  brand: "cyan",
  memory: "green",
  connector: "magenta",
  adapter: "blue",
  report: "yellow",
  service: "green",
  muted: "gray",
  danger: "red",
  ok: "green",
  warn: "yellow",
  text: "white"
};

export async function renderInteractiveCliApp(payload, options = {}) {
  const React = await import("react");
  const ink = await import("ink");
  const h = React.createElement;
  const { Box, Text, useApp, useInput } = ink;
  const views = buildViews(payload);
  const interactive = Boolean(options.interactive);

  function Header({ view }) {
    const runtime = payload.runtime ?? {};
    const packageLabel = `${payload.package?.name ?? "cognibrain"} ${payload.package?.version ?? ""}`.trim();
    const runtimeState = runtime.api?.alive ? "API online" : "API offline";
    const dashboardState = runtime.dashboard?.alive ? "Dashboard online" : "Dashboard optional";
    return h(
      Box,
      { flexDirection: "column", marginBottom: 1 },
      h(
        Box,
        { justifyContent: "space-between" },
        h(
          Box,
          { gap: 1 },
          h(Text, { backgroundColor: "cyan", color: "black", bold: true }, " CB "),
          h(Text, { color: "cyan", bold: true }, "COGNIBRAIN"),
          h(Text, { color: "gray" }, packageLabel)
        ),
        h(
          Box,
          { gap: 2 },
          h(Text, { color: runtime.api?.alive ? "green" : "yellow" }, runtimeState),
          h(Text, { color: runtime.dashboard?.alive ? "green" : "gray" }, dashboardState)
        )
      ),
      h(
        Box,
        { marginTop: 1, flexDirection: "column" },
        h(Text, { color: view.accent, bold: true }, view.title),
        h(Text, { color: "gray" }, view.subtitle)
      )
    );
  }

  function Sidebar({ selected, setSelected }) {
    return h(
      Box,
      { width: 32, flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, paddingY: 1, marginRight: 1 },
      h(Text, { color: "gray", bold: true }, "WORKBENCHES"),
      ...views.map((view, index) => {
        const active = selected === index;
        return h(
          Box,
          { key: view.id, marginTop: index === 0 ? 1 : 0 },
          h(Text, { color: active ? view.accent : "white", bold: active }, `${active ? ">" : " "} ${index + 1}. ${view.icon} ${view.label}`)
        );
      }),
      h(Box, { marginTop: 1, flexDirection: "column" },
        h(Text, { color: "gray" }, "Keys"),
        h(Text, { color: "gray" }, "up/down, 1-9"),
        h(Text, { color: "gray" }, "r refresh, q quit")
      )
    );
  }

  function MainPanel({ view, selectedAction, setSelectedAction }) {
    const actions = view.actions ?? [];
    return h(
      Box,
      { flexGrow: 1, flexDirection: "column" },
      h(
        Box,
        { minHeight: 6, flexDirection: "row", gap: 1, marginBottom: 1 },
        ...view.metrics.map((metric) => h(MetricTile, { key: metric.label, metric, accent: view.accent }))
      ),
      h(
        Box,
        { flexDirection: "row", gap: 1 },
        h(
          Box,
          { flexGrow: 1, flexDirection: "column", borderStyle: "round", borderColor: view.accent, paddingX: 1, paddingY: 1 },
          ...view.sections.map((section, index) => h(Section, { key: `${view.id}-${section.title}`, section, first: index === 0, accent: view.accent }))
        ),
        h(
          Box,
          { width: 38, flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, paddingY: 1 },
          h(Text, { color: "gray", bold: true }, "ACTION PALETTE"),
          ...actions.map((action, index) => {
            const active = selectedAction === index;
            return h(
              Box,
              { key: action.command, marginTop: index === 0 ? 1 : 0, flexDirection: "column" },
              h(Text, { color: active ? view.accent : "white", bold: active }, `${active ? ">" : " "} ${action.label}`),
              h(Text, { color: "gray" }, short(action.command, 30))
            );
          })
        )
      )
    );
  }

  function MetricTile({ metric, accent }) {
    return h(
      Box,
      { width: metric.width ?? 18, flexDirection: "column", borderStyle: "round", borderColor: metric.color ?? accent, paddingX: 1 },
      h(Text, { color: "gray" }, metric.label),
      h(Text, { color: metric.color ?? accent, bold: true }, String(metric.value)),
      metric.note ? h(Text, { color: "gray" }, short(metric.note, metric.noteWidth ?? 15)) : null
    );
  }

  function Section({ section, first, accent }) {
    return h(
      Box,
      { flexDirection: "column", marginTop: first ? 0 : 1 },
      h(Text, { color: accent, bold: true }, section.title),
      ...section.items.map((item, index) => h(Text, { key: `${section.title}-${index}`, color: item.color ?? "white" }, `${item.bullet ?? " "} ${item.text}`))
    );
  }

  function Footer({ view }) {
    const hint = interactive
      ? "Use the keyboard to switch workbenches. Commands stay available for automation."
      : "Snapshot mode. Run in a real terminal for keyboard navigation.";
    return h(
      Box,
      { marginTop: 1, justifyContent: "space-between" },
      h(Text, { color: "gray" }, hint),
      h(Text, { color: view.accent }, view.primaryCommand)
    );
  }

  function App() {
    const app = useApp();
    const [selected, setSelected] = React.useState(0);
    const [selectedAction, setSelectedAction] = React.useState(0);
    const view = views[selected] ?? views[0];
    useInput((input, key) => {
      if (input === "q") app.exit();
      if (input === "r") app.exit();
      if (key.upArrow || input === "k") {
        setSelected((current) => (current - 1 + views.length) % views.length);
        setSelectedAction(0);
      }
      if (key.downArrow || input === "j") {
        setSelected((current) => (current + 1) % views.length);
        setSelectedAction(0);
      }
      if (key.leftArrow) setSelectedAction((current) => Math.max(0, current - 1));
      if (key.rightArrow || key.tab) setSelectedAction((current) => Math.min((view.actions?.length ?? 1) - 1, current + 1));
      if (/^[1-9]$/.test(input)) {
        const next = Number(input) - 1;
        if (views[next]) {
          setSelected(next);
          setSelectedAction(0);
        }
      }
    }, { isActive: interactive });

    return h(
      Box,
      { flexDirection: "column", paddingX: 1 },
      h(Header, { view }),
      h(Box, { flexDirection: "row" }, h(Sidebar, { selected, setSelected }), h(MainPanel, { view, selectedAction, setSelectedAction })),
      h(Footer, { view })
    );
  }

  const instance = ink.render(h(App), { exitOnCtrlC: true });
  if (!interactive) {
    await new Promise((resolve) => setTimeout(resolve, options.snapshotMs ?? 60));
    instance.unmount();
    return;
  }
  await instance.waitUntilExit();
}

function buildViews(payload) {
  const truth = payload.reports ?? {};
  const truthSummary = truth.summary ?? {};
  const connectors = payload.connectors?.catalog ?? [];
  const adapters = payload.adapters?.catalog ?? [];
  const connectorDoctor = payload.connectors?.doctor ?? { checks: [] };
  const adapterDoctor = payload.adapters?.doctor ?? { checks: [] };
  const configuredConnectors = connectors.filter((item) => item.configured);
  const configuredAdapters = adapters.filter((item) => item.configured);
  const memories = payload.memories ?? {};
  const memoryCount = memories.health?.memories ?? memories.health?.total ?? memories.recent?.length ?? 0;

  return [
    {
      id: "home",
      label: "Home",
      icon: "Home",
      title: "One-command control plane",
      subtitle: "Everything starts from `cognibrain`: local runtime, memory, connectors, proof and service control.",
      accent: palette.brand,
      primaryCommand: "cognibrain",
      metrics: [
        metric("Memories", memoryCount, palette.memory, "stored"),
        metric("Connectors", `${configuredConnectors.length}/${connectors.length}`, palette.connector, "configured"),
        metric("Adapters", `${configuredAdapters.length}/${adapters.length}`, palette.adapter, "configured"),
        metric("Proof", `${truthSummary.realCompetitorRuns ?? 0} real`, (truthSummary.realCompetitorRuns ?? 0) > 0 ? palette.ok : palette.warn, "competitors")
      ],
      sections: [
        section("Today", [
          item("Run this app with one command, then navigate instead of memorizing commands.", "cyan", ">"),
          item(`${truthSummary.openGaps ?? 0} open proof gaps are visible in Reports; no marketing claim hides them.`, (truthSummary.openGaps ?? 0) ? "yellow" : "green", ">"),
          item("The dashboard remains optional. The CLI is the self-hosted operator surface.", "white", ">")
        ]),
        section("Configured", [
          item(`Profile: ${payload.config?.setupState?.profile ?? "not initialized"}`),
          item(`Runtime root: ${payload.config?.runtimeRoot ?? payload.runtimeRoot ?? "local"}`),
          item(`Service: ${payload.service?.platform ?? "local"} via ${payload.service?.manager ?? "manual"}`)
        ])
      ],
      actions: actions(["cognibrain init", "cognibrain doctor --fix", "cognibrain proof", "cognibrain service plan"])
    },
    {
      id: "memories",
      label: "Memories",
      icon: "Memo",
      title: "Memory workbench",
      subtitle: "Search, inspect, add corrections, explain why memory was used and run maintenance.",
      accent: palette.memory,
      primaryCommand: "cognibrain memories",
      metrics: [
        metric("Stored", memoryCount, palette.memory),
        metric("Quality", memories.health?.qualityScore ?? memories.health?.freshness ?? "n/a", palette.brand),
        metric("Recent", memories.recent?.length ?? 0, palette.text)
      ],
      sections: [
        section("Recent Memories", compact(memories.recent ?? [], (memory) => item(`${shortId(memory.id)} ${memory.content}`, "white", "-"), 6)),
        section("Capabilities", [
          item("Add corrections, repo rules, tool outcomes and release evidence."),
          item("Open coding context packs, evidence packs, why-used reports, graph and timeline views."),
          item("Run dream maintenance from the terminal after large imports or releases.")
        ])
      ],
      actions: actions(["cognibrain memories search <query>", "cognibrain memory code-correction <text>", "cognibrain memory why-used <id>", "cognibrain memory dream"])
    },
    {
      id: "connections",
      label: "Connections",
      icon: "Links",
      title: "Connections overview",
      subtitle: "Configured source systems and adapters, with credential-safe setup and health checks.",
      accent: palette.connector,
      primaryCommand: "cognibrain connections",
      metrics: [
        metric("Connectors", `${configuredConnectors.length}/${connectors.length}`, palette.connector),
        metric("Adapters", `${configuredAdapters.length}/${adapters.length}`, palette.adapter),
        metric("Config", connectorDoctor.ok && adapterDoctor.ok ? "ready" : "check", connectorDoctor.ok && adapterDoctor.ok ? palette.ok : palette.warn)
      ],
      sections: [
        section("Configured Connectors", configuredConnectors.length ? configuredConnectors.map((connector) => item(`${connector.provider} -> ${connector.connectorId}`, "green", "-")) : [item("No connector configured yet.", "yellow", "-")]),
        section("Configured Adapters", configuredAdapters.length ? configuredAdapters.map((adapter) => item(`${adapter.adapter} -> ${adapter.adapterId}`, "green", "-")) : [item("No adapter configured yet.", "yellow", "-")]),
        section("Health", [
          item(`${connectorDoctor.checks?.length ?? 0} connector checks available from this screen.`),
          item(`${adapterDoctor.checks?.length ?? 0} adapter checks available from this screen.`)
        ])
      ],
      actions: actions(["cognibrain connections add jira", "cognibrain connections add notion", "cognibrain connections doctor", "cognibrain connector list"])
    },
    {
      id: "connectors",
      label: "Connectors",
      icon: "Plug",
      title: "Native connector matrix",
      subtitle: "Vendor drivers, setup fields, fixture/API-spec proof and live-credential boundaries.",
      accent: palette.connector,
      primaryCommand: "cognibrain connector list",
      metrics: [
        metric("Native", connectors.length, palette.connector),
        metric("Configured", configuredConnectors.length, configuredConnectors.length ? palette.ok : palette.warn),
        metric("API Spec", payload.connectors?.apiSpec?.summary?.passed ?? "n/a", (payload.connectors?.apiSpec?.passed ? palette.ok : palette.warn), "contracts")
      ],
      sections: [
        section("Priority Systems", compact(connectors.filter((connector) => ["jira", "confluence", "notion", "linear", "github", "gitlab", "azure-devops"].includes(connector.provider)), (connector) => item(`${connector.provider}: ${connector.status}${connector.configured ? " configured" : ""}`, connector.configured ? "green" : "white", "-"), 8)),
        section("Spec Verification", [
          item(`Artifact: ${payload.connectors?.apiSpec?.artifact ?? "artifacts/vendor-api-specs.json"}`),
          item("Spec checks validate method, path shape, auth scheme and writeback expectations without tenant credentials."),
          item("Live-smoke remains credential-gated and is never claimed unless an artifact proves it.", "yellow")
        ])
      ],
      actions: actions(["cognibrain connector show jira", "cognibrain connector doctor jira", "npm run verify:vendor-api-specs", "npm run connectors:maturity"])
    },
    {
      id: "adapters",
      label: "Adapters",
      icon: "SDK",
      title: "Adapter workbench",
      subtitle: "Storage, model-provider, media, MCP and benchmark runner adapters.",
      accent: palette.adapter,
      primaryCommand: "cognibrain adapter list",
      metrics: [
        metric("Available", adapters.length, palette.adapter),
        metric("Configured", configuredAdapters.length, configuredAdapters.length ? palette.ok : palette.warn),
        metric("Doctor", adapterDoctor.ok ? "ready" : "needs config", adapterDoctor.ok ? palette.ok : palette.warn)
      ],
      sections: [
        section("Available Adapters", compact(adapters, (adapter) => item(`${adapter.adapter} (${adapter.kind}, ${adapter.status})`, adapter.configured ? "green" : "white", "-"), 10)),
        section("Coverage", [
          item("Storage adapters keep self-hosted deploys portable."),
          item("JSON-command adapters let external platforms integrate without changing core code."),
          item("Benchmark runners use the same adapter contract as competitor execution.")
        ])
      ],
      actions: actions(["cognibrain adapter add storage-sqlite", "cognibrain adapter doctor", "cognibrain sdk platform acme", "cognibrain connections adapters"])
    },
    {
      id: "config",
      label: "Config",
      icon: "Tune",
      title: "Configuration center",
      subtitle: "Setup profile, harness configs, connector files, adapter files and Codex skill state.",
      accent: palette.brand,
      primaryCommand: "cognibrain config show",
      metrics: [
        metric("Profile", payload.config?.setupState?.profile ?? "missing", payload.config?.setupState ? palette.ok : palette.warn),
        metric("Harness", payload.config?.harnessManifest ? "present" : "missing", payload.config?.harnessManifest ? palette.ok : palette.warn),
        metric("Skill", payload.config?.skill?.installed ? "installed" : "missing", payload.config?.skill?.installed ? palette.ok : palette.warn)
      ],
      sections: [
        section("Paths", compact(Object.entries(payload.configCatalog?.paths ?? {}), ([name, value]) => item(`${name}: ${value}`, "white", "-"), 8)),
        section("Harnesses", compact(payload.configCatalog?.harnesses ?? [], (target) => item(`${target.target}: ${target.command}`, "white", "-"), 8))
      ],
      actions: actions(["cognibrain config doctor", "cognibrain config all", "cognibrain skill install", "cognibrain init --profile team"])
    },
    {
      id: "service",
      label: "Service",
      icon: "Run",
      title: "Service automation",
      subtitle: "Start, stop and install native services on Linux, macOS and Windows from the terminal.",
      accent: palette.service,
      primaryCommand: "cognibrain service plan",
      metrics: [
        metric("Platform", payload.service?.platform ?? "local", palette.service),
        metric("Manager", payload.service?.manager ?? "manual", palette.text),
        metric("Installed", payload.service?.installed ? "yes" : "no", payload.service?.installed ? palette.ok : palette.warn)
      ],
      sections: [
        section("Plan", [
          item(`Descriptor: ${payload.service?.files?.descriptor ?? "not planned"}`),
          item(`Metadata: ${payload.service?.files?.metadata ?? "not planned"}`),
          item(`Dashboard: ${payload.service?.dashboard?.enabled ? "enabled" : "optional/off"}`)
        ]),
        section("Native Control", compact(payload.service?.actions ?? [], (command) => item(command, "white", "-"), 6))
      ],
      actions: actions(["cognibrain service install --activate", "cognibrain service start", "cognibrain service logs", "cognibrain status"])
    },
    {
      id: "reports",
      label: "Reports",
      icon: "Proof",
      title: "Proof and benchmark reports",
      subtitle: "Arena proof levels, connector maturity, API/spec verification and release truth.",
      accent: palette.report,
      primaryCommand: "cognibrain proof",
      metrics: [
        metric("Truth", truth.passed ? "bounded" : "fail", truth.passed ? palette.ok : palette.danger),
        metric("Plan", truth.planComplete ? "complete" : `${truthSummary.openGaps ?? 0} gaps`, truth.planComplete ? palette.ok : palette.warn),
        metric("Real Runs", truthSummary.realCompetitorRuns ?? 0, (truthSummary.realCompetitorRuns ?? 0) > 0 ? palette.ok : palette.warn)
      ],
      sections: [
        section("Truth Tuples", compact(truth.truthTuples ?? [], (tuple) => item(`${tuple[0]} = ${tuple[1]} (${tuple[2]})`, "white", "-"), 8)),
        section("Open Gaps", (truth.openGaps?.length ? truth.openGaps : []).slice(0, 6).map((gap) => item(`${gap.id}: ${gap.message}`, "yellow", "-")).concat(truth.openGaps?.length ? [] : [item("No open proof gaps in current artifact.", "green", "-")]))
      ],
      actions: actions(["cognibrain proof --json", "npm run benchmark:arena", "npm run benchmark:competitors:native", "npm run audit:truth"])
    },
    {
      id: "sdk",
      label: "SDK",
      icon: "Code",
      title: "Integration SDK",
      subtitle: "Scaffold new platform integrations and verify SDK packaging from the CLI.",
      accent: palette.adapter,
      primaryCommand: "cognibrain sdk list",
      metrics: [
        metric("SDKs", payload.sdk?.catalog?.length ?? 0, palette.adapter),
        metric("Doctor", payload.sdk?.doctor?.ok ? "ready" : "check", payload.sdk?.doctor?.ok ? palette.ok : palette.warn),
        metric("Custom", "yes", palette.ok)
      ],
      sections: [
        section("Available SDKs", compact(payload.sdk?.catalog ?? [], (sdk) => item(`${sdk.sdk} (${sdk.status})`, "white", "-"), 6)),
        section("Scaffold Flow", [
          item("Generate an integration contract, manifest, env example and README."),
          item("Run fixture/spec verification before a connector appears as production-certified."),
          item("Keep external platforms code-driven through adapters, not doc-only claims.")
        ])
      ],
      actions: actions(["cognibrain sdk platform acme --kind project_management", "cognibrain sdk doctor", "cognibrain connections add acme", "npm run verify:compatibility"])
    },
    {
      id: "doctor",
      label: "Doctor",
      icon: "Check",
      title: "Readiness doctor",
      subtitle: "Local readiness, missing credentials, stale artifacts and safe remediation.",
      accent: palette.warn,
      primaryCommand: "cognibrain doctor --fix",
      metrics: [
        metric("Config", payload.doctor?.config?.ok ? "ready" : "check", payload.doctor?.config?.ok ? palette.ok : palette.warn),
        metric("Connections", payload.doctor?.connections?.ok ? "ready" : "check", payload.doctor?.connections?.ok ? palette.ok : palette.warn),
        metric("SDK", payload.doctor?.sdk?.ok ? "ready" : "check", payload.doctor?.sdk?.ok ? palette.ok : palette.warn)
      ],
      sections: [
        section("Config Checks", compact(payload.doctor?.config?.checks ?? [], (check) => item(`${check.ok ? "ok" : "warn"} ${check.name}`, check.ok ? "green" : "yellow", "-"), 6)),
        section("Next Fixes", [
          item("Use --fix for safe local remediation."),
          item("Connector secrets stay in environment variables, never plaintext config."),
          item("Dangerous service changes stay explicit.")
        ])
      ],
      actions: actions(["cognibrain doctor --fix", "cognibrain connections doctor", "npm run release:check", "npm pack --dry-run"])
    }
  ];
}

function metric(label, value, color = "white", note) {
  return { label, value, color, note };
}

function section(title, items) {
  return { title, items: items.length ? items : [item("none", "gray")] };
}

function item(text, color = "white", bullet = " ") {
  return { text: String(text), color, bullet };
}

function actions(commands) {
  return commands.map((command) => ({ label: command.replace(/^cognibrain\s*/, "") || "home", command }));
}

function compact(values, formatter, limit = 8) {
  const items = values.slice(0, limit).map(formatter);
  if (values.length > limit) items.push(item(`and ${values.length - limit} more`, "gray", "-"));
  return items;
}

function short(value, length) {
  const text = String(value ?? "");
  return text.length > length ? `${text.slice(0, Math.max(0, length - 1))}...` : text;
}

function shortId(value) {
  return String(value ?? "memory").slice(0, 8);
}
