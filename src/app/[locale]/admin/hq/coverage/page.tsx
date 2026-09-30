import { RoomShell } from '../HqKit';

import CoverageMap from './CoverageMap';

export const dynamic = 'force-dynamic';

// R9 HQ — Coverage room: the full-screen map (Leaflet + OSM raster tiles, no
// key, attribution displayed), every live cleaner's polygon individually
// toggleable, union shading, tap → her card, and the gap list for ad
// targeting. All interactivity lives in the client component.
export default function CoverageRoom() {
  return (
    <RoomShell
      title="Coverage"
      subtitle="Every live catchment polygon. Toggle cleaners, tap a polygon for her card. Gap areas are named below the map — that list is the ad-targeting list."
    >
      <CoverageMap />
    </RoomShell>
  );
}
