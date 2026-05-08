import { buildApp } from "./app.js";
import { config } from "./config.js";
import { verifyOsrmArtifacts } from "./startup-checks.js";

async function start() {
  await verifyOsrmArtifacts(config.OSRM_DATA_PATH, config.OSRM_DATA_BASENAME);

  const app = buildApp({
    osrmBaseUrl: config.OSRM_BASE_URL,
    osrmRequestTimeoutMs: config.OSRM_REQUEST_TIMEOUT_MS,
    osrmMaxRetries: config.OSRM_MAX_RETRIES
  });

  await app.listen({ port: config.ROUTING_SERVICE_PORT, host: "0.0.0.0" });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
