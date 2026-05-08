import { z } from "zod";
import { StartupResourceSchema, type StartupResource } from "../types.js";

const resourcesResponseSchema = z.object({
  resources: z.array(StartupResourceSchema),
  count: z.number()
});

export interface ResourceClient {
  fetchResources(filters: { category?: string; city?: string; limit?: number }): Promise<StartupResource[]>;
}

export class HttpResourceClient implements ResourceClient {
  constructor(private readonly baseUrl: string) {}

  async fetchResources(filters: { category?: string; city?: string; limit?: number }): Promise<StartupResource[]> {
    const query = new URLSearchParams();
    if (filters.category) query.set("category", filters.category);
    if (filters.city) query.set("city", filters.city);
    if (typeof filters.limit === "number") query.set("limit", String(filters.limit));

    const url = `${this.baseUrl}/resources${query.toString() ? `?${query.toString()}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Resource service request failed: ${response.status}`);
    }

    const payload = resourcesResponseSchema.parse(await response.json());
    return payload.resources;
  }
}
