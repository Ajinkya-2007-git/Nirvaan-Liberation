// This component shows an interactive map and lets the user place
// a pin on it. It's used inside the Request Help form so someone
// can mark exactly where the person in need is located.

import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';

// Leaflet's default marker icon is broken out of the box when used
// with a bundler like Vite — the image file paths it expects don't
// match how Vite packages files. These three lines fix that by
// manually pointing Leaflet at the correct icon image files.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
// @ts-expect-error — this internal method exists at runtime but Leaflet's
// own TypeScript types don't declare it, so TypeScript doesn't know about it.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Leaflet's own CSS — without this the map renders as a broken,
// unstyled mess of grey tiles.
import 'leaflet/dist/leaflet.css';

// Roughly the center of Gujarat, India — used as the map's starting
// point before the user has picked a location.
const DEFAULT_CENTER: [number, number] = [22.2587, 71.1924];

interface LocationPickerProps {
  // The pin's current position. "null" means no pin placed yet.
  value: { lat: number; lng: number } | null;
  // Called every time the user moves the pin, so the parent form
  // (RequestHelp.tsx) can save the new coordinates into its state.
  onChange: (lat: number, lng: number) => void;
  // Optional — when provided, draws a live circle around the pin at
  // this radius (in km), so whoever's placing a point can actually
  // SEE the coverage area instead of just picking blind coordinates.
  // Existing callers (like RequestHelp.tsx) that don't pass this are
  // unaffected — no circle renders at all without it.
  radiusKm?: number;
}

// A small helper component that listens for map clicks. It has to
// be its OWN component (not just code inside LocationPicker) because
// react-leaflet's useMapEvents hook only works for components that
// are rendered INSIDE a MapContainer.
function ClickToPlacePin({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    // Whenever the user clicks anywhere on the map, grab the
    // coordinates of that exact spot and pass them up.
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  // This component doesn't draw anything itself — it only listens.
  return null;
}

export function LocationPicker({ value, onChange, radiusKm }: LocationPickerProps) {
  const { t } = useTranslation();
  // Tracks whether the user has interacted with the map yet, purely
  // so we can show a helpful hint message until they do.
  const [hasInteracted, setHasInteracted] = useState(false);

  const position = value ?? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };

  return (
    <div>
      <div className="h-72 w-full overflow-hidden rounded-lg border border-hairline">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={7}
          // Fills the entire height/width of the parent div above.
          style={{ height: '100%', width: '100%' }}
        >
          {/* Standard OpenStreetMap tiles — switched back from a
              dark CARTO basemap after discovering it doesn't render
              hospital icons, named landmarks, or other POI labels at
              all (it's a deliberately simplified style), and has a
              zoom ceiling that shows an "API key required" tile past
              a certain level on the free tier. For a form where
              someone needs to precisely mark a real location, seeing
              actual landmarks matters more than matching the dark
              theme exactly — a bright map here is the right
              trade-off, not a leftover bug. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Only show a pin once the user has actually picked a spot. */}
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              // Lets the user fine-tune the pin by dragging it after placing it.
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const newPos = marker.getLatLng();
                  onChange(newPos.lat, newPos.lng);
                  setHasInteracted(true);
                },
              }}
            />
          )}

          {/* Live radius preview — only draws when a caller actually
              passes radiusKm (see AdminNgoApprovals.tsx for the one
              place that does). Lets an admin literally see the
              coverage area while adjusting the radius, instead of
              guessing from a number alone. */}
          {value && radiusKm && radiusKm > 0 && (
            <Circle
              center={[value.lat, value.lng]}
              radius={radiusKm * 1000}
              pathOptions={{ color: '#2fb0ac', fillColor: '#2fb0ac', fillOpacity: 0.1, weight: 1.5, dashArray: '6 4' }}
            />
          )}

          <ClickToPlacePin
            onChange={(lat, lng) => {
              onChange(lat, lng);
              setHasInteracted(true);
            }}
          />
        </MapContainer>
      </div>

      {/* A hint that disappears once the user has actually placed a pin. */}
      {!hasInteracted && (
        <p className="mt-2 text-sm text-muted">
          {t('requestHelp.mapHint')}
        </p>
      )}

      {/* Show the exact coordinates once picked — reassures the user
          something real was captured, and is handy for you to see
          while testing. */}
      {value && (
        <p className="mt-1 font-data text-xs text-muted">
          {t('requestHelp.locationSet')}: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
