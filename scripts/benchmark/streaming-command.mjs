import { spawn } from "node:child_process";

export function runCommand(command, args = [], options = {}) {
  const timeoutMs = Math.max(1, Number(options.timeout ?? 300_000));
  const captureLimit = Math.max(1_000, Number(options.captureLimit ?? 3_000));
  const stdout = createTailBuffer(captureLimit);
  const stderr = createTailBuffer(captureLimit);
  const started = Date.now();
  let timedOut = false;
  let errorMessage;

  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    shell: options.shell === true,
    stdio: ["pipe", "pipe", "pipe"]
  });

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => {
    stdout.write(chunk);
    if (options.forwardOutput) process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    stderr.write(chunk);
    if (options.forwardOutput) process.stderr.write(chunk);
  });
  child.on("error", (error) => {
    errorMessage = error.message;
  });
  child.stdin?.end(options.input ?? "");

  return new Promise((resolve) => {
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolve({
        ok: status === 0,
        status,
        signal,
        stdout: stdout.value(),
        stderr: stderr.value(),
        error: errorMessage,
        timedOut,
        durationMs: Date.now() - started,
        truncatedStdout: stdout.truncated(),
        truncatedStderr: stderr.truncated()
      });
    });
  });
}

export function commandEntry(result) {
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdoutTail: result.stdout ?? "",
    stderrTail: result.stderr ?? "",
    error: result.error,
    timedOut: result.timedOut === true,
    durationMs: result.durationMs,
    truncatedStdout: result.truncatedStdout === true,
    truncatedStderr: result.truncatedStderr === true
  };
}

function createTailBuffer(limit) {
  let value = "";
  let clipped = false;
  return {
    write(chunk) {
      value += String(chunk ?? "");
      if (value.length > limit) {
        value = value.slice(-limit);
        clipped = true;
      }
    },
    value() {
      return value;
    },
    truncated() {
      return clipped;
    }
  };
}
