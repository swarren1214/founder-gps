import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../../../packages/shared-types/dist/index.js";
import {
  FounderPathRequestSchema,
  MatrixRequestSchema,
  RouteRequestSchema,
  TripRequestSchema
} from "../types.js";
import type { RoutingService } from "../service.js";

export async function routingRoutes(app: FastifyInstance, service: RoutingService) {
  app.post("/routing/route", async (request, reply) => {
    const parsed = RouteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid routing route request.", parsed.error.flatten());
    }

    try {
      const route = await service.route(parsed.data);
      return reply.send(route);
    } catch (error) {
      app.log.error({ error }, "routing_route_failed");
      return sendApiError(reply, "DEPENDENCY_UNAVAILABLE", "Routing provider unavailable.");
    }
  });

  app.post("/routing/matrix", async (request, reply) => {
    const parsed = MatrixRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid routing matrix request.", parsed.error.flatten());
    }

    try {
      const matrix = await service.matrix(parsed.data);
      return reply.send(matrix);
    } catch (error) {
      app.log.error({ error }, "routing_matrix_failed");
      return sendApiError(reply, "DEPENDENCY_UNAVAILABLE", "Routing provider unavailable.");
    }
  });

  app.post("/routing/trip", async (request, reply) => {
    const parsed = TripRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid routing trip request.", parsed.error.flatten());
    }

    try {
      const trip = await service.trip(parsed.data);
      return reply.send(trip);
    } catch (error) {
      app.log.error({ error }, "routing_trip_failed");
      return sendApiError(reply, "DEPENDENCY_UNAVAILABLE", "Routing provider unavailable.");
    }
  });

  app.post("/routing/founder-path", async (request, reply) => {
    const parsed = FounderPathRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid founder-path request.", parsed.error.flatten());
    }

    try {
      const founderRoute = await service.founderPath(parsed.data);
      return reply.send(founderRoute);
    } catch (error) {
      app.log.error({ error }, "routing_founder_path_failed");
      return sendApiError(reply, "DEPENDENCY_UNAVAILABLE", "Routing provider unavailable.");
    }
  });
}
