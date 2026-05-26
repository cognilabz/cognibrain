import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function createServiceRuntime({ root, runtimeRoot, hostPlatformName, optionValue, optionValues, readJson, writeJson, runtimeStatus, serviceUsage }) {
function servicePlan(serviceArgs = []) {
  const targetPlatform = normalizeServicePlatform(optionValue(serviceArgs, "--platform") ?? optionValue(serviceArgs, "--os") ?? serviceHostPlatform());
  const serviceName = optionValue(serviceArgs, "--name") ?? "cognibrain";
  const label = optionValue(serviceArgs, "--label") ?? `dev.cognilabz.${serviceName}`;
  const system = serviceArgs.includes("--system");
  const dashboardEnabled = serviceArgs.includes("--dashboard") || serviceArgs.includes("--with-dashboard");
  const serviceDir = join(runtimeRoot, ".cognibrain", "service");
  const metadataPath = join(serviceDir, "service.json");
  const logs = {
    stdout: join(serviceDir, "cognibrain.out.log"),
    stderr: join(serviceDir, "cognibrain.err.log")
  };
  const node = process.execPath;
  const cli = join(root, "bin", "cognibrain.mjs");
  const dbPath = optionValue(serviceArgs, "--db-path") ?? process.env.MEMORY_DB_PATH ?? join(runtimeRoot, ".memory-harness.json");
  const env = {
    COGNIBRAIN_RUNTIME_ROOT: runtimeRoot,
    MEMORY_DB_PATH: dbPath,
    NODE_ENV: optionValue(serviceArgs, "--node-env") ?? process.env.NODE_ENV ?? "production",
    ...serviceEnvFromArgs(serviceArgs)
  };
  if (optionValue(serviceArgs, "--port")) env.PORT = optionValue(serviceArgs, "--port");
  if (optionValue(serviceArgs, "--dashboard-port")) env.VITE_PORT = optionValue(serviceArgs, "--dashboard-port");
  if (dashboardEnabled) env.COGNIBRAIN_DASHBOARD = "true";

  const execArgs = [cli, "--runtime-root", runtimeRoot, "dev", ...(dashboardEnabled ? ["--dashboard"] : [])];
  const scope = system ? "system" : "user";
  const descriptorPath = serviceDescriptorPath(targetPlatform, serviceName, label, scope, serviceDir);
  const descriptor = serviceDescriptor(targetPlatform, {
    name: serviceName,
    label,
    scope,
    node,
    cli,
    execArgs,
    runtimeRoot,
    root,
    env,
    logs
  });
  const commands = serviceNativeCommands(targetPlatform, { name: serviceName, label, scope, descriptorPath, scriptPath: descriptorPath });
  const installed = existsSync(descriptorPath) || existsSync(metadataPath);
  return {
    schemaVersion: "1.0",
    platform: targetPlatform,
    hostPlatform: serviceHostPlatform(),
    manager: serviceManager(targetPlatform),
    name: serviceName,
    label,
    scope,
    runtimeRoot,
    dashboard: { enabled: dashboardEnabled, optional: true },
    command: { executable: node, args: execArgs },
    env,
    files: {
      descriptor: descriptorPath,
      metadata: metadataPath,
      logs
    },
    descriptor,
    installed,
    runtime: runtimeStatus(),
    commands,
    actions: [
      "cognibrain service plan --json",
      "cognibrain service install --activate",
      "cognibrain service status",
      "cognibrain service start",
      "cognibrain service stop",
      "cognibrain service uninstall --deactivate"
    ],
    notes: serviceNotes(targetPlatform)
  };
}

function serviceHostPlatform() {
  const value = hostPlatformName();
  if (value === "darwin") return "macos";
  if (value === "win32") return "windows";
  return "linux";
}

function normalizeServicePlatform(value) {
  const normalized = String(value).toLowerCase();
  if (["darwin", "mac", "macos", "osx"].includes(normalized)) return "macos";
  if (["win", "win32", "windows"].includes(normalized)) return "windows";
  if (["linux", "systemd"].includes(normalized)) return "linux";
  console.error(`Unknown service platform: ${value}`);
  serviceUsage(1);
}

function serviceManager(targetPlatform) {
  if (targetPlatform === "macos") return "launchd";
  if (targetPlatform === "windows") return "task-scheduler";
  return "systemd";
}

function serviceDescriptorPath(targetPlatform, name, label, scope, serviceDir) {
  if (targetPlatform === "macos") {
    return scope === "system" ? `/Library/LaunchDaemons/${label}.plist` : join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
  }
  if (targetPlatform === "windows") return join(serviceDir, `${name}.service.ps1`);
  return scope === "system" ? `/etc/systemd/system/${name}.service` : join(homedir(), ".config", "systemd", "user", `${name}.service`);
}

function serviceDescriptor(targetPlatform, options) {
  if (targetPlatform === "macos") return launchdPlist(options);
  if (targetPlatform === "windows") return windowsServiceScript(options);
  return systemdUnit(options);
}

function systemdUnit({ name, node, execArgs, runtimeRoot, root: workingDirectory, env }) {
  const envLines = Object.entries(env).map(([key, value]) => `Environment=${systemdQuote(`${key}=${value}`)}`).join("\n");
  return `[Unit]
Description=Cognibrain self-hosted memory runtime
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${systemdQuote(workingDirectory)}
${envLines}
ExecStart=${systemdQuote(node)} ${execArgs.map(systemdQuote).join(" ")}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`;
}

function launchdPlist({ label, node, execArgs, runtimeRoot: _runtimeRoot, root: workingDirectory, env, logs }) {
  const envEntries = Object.entries(env)
    .map(([key, value]) => `    <key>${xmlEscape(key)}</key>\n    <string>${xmlEscape(value)}</string>`)
    .join("\n");
  const args = [node, ...execArgs]
    .map((arg) => `    <string>${xmlEscape(arg)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(label)}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(workingDirectory)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${envEntries}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logs.stdout)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logs.stderr)}</string>
</dict>
</plist>
`;
}

function windowsServiceScript({ node, execArgs, root: workingDirectory, env }) {
  const envLines = Object.entries(env)
    .map(([key, value]) => `$env:${key} = ${powershellString(value)}`)
    .join("\n");
  const args = execArgs.map(powershellString).join(" ");
  return `$ErrorActionPreference = "Stop"
Set-Location ${powershellString(workingDirectory)}
${envLines}
& ${powershellString(node)} ${args}
exit $LASTEXITCODE
`;
}

function serviceEnvFromArgs(args) {
  return Object.fromEntries(optionValues(args, "--env").map((item) => {
    const index = item.indexOf("=");
    if (index <= 0) {
      console.error(`Invalid --env value: ${item}. Use KEY=value.`);
      process.exit(1);
    }
    return [item.slice(0, index), item.slice(index + 1)];
  }));
}

function serviceNativeCommands(targetPlatform, { name, label, scope, descriptorPath }) {
  if (targetPlatform === "macos") {
    return {
      enable: [`launchctl load -w ${shellQuote(descriptorPath)}`],
      disable: [`launchctl unload -w ${shellQuote(descriptorPath)}`],
      start: [`launchctl start ${shellQuote(label)}`],
      stop: [`launchctl stop ${shellQuote(label)}`],
      restart: [`launchctl stop ${shellQuote(label)}`, `launchctl start ${shellQuote(label)}`],
      status: [`launchctl list | grep ${shellQuote(label)}`],
      uninstall: [`rm ${shellQuote(descriptorPath)}`]
    };
  }
  if (targetPlatform === "windows") {
    const task = `Cognibrain\\${name}`;
    const action = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File '${descriptorPath.replace(/'/g, "''")}'`;
    return {
      enable: [`schtasks /Create /TN "${task}" /SC ONLOGON /TR "${action}" /F`],
      disable: [`schtasks /Delete /TN "${task}" /F`],
      start: [`schtasks /Run /TN "${task}"`],
      stop: [`schtasks /End /TN "${task}"`],
      restart: [`schtasks /End /TN "${task}"`, `schtasks /Run /TN "${task}"`],
      status: [`schtasks /Query /TN "${task}" /V /FO LIST`],
      uninstall: [`del "${descriptorPath}"`]
    };
  }
  const prefix = scope === "system" ? "sudo systemctl" : "systemctl --user";
  const unit = `${name}.service`;
  return {
    enable: [`${prefix} daemon-reload`, `${prefix} enable --now ${unit}`],
    disable: [`${prefix} disable --now ${unit}`],
    start: [`${prefix} start ${unit}`],
    stop: [`${prefix} stop ${unit}`],
    restart: [`${prefix} restart ${unit}`],
    status: [`${prefix} status ${unit}`],
    uninstall: [`rm ${shellQuote(descriptorPath)}`]
  };
}

function serviceNotes(targetPlatform) {
  if (targetPlatform === "windows") return ["Windows uses Task Scheduler for no-extra-dependency background startup.", "Use --dashboard only when the optional browser UI should run too."];
  if (targetPlatform === "macos") return ["macOS uses launchd LaunchAgents by default.", "Use --system only for LaunchDaemons when installing with administrator rights."];
  return ["Linux uses systemd user services by default.", "Use --system for a machine service when installing with administrator rights."];
}

function writeServicePlan(plan) {
  if (plan.platform !== serviceHostPlatform()) {
    console.error(`Refusing to install ${plan.platform} service files on ${serviceHostPlatform()}. Use service plan --platform ${plan.platform} --json on this host, or run install on the target OS.`);
    process.exit(1);
  }
  mkdirSync(dirname(plan.files.descriptor), { recursive: true });
  mkdirSync(dirname(plan.files.logs.stdout), { recursive: true });
  writeFileSync(plan.files.descriptor, plan.descriptor);
  const metadata = { ...plan, descriptor: undefined };
  writeJson(plan.files.metadata, metadata);
  return { ...plan, installed: true, written: [plan.files.descriptor, plan.files.metadata], dryRun: false };
}

function removeServicePlan(plan) {
  const removed = [];
  for (const path of [plan.files.descriptor, plan.files.metadata]) {
    if (existsSync(path)) {
      rmSync(path, { force: true });
      removed.push(path);
    }
  }
  return { ...plan, installed: false, removed };
}

function runServiceNativeAction(plan, action) {
  if (plan.platform !== serviceHostPlatform()) {
    console.error(`Cannot run ${plan.platform} ${action} command on ${serviceHostPlatform()}.`);
    process.exit(1);
  }
  const commands = action === "uninstall" ? plan.commands.uninstall : plan.commands[action];
  if (!commands?.length) serviceUsage(1);
  for (const command of commands) {
    const result = spawnSync(command, [], { cwd: root, shell: true, stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

function printServiceInstall(result, dryRun) {
  console.log(`${dryRun ? "would write" : "wrote"} ${result.manager} service for ${result.platform}`);
  console.log(`descriptor: ${result.files.descriptor}`);
  console.log(`metadata: ${result.files.metadata}`);
  console.log(`runtime: ${result.runtimeRoot}`);
  console.log(`dashboard: ${result.dashboard.enabled ? "enabled" : "optional/off"}`);
  console.log(`next: ${result.commands.enable.join(" && ")}`);
}

function printServiceRemove(result) {
  console.log(`removed service files: ${result.removed.length ? result.removed.join(", ") : "none"}`);
}

function printServiceLogs(plan) {
  if (plan.platform === "linux") console.log(`logs: ${plan.scope === "system" ? "journalctl -u" : "journalctl --user -u"} ${plan.name}.service -f`);
  else if (plan.platform === "macos") console.log(`logs: tail -f ${plan.files.logs.stdout} ${plan.files.logs.stderr}`);
  else console.log(`logs: schtasks /Query /TN "Cognibrain\\${plan.name}" /V /FO LIST`);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function systemdQuote(value) {
  return `"${String(value).replace(/(["\\$`])/g, "\\$1")}"`;
}

function powershellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

return {
  servicePlan,
  serviceHostPlatform,
  writeServicePlan,
  removeServicePlan,
  runServiceNativeAction,
  printServiceInstall,
  printServiceRemove,
  printServiceLogs
};
}
