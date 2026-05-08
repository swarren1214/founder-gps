import type { FounderRoute, FounderPathRequest, MatrixRequest, RouteRequest, TripRequest } from "./types.js";
import type { OsrmClient } from "./clients/osrm-client.js";
import { buildRouteGeojson } from "./clients/osrm-client.js";

const METERS_TO_MILES = 0.000621371;
const SECONDS_TO_MINUTES = 1 / 60;

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export class RoutingService {
  constructor(private readonly osrmClient: OsrmClient) {}

  async route(request: RouteRequest) {
    const response = await this.osrmClient.route(request);
    const bestRoute = response.routes[0];

    return {
      distanceMeters: bestRoute.distance,
      durationSeconds: bestRoute.duration,
      geojson: buildRouteGeojson(bestRoute.distance, bestRoute.duration, bestRoute.geometry.coordinates)
    };
  }

  async matrix(request: MatrixRequest) {
    const response = await this.osrmClient.matrix(request);
    return {
      durations: response.durations,
      distances: response.distances ?? []
    };
  }

  async trip(request: TripRequest) {
    const response = await this.osrmClient.trip(request);
    const bestTrip = response.trips[0];

    return {
      distanceMeters: bestTrip.distance,
      durationSeconds: bestTrip.duration,
      waypointOrder: response.waypoints.map((waypoint, inputIndex) => ({
        inputIndex,
        waypointIndex: waypoint.waypoint_index ?? inputIndex,
        snappedLocation: waypoint.location
      })),
      geojson: buildRouteGeojson(bestTrip.distance, bestTrip.duration, bestTrip.geometry.coordinates)
    };
  }

  async founderPath(request: FounderPathRequest): Promise<FounderRoute> {
    const selectedResources = request.resources.slice(0, request.topN);
    const tripResult = await this.trip({
      coordinates: [request.origin, ...selectedResources.map((resource) => ({ lat: resource.lat, lng: resource.lng }))],
      roundtrip: request.roundtrip,
      source: "first",
      destination: "any"
    });

    const orderedStops = tripResult.waypointOrder
      .filter((waypoint) => waypoint.inputIndex > 0)
      .sort((a, b) => a.waypointIndex - b.waypointIndex)
      .map((waypoint) => selectedResources[waypoint.inputIndex - 1]);

    return {
      orderedStops,
      totalDriveTimeMinutes: roundTwo(tripResult.durationSeconds * SECONDS_TO_MINUTES),
      totalDistanceMiles: roundTwo(tripResult.distanceMeters * METERS_TO_MILES),
      geojson: tripResult.geojson
    };
  }
}
