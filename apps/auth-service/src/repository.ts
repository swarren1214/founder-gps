import type { Pool, PoolClient } from "pg";
import type { UpdateProfileRequest } from "./types.js";

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

export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  roleTitle: string | null;
  bio: string | null;
  locationCity: string | null;
  onboardingContext: Record<string, unknown>;
  avatarUrl: string | null;
  avatarStorageKey: string | null;
  onboardingStatus: "not_started" | "in_progress" | "completed";
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  sessionTokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  lastSeenAt: string;
};

function toAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    emailVerifiedAt: row.email_verified_at ? new Date(String(row.email_verified_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function toUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    firstName: row.first_name ? String(row.first_name) : null,
    lastName: row.last_name ? String(row.last_name) : null,
    companyName: row.company_name ? String(row.company_name) : null,
    roleTitle: row.role_title ? String(row.role_title) : null,
    bio: row.bio ? String(row.bio) : null,
    locationCity: row.location_city ? String(row.location_city) : null,
    onboardingContext:
      row.onboarding_context_json && typeof row.onboarding_context_json === "object"
        ? (row.onboarding_context_json as Record<string, unknown>)
        : {},
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    avatarStorageKey: row.avatar_storage_key ? String(row.avatar_storage_key) : null,
    onboardingStatus: String(row.onboarding_status) as UserProfile["onboardingStatus"],
    onboardingCompletedAt: row.onboarding_completed_at
      ? new Date(String(row.onboarding_completed_at)).toISOString()
      : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function toAuthSession(row: Record<string, unknown>): AuthSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sessionTokenHash: String(row.session_token_hash),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    lastSeenAt: new Date(String(row.last_seen_at)).toISOString()
  };
}

export interface AuthRepository {
  createUserWithProfile(params: {
    email: string;
    passwordHash: string;
  }): Promise<{ user: AuthUser; profile: UserProfile }>;
  getUserByEmail(email: string): Promise<AuthUser | null>;
  getUserById(id: string): Promise<AuthUser | null>;
  getProfileByUserId(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, patch: UpdateProfileRequest): Promise<UserProfile>;
  updateAvatar(userId: string, avatarUrl: string, avatarStorageKey: string): Promise<UserProfile>;
  clearAvatar(userId: string): Promise<UserProfile>;
  createSession(params: { userId: string; sessionTokenHash: string; expiresAt: Date }): Promise<AuthSession>;
  getSessionByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  revokeSessionByTokenHash(tokenHash: string): Promise<void>;
  touchSession(sessionId: string): Promise<void>;
}

export class PgAuthRepository implements AuthRepository {
  constructor(private readonly pool: Pool) {}

  async createUserWithProfile(params: {
    email: string;
    passwordHash: string;
  }): Promise<{ user: AuthUser; profile: UserProfile }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const userInsert = await client.query(
        `
          INSERT INTO users (email, password_hash)
          VALUES ($1, $2)
          RETURNING id, email, password_hash, email_verified_at, created_at, updated_at
        `,
        [params.email, params.passwordHash]
      );

      const user = toAuthUser(userInsert.rows[0]);

      const profileInsert = await client.query(
        `
          INSERT INTO user_profiles (user_id)
          VALUES ($1)
          RETURNING
            id,
            user_id,
            first_name,
            last_name,
            company_name,
            role_title,
            bio,
            location_city,
            onboarding_context_json,
            avatar_url,
            avatar_storage_key,
            onboarding_status,
            onboarding_completed_at,
            created_at,
            updated_at
        `,
        [user.id]
      );

      const profile = toUserProfile(profileInsert.rows[0]);

      await client.query("COMMIT");
      return { user, profile };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email: string): Promise<AuthUser | null> {
    const result = await this.pool.query(
      `
        SELECT id, email, password_hash, email_verified_at, created_at, updated_at
        FROM users
        WHERE lower(email) = lower($1)
      `,
      [email]
    );

    if (!result.rowCount) {
      return null;
    }

    return toAuthUser(result.rows[0]);
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const result = await this.pool.query(
      `
        SELECT id, email, password_hash, email_verified_at, created_at, updated_at
        FROM users
        WHERE id = $1
      `,
      [id]
    );

    if (!result.rowCount) {
      return null;
    }

    return toAuthUser(result.rows[0]);
  }

  async getProfileByUserId(userId: string): Promise<UserProfile | null> {
    const result = await this.pool.query(
      `
        SELECT
          id,
          user_id,
          first_name,
          last_name,
          company_name,
          role_title,
          bio,
          location_city,
          onboarding_context_json,
          avatar_url,
          avatar_storage_key,
          onboarding_status,
          onboarding_completed_at,
          created_at,
          updated_at
        FROM user_profiles
        WHERE user_id = $1
      `,
      [userId]
    );

    if (!result.rowCount) {
      return null;
    }

    return toUserProfile(result.rows[0]);
  }

  async updateProfile(userId: string, patch: UpdateProfileRequest): Promise<UserProfile> {
    const client = await this.pool.connect();
    try {
      return await this.updateProfileWithClient(client, userId, patch);
    } finally {
      client.release();
    }
  }

  async updateAvatar(userId: string, avatarUrl: string, avatarStorageKey: string): Promise<UserProfile> {
    const result = await this.pool.query(
      `
        UPDATE user_profiles
        SET avatar_url = $1, avatar_storage_key = $2, updated_at = NOW()
        WHERE user_id = $3
        RETURNING
          id,
          user_id,
          first_name,
          last_name,
          company_name,
          role_title,
          bio,
          location_city,
          onboarding_context_json,
          avatar_url,
          avatar_storage_key,
          onboarding_status,
          onboarding_completed_at,
          created_at,
          updated_at
      `,
      [avatarUrl, avatarStorageKey, userId]
    );

    if (!result.rowCount) {
      throw new Error("Profile not found.");
    }

    return toUserProfile(result.rows[0]);
  }

  async clearAvatar(userId: string): Promise<UserProfile> {
    const result = await this.pool.query(
      `
        UPDATE user_profiles
        SET avatar_url = NULL, avatar_storage_key = NULL, updated_at = NOW()
        WHERE user_id = $1
        RETURNING
          id,
          user_id,
          first_name,
          last_name,
          company_name,
          role_title,
          bio,
          location_city,
          onboarding_context_json,
          avatar_url,
          avatar_storage_key,
          onboarding_status,
          onboarding_completed_at,
          created_at,
          updated_at
      `,
      [userId]
    );

    if (!result.rowCount) {
      throw new Error("Profile not found.");
    }

    return toUserProfile(result.rows[0]);
  }

  private async updateProfileWithClient(
    client: PoolClient,
    userId: string,
    patch: UpdateProfileRequest
  ): Promise<UserProfile> {
    const updates: string[] = [];
    const values: unknown[] = [];

    const map: Array<[keyof UpdateProfileRequest, string]> = [
      ["firstName", "first_name"],
      ["lastName", "last_name"],
      ["companyName", "company_name"],
      ["roleTitle", "role_title"],
      ["bio", "bio"],
      ["locationCity", "location_city"],
      ["onboardingContext", "onboarding_context_json"],
      ["onboardingStatus", "onboarding_status"]
    ];

    for (const [inputKey, column] of map) {
      if (inputKey in patch) {
        if (inputKey === "onboardingContext") {
          values.push(sanitizeOnboardingContext((patch as Record<string, unknown>)[inputKey as string]));
        } else {
          values.push((patch as Record<string, unknown>)[inputKey as string]);
        }
        updates.push(`${column} = $${values.length}`);
      }
    }

    if (patch.onboardingStatus === "completed") {
      updates.push("onboarding_completed_at = NOW()");
    }

    updates.push("updated_at = NOW()");
    values.push(userId);

    const result = await client.query(
      `
        UPDATE user_profiles
        SET ${updates.join(", ")}
        WHERE user_id = $${values.length}
        RETURNING
          id,
          user_id,
          first_name,
          last_name,
          company_name,
          role_title,
          bio,
          location_city,
          onboarding_context_json,
          avatar_url,
          avatar_storage_key,
          onboarding_status,
          onboarding_completed_at,
          created_at,
          updated_at
      `,
      values
    );

    if (!result.rowCount) {
      throw new Error("Profile not found.");
    }

    return toUserProfile(result.rows[0]);
  }

  async createSession(params: {
    userId: string;
    sessionTokenHash: string;
    expiresAt: Date;
  }): Promise<AuthSession> {
    const result = await this.pool.query(
      `
        INSERT INTO auth_sessions (user_id, session_token_hash, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, session_token_hash, expires_at, revoked_at, created_at, last_seen_at
      `,
      [params.userId, params.sessionTokenHash, params.expiresAt.toISOString()]
    );

    return toAuthSession(result.rows[0]);
  }

  async getSessionByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    const result = await this.pool.query(
      `
        SELECT id, user_id, session_token_hash, expires_at, revoked_at, created_at, last_seen_at
        FROM auth_sessions
        WHERE session_token_hash = $1
      `,
      [tokenHash]
    );

    if (!result.rowCount) {
      return null;
    }

    return toAuthSession(result.rows[0]);
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE session_token_hash = $1 AND revoked_at IS NULL
      `,
      [tokenHash]
    );
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE auth_sessions
        SET last_seen_at = NOW()
        WHERE id = $1
      `,
      [sessionId]
    );
  }
}
