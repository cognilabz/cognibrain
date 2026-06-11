#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../..", import.meta.url);
const packageJsonPath = new URL("package.json", root);
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const registry = process.env.NPM_CONFIG_REGISTRY || "https://registry.npmjs.org/";
const dryRun = process.argv.includes("--dry-run");
const githubOutputPath = argValue("--github-output");
const npmLatestVersion = process.env.COGNIBRAIN_NPM_LATEST_VERSION || readNpmLatestVersion(packageJson.name, registry);
const publishVersion = choosePublishVersion(packageJson.version, npmLatestVersion);
const updated = publishVersion !== packageJson.version;

if (updated) {
  if (dryRun) {
    console.log(`would sync ${packageJson.name} from ${packageJson.version} to ${publishVersion}`);
  } else {
    run("npm", ["version", publishVersion, "--no-git-tag-version"], root.pathname);
  }
} else {
  console.log(`${packageJson.name} package version ${packageJson.version} is ahead of npm latest ${npmLatestVersion || "none"}`);
}

const outputs = {
  package_name: packageJson.name,
  previous_package_version: packageJson.version,
  npm_latest: npmLatestVersion || "",
  publish_version: publishVersion,
  updated: String(updated)
};

for (const [key, value] of Object.entries(outputs)) {
  console.log(`${key}=${value}`);
}

if (githubOutputPath) {
  appendFileSync(githubOutputPath, `${Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
}

function choosePublishVersion(packageVersion, latestVersion) {
  if (!latestVersion) {
    parseVersion(packageVersion);
    return packageVersion;
  }
  if (compareVersions(packageVersion, latestVersion) > 0) {
    return packageVersion;
  }
  return bumpPatch(latestVersion);
}

function readNpmLatestVersion(packageName, registryUrl) {
  const result = spawnSync("npm", ["view", packageName, "version", `--registry=${registryUrl}`], {
    cwd: root.pathname,
    encoding: "utf8"
  });
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  const combined = `${stdout}\n${stderr}`;
  if (result.status === 0 && stdout) {
    return stdout.split(/\r?\n/).at(-1).trim();
  }
  if (/E404|404 Not Found/.test(combined)) {
    return "";
  }
  throw new Error(`Failed to read npm latest version for ${packageName}: ${combined || `exit ${result.status}`}`);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (const key of ["major", "minor", "patch"]) {
    const delta = a[key] - b[key];
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function bumpPatch(version) {
  const parsed = parseVersion(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function parseVersion(version) {
  const value = String(version || "").trim();
  const core = value.split(/[+-]/)[0];
  const parts = core.split(".").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Unsupported npm package version: ${value}`);
  }
  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2]
  };
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return "";
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}
