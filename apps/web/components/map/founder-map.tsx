"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { IconLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { cn } from "@/lib/utils";
import type { FounderRoute, Recommendation, ResourceCardData, StartupProfileData } from "@/lib/schemas";

type FounderMapProps = {
  resources: ResourceCardData[];
  startups: StartupProfileData[];
  recommendations: Recommendation[];
  route: FounderRoute | null;
  founderLocation: { lat: number; lng: number; city: string };
  showPins: boolean;
  selectedStartupId?: string | null;
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
    const badge = getFallbackColor(label);
    const initial = getFallbackInitial(label);
    return (
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='${PIN_W}' height='${PIN_H}' viewBox='0 0 ${PIN_W} ${PIN_H}'><path d='${PIN_PATH}' fill='${fill}'/><circle cx='${PIN_CIRCLE_CX}' cy='${PIN_CIRCLE_CY}' r='${PIN_CIRCLE_R}' fill='${badge}'/><text x='${PIN_CIRCLE_CX}' y='${PIN_CIRCLE_CY + 1}' text-anchor='middle' dominant-baseline='middle' fill='#fff' font-family='system-ui, -apple-system, Segoe UI, sans-serif' font-size='14' font-weight='700'>${initial}</text></svg>`
      )
    );
  }

  ctx.scale(scale, scale);

  const pinColor = isRecommended ? "#0f6a74" : "#11203b";
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

  return canvas.toDataURL("image/png");
}

type ResourcePin = ResourceCardData & { pinIconUrl: string };
type StartupPin = { id: string; name: string; lat: number; lng: number; pinIconUrl: string };
type MapPin = { id: string; name: string; lat: number; lng: number; pinIconUrl: string; size: number };
type PinCluster = {
  id: string;
  lat: number;
  lng: number;
  count: number;
  points: MapPin[];
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

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

function clusterPins(points: MapPin[], map: maplibregl.Map, radiusPx = 52): { clusters: PinCluster[]; singles: MapPin[] } {
  if (points.length <= 1) {
    return { clusters: [], singles: points };
  }

  const projected = points.map((point) => ({
    point,
    projected: map.project([point.lng, point.lat])
  }));

  const visited = new Array(projected.length).fill(false);
  const clusters: PinCluster[] = [];
  const singles: MapPin[] = [];

  for (let index = 0; index < projected.length; index += 1) {
    if (visited[index]) {
      continue;
    }

    visited[index] = true;
    const queue = [index];
    const memberIndexes: number[] = [index];

    while (queue.length > 0) {
      const currentIndex = queue.pop() as number;
      const current = projected[currentIndex];

      for (let compareIndex = 0; compareIndex < projected.length; compareIndex += 1) {
        if (visited[compareIndex]) {
          continue;
        }

        const candidate = projected[compareIndex];
        const dx = current.projected.x - candidate.projected.x;
        const dy = current.projected.y - candidate.projected.y;
        const distance = Math.hypot(dx, dy);

        if (distance <= radiusPx) {
          visited[compareIndex] = true;
          queue.push(compareIndex);
          memberIndexes.push(compareIndex);
        }
      }
    }

    if (memberIndexes.length === 1) {
      singles.push(projected[index].point);
      continue;
    }

    const members = memberIndexes.map((memberIndex) => projected[memberIndex].point);

    const lng = members.reduce((sum, member) => sum + member.lng, 0) / members.length;
    const lat = members.reduce((sum, member) => sum + member.lat, 0) / members.length;
    const minLng = Math.min(...members.map((member) => member.lng));
    const maxLng = Math.max(...members.map((member) => member.lng));
    const minLat = Math.min(...members.map((member) => member.lat));
    const maxLat = Math.max(...members.map((member) => member.lat));

    clusters.push({
      id: `cluster-${memberIndexes.sort((a, b) => a - b).join("-")}`,
      lat,
      lng,
      count: members.length,
      points: members,
      minLat,
      minLng,
      maxLat,
      maxLng
    });
  }

  return { clusters, singles };
}

export function FounderMap({
  resources,
  startups,
  recommendations,
  route,
  founderLocation,
  showPins,
  selectedStartupId = null,
  className
}: FounderMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<maplibregl.Map | null>(null);

  const recommendedIds = useMemo(
    () => new Set(recommendations.map((recommendation) => recommendation.resourceId)),
    [recommendations]
  );

  const [resourcePins, setResourcePins] = useState<ResourcePin[]>([]);
  const [startupPins, setStartupPins] = useState<StartupPin[]>([]);
  const [mapRevision, setMapRevision] = useState(0);

  const allPins = useMemo<MapPin[]>(
    () => [
      ...startupPins.map((pin) => ({
        ...pin,
        size: pin.id === selectedStartupId ? 72 : 56
      })),
      ...resourcePins.map((pin) => ({
        id: pin.id,
        name: pin.name,
        lat: pin.lat,
        lng: pin.lng,
        pinIconUrl: pin.pinIconUrl,
        size: recommendedIds.has(pin.id) ? 72 : 64
      }))
    ],
    [resourcePins, startupPins, recommendedIds, selectedStartupId]
  );

  const clusteredPins = useMemo(() => {
    const map = instanceRef.current;
    if (!map || allPins.length === 0) {
      return { clusters: [] as PinCluster[], singles: allPins };
    }

    return clusterPins(allPins, map);
  }, [allPins, mapRevision]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      startups
        .filter((startup): startup is StartupProfileData & { lat: number; lng: number } => startup.lat !== null && startup.lng !== null)
        .map(async (startup) => {
          const domain = getDomainFromUrl(startup.website);
          const proxiedLogoUrl = startup.logoUrl
            ? `/api/logo?src=${encodeURIComponent(startup.logoUrl)}${domain ? `&domain=${encodeURIComponent(domain)}` : ""}&size=64&strict=1`
            : domain
              ? `/api/logo?domain=${encodeURIComponent(domain)}&size=64&strict=1`
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
          ? `/api/logo?src=${encodeURIComponent(resource.logoUrl)}${domain ? `&domain=${encodeURIComponent(domain)}` : ""}&size=64&strict=1`
          : domain
            ? `/api/logo?domain=${encodeURIComponent(domain)}&size=64&strict=1`
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

    map.on("load", () => {
      setMapRevision((value) => value + 1);
    });

    map.on("moveend", () => {
      setMapRevision((value) => value + 1);
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    return () => {
      instanceRef.current?.remove();
      instanceRef.current = null;
    };
  }, [founderLocation.lat, founderLocation.lng]);

  useEffect(() => {
    if (!selectedStartupId) {
      return;
    }

    const map = instanceRef.current;
    if (!map) {
      return;
    }

    const selectedStartup = startups.find(
      (startup): startup is StartupProfileData & { lat: number; lng: number } =>
        startup.id === selectedStartupId && startup.lat !== null && startup.lng !== null
    );

    if (!selectedStartup) {
      return;
    }

    map.flyTo({
      center: [selectedStartup.lng, selectedStartup.lat],
      zoom: Math.max(map.getZoom(), 13.5),
      speed: 1.1,
      curve: 1.2,
      essential: true
    });
  }, [selectedStartupId, startups]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) {
      return;
    }

    const routeCoordinates = route?.geojson.features[0]?.geometry.coordinates ?? [];

    const overlay = new MapboxOverlay({
      interleaved: true,
      getTooltip: ({ layer, object }) => {
        if (layer?.id === "pin-cluster-layer" && object && "count" in object) {
          const cluster = object as PinCluster;
          return {
            text: `${cluster.count} startups/resources`
          };
        }

        if (layer?.id === "pin-cluster-count-layer") {
          return null;
        }

        if (layer?.id === "all-pins-layer" && object && "name" in object) {
          return {
            text: (object as MapPin).name
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
              ...(clusteredPins.clusters.length > 0
                ? [
                    new ScatterplotLayer<PinCluster>({
                      id: "pin-cluster-layer",
                      data: clusteredPins.clusters,
                      getPosition: (cluster) => [cluster.lng, cluster.lat],
                      getRadius: (cluster) => Math.min(40, 18 + cluster.count * 1.6),
                      radiusUnits: "pixels",
                      getFillColor: [17, 32, 59, 230],
                      getLineColor: [67, 167, 157, 255],
                      lineWidthUnits: "pixels",
                      lineWidthMinPixels: 2,
                      stroked: true,
                      pickable: true,
                      onClick: ({ object }) => {
                        if (!object) {
                          return;
                        }

                        const mapInstance = instanceRef.current;
                        if (!mapInstance) {
                          return;
                        }

                        const cluster = object as PinCluster;
                        mapInstance.fitBounds(
                          [
                            [cluster.minLng, cluster.minLat],
                            [cluster.maxLng, cluster.maxLat]
                          ],
                          {
                            padding: 90,
                            maxZoom: 14,
                            duration: 350
                          }
                        );
                      }
                    }),
                    new TextLayer<PinCluster>({
                      id: "pin-cluster-count-layer",
                      data: clusteredPins.clusters,
                      getPosition: (cluster) => [cluster.lng, cluster.lat],
                      getText: (cluster) => String(cluster.count),
                      getSize: 14,
                      sizeUnits: "pixels",
                      getColor: [255, 255, 255, 255],
                      getTextAnchor: "middle",
                      getAlignmentBaseline: "center",
                      pickable: false
                    })
                  ]
                : []),
              new IconLayer<MapPin>({
                id: "all-pins-layer",
                data: clusteredPins.singles,
                getPosition: (pin) => [pin.lng, pin.lat],
                getIcon: (pin) => ({
                  url: pin.pinIconUrl,
                  // Canvas is drawn at 2x (retina): PIN_W*2 × PIN_H*2
                  width: PIN_W * 2,
                  height: PIN_H * 2,
                  anchorX: PIN_W, // center x = 40*2
                  anchorY: PIN_ANCHOR_Y * 2 // pin tip = 88*2
                }),
                getSize: (pin) => pin.size,
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
    clusteredPins,
    showPins
  ]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className={cn("h-full w-full overflow-hidden", className)} />
    </div>
  );
}
