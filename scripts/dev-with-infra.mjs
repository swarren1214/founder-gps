import { spawn, spawnSync } from "node:child_process";

const REQUIRED_SERVICES = ["postgres", "osrm"];

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

function checkDockerAvailable() {
  const result = runSync("docker", ["info", "--format", "{{.ServerVersion}}"]);
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new Error(
      `Docker daemon is not reachable. Start Docker Desktop and retry. ${stderr}`.trim()
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
  const up = spawnSync("docker", ["compose", "up", "-d", ...missing], {
    stdio: "inherit"
  });

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

  try {
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
