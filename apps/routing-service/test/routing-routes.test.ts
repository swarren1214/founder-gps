import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { OsrmClient, OsrmRouteResult, OsrmTableResult, OsrmTripResult } from "../src/clients/osrm-client.js";

const tripFixture: OsrmTripResult = {
  code: "Ok",
  trips: [
    {
      distance: 80467.2,
      duration: 4560,
      geometry: {
        coordinates: [
          [-111.8508, 40.3916],
          [-111.6585, 40.2338],
          [-111.8935, 40.7594]
        ]
      }
    }
  ],
  waypoints: [
    {
      location: [-111.8508, 40.3916],
      waypoint_index: 0
    },
    {
      location: [-111.6585, 40.2338],
      waypoint_index: 1
    },
    {
      location: [-111.8935, 40.7594],
      waypoint_index: 2
    }
  ]
};

class StubOsrmClient implements OsrmClient {
  async route(): Promise<OsrmRouteResult> {
    return {
      code: "Ok",
      routes: [
        {
          distance: 12000,
          duration: 900,
          geometry: {
            coordinates: [
              [-111.8508, 40.3916],
              [-111.8935, 40.7594]
            ]
          }
        }
      ],
      waypoints: [
        { location: [-111.8508, 40.3916] },
        { location: [-111.8935, 40.7594] }
      ]
    };
  }

  async matrix(): Promise<OsrmTableResult> {
    return {
      code: "Ok",
      durations: [
        [0, 900],
        [850, 0]
      ],
      distances: [
        [0, 12000],
        [11800, 0]
      ],
      sources: [{ location: [-111.8508, 40.3916] }, { location: [-111.8935, 40.7594] }],
      destinations: [{ location: [-111.8508, 40.3916] }, { location: [-111.8935, 40.7594] }]
    };
  }

  async trip(): Promise<OsrmTripResult> {
    return tripFixture;
  }
}

class FailingOsrmClient implements OsrmClient {
  async route(): Promise<OsrmRouteResult> {
    throw new Error("OSRM unavailable");
  }

  async matrix(): Promise<OsrmTableResult> {
    throw new Error("OSRM unavailable");
  }

  async trip(): Promise<OsrmTripResult> {
    throw new Error("OSRM unavailable");
  }
}

class CapturingOsrmClient extends StubOsrmClient {
  lastTripRequest: unknown;

  override async trip(request: Parameters<OsrmClient["trip"]>[0]): Promise<OsrmTripResult> {
    this.lastTripRequest = request;
    return super.trip();
  }
}

describe("routing routes", () => {
  const app = buildApp({ osrmClient: new StubOsrmClient() });

  it("returns route geometry", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/routing/route",
      payload: {
        coordinates: [
          { lat: 40.3916, lng: -111.8508 },
          { lat: 40.7594, lng: -111.8935 }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.distanceMeters).toBe(12000);
    expect(body.geojson.type).toBe("FeatureCollection");
  });

  it("returns matrix data", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/routing/matrix",
      payload: {
        coordinates: [
          { lat: 40.3916, lng: -111.8508 },
          { lat: 40.7594, lng: -111.8935 }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.durations[0][1]).toBe(900);
    expect(body.distances[1][0]).toBe(11800);
  });

  it("returns trip optimization data", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/routing/trip",
      payload: {
        coordinates: [
          { lat: 40.3916, lng: -111.8508 },
          { lat: 40.2338, lng: -111.6585 },
          { lat: 40.7594, lng: -111.8935 }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.waypointOrder).toHaveLength(3);
    expect(body.distanceMeters).toBeGreaterThan(0);
    expect(body.geojson.features[0].properties.mode).toBe("driving");
  });

  it("builds an ordered founder path with route summary", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/routing/founder-path",
      payload: {
        origin: {
          city: "Lehi",
          lat: 40.3916,
          lng: -111.8508
        },
        topN: 2,
        resources: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "BYU Rollins Center",
            category: "university",
            description: "Campus resource",
            website: "https://rollins.byu.edu",
            logoUrl: null,
            address: null,
            city: "Provo",
            state: "UT",
            lat: 40.2338,
            lng: -111.6585,
            stageFit: ["idea", "validation"],
            industryFit: ["saas"],
            tags: ["customer_discovery"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Pelion Venture Partners",
            category: "investor",
            description: "VC",
            website: "https://pelionvp.com",
            logoUrl: null,
            address: null,
            city: "Salt Lake City",
            state: "UT",
            lat: 40.7594,
            lng: -111.8935,
            stageFit: ["fundraising"],
            industryFit: ["saas"],
            tags: ["fundraising"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.orderedStops).toHaveLength(2);
    expect(body.orderedStops[0].name).toBe("BYU Rollins Center");
    expect(body.totalDriveTimeMinutes).toBeGreaterThan(0);
    expect(body.totalDistanceMiles).toBeGreaterThan(0);
    expect(body.geojson.features[0].geometry.type).toBe("LineString");
  });

  it("validates malformed founder path payloads", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/routing/founder-path",
      payload: {
        origin: {
          lat: 95,
          lng: -111.8508
        },
        resources: []
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("degrades gracefully when OSRM is unavailable", async () => {
    const failingApp = buildApp({ osrmClient: new FailingOsrmClient() });

    const response = await failingApp.inject({
      method: "POST",
      url: "/routing/route",
      payload: {
        coordinates: [
          { lat: 40.3916, lng: -111.8508 },
          { lat: 40.7594, lng: -111.8935 }
        ]
      }
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Routing provider unavailable."
      }
    });
  });

  it("leaves the final stop open for OSRM optimization on one-way founder paths", async () => {
    const capturingClient = new CapturingOsrmClient();
    const capturingApp = buildApp({ osrmClient: capturingClient });

    const response = await capturingApp.inject({
      method: "POST",
      url: "/routing/founder-path",
      payload: {
        origin: {
          city: "Lehi",
          lat: 40.3916,
          lng: -111.8508
        },
        topN: 2,
        resources: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "BYU Rollins Center",
            category: "university",
            description: "Campus resource",
            website: "https://rollins.byu.edu",
            logoUrl: null,
            address: null,
            city: "Provo",
            state: "UT",
            lat: 40.2338,
            lng: -111.6585,
            stageFit: ["idea", "validation"],
            industryFit: ["saas"],
            tags: ["customer_discovery"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Pelion Venture Partners",
            category: "investor",
            description: "VC",
            website: "https://pelionvp.com",
            logoUrl: null,
            address: null,
            city: "Salt Lake City",
            state: "UT",
            lat: 40.7594,
            lng: -111.8935,
            stageFit: ["fundraising"],
            industryFit: ["saas"],
            tags: ["fundraising"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(capturingClient.lastTripRequest).toMatchObject({
      roundtrip: false,
      source: "first",
      destination: "any"
    });
  });
});
