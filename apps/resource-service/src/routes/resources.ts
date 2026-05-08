import { z } from "zod";
import { FOUNDER_STAGES, RESOURCE_CATEGORIES } from "@founder-gps/shared-types";
import { sendApiError } from "@founder-gps/shared-types";
import type { FastifyInstance } from "fastify";
import type { ResourceRepository } from "../repository.js";

const querySchema = z.object({
  category: z.enum(RESOURCE_CATEGORIES).optional(),
  city: z.string().min(1).optional(),
  stage: z.enum(FOUNDER_STAGES).optional(),
  industry: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusMiles: z.coerce.number().positive().max(250).optional()
});

const startupQuerySchema = z.object({
  city: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const searchBodySchema = z
  .object({
    category: z.enum(RESOURCE_CATEGORIES).optional(),
    city: z.string().min(1).optional(),
    stage: z.enum(FOUNDER_STAGES).optional(),
    industry: z.string().min(1).optional(),
    q: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(500).optional(),
    offset: z.number().int().min(0).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    radiusMiles: z.number().positive().max(250).optional()
  })
  .strict();

export async function resourceRoutes(app: FastifyInstance, repository: ResourceRepository) {
  app.get("/startups", async (request, reply) => {
    const parsed = startupQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid startups query.", parsed.error.flatten());
    }

    const startups = await repository.startups(parsed.data);
    return reply.send({ startups, count: startups.length });
  });

  app.get("/resources", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);

    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid resources query.", parsed.error.flatten());
    }

    const resources = await repository.list(parsed.data);
    return reply.send({ resources, count: resources.length });
  });

  app.get("/resources/:id", async (request, reply) => {
    const idSchema = z.object({ id: z.string().uuid() });
    const parsed = idSchema.safeParse(request.params);

    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid resource id.", parsed.error.flatten());
    }

    const resource = await repository.getById(parsed.data.id);

    if (!resource) {
      return sendApiError(reply, "NOT_FOUND", "Resource not found.");
    }

    return reply.send(resource);
  });

  app.post("/resources/search", async (request, reply) => {
    const parsed = searchBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid resource search request.", parsed.error.flatten());
    }

    const resources = await repository.list(parsed.data);
    return reply.send({ resources, count: resources.length });
  });

  app.get("/resources/map-data", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);

    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid map-data query.", parsed.error.flatten());
    }

    const mapData = await repository.mapData(parsed.data);
    return reply.send(mapData);
  });

  app.get("/resources/categories", async (_request, reply) => {
    const categories = await repository.categories();
    return reply.send({ categories });
  });
}
