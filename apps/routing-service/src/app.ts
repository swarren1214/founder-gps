import Fastify from "fastify";
import { HttpOsrmClient, type OsrmClient } from "./clients/osrm-client.js";
import { routingRoutes } from "./routes/routing.js";
import { RoutingService } from "./service.js";

export type AppOptions = {
  osrmBaseUrl?: string;
  osrmRequestTimeoutMs?: number;
  osrmMaxRetries?: number;
  osrmClient?: OsrmClient;
  service?: RoutingService;
};

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: true });

  const osrmClient =
    options.osrmClient ??
    new HttpOsrmClient(
      options.osrmBaseUrl ?? process.env.OSRM_BASE_URL ?? "http://localhost:5000",
      options.osrmRequestTimeoutMs,
      options.osrmMaxRetries
    );

  const service = options.service ?? new RoutingService(osrmClient);

  app.get("/health", async () => ({ ok: true }));

  app.register(async (instance) => {
    await routingRoutes(instance, service);
  });

  return app;
}
