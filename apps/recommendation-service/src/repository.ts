import { Pool } from "pg";
import type { Recommendation } from "./types.js";

export interface RecommendationRepository {
  saveRecommendations(params: {
    founderProfileId: string;
    recommendations: Recommendation[];
    recompute?: boolean;
  }): Promise<Recommendation[]>;
  getRecommendationsByFounderProfile(founderProfileId: string): Promise<Recommendation[]>;
}

export class PgRecommendationRepository implements RecommendationRepository {
  constructor(private readonly pool: Pool) {}

  async saveRecommendations(params: {
    founderProfileId: string;
    recommendations: Recommendation[];
    recompute?: boolean;
  }): Promise<Recommendation[]> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      if (params.recompute) {
        await client.query("DELETE FROM recommendations WHERE founder_profile_id = $1", [
          params.founderProfileId
        ]);
      }

      for (const recommendation of params.recommendations) {
        await client.query(
          `
            INSERT INTO recommendations (
              id,
              founder_profile_id,
              resource_id,
              score,
              priority,
              reason,
              recommended_action,
              score_breakdown,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            recommendation.id,
            recommendation.founderProfileId,
            recommendation.resourceId,
            recommendation.score,
            recommendation.priority,
            recommendation.reason,
            recommendation.recommendedAction,
            JSON.stringify(recommendation.scoreBreakdown),
            recommendation.createdAt
          ]
        );
      }

      await client.query("COMMIT");
      return params.recommendations;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getRecommendationsByFounderProfile(founderProfileId: string): Promise<Recommendation[]> {
    const result = await this.pool.query(
      `
        SELECT
          id,
          founder_profile_id,
          resource_id,
          startup_resources.name AS resource_name,
          score,
          priority,
          reason,
          recommended_action,
          score_breakdown,
          created_at
        FROM recommendations
        JOIN startup_resources ON startup_resources.id = recommendations.resource_id
        WHERE founder_profile_id = $1
        ORDER BY created_at DESC, score DESC
      `,
      [founderProfileId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      founderProfileId: row.founder_profile_id,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      score: Number(row.score),
      priority: row.priority,
      reason: row.reason,
      recommendedAction: row.recommended_action,
      scoreBreakdown: row.score_breakdown,
      createdAt: row.created_at.toISOString()
    }));
  }
}
