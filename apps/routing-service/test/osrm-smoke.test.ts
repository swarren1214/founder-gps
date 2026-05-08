import { describe, expect, it } from "vitest";
import { HttpOsrmClient } from "../src/clients/osrm-client.js";

const shouldRun = process.env.RUN_OSRM_SMOKE_TEST === "true";
const describeIf = shouldRun ? describe : describe.skip;

describeIf("OSRM smoke", () => {
  it("calls local OSRM route endpoint", async () => {
    const client = new HttpOsrmClient(process.env.OSRM_BASE_URL ?? "http://localhost:5000", 5000, 0);
    const response = await client.route({
      coordinates: [
        { lat: 40.3916, lng: -111.8508 },
        { lat: 40.7594, lng: -111.8935 }
      ],
      overview: "full",
      steps: false
    });

    expect(response.code).toBe("Ok");
    expect(response.routes[0].distance).toBeGreaterThan(0);
  });
});
