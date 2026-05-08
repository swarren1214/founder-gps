import Fastify from "fastify";
import { Pool } from "pg";
import { resourceRoutes } from "./routes/resources.js";
import { PgResourceRepository, type ResourceRepository } from "./repository.js";

export type AppOptions = {
  repository?: ResourceRepository;
  databaseUrl?: string;
};

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: true });

  const repository =
    options.repository ??
    new PgResourceRepository(new Pool({ connectionString: options.databaseUrl ?? process.env.DATABASE_URL }));

  app.get("/health", async () => ({ ok: true }));

  app.register(async (instance) => {
    await resourceRoutes(instance, repository);
  });

  return app;
}
