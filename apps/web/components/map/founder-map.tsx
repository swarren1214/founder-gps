"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { IconLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { MapControls } from "@/components/map/map-controls";
import { filterResources, filterStartups } from "@/lib/map-filters";
import { cn } from "@/lib/utils";
import type { FounderRoute, Recommendation, ResourceCardData, StartupProfileData, MapFilters } from "@/lib/schemas";

type FounderMapProps = {
  resources: ResourceCardData[];
  startups: StartupProfileData[];
  recommendations: Recommendation[];
  route: FounderRoute | null;
  founderLocation: { lat: number; lng: number; city: string };
  showStartupPins: boolean;
  showResourcePins: boolean;
  selectedStartupId?: string | null;
  selectedResourceId?: string | null;
  onPinSelect?: (pin: { id: string; kind: "startup" | "resource" }) => void;
  activeTab?: string;
  activeFilters?: MapFilters | null;
  className?: string;
};

// Pin SVG geometry constants (viewBox 0 0 61 71) based on the provided design.
const PIN_W = 61;
const PIN_H = 71;
const PIN_CIRCLE_CX = 30.5;
const PIN_CIRCLE_CY = 29.5;
const PIN_CIRCLE_R = 21.5;
const PIN_ANCHOR_Y = 64.7;
const PIN_SHADOW_CX = 30.5;
const PIN_SHADOW_CY = 64;
const PIN_SHADOW_RX = 8.5;
const PIN_SHADOW_RY = 3;

const PIN_PATH = "M30.5 4C44.5833 4 56 15.4167 56 29.5C56 37.7068 52.1232 45.008 46.101 49.6723C42.3514 52.5764 38.3218 55.28 35.5214 59.1078L31.9521 63.9865C31.7883 64.2113 31.5709 64.3948 31.3181 64.5215C31.0653 64.6481 30.7846 64.7143 30.4997 64.7143C30.2149 64.7143 29.9342 64.6481 29.6814 64.5215C29.4286 64.3948 29.2111 64.2113 29.0473 63.9865L25.4776 59.1071C22.6774 55.2796 18.6481 52.5761 14.8987 49.6721C8.87671 45.0078 5 37.7066 5 29.5C5 15.4167 16.4167 4 30.5 4Z";

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

async function buildPinIcon(logoUrl: string | null, _isRecommended: boolean, label: string): Promise<string> {
  const scale = 2; // retina canvas
  const canvas = document.createElement("canvas");
  canvas.width = PIN_W * scale;
  canvas.height = PIN_H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Fallback: plain SVG data URL (no logo)
    const initial = getFallbackInitial(label);
    return (
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='${PIN_W}' height='${PIN_H}' viewBox='0 0 ${PIN_W} ${PIN_H}'><ellipse cx='${PIN_SHADOW_CX}' cy='${PIN_SHADOW_CY}' rx='${PIN_SHADOW_RX}' ry='${PIN_SHADOW_RY}' fill='rgba(0,0,0,0.2)'/><path d='${PIN_PATH}' fill='#ffffff'/><circle cx='${PIN_CIRCLE_CX}' cy='${PIN_CIRCLE_CY}' r='${PIN_CIRCLE_R}' fill='#D9D9D9'/><text x='${PIN_CIRCLE_CX}' y='${PIN_CIRCLE_CY + 0.5}' text-anchor='middle' dominant-baseline='middle' fill='#fff' font-family='system-ui, -apple-system, Segoe UI, sans-serif' font-size='14' font-weight='700'>${initial}</text></svg>`
      )
    );
  }

  ctx.scale(scale, scale);

  // Ground shadow
  ctx.save();
  ctx.filter = "blur(1px)";
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.beginPath();
  ctx.ellipse(PIN_SHADOW_CX, PIN_SHADOW_CY, PIN_SHADOW_RX, PIN_SHADOW_RY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Pin body with soft drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = "#ffffff";
  ctx.fill(new Path2D(PIN_PATH));
  ctx.restore();

  // Badge base circle
  ctx.beginPath();
  ctx.arc(PIN_CIRCLE_CX, PIN_CIRCLE_CY, PIN_CIRCLE_R, 0, Math.PI * 2);
  ctx.fillStyle = "#D9D9D9";
  ctx.fill();

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
type MapPin = { id: string; kind: "startup" | "resource"; name: string; lat: number; lng: number; pinIconUrl: string; size: number };
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

const CLUSTER_RADIUS_PX = 28;
const CLUSTER_DISABLE_ZOOM = 11;

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

function appendVersionParam(url: string, versionToken: string | null): string {
  if (!versionToken) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(versionToken)}`;
}

function resolveLogoSource(
  logoUrl: string | null,
  website: string | null,
  updatedAt: string | null,
  strict = true
): string | null {
  const versionToken = updatedAt ? String(Date.parse(updatedAt) || updatedAt) : null;

  const domain = getDomainFromUrl(website);
  if (logoUrl) {
    if (!/^https?:\/\//i.test(logoUrl)) {
      return null;
    }

    return appendVersionParam(
      `/api/logo?src=${encodeURIComponent(logoUrl)}${domain ? `&domain=${encodeURIComponent(domain)}` : ""}&size=64${strict ? "&strict=1" : ""}`,
      versionToken
    );
  }

  return null;
}

function clusterPins(
  points: MapPin[],
  map: maplibregl.Map,
  radiusPx = CLUSTER_RADIUS_PX
): { clusters: PinCluster[]; singles: MapPin[] } {
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
  showStartupPins,
  showResourcePins,
  selectedStartupId = null,
  selectedResourceId = null,
  onPinSelect,
  activeTab = "overview",
  activeFilters = null,
  className
}: FounderMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);

  const recommendedIds = useMemo(
    () => new Set(recommendations.map((recommendation) => recommendation.resourceId)),
    [recommendations]
  );

  const [resourcePins, setResourcePins] = useState<ResourcePin[]>([]);
  const [startupPins, setStartupPins] = useState<StartupPin[]>([]);
  const [mapRevision, setMapRevision] = useState(0);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pulseTick, setPulseTick] = useState(0);
  const [orsRouteCoordinates, setOrsRouteCoordinates] = useState<[number, number][]>([]);
  const [isRouteHovered, setIsRouteHovered] = useState(false);
  const [isRouteFocusActive, setIsRouteFocusActive] = useState(false);

  const shouldShowRoadmapRoute = activeTab === "roadmap";

  const routeRequestCoordinates = useMemo<[number, number][]>(() => {
    const byId = new Map(resources.map((resource) => [resource.id, resource]));

    const orderedWaypoints = recommendations
      .map((recommendation) => byId.get(recommendation.resourceId))
      .filter((resource): resource is ResourceCardData => Boolean(resource))
      .slice(0, 10)
      .map((resource) => [resource.lng, resource.lat] as [number, number]);

    const coordinates: [number, number][] = [[founderLocation.lng, founderLocation.lat], ...orderedWaypoints];

    const uniqueCoordinates: [number, number][] = [];
    const seen = new Set<string>();
    for (const [lng, lat] of coordinates) {
      const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      uniqueCoordinates.push([lng, lat]);
    }

    return uniqueCoordinates;
  }, [founderLocation.lat, founderLocation.lng, recommendations, resources]);

  const routeTargetResourceIds = useMemo(() => {
    const resourceIds = new Set(resources.map((resource) => resource.id));
    return new Set(
      recommendations
        .slice(0, 10)
        .map((recommendation) => recommendation.resourceId)
        .filter((resourceId) => resourceIds.has(resourceId))
    );
  }, [recommendations, resources]);

  const allPins = useMemo<MapPin[]>(
    () => {
      const baseStartupPins = showStartupPins
        ? startupPins.map((pin) => ({
            ...pin,
            kind: "startup" as const,
            size: pin.id === selectedStartupId ? 80 : 56
          }))
        : [];

      const baseResourcePins = showResourcePins
        ? resourcePins.map((pin) => ({
            id: pin.id,
            kind: "resource" as const,
            name: pin.name,
            lat: pin.lat,
            lng: pin.lng,
            pinIconUrl: pin.pinIconUrl,
            size: pin.id === selectedResourceId ? 82 : recommendedIds.has(pin.id) ? 72 : 64
          }))
        : [];

      if (!activeFilters || activeFilters.intent === "general") {
        return [...baseStartupPins, ...baseResourcePins];
      }

      if (activeFilters.clearFilters) {
        return [...baseStartupPins, ...baseResourcePins];
      }

      const matchingResourceIds = new Set(filterResources(resources, activeFilters).map((resource) => resource.id));
      const matchingStartupIds = new Set(filterStartups(startups, activeFilters).map((startup) => startup.id));

      if (activeFilters.intent === "filter_resources") {
        return baseResourcePins.filter((pin) => matchingResourceIds.has(pin.id));
      }

      if (activeFilters.intent === "filter_startups") {
        return baseStartupPins.filter((pin) => matchingStartupIds.has(pin.id));
      }

      if (activeFilters.intent === "filter_both") {
        return [
          ...baseStartupPins.filter((pin) => matchingStartupIds.has(pin.id)),
          ...baseResourcePins.filter((pin) => matchingResourceIds.has(pin.id))
        ];
      }

      return [...baseStartupPins, ...baseResourcePins];
    },
    [
      resourcePins,
      startupPins,
      recommendedIds,
      selectedStartupId,
      selectedResourceId,
      activeFilters,
      startups,
      resources,
      showStartupPins,
      showResourcePins
    ]
  );

  const visiblePins = useMemo(() => {
    if (!isRouteFocusActive) {
      return allPins;
    }

    return allPins.filter((pin) => pin.kind === "resource" && routeTargetResourceIds.has(pin.id));
  }, [allPins, isRouteFocusActive, routeTargetResourceIds]);

  const clusteredPins = useMemo(() => {
    const map = instanceRef.current;
    if (!map || visiblePins.length === 0) {
      return { clusters: [] as PinCluster[], singles: visiblePins };
    }

    // At closer zoom levels, show individual pins instead of forcing cluster bubbles.
    if (map.getZoom() >= CLUSTER_DISABLE_ZOOM) {
      return { clusters: [] as PinCluster[], singles: visiblePins };
    }

    return clusterPins(visiblePins, map);
  }, [mapRevision, visiblePins]);

  const selectedPinIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedStartupId) {
      ids.add(selectedStartupId);
    }
    if (selectedResourceId) {
      ids.add(selectedResourceId);
    }
    return ids;
  }, [selectedStartupId, selectedResourceId]);

  const regularSinglePins = useMemo(
    () => clusteredPins.singles.filter((pin) => !selectedPinIds.has(pin.id)),
    [clusteredPins.singles, selectedPinIds]
  );

  const selectedSinglePins = useMemo(
    () => clusteredPins.singles.filter((pin) => selectedPinIds.has(pin.id)),
    [clusteredPins.singles, selectedPinIds]
  );

  useEffect(() => {
    if (!userLocation) {
      return;
    }

    const interval = window.setInterval(() => {
      setPulseTick((value) => value + 1);
    }, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, [userLocation]);

  useEffect(() => {
    if (!shouldShowRoadmapRoute) {
      setOrsRouteCoordinates([]);
      setIsRouteHovered(false);
      setIsRouteFocusActive(false);
      return;
    }

    if (routeRequestCoordinates.length < 2) {
      setOrsRouteCoordinates([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/routing/ors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coordinates: routeRequestCoordinates })
        });

        const payload = (await response.json()) as {
          coordinates?: [number, number][];
        };

        if (!response.ok) {
          if (!cancelled) {
            setOrsRouteCoordinates([]);
          }
          return;
        }

        if (!cancelled) {
          setOrsRouteCoordinates(Array.isArray(payload.coordinates) ? payload.coordinates : []);
        }
      } catch {
        if (!cancelled) {
          setOrsRouteCoordinates([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeRequestCoordinates, shouldShowRoadmapRoute]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      startups
        .filter((startup): startup is StartupProfileData & { lat: number; lng: number } => startup.lat !== null && startup.lng !== null)
        .map(async (startup) => {
          const proxiedLogoUrl = resolveLogoSource(startup.logoUrl, startup.website, startup.updatedAt, true);
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
        const logoUrl = resolveLogoSource(resource.logoUrl, resource.website, resource.updatedAt, true);
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

    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
      getTooltip: ({ layer, object }) => {
        if (layer?.id === "pin-cluster-layer" && object && "count" in object) {
          const cluster = object as PinCluster;
          return {
            text: `${cluster.count} startups/resources`,
            style: {
              borderRadius: "12px"
            }
          };
        }

        if (layer?.id === "pin-cluster-count-layer") {
          return null;
        }

        if ((layer?.id === "all-pins-layer" || layer?.id === "selected-pins-layer") && object && "name" in object) {
          return {
            text: (object as MapPin).name,
            style: {
              borderRadius: "12px"
            }
          };
        }

        return null;
      }
    });

    overlayRef.current = overlay;
    map.addControl(overlay);

    return () => {
      if (overlayRef.current) {
        map.removeControl(overlayRef.current);
        overlayRef.current = null;
      }
      instanceRef.current?.remove();
      instanceRef.current = null;
    };
  }, [founderLocation.lat, founderLocation.lng]);

  const selectedStartupCoords = useMemo(() => {
    if (!selectedStartupId) {
      return null;
    }

    const found = startups.find(
      (startup): startup is StartupProfileData & { lat: number; lng: number } =>
        startup.id === selectedStartupId && startup.lat !== null && startup.lng !== null
    );

    return found ? { lat: found.lat, lng: found.lng } : null;
  }, [selectedStartupId, startups]);

  const selectedResourceCoords = useMemo(() => {
    if (!selectedResourceId) {
      return null;
    }

    const found = resources.find((resource) => resource.id === selectedResourceId);
    return found ? { lat: found.lat, lng: found.lng } : null;
  }, [selectedResourceId, resources]);

  useEffect(() => {
    if (!selectedStartupCoords) {
      return;
    }

    const map = instanceRef.current;
    if (!map) {
      return;
    }

    map.flyTo({
      center: [selectedStartupCoords.lng, selectedStartupCoords.lat],
      zoom: Math.max(map.getZoom(), 13.5),
      speed: 1.1,
      curve: 1.2,
      essential: true
    });
  }, [selectedStartupCoords]);

  useEffect(() => {
    if (!selectedResourceCoords) {
      return;
    }

    const map = instanceRef.current;
    if (!map) {
      return;
    }

    map.flyTo({
      center: [selectedResourceCoords.lng, selectedResourceCoords.lat],
      zoom: Math.max(map.getZoom(), 13.5),
      speed: 1.1,
      curve: 1.2,
      essential: true
    });
  }, [selectedResourceCoords]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    const routeCoordinates = shouldShowRoadmapRoute ? orsRouteCoordinates : [];
    const pulseProgress = (pulseTick % 18) / 18;
    const pulseRadius = 35 + pulseProgress * 115;
    const pulseAlpha = Math.max(20, Math.round((1 - pulseProgress) * 125));
    const routeLineWidthPx = isRouteHovered ? 13 : 7;

    overlay.setProps({
      layers: [
        new PathLayer<{ path: [number, number][] }>({
          id: "route-line-layer",
          data: routeCoordinates.length > 1 ? [{ path: routeCoordinates }] : [],
          getPath: (item: { path: [number, number][] }) => item.path,
          getColor: [67, 167, 157, 230],
          getWidth: routeLineWidthPx,
          widthUnits: "pixels",
          pickable: true,
          onHover: ({ object }: { object: unknown }) => {
            setIsRouteHovered(Boolean(object));
          },
          onClick: ({ object }: { object: unknown }) => {
            if (!object) {
              return;
            }

            setIsRouteFocusActive((value) => !value);
          },
          updateTriggers: {
            getWidth: routeLineWidthPx
          }
        } as unknown as ConstructorParameters<typeof PathLayer<{ path: [number, number][] }>>[0]),
        new ScatterplotLayer({
          id: "founder-location-layer",
          data: [{ position: [founderLocation.lng, founderLocation.lat], city: founderLocation.city }],
          getPosition: (item: { position: [number, number] }) => item.position,
          getFillColor: [17, 32, 59, 220],
          getRadius: 140,
          radiusUnits: "meters"
        }),
        ...(userLocation
          ? [
              new ScatterplotLayer({
                id: "user-location-pulse-layer",
                data: [{ position: [userLocation.lng, userLocation.lat] as [number, number] }],
                getPosition: (item: { position: [number, number] }) => item.position,
                getFillColor: [59, 130, 246, pulseAlpha],
                getRadius: pulseRadius,
                radiusUnits: "meters",
                pickable: false
              }),
              new ScatterplotLayer({
                id: "user-location-dot-layer",
                data: [{ position: [userLocation.lng, userLocation.lat] as [number, number] }],
                getPosition: (item: { position: [number, number] }) => item.position,
                getFillColor: [59, 130, 246, 255],
                getLineColor: [255, 255, 255, 255],
                lineWidthUnits: "pixels",
                lineWidthMinPixels: 2,
                stroked: true,
                getRadius: 9,
                radiusUnits: "meters",
                pickable: false
              })
            ]
          : []),
        ...((showStartupPins || showResourcePins)
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
                            maxZoom: 16,
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
                data: regularSinglePins,
                getPosition: (pin) => [pin.lng, pin.lat],
                getIcon: (pin) => ({
                  url: pin.pinIconUrl,
                  // Canvas is drawn at 2x (retina): PIN_W*2 × PIN_H*2
                  width: PIN_W * 2,
                  height: PIN_H * 2,
                  anchorX: PIN_W,
                  anchorY: PIN_ANCHOR_Y * 2
                }),
                getSize: (pin) => (pin.id === hoveredPinId ? pin.size * 1.1 : pin.size),
                sizeUnits: "pixels",
                sizeScale: 1,
                pickable: true,
                autoHighlight: true,
                highlightColor: [255, 255, 255, 56],
                transitions: {
                  getSize: 120
                },
                updateTriggers: {
                  getSize: hoveredPinId
                },
                onHover: ({ object }) => {
                  const hovered = object as MapPin | null;
                  setHoveredPinId((prev) => {
                    const next = hovered?.id ?? null;
                    return prev === next ? prev : next;
                  });
                },
                onClick: ({ object }) => {
                  const selectedPin = object as MapPin | null;
                  if (!selectedPin) {
                    return;
                  }
                  onPinSelect?.({ id: selectedPin.id, kind: selectedPin.kind });
                }
              }),
              new IconLayer<MapPin>({
                id: "selected-pins-layer",
                data: selectedSinglePins,
                getPosition: (pin) => [pin.lng, pin.lat],
                getIcon: (pin) => ({
                  url: pin.pinIconUrl,
                  // Canvas is drawn at 2x (retina): PIN_W*2 × PIN_H*2
                  width: PIN_W * 2,
                  height: PIN_H * 2,
                  anchorX: PIN_W,
                  anchorY: PIN_ANCHOR_Y * 2
                }),
                getSize: (pin) => (pin.id === hoveredPinId ? pin.size * 1.1 : pin.size),
                sizeUnits: "pixels",
                sizeScale: 1,
                pickable: true,
                autoHighlight: true,
                highlightColor: [255, 255, 255, 56],
                transitions: {
                  getSize: 120
                },
                updateTriggers: {
                  getSize: hoveredPinId
                },
                onHover: ({ object }) => {
                  const hovered = object as MapPin | null;
                  setHoveredPinId((prev) => {
                    const next = hovered?.id ?? null;
                    return prev === next ? prev : next;
                  });
                },
                onClick: ({ object }) => {
                  const selectedPin = object as MapPin | null;
                  if (!selectedPin) {
                    return;
                  }
                  onPinSelect?.({ id: selectedPin.id, kind: selectedPin.kind });
                }
              })
            ]
          : []),
      ]
    });
  }, [
    activeTab,
    founderLocation.city,
    founderLocation.lat,
    founderLocation.lng,
    clusteredPins,
    hoveredPinId,
    isRouteHovered,
    onPinSelect,
    pulseTick,
    regularSinglePins,
    routeTargetResourceIds,
    orsRouteCoordinates,
    selectedSinglePins,
    showStartupPins,
    showResourcePins,
    shouldShowRoadmapRoute,
    userLocation
  ]);

  function handleZoomIn() {
    const map = instanceRef.current;
    if (!map) {
      return;
    }

    map.zoomTo(map.getZoom() + 1, { duration: 220 });
  }

  function handleZoomOut() {
    const map = instanceRef.current;
    if (!map) {
      return;
    }

    map.zoomTo(map.getZoom() - 1, { duration: 220 });
  }

  function handleLocateCurrent() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    setIsLocatingUser(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        setUserLocation(nextLocation);
        const map = instanceRef.current;
        if (map) {
          map.flyTo({
            center: [nextLocation.lng, nextLocation.lat],
            zoom: Math.max(map.getZoom(), 13.8),
            speed: 1,
            curve: 1.1,
            essential: true
          });
        }

        setIsLocatingUser(false);
      },
      () => {
        setIsLocatingUser(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  async function handleSearchLocation(query: string): Promise<boolean> {
    const map = instanceRef.current;
    if (!map) {
      return false;
    }

    setIsSearchingLocation(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: "application/json"
          }
        }
      );

      if (!response.ok) {
        return false;
      }

      const payload = (await response.json()) as Array<{ lat: string; lon: string }>;
      const bestMatch = payload[0];
      if (!bestMatch) {
        return false;
      }

      const lat = Number(bestMatch.lat);
      const lng = Number(bestMatch.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return false;
      }

      map.flyTo({
        center: [lng, lat],
        zoom: Math.max(map.getZoom(), 12.8),
        speed: 1,
        curve: 1.1,
        essential: true
      });

      return true;
    } catch {
      return false;
    } finally {
      setIsSearchingLocation(false);
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className={cn("h-full w-full overflow-hidden", className)} />
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onLocate={handleLocateCurrent}
        onSearch={handleSearchLocation}
        isLocating={isLocatingUser}
        isSearching={isSearchingLocation}
      />
    </div>
  );
}
