import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { Pool } from "pg";
import { authRoutes } from "./routes.js";
import { PgAuthRepository, type AuthRepository } from "./repository.js";
import { LocalAvatarStorageClient, type AvatarStorageClient } from "./avatar-storage.js";

export type AppOptions = {
  repository?: AuthRepository;
  databaseUrl?: string;
  cookieName?: string;
  sessionTtlDays?: number;
  isProduction?: boolean;
  avatarStorage?: AvatarStorageClient;
  avatarStorageDir?: string;
  avatarPublicBaseUrl?: string;
};

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: true, trustProxy: true });

  const repository =
    options.repository ??
    new PgAuthRepository(new Pool({ connectionString: options.databaseUrl ?? process.env.DATABASE_URL }));

  const avatarStorage =
    options.avatarStorage ??
    new LocalAvatarStorageClient(
      options.avatarStorageDir ?? process.env.AUTH_AVATAR_STORAGE_DIR ?? ".data/avatars",
      options.avatarPublicBaseUrl ?? process.env.AUTH_AVATAR_PUBLIC_BASE_URL ?? "http://localhost:4005/profile/avatar"
    );

  app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    reply.header("Pragma", "no-cache");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "same-origin");
  });

  app.register(async (instance) => {
    await authRoutes(instance, {
      repository,
      cookieName: options.cookieName ?? process.env.AUTH_COOKIE_NAME ?? "fg_session",
      sessionTtlDays: options.sessionTtlDays ?? Number(process.env.AUTH_SESSION_TTL_DAYS ?? "14"),
      isProduction: options.isProduction ?? process.env.NODE_ENV === "production",
      avatarStorage
    });
  });

  return app;
}
