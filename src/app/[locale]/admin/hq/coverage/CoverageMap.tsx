'use client';

import type * as Leaflet from 'leaflet';
import { useEffect, useRef, useState } from 'react';


import 'leaflet/dist/leaflet.css';

// R9 HQ — Coverage map (client). Leaflet + OpenStreetMap raster tiles (free,
// keyless, attribution displayed — OSM policy comfortably covers a two-person
// admin tool). Polygons are the raw stored ORS GeoJSON; per-cleaner toggle is
// layer add/remove; union shading is turf union over the visible set; tap →
// her card in a popup. Leaflet and turf are dynamically imported so this
// admin-only weight never rides any public bundle.

interface CoverageCleaner {
  userId: string;
  name: string;
  rating: number;
  serviceTypes: string[];
  maxTravelMinutes: number | null;
  homePostcode: string | null;
  visibleInDirectory: boolean;
  verified: boolean;
  generatedAt: string | null;
  polygon: unknown;
}

interface CoverageArea {
  slug: string;
  name: string;
  outcode: string;
  lat: number | null;
  lng: number | null;
  covered: boolean | null;
}

interface CoverageData {
  cleaners: CoverageCleaner[];
  areas: CoverageArea[];
  gaps: string[];
}

const PALETTE = ['#16296b', '#0E7490', '#7C3AED', '#B45309', '#0F766E', '#BE123C', '#4338CA'];

export default function CoverageMap() {
  const mapEl = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CoverageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [unionOn, setUnionOn] = useState(true);
  // Leaflet handles kept in refs — the map object never re-renders React.
  const leafletRef = useRef<{
    map: Leaflet.Map;
    L: typeof Leaflet;
    layers: Map<string, Leaflet.GeoJSON>;
    unionLayer: Leaflet.GeoJSON | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/hq/coverage');
        if (!res.ok) throw new Error(`coverage data ${res.status}`);
        const d: CoverageData = await res.json();
        if (cancelled) return;
        setData(d);
        setVisible(Object.fromEntries(d.cleaners.map((c) => [c.userId, true])));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mount the map once data lands.
  useEffect(() => {
    if (!data || !mapEl.current || leafletRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapEl.current) return;
      const map = L.map(mapEl.current).setView([51.6, 0.02], 11); // NE London home turf
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const layers = new Map<string, L.GeoJSON>();
      data.cleaners.forEach((c, i) => {
        const color = PALETTE[i % PALETTE.length];
        const layer = L.geoJSON(c.polygon as GeoJSON.GeoJsonObject, {
          style: { color, weight: 2, fillColor: color, fillOpacity: 0.08 },
        });
        layer.bindPopup(
          `<div style="font-family:Jost,sans-serif;min-width:180px">
             <p style="margin:0;font-weight:600;color:#16296b">${escapeHtml(c.name)}</p>
             <p style="margin:4px 0 0;font-size:12px;color:#3D5170">
               ★ ${c.rating.toFixed(2)} · ${c.verified ? 'verified' : 'unverified'} ·
               ${c.visibleInDirectory ? 'visible' : 'hidden'}</p>
             <p style="margin:4px 0 0;font-size:12px;color:#3D5170">
               ${escapeHtml(c.serviceTypes.join(', ') || 'no services listed')}</p>
             <p style="margin:4px 0 0;font-size:12px;color:#3D5170">
               Catchment: ${c.maxTravelMinutes ?? '—'} min from ${escapeHtml(c.homePostcode ?? '—')}</p>
           </div>`
        );
        layer.addTo(map);
        layers.set(c.userId, layer);
      });

      // Area centroid pins: covered = navy dot, gap = red ring.
      data.areas.forEach((a) => {
        if (typeof a.lat !== 'number' || typeof a.lng !== 'number') return;
        L.circleMarker([a.lat, a.lng], {
          radius: 6,
          color: a.covered === false ? '#DC2626' : '#16296b',
          weight: 2,
          fillColor: a.covered === false ? '#FEE2E2' : '#16296b',
          fillOpacity: a.covered === false ? 0.9 : 0.7,
        })
          .bindTooltip(`${a.name} (${a.outcode})${a.covered === false ? ' — GAP' : ''}`)
          .addTo(map);
      });

      leafletRef.current = { map, L, layers, unionLayer: null };
      await redrawUnion(true);
    })();
    return () => {
      cancelled = true;
      leafletRef.current?.map.remove();
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function redrawUnion(on: boolean) {
    const lr = leafletRef.current;
    if (!lr || !data) return;
    if (lr.unionLayer) {
      lr.map.removeLayer(lr.unionLayer);
      lr.unionLayer = null;
    }
    if (!on) return;
    try {
      const { union } = await import('@turf/union');
      const { featureCollection } = await import('@turf/helpers');
      const { extractFeature } = await import('./extract-feature');
      const feats = data.cleaners
        .filter((c) => visibleRef.current[c.userId] !== false)
        .map((c) => extractFeature(c.polygon))
        .filter((f): f is GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> => f !== null);
      if (feats.length === 0) return;
      let merged: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null = null;
      if (feats.length === 1) {
        merged = feats[0];
      } else {
        merged = union(featureCollection(feats));
      }
      if (!merged) return;
      lr.unionLayer = lr.L.geoJSON(merged, {
        style: { color: '#16296b', weight: 0, fillColor: '#16296b', fillOpacity: 0.12 },
        interactive: false,
      }).addTo(lr.map);
    } catch {
      // union shading is decoration — a bad geometry never breaks the room
    }
  }

  // visible state also needed inside async closures
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  function toggleCleaner(userId: string) {
    const lr = leafletRef.current;
    const next = { ...visible, [userId]: !(visible[userId] !== false) };
    setVisible(next);
    visibleRef.current = next;
    if (lr) {
      const layer = lr.layers.get(userId);
      if (layer) {
        if (next[userId]) layer.addTo(lr.map);
        else lr.map.removeLayer(layer);
      }
    }
    void redrawUnion(unionOn);
  }

  function toggleUnion() {
    const next = !unionOn;
    setUnionOn(next);
    void redrawUnion(next);
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#E4E9F0] bg-white p-6 text-sm font-light text-red-600">
        Coverage data failed to load ({error}). Refresh to retry.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={mapEl}
        className="h-[60vh] min-h-[380px] w-full overflow-hidden rounded-2xl border border-[#E4E9F0] bg-white"
      />
      {!data && <p className="text-sm font-light text-[#8A97AB]">Loading coverage…</p>}
      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#E4E9F0] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8A97AB]">
                Cleaners on the map
              </p>
              <label className="flex items-center gap-2 text-xs font-light text-[#3D5170]">
                <input type="checkbox" checked={unionOn} onChange={toggleUnion} />
                union shading
              </label>
            </div>
            {data.cleaners.length === 0 ? (
              <p className="mt-2 text-sm font-light text-[#8A97AB]">
                No live catchment polygons yet — polygons mint when a cleaner sets her home
                postcode and travel time (ORS generation).
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.cleaners.map((c, i) => (
                  <li key={c.userId} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={visible[c.userId] !== false}
                      onChange={() => toggleCleaner(c.userId)}
                    />
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="text-sm font-light text-[#3D5170]">
                      {c.name} · ★ {c.rating.toFixed(2)} · {c.maxTravelMinutes ?? '—'} min
                      {!c.visibleInDirectory && (
                        <span className="ml-1 text-[10px] uppercase text-[#8A97AB]">hidden</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-[#E4E9F0] bg-white p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8A97AB]">
              Gap areas — the ad-targeting list
            </p>
            {data.gaps.length === 0 ? (
              <p className="mt-2 text-sm font-light text-[#3D5170]">
                Every served area&apos;s centroid falls inside at least one live catchment.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {data.gaps.map((g) => (
                  <li key={g} className="flex items-center gap-2 text-sm font-light text-[#3D5170]">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                    {g}
                  </li>
                ))}
              </ul>
            )}
            {data.areas.some((a) => a.covered === null) && (
              <p className="mt-3 text-[11px] font-light italic text-[#8A97AB]">
                Areas marked unknown (centroid lookup unavailable) are excluded from the gap list
                rather than guessed.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
