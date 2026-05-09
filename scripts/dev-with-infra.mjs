import { spawn, spawnSync } from "node:child_process";

const REQUIRED_SERVICES = ["postgres", "osrm"];
const DEV_PORTS = [3000, 3001, 3002, 4001, 4002, 4003, 4004, 4005];

function runSync(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    ...options
  });
}

function getPnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function getListeningPidsByPort(ports) {
  const pids = new Set();

  for (const port of ports) {
    const result = runSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
    if (result.status !== 0) {
      continue;
    }

    for (const line of (result.stdout || "").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const pid = Number(trimmed);
      if (Number.isInteger(pid) && pid > 0) {
        pids.add(pid);
      }
    }
  }

  return pids;
}

function getProcessCommand(pid) {
  const result = runSync("ps", ["-p", String(pid), "-o", "comm="]);
  if (result.status !== 0) {
    return "";
  }
  return (result.stdout || "").trim().toLowerCase();
}

function clearStaleLocalDevPorts() {
  const lsofCheck = runSync("lsof", ["-v"]);
  if (lsofCheck.error || lsofCheck.status !== 0) {
    console.warn("[dev] Skipping port cleanup: lsof is not available on this system.");
    return;
  }

  const pids = getListeningPidsByPort(DEV_PORTS);
  if (pids.size === 0) {
    return;
  }

  const nodePids = [];
  const skipped = [];

  for (const pid of pids) {
    const command = getProcessCommand(pid);
    if (command.includes("node") || command.includes("next-server") || command.includes("next")) {
      nodePids.push(pid);
    } else {
      skipped.push({ pid, command: command || "unknown" });
    }
  }

  if (nodePids.length > 0) {
    const kill = runSync("kill", ["-9", ...nodePids.map((pid) => String(pid))]);
    if (kill.status === 0) {
      console.log(`[dev] Cleared stale Node listeners on dev ports (PIDs: ${nodePids.join(", ")})`);
    } else {
      console.warn(`[dev] Failed to kill some stale Node listeners (PIDs: ${nodePids.join(", ")})`);
    }
  }

  if (skipped.length > 0) {
    const skippedSummary = skipped.map((entry) => `${entry.pid}:${entry.command}`).join(", ");
    console.warn(`[dev] Found non-Node listeners on dev ports (left untouched): ${skippedSummary}`);
  }
}

function checkDockerAvailable() {
  const result = runSync("docker", ["info", "--format", "{{.ServerVersion}}"]);
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new Error(
      `Docker daemon is not reachable. Start Docker Desktop and retry. ${stderr}`.trim()
    );
  }
}

function assertNotRunningFromTrash() {
  const cwd = process.cwd();
  if (cwd.includes("/.Trash/")) {
    throw new Error(
      `This project is running from Trash (${cwd}). Restore or run from your working repo path to avoid stale config and high memory usage.`
    );
  }
}

function getRunningServiceSet() {
  const running = new Set();

  // Compose v2: get running services directly.
  const statusResult = runSync("docker", [
    "compose",
    "ps",
    "--services",
    "--status",
    "running"
  ]);

  if (statusResult.status === 0) {
    for (const service of statusResult.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
      running.add(service);
    }
    return running;
  }

  // Fallback: inspect each service container state.
  for (const service of REQUIRED_SERVICES) {
    const idResult = runSync("docker", ["compose", "ps", "-q", service]);
    const containerId = (idResult.stdout || "").trim();
    if (!containerId) {
      continue;
    }

    const inspect = runSync("docker", ["inspect", "-f", "{{.State.Running}}", containerId]);
    if (inspect.status === 0 && (inspect.stdout || "").trim() === "true") {
      running.add(service);
    }
  }

  return running;
}

function ensureInfraRunning() {
  checkDockerAvailable();

  const running = getRunningServiceSet();
  const missing = REQUIRED_SERVICES.filter((service) => !running.has(service));

  if (missing.length === 0) {
    console.log("[dev] Docker infra already running: postgres, osrm");
    return;
  }

  console.log(`[dev] Starting missing Docker services: ${missing.join(", ")}`);
  const up = runSync("docker", ["compose", "up", "-d", ...missing]);
  if (up.stdout) {
    process.stdout.write(up.stdout);
  }
  if (up.stderr) {
    process.stderr.write(up.stderr);
  }

  if (up.status !== 0) {
    const combined = `${up.stdout || ""}\n${up.stderr || ""}`;
    if (combined.includes("is already in use by container")) {
      console.warn("[dev] Found stale Docker container name conflict. Cleaning and retrying...");
      runSync("docker", ["rm", "-f", "founder-gps-postgres", "founder-gps-osrm"]);

      const retryUp = runSync("docker", ["compose", "up", "-d", ...missing]);
      if (retryUp.stdout) {
        process.stdout.write(retryUp.stdout);
      }
      if (retryUp.stderr) {
        process.stderr.write(retryUp.stderr);
      }

      if (retryUp.status === 0) {
        return;
      }
    }
  }

  if (up.status !== 0) {
    throw new Error("Failed to start required Docker services with docker compose.");
  }
}

function startDevApps() {
  const pnpmCmd = getPnpmCommand();
  const child = spawn(pnpmCmd, ["turbo", "run", "dev", "--parallel"], {
    stdio: "inherit"
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

function main() {
  const args = new Set(process.argv.slice(2));
  const skipInfra = args.has("--skip-infra");
  const skipPortCleanup = args.has("--skip-port-cleanup");

  try {
    assertNotRunningFromTrash();

    if (!skipPortCleanup) {
      clearStaleLocalDevPorts();
    } else {
      console.log("[dev] Skipping stale port cleanup (--skip-port-cleanup)");
    }

    if (!skipInfra) {
      ensureInfraRunning();
    } else {
      console.log("[dev] Skipping Docker infra check (--skip-infra)");
    }

    startDevApps();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[dev] ${message}`);
    process.exit(1);
  }
}

main();
