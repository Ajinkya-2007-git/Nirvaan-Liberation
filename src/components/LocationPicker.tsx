// Tap-to-place map used by the Request Help form and by the admin's area allocation.
// Shows a teal pin you can tap, drag or place from "Use current location", and (optionally)
// a dashed circle for a coverage radius. Captions live in the pages that use it.
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Roughly the centre of Gujarat: where the map starts before a spot is chosen.
const DEFAULT_CENTER: [number, number] = [22.2587, 71.1924];

// A round teal pin with a white centre (drawn with HTML/CSS, so no image files needed).
const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50%;background:#0f7c7c;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:#fff"></div></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

interface LocationPickerProps {
  value: { lat: number; lng: number } | null; // current pin, or null if none yet
  onChange: (lat: number, lng: number) => void; // called whenever the pin moves
  radiusKm?: number; // optional: draws a coverage circle around the pin
  className?: string; // height/size classes (default: a comfortable block)
}

// Listens for taps on the map and reports their coordinates.
function ClickToPlacePin({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Brings the pin into view (and zooms in) when it's placed far away or while zoomed far out,
// e.g. after "Use current location".
function Recenter({ value }: { value: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!value) return;
    const point = L.latLng(value.lat, value.lng);
    if (map.getZoom() < 11 || !map.getBounds().contains(point)) {
      map.setView(point, Math.max(map.getZoom(), 13));
    }
  }, [value, map]);
  return null;
}

export function LocationPicker({ value, onChange, radiusKm, className = 'h-72' }: LocationPickerProps) {
  return (
    // "isolate" keeps the map's internal layers from floating above the sticky header.
    <div className={`relative isolate w-full overflow-hidden ${className}`}>
      <MapContainer center={DEFAULT_CENTER} zoom={7} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const pos = e.target.getLatLng();
                onChange(pos.lat, pos.lng);
              },
            }}
          />
        )}

        {value && radiusKm && radiusKm > 0 && (
          <Circle
            center={[value.lat, value.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#2fb0ac', fillColor: '#2fb0ac', fillOpacity: 0.1, weight: 1.5, dashArray: '6 4' }}
          />
        )}

        <ClickToPlacePin onChange={onChange} />
        <Recenter value={value} />
      </MapContainer>
    </div>
  );
}
