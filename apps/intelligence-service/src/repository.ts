import { Pool } from "pg";
import type { AiMetadata } from "@founder-gps/ai";
import type { ChatCitation, ChatMessage } from "@founder-gps/shared-types";

export type AnalysisSnapshot = {
  id: string;
  founderProfileId: string | null;
  analysisJson: unknown;
  provider: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  fallbackUsed: boolean;
  createdAt: string;
};

export type FounderProfileRecord = {
  id: string;
  userId: string | null;
  locationCity: string;
  locationLat: number | null;
  locationLng: number | null;
  startupIdea: string;
  industry: string | null;
  stage: string;
  biggestChallenge: string;
  fundingStatus: string | null;
  founderBackground: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatSessionRecord = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatContextSnapshotRecord = {
  id: string;
  sessionId: string;
  bundleHash: string;
  bundleJson: unknown;
  createdAt: string;
};

export type ChatMessageRecord = ChatMessage & {
  sessionId: string;
  citations: ChatCitation[];
  toolInvocations: unknown[];
};

export interface IntelligenceRepository {
  saveFounderAnalysisSnapshot(params: {
    founderProfileId?: string;
    analysis: unknown;
    metadata: AiMetadata;
  }): Promise<AnalysisSnapshot>;
  getFounderAnalysisSnapshot(id: string): Promise<AnalysisSnapshot | null>;
  getLatestFounderAnalysisSnapshotByFounderProfileId(
    founderProfileId: string
  ): Promise<AnalysisSnapshot | null>;
  getFounderProfileByUserId(userId: string): Promise<FounderProfileRecord | null>;
  createChatSession(params: { id?: string; userId: string }): Promise<ChatSessionRecord>;
  getChatSession(id: string): Promise<ChatSessionRecord | null>;
  appendChatMessage(params: {
    sessionId: string;
    role: ChatMessage["role"];
    content: string;
    citations?: ChatCitation[];
    toolInvocations?: unknown[];
  }): Promise<ChatMessageRecord>;
  getChatMessages(sessionId: string): Promise<ChatMessageRecord[]>;
  saveChatContextSnapshot(params: {
    sessionId: string;
    bundleHash: string;
    bundleJson: unknown;
  }): Promise<ChatContextSnapshotRecord>;
  getChatContextSnapshots(sessionId: string): Promise<ChatContextSnapshotRecord[]>;
}

export class PgIntelligenceRepository implements IntelligenceRepository {
  constructor(private readonly pool: Pool) {}

  private async insertSnapshot(params: {
    founderProfileId?: string;
    analysis: unknown;
    metadata: AiMetadata;
  }) {
    return this.pool.query(
      `
        INSERT INTO founder_analysis_snapshots (
          founder_profile_id,
          analysis_json,
          provider,
          model,
          prompt_version,
          latency_ms,
          tokens_in,
          tokens_out,
          fallback_used
        )
        VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          founder_profile_id,
          analysis_json,
          provider,
          model,
          prompt_version,
          latency_ms,
          tokens_in,
          tokens_out,
          fallback_used,
          created_at
      `,
      [
        params.founderProfileId ?? null,
        JSON.stringify(params.analysis),
        params.metadata.provider,
        params.metadata.model,
        params.metadata.promptVersion,
        params.metadata.latencyMs,
        params.metadata.tokensIn,
        params.metadata.tokensOut,
        params.metadata.fallbackUsed
      ]
    );
  }

  async saveFounderAnalysisSnapshot(params: {
    founderProfileId?: string;
    analysis: unknown;
    metadata: AiMetadata;
  }): Promise<AnalysisSnapshot> {
    let result;
    try {
      result = await this.insertSnapshot(params);
    } catch (error) {
      // Allow analysis snapshots even when founder profile hasn't been persisted yet.
      const maybePgError = error as { code?: string };
      if (maybePgError.code === "23503" && params.founderProfileId) {
        result = await this.insertSnapshot({ ...params, founderProfileId: undefined });
      } else {
        throw error;
      }
    }

    const row = result.rows[0];
    return {
      id: row.id,
      founderProfileId: row.founder_profile_id,
      analysisJson: row.analysis_json,
      provider: row.provider,
      model: row.model,
      promptVersion: row.prompt_version,
      latencyMs: row.latency_ms,
      tokensIn: row.tokens_in,
      tokensOut: row.tokens_out,
      fallbackUsed: row.fallback_used,
      createdAt: row.created_at.toISOString()
    };
  }

  async getFounderAnalysisSnapshot(id: string): Promise<AnalysisSnapshot | null> {
    const result = await this.pool.query(
      `
        SELECT
          id,
          founder_profile_id,
          analysis_json,
          provider,
          model,
          prompt_version,
          latency_ms,
          tokens_in,
          tokens_out,
          fallback_used,
          created_at
        FROM founder_analysis_snapshots
        WHERE id = $1
      `,
      [id]
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      founderProfileId: row.founder_profile_id,
      analysisJson: row.analysis_json,
      provider: row.provider,
      model: row.model,
      promptVersion: row.prompt_version,
      latencyMs: row.latency_ms,
      tokensIn: row.tokens_in,
      tokensOut: row.tokens_out,
      fallbackUsed: row.fallback_used,
      createdAt: row.created_at.toISOString()
    };
  }

  async getLatestFounderAnalysisSnapshotByFounderProfileId(
    founderProfileId: string
  ): Promise<AnalysisSnapshot | null> {
    const result = await this.pool.query(
      `
        SELECT
          id,
          founder_profile_id,
          analysis_json,
          provider,
          model,
          prompt_version,
          latency_ms,
          tokens_in,
          tokens_out,
          fallback_used,
          created_at
        FROM founder_analysis_snapshots
        WHERE founder_profile_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [founderProfileId]
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      founderProfileId: row.founder_profile_id,
      analysisJson: row.analysis_json,
      provider: row.provider,
      model: row.model,
      promptVersion: row.prompt_version,
      latencyMs: row.latency_ms,
      tokensIn: row.tokens_in,
      tokensOut: row.tokens_out,
      fallbackUsed: row.fallback_used,
      createdAt: row.created_at.toISOString()
    };
  }

  async getFounderProfileByUserId(userId: string): Promise<FounderProfileRecord | null> {
    const result = await this.pool.query(
      `
        SELECT
          id,
          user_id,
          location_city,
          location_lat,
          location_lng,
          startup_idea,
          industry,
          stage,
          biggest_challenge,
          funding_status,
          founder_background,
          created_at,
          updated_at
        FROM founder_profiles
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [userId]
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      locationCity: row.location_city,
      locationLat: row.location_lat === null ? null : Number(row.location_lat),
      locationLng: row.location_lng === null ? null : Number(row.location_lng),
      startupIdea: row.startup_idea,
      industry: row.industry,
      stage: row.stage,
      biggestChallenge: row.biggest_challenge,
      fundingStatus: row.funding_status,
      founderBackground: row.founder_background,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  async createChatSession(params: { id?: string; userId: string }): Promise<ChatSessionRecord> {
    const result = await this.pool.query(
      `
        INSERT INTO chat_sessions (id, user_id)
        VALUES (COALESCE($1, gen_random_uuid()::text), $2)
        ON CONFLICT (id) DO UPDATE
          SET user_id = EXCLUDED.user_id,
              updated_at = NOW()
        RETURNING id, user_id, created_at, updated_at
      `,
      [params.id ?? null, params.userId]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  async getChatSession(id: string): Promise<ChatSessionRecord | null> {
    const result = await this.pool.query(
      `
        SELECT id, user_id, created_at, updated_at
        FROM chat_sessions
        WHERE id = $1
      `,
      [id]
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  async appendChatMessage(params: {
    sessionId: string;
    role: ChatMessage["role"];
    content: string;
    citations?: ChatCitation[];
    toolInvocations?: unknown[];
  }): Promise<ChatMessageRecord> {
    const result = await this.pool.query(
      `
        INSERT INTO chat_messages (
          session_id,
          role,
          content,
          citations,
          tool_invocations
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
        RETURNING id, session_id, role, content, citations, tool_invocations, created_at
      `,
      [
        params.sessionId,
        params.role,
        params.content,
        JSON.stringify(params.citations ?? []),
        JSON.stringify(params.toolInvocations ?? [])
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      citations: row.citations ?? [],
      toolInvocations: row.tool_invocations ?? [],
      createdAt: row.created_at.toISOString()
    };
  }

  async getChatMessages(sessionId: string): Promise<ChatMessageRecord[]> {
    const result = await this.pool.query(
      `
        SELECT id, session_id, role, content, citations, tool_invocations, created_at
        FROM chat_messages
        WHERE session_id = $1
        ORDER BY created_at ASC
      `,
      [sessionId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      citations: row.citations ?? [],
      toolInvocations: row.tool_invocations ?? [],
      createdAt: row.created_at.toISOString()
    }));
  }

  async saveChatContextSnapshot(params: {
    sessionId: string;
    bundleHash: string;
    bundleJson: unknown;
  }): Promise<ChatContextSnapshotRecord> {
    const result = await this.pool.query(
      `
        INSERT INTO chat_context_snapshots (session_id, bundle_hash, bundle_json)
        VALUES ($1, $2, $3::jsonb)
        RETURNING id, session_id, bundle_hash, bundle_json, created_at
      `,
      [params.sessionId, params.bundleHash, JSON.stringify(params.bundleJson)]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      sessionId: row.session_id,
      bundleHash: row.bundle_hash,
      bundleJson: row.bundle_json,
      createdAt: row.created_at.toISOString()
    };
  }

  async getChatContextSnapshots(sessionId: string): Promise<ChatContextSnapshotRecord[]> {
    const result = await this.pool.query(
      `
        SELECT id, session_id, bundle_hash, bundle_json, created_at
        FROM chat_context_snapshots
        WHERE session_id = $1
        ORDER BY created_at DESC
      `,
      [sessionId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      bundleHash: row.bundle_hash,
      bundleJson: row.bundle_json,
      createdAt: row.created_at.toISOString()
    }));
  }
}
