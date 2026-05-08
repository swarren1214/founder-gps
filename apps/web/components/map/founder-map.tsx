"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { IconLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { cn } from "@/lib/utils";
import type { FounderRoute, Recommendation, ResourceCardData, StartupProfileData } from "@/lib/schemas";

type FounderMapProps = {
  resources: ResourceCardData[];
  startups: StartupProfileData[];
  recommendations: Recommendation[];
  route: FounderRoute | null;
  founderLocation: { lat: number; lng: number; city: string };
  showPins: boolean;
  className?: string;
};

// Pin SVG geometry constants (viewBox 0 0 80 94)
// Circle: cx=40, cy=32, r=20  Anchor (tip): x=40, y=88
const PIN_W = 80;
const PIN_H = 94;
const PIN_CIRCLE_CX = 40;
const PIN_CIRCLE_CY = 42;
const PIN_CIRCLE_R = 20;
const PIN_ANCHOR_Y = 88;

const PIN_PATH = "M40 88c0 0 25-28 25-46 0-14-11-25-25-25S15 28 15 42c0 18 25 46 25 46z";

async function buildPinIcon(logoUrl: string | null, isRecommended: boolean): Promise<string> {
  const scale = 2; // retina canvas
  const canvas = document.createElement("canvas");
  canvas.width = PIN_W * scale;
  canvas.height = PIN_H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Fallback: plain SVG data URL (no logo)
    const fill = isRecommended ? "#0f6a74" : "#11203b";
    const stroke = isRecommended ? "#43A79D" : "#009C8D";
    return (
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='${PIN_W}' height='${PIN_H}' viewBox='0 0 ${PIN_W} ${PIN_H}'><path d='${PIN_PATH}' fill='${fill}'/><circle cx='${PIN_CIRCLE_CX}' cy='${PIN_CIRCLE_CY}' r='${PIN_CIRCLE_R}' fill='#ffffff' stroke='${stroke}' stroke-width='3'/></svg>`
      )
    );
  }

  ctx.scale(scale, scale);

  const pinColor = isRecommended ? "#0f6a74" : "#11203b";
  const strokeColor = isRecommended ? "#43A79D" : "#009C8D";

  // Pin body
  ctx.fillStyle = pinColor;
  ctx.fill(new Path2D(PIN_PATH));

  // Logo clipped to circle (fills edge-to-edge), then stroke drawn on top
  if (logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("logo load failed"));
        img.src = logoUrl;
      });
      // Fill circle with white first (in case logo has transparency)
      ctx.beginPath();
      ctx.arc(PIN_CIRCLE_CX, PIN_CIRCLE_CY, PIN_CIRCLE_R, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      // Clip and draw logo to exactly fill the circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(PIN_CIRCLE_CX, PIN_CIRCLE_CY, PIN_CIRCLE_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        img,
        PIN_CIRCLE_CX - PIN_CIRCLE_R,
        PIN_CIRCLE_CY - PIN_CIRCLE_R,
        PIN_CIRCLE_R * 2,
        PIN_CIRCLE_R * 2
      );
      ctx.restore();
    } catch {
      // Logo failed — draw plain white circle
      ctx.beginPath();
      ctx.arc(PIN_CIRCLE_CX, PIN_CIRCLE_CY, PIN_CIRCLE_R, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  } else {
    // No logo — plain white circle
    ctx.beginPath();
    ctx.arc(PIN_CIRCLE_CX, PIN_CIRCLE_CY, PIN_CIRCLE_R, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  // Stroke ring drawn on top of logo
  ctx.beginPath();
  ctx.arc(PIN_CIRCLE_CX, PIN_CIRCLE_CY, PIN_CIRCLE_R, 0, Math.PI * 2);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

type ResourcePin = ResourceCardData & { pinIconUrl: string };
type StartupPin = { id: string; name: string; lat: number; lng: number; pinIconUrl: string };

function getDomainFromUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function FounderMap({ resources, startups, recommendations, route, founderLocation, showPins, className }: FounderMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<maplibregl.Map | null>(null);

  const recommendedIds = useMemo(
    () => new Set(recommendations.map((recommendation) => recommendation.resourceId)),
    [recommendations]
  );

  const [resourcePins, setResourcePins] = useState<ResourcePin[]>([]);
  const [startupPinIconUrl, setStartupPinIconUrl] = useState<string | null>(null);

  const startupPins = useMemo<StartupPin[]>(
    () =>
      startups
        .filter((startup): startup is StartupProfileData & { lat: number; lng: number } => startup.lat !== null && startup.lng !== null)
        .map((startup) => ({
          id: startup.id,
          name: startup.name,
          lat: startup.lat,
          lng: startup.lng,
          pinIconUrl: startupPinIconUrl ?? ""
        })),
    [startups, startupPinIconUrl]
  );

  useEffect(() => {
    let cancelled = false;

    buildPinIcon(null, true).then((url) => {
      if (!cancelled) {
        setStartupPinIconUrl(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      resources.map(async (resource) => {
        const domain = getDomainFromUrl(resource.website);
        const logoUrl = domain
          ? `/api/logo?domain=${encodeURIComponent(domain)}&size=64`
          : (resource.logoUrl ?? null);
        const isRecommended = recommendedIds.has(resource.id);
        const pinIconUrl = await buildPinIcon(logoUrl, isRecommended);
        return { ...resource, pinIconUrl };
      })
    ).then((pins) => {
      if (!cancelled) setResourcePins(pins);
    });

    return () => {
      cancelled = true;
    };
  }, [resources, recommendedIds]);

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [founderLocation.lng, founderLocation.lat],
      zoom: 8.2
    });

    instanceRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    return () => {
      instanceRef.current?.remove();
      instanceRef.current = null;
    };
  }, [founderLocation.lat, founderLocation.lng]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) {
      return;
    }

    const routeCoordinates = route?.geojson.features[0]?.geometry.coordinates ?? [];

    const overlay = new MapboxOverlay({
      interleaved: true,
      getTooltip: ({ layer, object }) => {
        if ((layer?.id === "resources-pin-layer" || layer?.id === "startup-profiles-pin-layer") && object && "name" in object) {
          return {
            text: (object as ResourceCardData).name
          };
        }

        return null;
      },
      layers: [
        new ScatterplotLayer({
          id: "founder-location-layer",
          data: [{ position: [founderLocation.lng, founderLocation.lat], city: founderLocation.city }],
          getPosition: (item: { position: [number, number] }) => item.position,
          getFillColor: [17, 32, 59, 220],
          getRadius: 140,
          radiusUnits: "meters"
        }),
        ...(showPins
          ? [
              ...(startupPinIconUrl
                ? [
                    new IconLayer<StartupPin>({
                      id: "startup-profiles-pin-layer",
                      data: startupPins,
                      getPosition: (startup) => [startup.lng, startup.lat],
                      getIcon: (startup) => ({
                        url: startup.pinIconUrl,
                        width: PIN_W * 2,
                        height: PIN_H * 2,
                        anchorX: PIN_W,
                        anchorY: PIN_ANCHOR_Y * 2
                      }),
                      getSize: 54,
                      sizeUnits: "pixels",
                      sizeScale: 1,
                      pickable: true
                    })
                  ]
                : []),
              new IconLayer<ResourcePin>({
                id: "resources-pin-layer",
                data: resourcePins,
                getPosition: (resource) => [resource.lng, resource.lat],
                getIcon: (resource) => ({
                  url: resource.pinIconUrl,
                  // Canvas is drawn at 2x (retina): PIN_W*2 × PIN_H*2
                  width: PIN_W * 2,
                  height: PIN_H * 2,
                  anchorX: PIN_W, // center x = 40*2
                  anchorY: PIN_ANCHOR_Y * 2 // pin tip = 88*2
                }),
                getSize: (resource) => (recommendedIds.has(resource.id) ? 72 : 64),
                sizeUnits: "pixels",
                sizeScale: 1,
                pickable: true
              })
            ]
          : []),
        new PathLayer({
          id: "route-line-layer",
          data: routeCoordinates.length > 1 ? [{ path: routeCoordinates }] : [],
          getPath: (item: { path: [number, number][] }) => item.path,
          getColor: [255, 122, 26, 230],
          getWidth: 8,
          widthUnits: "pixels"
        })
      ]
    });

    map.addControl(overlay);

    return () => {
      map.removeControl(overlay);
    };
  }, [
    resources,
    recommendations,
    route,
    startups,
    founderLocation.city,
    founderLocation.lat,
    founderLocation.lng,
    recommendedIds,
    resourcePins,
    startupPinIconUrl,
    startupPins,
    showPins
  ]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className={cn("h-full w-full overflow-hidden", className)} />
    </div>
  );
}
