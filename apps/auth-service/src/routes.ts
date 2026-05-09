import type { FastifyInstance } from "fastify";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { sendApiError } from "@founder-gps/shared-types";
import { generateSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./auth.js";
import type { AuthRepository } from "./repository.js";
import type { AvatarStorageClient } from "./avatar-storage.js";
import { authWriteLimiter, normalizeRateLimitKey } from "./rate-limit.js";
import {
  AuthUserResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  UpdateProfileRequestSchema,
  type UpdateProfileRequest
} from "./types.js";

type RouteOptions = {
  repository: AuthRepository;
  cookieName: string;
  sessionTtlDays: number;
  isProduction: boolean;
  avatarStorage: AvatarStorageClient;
};

const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
function isSensitiveContextKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (normalized === "password" || normalized === "confirmpassword" || normalized === "passphrase") {
    return true;
  }

  if (normalized.includes("secret") || normalized.includes("token")) {
    return true;
  }

  return false;
}

function sanitizeOnboardingContext(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeOnboardingContext(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveContextKey(key)) {
      continue;
    }

    sanitized[key] = sanitizeOnboardingContext(nestedValue);
  }

  return sanitized;
}

function serializeSessionCookie(options: {
  name: string;
  value: string;
  isProduction: boolean;
  maxAgeSeconds: number;
}) {
  return serializeCookie(options.name, options.value, {
    httpOnly: true,
    secure: options.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: options.maxAgeSeconds
  });
}

function clearSessionCookie(options: { name: string; isProduction: boolean }) {
  return serializeCookie(options.name, "", {
    httpOnly: true,
    secure: options.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

function readHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function buildRateLimitKey(request: { ip?: string; headers: Record<string, string | string[] | undefined> }) {
  const forwarded = readHeaderValue(request.headers["x-forwarded-for"])
    ?.split(",")[0]
    ?.trim();
  const realIp = readHeaderValue(request.headers["x-real-ip"])
    ?.trim();
  return normalizeRateLimitKey(forwarded ?? realIp ?? request.ip);
}

function enforceAuthRateLimit(
  request: { ip?: string; headers: Record<string, string | string[] | undefined> },
  subject: string
) {
  const key = `${subject}:${buildRateLimitKey(request)}`;
  if (!authWriteLimiter.allow(key)) {
    return false;
  }

  return true;
}

async function resolveRequestIdentity(
  app: FastifyInstance,
  options: RouteOptions,
  cookieHeader: string | undefined
) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookie(cookieHeader);
  const rawToken = cookies[options.cookieName];
  if (!rawToken) {
    return null;
  }

  const sessionTokenHash = hashSessionToken(rawToken);
  const session = await options.repository.getSessionByTokenHash(sessionTokenHash);
  if (!session) {
    return null;
  }

  if (session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  await options.repository.touchSession(session.id);

  const user = await options.repository.getUserById(session.userId);
  if (!user) {
    app.log.warn({ sessionId: session.id, userId: session.userId }, "Session user missing.");
    return null;
  }

  const profile = await options.repository.getProfileByUserId(user.id);
  if (!profile) {
    app.log.warn({ userId: user.id }, "User profile missing.");
    return null;
  }

  return AuthUserResponseSchema.parse({
    user: {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    },
    profile
  });
}

export async function authRoutes(app: FastifyInstance, options: RouteOptions) {
  app.get("/health", async () => ({ ok: true }));

  app.post("/auth/register", async (request, reply) => {
    const parsed = RegisterRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid register request.", parsed.error.flatten());
    }

    if (!enforceAuthRateLimit(request, `register:${parsed.data.email}`)) {
      return sendApiError(reply, "RATE_LIMITED", "Too many registration attempts. Please try again later.");
    }

    const existing = await options.repository.getUserByEmail(parsed.data.email);
    if (existing) {
      return sendApiError(reply, "CONFLICT", "Email already exists.");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const { user, profile } = await options.repository.createUserWithProfile({
      email: parsed.data.email,
      passwordHash,
      displayName: parsed.data.displayName
    });

    const rawSessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + options.sessionTtlDays * 24 * 60 * 60 * 1000);

    await options.repository.createSession({
      userId: user.id,
      sessionTokenHash,
      expiresAt
    });

    app.log.info({ userId: user.id }, "User registered.");

    const payload = AuthUserResponseSchema.parse({
      user: {
        id: user.id,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      profile
    });

    reply.header(
      "Set-Cookie",
      serializeSessionCookie({
        name: options.cookieName,
        value: rawSessionToken,
        isProduction: options.isProduction,
        maxAgeSeconds: options.sessionTtlDays * 24 * 60 * 60
      })
    );

    return reply.send(payload);
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = LoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid login request.", parsed.error.flatten());
    }

    if (!enforceAuthRateLimit(request, `login:${parsed.data.email}`)) {
      return sendApiError(reply, "RATE_LIMITED", "Too many login attempts. Please try again later.");
    }

    const user = await options.repository.getUserByEmail(parsed.data.email);
    if (!user) {
      return sendApiError(reply, "UNAUTHORIZED", "Invalid credentials.");
    }

    const isPasswordValid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!isPasswordValid) {
      return sendApiError(reply, "UNAUTHORIZED", "Invalid credentials.");
    }

    const profile = await options.repository.getProfileByUserId(user.id);
    if (!profile) {
      return sendApiError(reply, "NOT_FOUND", "Profile not found.");
    }

    const rawSessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + options.sessionTtlDays * 24 * 60 * 60 * 1000);
    await options.repository.createSession({ userId: user.id, sessionTokenHash, expiresAt });

    app.log.info({ userId: user.id }, "User logged in.");

    reply.header(
      "Set-Cookie",
      serializeSessionCookie({
        name: options.cookieName,
        value: rawSessionToken,
        isProduction: options.isProduction,
        maxAgeSeconds: options.sessionTtlDays * 24 * 60 * 60
      })
    );

    return reply.send(
      AuthUserResponseSchema.parse({
        user: {
          id: user.id,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        profile
      })
    );
  });

  app.post("/auth/logout", async (request, reply) => {
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookie(cookieHeader);
      const rawToken = cookies[options.cookieName];
      if (rawToken) {
        await options.repository.revokeSessionByTokenHash(hashSessionToken(rawToken));
      }
    }

    app.log.info("User logged out.");

    reply.header(
      "Set-Cookie",
      clearSessionCookie({ name: options.cookieName, isProduction: options.isProduction })
    );

    return reply.send({ ok: true });
  });

  app.get("/auth/me", async (request, reply) => {
    const identity = await resolveRequestIdentity(app, options, request.headers.cookie);
    if (!identity) {
      return sendApiError(reply, "UNAUTHORIZED", "Authentication required.");
    }

    return reply.send(identity);
  });

  app.patch("/profile", async (request, reply) => {
    const identity = await resolveRequestIdentity(app, options, request.headers.cookie);
    if (!identity) {
      return sendApiError(reply, "UNAUTHORIZED", "Authentication required.");
    }

    const parsed = UpdateProfileRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid profile update request.", parsed.error.flatten());
    }

    const patch: UpdateProfileRequest =
      parsed.data.onboardingContext === undefined
        ? parsed.data
        : {
            ...parsed.data,
            onboardingContext: {
              ...(sanitizeOnboardingContext(parsed.data.onboardingContext) as Record<string, unknown>),
              schemaVersion: parsed.data.onboardingContext.schemaVersion
            }
          };

    const profile = await options.repository.updateProfile(identity.user.id, patch);
    return reply.send({ user: identity.user, profile });
  });

  app.post("/profile/avatar", async (request, reply) => {
    const identity = await resolveRequestIdentity(app, options, request.headers.cookie);
    if (!identity) {
      return sendApiError(reply, "UNAUTHORIZED", "Authentication required.");
    }

    const file = await (request as unknown as { file: () => Promise<any> }).file();
    if (!file) {
      return sendApiError(reply, "VALIDATION_ERROR", "Avatar file is required.");
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      return sendApiError(reply, "VALIDATION_ERROR", "Unsupported avatar mime type.");
    }

    const data = await file.toBuffer();
    if (data.byteLength > 2 * 1024 * 1024) {
      return sendApiError(reply, "VALIDATION_ERROR", "Avatar must be 2 MB or smaller.");
    }

    const storedAvatar = await options.avatarStorage.saveAvatar({
      userId: identity.user.id,
      mimeType: file.mimetype,
      data
    });

    const previousAvatarKey = identity.profile.avatarStorageKey;
    const profile = await options.repository.updateAvatar(
      identity.user.id,
      storedAvatar.url,
      storedAvatar.storageKey
    );

    if (previousAvatarKey && previousAvatarKey !== storedAvatar.storageKey) {
      await options.avatarStorage.deleteAvatar(previousAvatarKey);
    }

    return reply.send({ user: identity.user, profile });
  });

  app.delete("/profile/avatar", async (request, reply) => {
    const identity = await resolveRequestIdentity(app, options, request.headers.cookie);
    if (!identity) {
      return sendApiError(reply, "UNAUTHORIZED", "Authentication required.");
    }

    if (identity.profile.avatarStorageKey) {
      await options.avatarStorage.deleteAvatar(identity.profile.avatarStorageKey);
    }

    const profile = await options.repository.clearAvatar(identity.user.id);
    return reply.send({ user: identity.user, profile });
  });

  app.get("/profile/avatar/:storageKey", async (request, reply) => {
    const params = request.params as { storageKey?: string };
    if (!params.storageKey) {
      return sendApiError(reply, "VALIDATION_ERROR", "Avatar key is required.");
    }

    const avatar = await options.avatarStorage.readAvatar(params.storageKey);
    if (!avatar) {
      return sendApiError(reply, "NOT_FOUND", "Avatar not found.");
    }

    reply.header("Content-Type", avatar.mimeType);
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(avatar.data);
  });
}
