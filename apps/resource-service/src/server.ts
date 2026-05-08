import { buildApp } from "./app.js";
import { config } from "./config.js";

async function start() {
  const app = buildApp({ databaseUrl: config.DATABASE_URL });

  await app.listen({ port: config.RESOURCE_SERVICE_PORT, host: "0.0.0.0" });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
