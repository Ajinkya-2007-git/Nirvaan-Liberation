// The PUBLIC live map — anyone (including a person who just
// submitted an SOS, or a logged-in volunteer) can view it. It shows
// every request and volunteer as a pin and lets you click a request
// to see read-only details. It deliberately does NOT let anyone
// assign a volunteer to a request — that decision now belongs
// exclusively to the admin panel (see AdminPanel.tsx), so that two
// different responders can't both act on the same request at once,
// and so assignment always goes through one authority instead of a
// free-for-all.

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { requestIcon, volunteerIcon, ngoIcon } from '../lib/mapIcons';
import { Header } from '../components/Header';
import { UrgencyFilterBar, type UrgencyFilterKey } from '../components/UrgencyFilterBar';
import { PhoneActions } from '../components/PhoneActions';
import { timeAgo } from '../lib/timeAgo';
import type { SosRequest, VolunteerProfile, Ngo, NgoAreaAssignment } from '../lib/types';

const DEFAULT_CENTER: [number, number] = [22.2587, 71.1924]; // Gujarat, India

// Same colors as mapIcons.ts uses for pins, reused here for a small
// text badge on each assignment card — so "red" means the exact
// same thing on the card as it does on the map itself.
const URGENCY_BADGE: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#dc2626' },
  high: { label: 'High', color: '#ea580c' },
  medium: { label: 'Medium', color: '#eab308' },
  low: { label: 'Low', color: '#fef08a' },
};

export function Map() {
  const [requests, setRequests] = useState<SosRequest[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [areaAssignments, setAreaAssignments] = useState<NgoAreaAssignment[]>([]);
  const [selected, setSelected] = useState<SosRequest | null>(null);
  // Whoever is currently logged in, if anyone — this is what lets us
  // work out "which requests are assigned to ME specifically" below.
  // Stays null for a logged-out visitor, which is fine: the "Your
  // assignments" panel simply never renders for them.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Starts collapsed on purpose — this panel used to always render
  // full-size with no way to dismiss it, which on a phone screen
  // meant it could take up most of the visible map with no way to
  // see what's underneath. A small pill button is shown instead
  // until someone taps it open.
  const [assignmentsPanelOpen, setAssignmentsPanelOpen] = useState(false);
  // All five categories start visible — someone opens the filter
  // bar to HIDE noise they don't care about, not to discover pins
  // that were invisible by default.
  const [activeUrgencies, setActiveUrgencies] = useState<Set<UrgencyFilterKey>>(
    new Set(['critical', 'high', 'medium', 'low', 'unclassified'])
  );

  const ALL_URGENCY_KEYS: UrgencyFilterKey[] = ['critical', 'high', 'medium', 'low', 'unclassified'];

  function toggleUrgency(key: UrgencyFilterKey) {
    setActiveUrgencies((current) => {
      // Fixed behavior: clicking a chip while EVERYTHING is showing
      // now ISOLATES to just that one category (so clicking
      // "Critical" shows ONLY critical pins) — the opposite of the
      // old behavior, which removed whatever you clicked and left
      // everything else visible. Once you've isolated one, clicking
      // another chip ADDS it alongside (multi-select), so you can
      // still build up "critical + high" together if you want.
      const isShowingEverything = current.size === ALL_URGENCY_KEYS.length;
      if (isShowingEverything) {
        return new Set([key]);
      }

      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      // Never leave the map with literally nothing visible — that
      // reads as "broken," not "filtered." Falling back to "show
      // everything" is a safer empty state than a blank map.
      return next.size === 0 ? new Set(ALL_URGENCY_KEYS) : next;
    });
  }
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    async function loadInitialData() {
      const { data: requestData } = await supabase.from('sos_requests').select('*');
      if (requestData) setRequests(requestData);

      const { data: volunteerData } = await supabase.from('volunteer_profiles').select('*').eq('available', true);
      if (volunteerData) setVolunteers(volunteerData);
      const { data: ngoData } = await supabase.from('ngos').select('*').eq('status', 'approved');
      if (ngoData) setNgos(ngoData);
      const { data: areaData } = await supabase.from('ngo_area_assignments').select('*');
      if (areaData) setAreaAssignments(areaData);
    }
    loadInitialData();

    const channel = supabase
      .channel('live-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_requests' }, (payload) => {
        setRequests((current) => {
          if (payload.eventType === 'INSERT') return [...current, payload.new as SosRequest];
          if (payload.eventType === 'UPDATE') return current.map((r) => (r.id === payload.new.id ? (payload.new as SosRequest) : r));
          if (payload.eventType === 'DELETE') return current.filter((r) => r.id !== payload.old.id);
          return current;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volunteer_profiles' }, (payload) => {
        setVolunteers((current) => {
          if (payload.eventType === 'INSERT') return [...current, payload.new as VolunteerProfile];
          if (payload.eventType === 'UPDATE') return current.map((v) => (v.id === payload.new.id ? (payload.new as VolunteerProfile) : v));
          if (payload.eventType === 'DELETE') return current.filter((v) => v.id !== payload.old.id);
          return current;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Derived, not fetched separately — `requests` already holds every
  // SOS request (see loadInitialData above), so this just filters
  // down to the ones assigned to whoever is currently logged in. It
  // stays in sync automatically whenever the realtime subscription
  // above updates `requests`, with no extra query needed.
  const myAssignments = currentUserId ? requests.filter((r) => r.assigned_responder_id === currentUserId) : [];

  // If the logged-in person is an NGO with an area assignment, this
  // finds it — for a volunteer (or anyone without one), this is
  // just an empty array, so the section below simply doesn't render.
  const myAreaAssignments = currentUserId ? areaAssignments.filter((a) => a.ngo_id === currentUserId) : [];

  async function updateMyRequestStatus(requestId: string, status: 'en_route' | 'resolved') {
    setUpdatingStatus(requestId);
    await supabase.from('sos_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', requestId);
    setUpdatingStatus(null);
  }

  // The actual filtering — a request with no urgency yet (still
  // black/unclassified) is matched against the 'unclassified' key
  // specifically, so hiding "Unclassified" behaves exactly the way
  // it visually reads: the black pins disappear.
  const visibleRequests = requests.filter((r) => activeUrgencies.has((r.urgency ?? 'unclassified') as UrgencyFilterKey));

  return (
    // overflow-x-hidden here is a defensive fix for the panel
    // rendering off-screen: Leaflet's map internals can sometimes
    // report a width slightly wider than the visible viewport,
    // which pushed our old "absolute right-0" panel out past the
    // edge of the screen. This guarantees nothing in this page can
    // ever cause horizontal scroll in the first place.
    <div className="flex h-screen w-screen flex-col overflow-x-hidden bg-ink">
      <Header />
      <UrgencyFilterBar active={activeUrgencies} onToggle={toggleUrgency} />
      <div className="relative flex-1">
        <MapContainer center={DEFAULT_CENTER} zoom={7} style={{ height: '100%', width: '100%' }}>
          {/* Standard OpenStreetMap tiles — reverted from a dark
              CARTO basemap, which doesn't render hospital icons or
              named landmarks and has a zoom ceiling on its free tier
              (past which it shows an "API key required" placeholder).
              A responder navigating to a real location needs to see
              real landmarks more than the map needs to match the
              dark theme exactly. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {visibleRequests.map((r) => (
            <Marker
              key={r.id}
              position={[r.latitude, r.longitude]}
              icon={requestIcon(r.urgency)}
              zIndexOffset={1000}
              eventHandlers={{ click: () => setSelected(r) }}
            >
              <Popup>
                <strong>{r.description.slice(0, 40)}</strong>
                <br />
                Status: {r.status}
              </Popup>
            </Marker>
          ))}

          {volunteers.map(
            (v) =>
              v.latitude &&
              v.longitude && (
                <Marker key={v.id} position={[v.latitude, v.longitude]} icon={volunteerIcon()}>
                  <Popup>
                    <strong>{v.full_name ?? 'Volunteer'}</strong>
                    <br />
                    Skills: {v.skills.join(', ') || 'none listed'}
                  </Popup>
                </Marker>
              )
          )}

          {ngos.map(
            (n) =>
              n.latitude &&
              n.longitude && (
                <Marker key={n.id} position={[n.latitude, n.longitude]} icon={ngoIcon()}>
                  <Popup>
                    <strong>{n.org_name}</strong>
                  </Popup>
                </Marker>
              )
          )}

          {/* Area assignments — drawn as circles so anyone (a
              requester, a volunteer, another NGO, or the assigned
              NGO themselves) can see at a glance which NGO is
              responsible for which neighborhood. A lookup against
              the `ngos` array turns the raw ngo_id into an actual
              name for the popup, since the assignment row itself
              only stores the id. */}
          {areaAssignments.map((area) => {
            const ngo = ngos.find((n) => n.id === area.ngo_id);
            return (
              <Circle
                key={area.id}
                center={[area.center_lat, area.center_lng]}
                radius={area.radius_km * 1000} // Leaflet expects meters, we store km
                pathOptions={{ color: '#2fb0ac', fillColor: '#2fb0ac', fillOpacity: 0.08, weight: 1.5, dashArray: '6 4' }}
              >
                <Popup>
                  <strong>{area.area_name || ngo?.org_name || 'NGO area'}</strong>
                  <br />
                  {ngo?.org_name ?? 'NGO'}
                  <br />
                  {area.radius_km} km radius
                  {area.category ? ` · ${area.category}` : ''}
                  {area.urgency ? ` · ${area.urgency}` : ''}
                </Popup>
              </Circle>
            );
          })}
        </MapContainer>

        {/* "Your assignments" — only appears at all if this logged-in
            person actually has something assigned to them (an
            individual request, an area, or both). This is the
            direct answer to "volunteers/NGOs can't see what they're
            assigned to": it's always visible on the map they already
            land on after logging in. */}
        {(myAssignments.length > 0 || myAreaAssignments.length > 0) && !assignmentsPanelOpen && (
          <button
            onClick={() => setAssignmentsPanelOpen(true)}
            className="fixed left-4 top-20 z-[900] rounded-full border border-hairline bg-panel px-4 py-2 text-sm font-medium text-paper shadow-lg"
          >
            Your assignments ({myAssignments.length + myAreaAssignments.length}) ▾
          </button>
        )}

        {(myAssignments.length > 0 || myAreaAssignments.length > 0) && assignmentsPanelOpen && (
          <div className="fixed left-4 top-20 z-[900] max-h-[70vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-hairline bg-panel p-4 shadow-lg sm:w-80">
            <button
              onClick={() => setAssignmentsPanelOpen(false)}
              className="mb-2 text-sm text-muted hover:text-paper"
            >
              ▲ Hide
            </button>
            {myAreaAssignments.length > 0 && (
              <div className="mb-4">
                <h3 className="font-display text-sm font-semibold text-paper">Your assigned area</h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {myAreaAssignments.map((area) => (
                    <li key={area.id} className="rounded-md border border-hairline p-3">
                      <p className="text-sm font-semibold text-paper">{area.area_name || 'Unnamed area'}</p>
                      <p className="mt-1 font-data text-xs text-muted">
                        {area.radius_km} km radius · center {area.center_lat.toFixed(4)}, {area.center_lng.toFixed(4)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Category: {area.category ? area.category.charAt(0).toUpperCase() + area.category.slice(1) : 'Any'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Urgency: {area.urgency ? area.urgency.charAt(0).toUpperCase() + area.urgency.slice(1) : 'Any'}
                      </p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${area.center_lat},${area.center_lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-medium text-signal hover:underline"
                      >
                        Get directions to center →
                      </a>
                      <p className="mt-2 font-data text-xs text-muted">Assigned {timeAgo(area.created_at)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {myAssignments.length > 0 && (
              <>
                <h3 className="font-display text-sm font-semibold text-paper">Your assignments ({myAssignments.length})</h3>
            <ul className="mt-3 flex flex-col gap-3">
              {myAssignments.map((r) => {
                const badge = r.urgency ? URGENCY_BADGE[r.urgency] : null;
                // Google Maps accepts a plain "lat,lng" destination and
                // will figure out walking/driving directions from
                // wherever the phone opening this link currently is —
                // no API key needed for this simple a link.
                const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`;

                return (
                  <li key={r.id} className="rounded-md border border-hairline p-3">
                    {/* Urgency badge — falls back to a plain "Not yet
                        classified" note for anything the AI
                        classifier hasn't scored yet (or a Quick SOS,
                        which has no description to classify at all). */}
                    <div className="flex items-center justify-between">
                      {badge ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold text-black"
                          style={{ backgroundColor: badge.color }}
                        >
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Not yet classified</span>
                      )}
                      <span className="font-data text-xs text-muted">{timeAgo(r.created_at)}</span>
                    </div>

                    <p className="mt-2 text-sm text-paper">{r.description}</p>

                    <dl className="mt-2 space-y-0.5 text-xs">
                      <div>
                        <dt className="inline text-muted">Reporter: </dt>
                        <dd className="inline text-paper">
                          {r.reporter_name ?? 'Anonymous (Quick SOS)'}
                          {r.relationship && r.reporter_name ? ` (${r.relationship})` : ''}
                        </dd>
                      </div>
                      {r.reporter_phone && (
                        <div className="mt-1">
                          <PhoneActions phone={r.reporter_phone} />
                        </div>
                      )}
                      {r.landmark && (
                        <div>
                          <dt className="inline text-muted">Landmark: </dt>
                          <dd className="inline text-paper">{r.landmark}</dd>
                        </div>
                      )}
                    </dl>

                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-signal hover:underline"
                    >
                      Get directions →
                    </a>

                    <p className="mt-2 font-data text-xs text-muted">Status: {r.status}</p>

                    {/* Buttons only show the NEXT sensible step, not
                        every possible status — an assigned request can
                        move to "en route", and an en-route one can move
                        to "resolved", but not the other way around from
                        here. This is the "Assigned → En Route →
                        Resolved" progression from the original spec. */}
                    <div className="mt-2 flex gap-2">
                      {r.status === 'assigned' && (
                        <button
                          onClick={() => updateMyRequestStatus(r.id, 'en_route')}
                          disabled={updatingStatus === r.id}
                          className="rounded-md bg-signal px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                        >
                          Mark en route
                        </button>
                      )}
                      {r.status === 'en_route' && (
                        <button
                          onClick={() => updateMyRequestStatus(r.id, 'resolved')}
                          disabled={updatingStatus === r.id}
                          className="rounded-md bg-signal px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                        >
                          Mark resolved
                        </button>
                      )}
                      {r.status === 'resolved' && <span className="text-xs text-muted">Resolved ✓</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
              </>
            )}
          </div>
        )}

        {/* Read-only details panel. No assign button, no volunteer
            list — this view is for situational awareness only.
            "fixed" instead of the old "absolute" anchors this
            directly to the browser viewport itself, regardless of
            how any ancestor element's width gets computed — this is
            what actually fixes the panel rendering off-screen. */}
        {selected && (
          <div className="fixed right-0 top-0 z-[1000] h-full w-[calc(100vw-2rem)] overflow-y-auto border-l border-hairline bg-panel p-5 shadow-lg sm:w-80">
            <button onClick={() => setSelected(null)} className="text-sm text-muted hover:text-paper">
              ✕ Close
            </button>

            <h2 className="mt-2 font-display text-lg font-semibold text-paper">Request details</h2>
            <p className="mt-2 text-sm text-muted">{selected.description}</p>

            <dl className="mt-4 space-y-1 text-sm">
              <div>
                <dt className="inline text-muted">Reporter: </dt>
                <dd className="inline text-paper">
                  {selected.reporter_name ?? 'Anonymous (Quick SOS)'} ({selected.relationship})
                </dd>
              </div>
              {selected.landmark && (
                <div>
                  <dt className="inline text-muted">Landmark: </dt>
                  <dd className="inline text-paper">{selected.landmark}</dd>
                </div>
              )}
              <div>
                <dt className="inline text-muted">Status: </dt>
                <dd className="inline text-paper">{selected.status}</dd>
              </div>
            </dl>

            {/* bg-ink (solid white) instead of the old bg-ink/40 —
                see the matching note in AdminPanel.tsx for why the
                translucent version stopped working once the theme
                flipped from near-black to white. */}
            <p className="mt-6 rounded-md border border-hairline bg-ink p-3 text-xs text-muted">
              Assigning a responder is handled by the admin team to make sure two responders don't get sent to the same
              place.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
