// Builds the colored circular pins used on the live map. We use
// L.divIcon (a plain HTML/CSS shape) instead of image-based icons
// because it's the easiest way to get solid, precisely-colored
// circles without needing separate image files for every color.

import L from 'leaflet';
import type { Urgency } from './types';

// Color scheme from the project spec: each urgency level gets its
// own color so a responder can tell severity apart at a glance,
// without reading every single label.
const URGENCY_COLORS: Record<Urgency, string> = {
  critical: '#dc2626', // red
  high: '#ea580c', // orange
  medium: '#eab308', // yellow
  low: '#fef08a', // pale yellow — lighter than medium, deliberately NOT green
};

// Requests that haven't been AI-classified yet (urgency is still
// null) show as black — a clear "not yet triaged" signal, distinct
// from every real urgency color.
const UNCLASSIFIED_COLOR = '#000000';
const VOLUNTEER_COLOR = '#2563eb'; // blue
const NGO_COLOR = '#16a34a'; // green — distinct from every urgency color and from volunteer blue

// The actual shape-builder. "color" in, a Leaflet icon out.
function coloredCircleIcon(color: string): L.DivIcon {
  return L.divIcon({
    // Plain inline CSS for a small circle: colored fill, white
    // border so it's visible even sitting on top of similarly
    // colored map areas, and a subtle shadow for depth.
    html: `<div style="
      background-color: ${color};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    className: '', // stops Leaflet from adding its own default icon styling on top of ours
    iconSize: [20, 20],
    // Centers the icon exactly on the coordinate, instead of the
    // top-left corner sitting on the point (Leaflet's default).
    iconAnchor: [10, 10],
  });
}

export function requestIcon(urgency: Urgency | null | undefined): L.DivIcon {
  const color = urgency ? URGENCY_COLORS[urgency] : UNCLASSIFIED_COLOR;
  return coloredCircleIcon(color);
}

export function volunteerIcon(): L.DivIcon {
  return coloredCircleIcon(VOLUNTEER_COLOR);
}

export function ngoIcon(): L.DivIcon {
  return coloredCircleIcon(NGO_COLOR);
}
