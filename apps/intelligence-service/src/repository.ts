import { Pool } from "pg";
import type { AiMetadata } from "@founder-gps/ai";

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

export interface IntelligenceRepository {
  saveFounderAnalysisSnapshot(params: {
    founderProfileId?: string;
    analysis: unknown;
    metadata: AiMetadata;
  }): Promise<AnalysisSnapshot>;
  getFounderAnalysisSnapshot(id: string): Promise<AnalysisSnapshot | null>;
}

export class PgIntelligenceRepository implements IntelligenceRepository {
  constructor(private readonly pool: Pool) {}

  async saveFounderAnalysisSnapshot(params: {
    founderProfileId?: string;
    analysis: unknown;
    metadata: AiMetadata;
  }): Promise<AnalysisSnapshot> {
    const result = await this.pool.query(
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
}
