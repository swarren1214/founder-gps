"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { IconLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { FounderRoute, Recommendation, ResourceCardData } from "@/lib/schemas";

type FounderMapProps = {
  resources: ResourceCardData[];
  recommendations: Recommendation[];
  route: FounderRoute | null;
  founderLocation: { lat: number; lng: number; city: string };
};

const categoryColors: Record<string, [number, number, number, number]> = {
  community: [15, 106, 116, 220],
  investor: [255, 122, 26, 220],
  university: [29, 78, 216, 220],
  coworking: [123, 97, 255, 220],
  accelerator: [219, 39, 119, 220],
  incubator: [22, 163, 74, 220]
};

export function FounderMap({ resources, recommendations, route, founderLocation }: FounderMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<maplibregl.Map | null>(null);

  const recommendedIds = useMemo(
    () => new Set(recommendations.map((recommendation) => recommendation.resourceId)),
    [recommendations]
  );

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors"
          }
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm"
          }
        ]
      },
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
      layers: [
        new ScatterplotLayer({
          id: "founder-location-layer",
          data: [{ position: [founderLocation.lng, founderLocation.lat], city: founderLocation.city }],
          getPosition: (item: { position: [number, number] }) => item.position,
          getFillColor: [17, 32, 59, 220],
          getRadius: 140,
          radiusUnits: "meters"
        }),
        new IconLayer<ResourceCardData>({
          id: "recommended-resources-layer",
          data: resources,
          getPosition: (resource) => [resource.lng, resource.lat],
          getIcon: () => ({
            url:
              "data:image/svg+xml;charset=utf-8," +
              encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#11203b"/><circle cx="32" cy="32" r="14" fill="#ff7a1a"/></svg>'),
            width: 64,
            height: 64,
            anchorY: 32
          }),
          sizeScale: 0.7,
          getSize: (resource) => (recommendedIds.has(resource.id) ? 54 : 36),
          getColor: (resource) => categoryColors[resource.category] ?? [15, 106, 116, 220],
          pickable: true
        }),
        new TextLayer<ResourceCardData>({
          id: "resource-label-layer",
          data: resources.filter((resource) => recommendedIds.has(resource.id)),
          getPosition: (resource) => [resource.lng, resource.lat],
          getText: (resource) => resource.name,
          getColor: [17, 32, 59, 220],
          getSize: 14,
          getTextAnchor: "start",
          getAlignmentBaseline: "center",
          getPixelOffset: [18, -12]
        }),
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
  }, [resources, recommendations, route, founderLocation.city, founderLocation.lat, founderLocation.lng, recommendedIds]);

  return <div ref={mapRef} className="h-[420px] w-full overflow-hidden rounded-[28px]" />;
}
