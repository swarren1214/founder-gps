import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import { authWriteLimiter } from "../src/rate-limit.js";
import type { AuthRepository, AuthSession, AuthUser, UserProfile } from "../src/repository.js";
import type { AvatarStorageClient, StoredAvatar } from "../src/avatar-storage.js";

type StoredUserRecord = AuthUser & { profile: UserProfile };

class InMemoryAuthRepository implements AuthRepository {
  private readonly usersByEmail = new Map<string, StoredUserRecord>();
  private readonly usersById = new Map<string, StoredUserRecord>();
  private readonly sessionsByHash = new Map<string, AuthSession>();

  async createUserWithProfile(params: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<{ user: AuthUser; profile: UserProfile }> {
    const now = new Date().toISOString();
    const user: AuthUser = {
      id: randomUUID(),
      email: params.email,
      passwordHash: params.passwordHash,
      emailVerifiedAt: null,
      createdAt: now,
      updatedAt: now
    };

    const profile: UserProfile = {
      id: randomUUID(),
      userId: user.id,
      displayName: params.displayName,
      firstName: null,
      lastName: null,
      companyName: null,
      roleTitle: null,
      bio: null,
      locationCity: null,
      avatarUrl: null,
      avatarStorageKey: null,
      onboardingStatus: "not_started",
      onboardingCompletedAt: null,
      createdAt: now,
      updatedAt: now
    };

    const record = { ...user, profile };
    this.usersByEmail.set(params.email.toLowerCase(), record);
    this.usersById.set(user.id, record);
    return { user, profile };
  }

  async getUserByEmail(email: string): Promise<AuthUser | null> {
    return this.usersByEmail.get(email.toLowerCase()) ?? null;
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    return this.usersById.get(id) ?? null;
  }

  async getProfileByUserId(userId: string): Promise<UserProfile | null> {
    return this.usersById.get(userId)?.profile ?? null;
  }

  async updateProfile(userId: string, patch: Partial<UserProfile> & Record<string, unknown>): Promise<UserProfile> {
    const record = this.usersById.get(userId);
    if (!record) {
      throw new Error("Profile not found.");
    }

    const nextProfile: UserProfile = {
      ...record.profile,
      displayName: typeof patch.displayName === "string" ? patch.displayName : record.profile.displayName,
      firstName: patch.firstName === undefined ? record.profile.firstName : (patch.firstName as string | null),
      lastName: patch.lastName === undefined ? record.profile.lastName : (patch.lastName as string | null),
      companyName: patch.companyName === undefined ? record.profile.companyName : (patch.companyName as string | null),
      roleTitle: patch.roleTitle === undefined ? record.profile.roleTitle : (patch.roleTitle as string | null),
      bio: patch.bio === undefined ? record.profile.bio : (patch.bio as string | null),
      locationCity: patch.locationCity === undefined ? record.profile.locationCity : (patch.locationCity as string | null),
      onboardingStatus:
        (patch.onboardingStatus as UserProfile["onboardingStatus"] | undefined) ?? record.profile.onboardingStatus,
      onboardingCompletedAt:
        patch.onboardingStatus === "completed"
          ? new Date().toISOString()
          : record.profile.onboardingCompletedAt,
      createdAt: record.profile.createdAt,
      updatedAt: new Date().toISOString()
    };

    const nextRecord = { ...record, profile: nextProfile };
    this.usersByEmail.set(record.email.toLowerCase(), nextRecord);
    this.usersById.set(userId, nextRecord);
    return nextProfile;
  }

  async updateAvatar(userId: string, avatarUrl: string, avatarStorageKey: string): Promise<UserProfile> {
    const record = this.usersById.get(userId);
    if (!record) {
      throw new Error("Profile not found.");
    }

    const nextProfile: UserProfile = {
      ...record.profile,
      avatarUrl,
      avatarStorageKey,
      updatedAt: new Date().toISOString()
    };

    const nextRecord = { ...record, profile: nextProfile };
    this.usersByEmail.set(record.email.toLowerCase(), nextRecord);
    this.usersById.set(userId, nextRecord);
    return nextProfile;
  }

  async clearAvatar(userId: string): Promise<UserProfile> {
    const record = this.usersById.get(userId);
    if (!record) {
      throw new Error("Profile not found.");
    }

    const nextProfile: UserProfile = {
      ...record.profile,
      avatarUrl: null,
      avatarStorageKey: null,
      updatedAt: new Date().toISOString()
    };

    const nextRecord = { ...record, profile: nextProfile };
    this.usersByEmail.set(record.email.toLowerCase(), nextRecord);
    this.usersById.set(userId, nextRecord);
    return nextProfile;
  }

  async createSession(params: { userId: string; sessionTokenHash: string; expiresAt: Date }): Promise<AuthSession> {
    const now = new Date().toISOString();
    const session: AuthSession = {
      id: randomUUID(),
      userId: params.userId,
      sessionTokenHash: params.sessionTokenHash,
      expiresAt: params.expiresAt.toISOString(),
      revokedAt: null,
      createdAt: now,
      lastSeenAt: now
    };

    this.sessionsByHash.set(params.sessionTokenHash, session);
    return session;
  }

  async getSessionByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    return this.sessionsByHash.get(tokenHash) ?? null;
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    const session = this.sessionsByHash.get(tokenHash);
    if (session) {
      this.sessionsByHash.set(tokenHash, { ...session, revokedAt: new Date().toISOString() });
    }
  }

  async touchSession(sessionId: string): Promise<void> {
    for (const [tokenHash, session] of this.sessionsByHash.entries()) {
      if (session.id === sessionId) {
        this.sessionsByHash.set(tokenHash, { ...session, lastSeenAt: new Date().toISOString() });
      }
    }
  }
}

class InMemoryAvatarStorage implements AvatarStorageClient {
  private readonly avatars = new Map<string, StoredAvatar & { data: Buffer; mimeType: string }>();

  async saveAvatar(params: { userId: string; mimeType: string; data: Buffer }): Promise<StoredAvatar> {
    const storageKey = `${params.userId}-${randomUUID()}.png`;
    const storedAvatar = {
      storageKey,
      url: `http://avatars.local/${storageKey}`,
      data: params.data,
      mimeType: params.mimeType
    };

    this.avatars.set(storageKey, storedAvatar);
    return { storageKey, url: storedAvatar.url };
  }

  async readAvatar(storageKey: string) {
    const storedAvatar = this.avatars.get(storageKey);
    if (!storedAvatar) {
      return null;
    }

    return {
      data: storedAvatar.data,
      mimeType: storedAvatar.mimeType
    };
  }

  async deleteAvatar(storageKey: string): Promise<void> {
    this.avatars.delete(storageKey);
  }
}

function extractCookieValue(setCookieHeader: string | string[] | undefined, cookieName: string) {
  const header = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  if (!header) {
    return null;
  }

  const match = header.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1] ?? null;
}

function buildMultipartBody(fileName: string, mimeType: string, content: Buffer) {
  const boundary = `----founder-gps-${randomUUID().replace(/-/g, "")}`;
  const parts = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="avatar"; filename="${fileName}"`,
    `Content-Type: ${mimeType}`,
    "",
    content.toString("utf8"),
    `--${boundary}--`,
    ""
  ];

  return {
    body: Buffer.from(parts.join("\r\n"), "utf8"),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

describe("auth routes", () => {
  beforeEach(() => {
    authWriteLimiter.reset();
  });

  it("registers, authenticates, updates profile, uploads avatar, and logs out", async () => {
    const repository = new InMemoryAuthRepository();
    const avatarStorage = new InMemoryAvatarStorage();
    const app = buildApp({
      repository,
      avatarStorage,
      cookieName: "fg_session",
      sessionTtlDays: 14,
      isProduction: false
    });

    const email = `founder-${randomUUID()}@example.com`;
    const password = "correct horse battery staple";

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password,
        displayName: "Ada Founder"
      }
    });

    expect(registerResponse.statusCode).toBe(200);
    expect(registerResponse.json().profile.displayName).toBe("Ada Founder");

    const sessionToken = extractCookieValue(registerResponse.headers["set-cookie"], "fg_session");
    expect(sessionToken).toBeTruthy();

    const meResponse = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        cookie: `fg_session=${sessionToken}`
      }
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json().user.email).toBe(email);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password
      }
    });

    expect(loginResponse.statusCode).toBe(200);

    const updateProfileResponse = await app.inject({
      method: "PATCH",
      url: "/profile",
      headers: {
        cookie: `fg_session=${sessionToken}`,
        "content-type": "application/json"
      },
      payload: {
        displayName: "Ada Builder",
        locationCity: "Lehi",
        onboardingStatus: "completed"
      }
    });

    expect(updateProfileResponse.statusCode).toBe(200);
    expect(updateProfileResponse.json().profile.onboardingStatus).toBe("completed");

    const avatarBytes = Buffer.from("avatar bytes", "utf8");
    const multipart = buildMultipartBody("avatar.png", "image/png", avatarBytes);

    const uploadResponse = await app.inject({
      method: "POST",
      url: "/profile/avatar",
      headers: {
        cookie: `fg_session=${sessionToken}`,
        "content-type": multipart.contentType
      },
      payload: multipart.body
    });

    expect(uploadResponse.statusCode).toBe(200);
    expect(uploadResponse.json().profile.avatarUrl).toContain("http://avatars.local/");

    const profileAfterUpload = uploadResponse.json().profile;
    const avatarKey = profileAfterUpload.avatarStorageKey;
    expect(avatarKey).toBeTruthy();

    const readAvatarResponse = await app.inject({
      method: "GET",
      url: `/profile/avatar/${avatarKey}`
    });

    expect(readAvatarResponse.statusCode).toBe(200);
    expect(readAvatarResponse.headers["content-type"]).toContain("image/png");

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: "/profile/avatar",
      headers: {
        cookie: `fg_session=${sessionToken}`
      }
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().profile.avatarUrl).toBeNull();

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        cookie: `fg_session=${sessionToken}`
      }
    });

    expect(logoutResponse.statusCode).toBe(200);

    const meAfterLogoutResponse = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        cookie: `fg_session=${sessionToken}`
      }
    });

    expect(meAfterLogoutResponse.statusCode).toBe(401);
  });

  it("rejects invalid login attempts and unsupported avatar uploads", async () => {
    const repository = new InMemoryAuthRepository();
    const avatarStorage = new InMemoryAvatarStorage();
    const app = buildApp({
      repository,
      avatarStorage,
      cookieName: "fg_session",
      sessionTtlDays: 14,
      isProduction: false
    });

    const email = `founder-${randomUUID()}@example.com`;

    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "correct horse battery staple",
        displayName: "Ada Founder"
      }
    });

    const badLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password: "wrong password"
      }
    });

    expect(badLoginResponse.statusCode).toBe(401);

    const sessionToken = extractCookieValue((await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password: "correct horse battery staple"
      }
    })).headers["set-cookie"], "fg_session");

    const multipart = buildMultipartBody("avatar.txt", "text/plain", Buffer.from("plain text", "utf8"));

    const invalidAvatarResponse = await app.inject({
      method: "POST",
      url: "/profile/avatar",
      headers: {
        cookie: `fg_session=${sessionToken}`,
        "content-type": multipart.contentType
      },
      payload: multipart.body
    });

    expect(invalidAvatarResponse.statusCode).toBe(400);
  });

  describe("GET /health", () => {
    it("returns ok: true without authentication", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    });
  });

  describe("POST /auth/register", () => {
    it("rejects registration when required fields are missing", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const noEmailResponse = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { password: "validpassword1", displayName: "Test User" }
      });
      expect(noEmailResponse.statusCode).toBe(400);

      const noPasswordResponse = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: "test@example.com", displayName: "Test User" }
      });
      expect(noPasswordResponse.statusCode).toBe(400);

      const noDisplayNameResponse = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: "test@example.com", password: "validpassword1" }
      });
      expect(noDisplayNameResponse.statusCode).toBe(400);
    });

    it("rejects registration when password is too short", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: "test@example.com", password: "short", displayName: "Test User" }
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects registration when email is already taken", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const email = `dup-${randomUUID()}@example.com`;
      const payload = { email, password: "validpassword1", displayName: "First User" };

      const firstResponse = await app.inject({ method: "POST", url: "/auth/register", payload });
      expect(firstResponse.statusCode).toBe(200);

      const secondResponse = await app.inject({ method: "POST", url: "/auth/register", payload });
      expect(secondResponse.statusCode).toBe(409);
    });

    it("sets an HTTP-only session cookie on successful registration", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: `cookie-test-${randomUUID()}@example.com`, password: "validpassword1", displayName: "Cookie Test" }
      });

      expect(response.statusCode).toBe(200);
      const setCookie = response.headers["set-cookie"];
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(cookieStr).toContain("fg_session=");
      expect(cookieStr?.toLowerCase()).toContain("httponly");
    });

    it("returns user and profile on successful registration", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const email = `newuser-${randomUUID()}@example.com`;
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "validpassword1", displayName: "New Founder" }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.email).toBe(email);
      expect(body.profile.displayName).toBe("New Founder");
      expect(body.profile.onboardingStatus).toBe("not_started");
      expect(body.user).not.toHaveProperty("passwordHash");
    });
  });

  describe("POST /auth/login", () => {
    it("rejects login when credentials are missing", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "test@example.com" }
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects login for unknown email", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: `notregistered-${randomUUID()}@example.com`, password: "anypassword" }
      });

      expect(response.statusCode).toBe(401);
    });

    it("sets a session cookie and returns user on successful login", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const email = `login-${randomUUID()}@example.com`;
      const password = "validpassword1";
      await app.inject({ method: "POST", url: "/auth/register", payload: { email, password, displayName: "Login User" } });

      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user.email).toBe(email);
      const cookieStr = Array.isArray(response.headers["set-cookie"])
        ? response.headers["set-cookie"][0]
        : response.headers["set-cookie"];
      expect(cookieStr).toContain("fg_session=");
    });
  });

  describe("POST /auth/logout", () => {
    it("returns ok and clears cookie even without an active session", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const response = await app.inject({ method: "POST", url: "/auth/logout" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
      const cookieStr = Array.isArray(response.headers["set-cookie"])
        ? response.headers["set-cookie"][0]
        : response.headers["set-cookie"];
      expect(cookieStr).toContain("fg_session=;");
    });

    it("invalidates the session so subsequent /auth/me requests return 401", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const email = `logout-${randomUUID()}@example.com`;
      const registerResponse = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "validpassword1", displayName: "Logout User" }
      });
      const token = extractCookieValue(registerResponse.headers["set-cookie"], "fg_session");

      await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie: `fg_session=${token}` } });

      const meResponse = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: `fg_session=${token}` } });
      expect(meResponse.statusCode).toBe(401);
    });
  });

  describe("GET /auth/me", () => {
    it("returns 401 when no session cookie is provided", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const response = await app.inject({ method: "GET", url: "/auth/me" });
      expect(response.statusCode).toBe(401);
    });

    it("returns 401 when session cookie is invalid", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { cookie: "fg_session=bogus-token" }
      });
      expect(response.statusCode).toBe(401);
    });

    it("returns user and full profile for an authenticated session", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const email = `me-${randomUUID()}@example.com`;
      const registerResponse = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "validpassword1", displayName: "Me User" }
      });
      const token = extractCookieValue(registerResponse.headers["set-cookie"], "fg_session");

      const meResponse = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { cookie: `fg_session=${token}` }
      });

      expect(meResponse.statusCode).toBe(200);
      const body = meResponse.json();
      expect(body.user.email).toBe(email);
      expect(body.profile).toBeDefined();
      expect(body.profile.onboardingStatus).toBe("not_started");
    });
  });

  describe("PATCH /profile", () => {
    it("returns 401 when unauthenticated", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/profile",
        payload: { displayName: "Updated Name" }
      });
      expect(response.statusCode).toBe(401);
    });

    it("allows partial profile updates and preserves unspecified fields", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const registerResponse = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: `partial-${randomUUID()}@example.com`, password: "validpassword1", displayName: "Original Name" }
      });
      const token = extractCookieValue(registerResponse.headers["set-cookie"], "fg_session");

      const patchResponse = await app.inject({
        method: "PATCH",
        url: "/profile",
        headers: { cookie: `fg_session=${token}`, "content-type": "application/json" },
        payload: { locationCity: "Provo" }
      });

      expect(patchResponse.statusCode).toBe(200);
      const profile = patchResponse.json().profile;
      expect(profile.displayName).toBe("Original Name");
      expect(profile.locationCity).toBe("Provo");
    });

    it("sets onboardingCompletedAt when onboardingStatus is set to completed", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const registerResponse = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: `onboarding-${randomUUID()}@example.com`, password: "validpassword1", displayName: "Onboard User" }
      });
      const token = extractCookieValue(registerResponse.headers["set-cookie"], "fg_session");

      const patchResponse = await app.inject({
        method: "PATCH",
        url: "/profile",
        headers: { cookie: `fg_session=${token}`, "content-type": "application/json" },
        payload: { onboardingStatus: "completed" }
      });

      expect(patchResponse.statusCode).toBe(200);
      const profile = patchResponse.json().profile;
      expect(profile.onboardingStatus).toBe("completed");
      expect(profile.onboardingCompletedAt).not.toBeNull();
    });
  });

  describe("POST /profile/avatar", () => {
    it("returns 401 when unauthenticated", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const multipart = buildMultipartBody("avatar.png", "image/png", Buffer.from("data", "utf8"));
      const response = await app.inject({
        method: "POST",
        url: "/profile/avatar",
        headers: { "content-type": multipart.contentType },
        payload: multipart.body
      });
      expect(response.statusCode).toBe(401);
    });

    it("persists avatar URL and storage key in the profile", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const registerResponse = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: `avatar-${randomUUID()}@example.com`, password: "validpassword1", displayName: "Avatar User" }
      });
      const token = extractCookieValue(registerResponse.headers["set-cookie"], "fg_session");

      const multipart = buildMultipartBody("photo.webp", "image/webp", Buffer.from("webp bytes", "utf8"));
      const response = await app.inject({
        method: "POST",
        url: "/profile/avatar",
        headers: { cookie: `fg_session=${token}`, "content-type": multipart.contentType },
        payload: multipart.body
      });

      expect(response.statusCode).toBe(200);
      const profile = response.json().profile;
      expect(profile.avatarUrl).toBeTruthy();
      expect(profile.avatarStorageKey).toBeTruthy();
    });
  });

  describe("DELETE /profile/avatar", () => {
    it("returns 401 when unauthenticated", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const response = await app.inject({ method: "DELETE", url: "/profile/avatar" });
      expect(response.statusCode).toBe(401);
    });

    it("clears avatar fields in the profile after deletion", async () => {
      const app = buildApp({
        repository: new InMemoryAuthRepository(),
        avatarStorage: new InMemoryAvatarStorage(),
        cookieName: "fg_session",
        sessionTtlDays: 14,
        isProduction: false
      });

      const registerResponse = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: `del-avatar-${randomUUID()}@example.com`, password: "validpassword1", displayName: "Del User" }
      });
      const token = extractCookieValue(registerResponse.headers["set-cookie"], "fg_session");

      const multipart = buildMultipartBody("photo.png", "image/png", Buffer.from("data", "utf8"));
      await app.inject({
        method: "POST",
        url: "/profile/avatar",
        headers: { cookie: `fg_session=${token}`, "content-type": multipart.contentType },
        payload: multipart.body
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: "/profile/avatar",
        headers: { cookie: `fg_session=${token}` }
      });

      expect(deleteResponse.statusCode).toBe(200);
      const profile = deleteResponse.json().profile;
      expect(profile.avatarUrl).toBeNull();
      expect(profile.avatarStorageKey).toBeNull();
    });
  });
});
