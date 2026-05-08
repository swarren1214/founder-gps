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

const PIN_FALLBACK_COLORS = [
  "#124e66",
  "#0f766e",
  "#1f6f8b",
  "#1b4332",
  "#264653",
  "#2a4365",
  "#155e75",
  "#065f46"
] as const;

function getFallbackColor(label: string): string {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash << 5) - hash + label.charCodeAt(index);
    hash |= 0;
  }
  return PIN_FALLBACK_COLORS[Math.abs(hash) % PIN_FALLBACK_COLORS.length];
}

function getFallbackInitial(label: string): string {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}

function drawFallbackBadge(ctx: CanvasRenderingContext2D, label: string) {
  ctx.beginPath();
  ctx.arc(PIN_CIRCLE_CX, PIN_CIRCLE_CY, PIN_CIRCLE_R, 0, Math.PI * 2);
  ctx.fillStyle = getFallbackColor(label);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(getFallbackInitial(label), PIN_CIRCLE_CX, PIN_CIRCLE_CY + 0.5);
}

function getOpaqueBounds(img: HTMLImageElement): { sx: number; sy: number; sw: number; sh: number } | null {
  const sourceW = img.naturalWidth || img.width;
  const sourceH = img.naturalHeight || img.height;
  if (!sourceW || !sourceH) {
    return null;
  }

  const sampleW = Math.min(sourceW, 256);
  const sampleH = Math.min(sourceH, 256);
  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.drawImage(img, 0, 0, sampleW, sampleH);

  try {
    const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
    const { data } = imageData;

    let minX = sampleW;
    let minY = sampleH;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sampleH; y += 1) {
      for (let x = 0; x < sampleW; x += 1) {
        const alpha = data[(y * sampleW + x) * 4 + 3];
        if (alpha > 12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return null;
    }

    const scaleX = sourceW / sampleW;
    const scaleY = sourceH / sampleH;
    const sx = Math.max(0, Math.floor(minX * scaleX));
    const sy = Math.max(0, Math.floor(minY * scaleY));
    const sw = Math.max(1, Math.ceil((maxX - minX + 1) * scaleX));
    const sh = Math.max(1, Math.ceil((maxY - minY + 1) * scaleY));

    return { sx, sy, sw, sh };
  } catch {
    // If image data is inaccessible, fall back to the full image bounds.
    return null;
  }
}

async function buildPinIcon(logoUrl: string | null, isRecommended: boolean, label: string): Promise<string> {
  const scale = 2; // retina canvas
  const canvas = document.createElement("canvas");
  canvas.width = PIN_W * scale;
  canvas.height = PIN_H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Fallback: plain SVG data URL (no logo)
    const fill = isRecommended ? "#0f6a74" : "#11203b";
    const stroke = isRecommended ? "#43A79D" : "#009C8D";
    const badge = getFallbackColor(label);
    const initial = getFallbackInitial(label);
    return (
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='${PIN_W}' height='${PIN_H}' viewBox='0 0 ${PIN_W} ${PIN_H}'><path d='${PIN_PATH}' fill='${fill}'/><circle cx='${PIN_CIRCLE_CX}' cy='${PIN_CIRCLE_CY}' r='${PIN_CIRCLE_R}' fill='${badge}' stroke='${stroke}' stroke-width='1'/><text x='${PIN_CIRCLE_CX}' y='${PIN_CIRCLE_CY + 1}' text-anchor='middle' dominant-baseline='middle' fill='#fff' font-family='system-ui, -apple-system, Segoe UI, sans-serif' font-size='14' font-weight='700'>${initial}</text></svg>`
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

      const bounds = getOpaqueBounds(img);
      const sx = bounds?.sx ?? 0;
      const sy = bounds?.sy ?? 0;
      const sw = bounds?.sw ?? (img.naturalWidth || img.width);
      const sh = bounds?.sh ?? (img.naturalHeight || img.height);

      ctx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        PIN_CIRCLE_CX - PIN_CIRCLE_R,
        PIN_CIRCLE_CY - PIN_CIRCLE_R,
        PIN_CIRCLE_R * 2,
        PIN_CIRCLE_R * 2
      );
      ctx.restore();
    } catch {
      // Logo failed — draw deterministic fallback avatar.
      drawFallbackBadge(ctx, label);
    }
  } else {
    // No logo — draw deterministic fallback avatar.
    drawFallbackBadge(ctx, label);
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
  const [startupPins, setStartupPins] = useState<StartupPin[]>([]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      startups
        .filter((startup): startup is StartupProfileData & { lat: number; lng: number } => startup.lat !== null && startup.lng !== null)
        .map(async (startup) => {
          const domain = getDomainFromUrl(startup.website);
          const proxiedLogoUrl = startup.logoUrl
            ? `/api/logo?src=${encodeURIComponent(startup.logoUrl)}&size=64`
            : domain
              ? `/api/logo?domain=${encodeURIComponent(domain)}&size=64`
              : null;
          const pinIconUrl = await buildPinIcon(proxiedLogoUrl, true, startup.name);
          return {
            id: startup.id,
            name: startup.name,
            lat: startup.lat,
            lng: startup.lng,
            pinIconUrl
          };
        })
    ).then((pins) => {
      if (!cancelled) {
        setStartupPins(pins);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [startups]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      resources.map(async (resource) => {
        const domain = getDomainFromUrl(resource.website);
        const logoUrl = resource.logoUrl
          ? `/api/logo?src=${encodeURIComponent(resource.logoUrl)}&size=64`
          : domain
            ? `/api/logo?domain=${encodeURIComponent(domain)}&size=64`
            : null;
        const isRecommended = recommendedIds.has(resource.id);
        const pinIconUrl = await buildPinIcon(logoUrl, isRecommended, resource.name);
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
              ...(startupPins.length > 0
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
    startupPins,
    showPins
  ]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className={cn("h-full w-full overflow-hidden", className)} />
    </div>
  );
}
