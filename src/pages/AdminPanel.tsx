// The ADMIN-ONLY panel. This is the one place in the whole app
// where a responder can actually be assigned to a request — moved
// out of the public map so a random volunteer (or the person who
// submitted the SOS) can never self-assign or assign someone else.
// Right now "nearby volunteers, closest first" is a simple distance
// sort; once the AI classification edge function exists, this is
// also where its category/urgency/suggested-responder output will
// show up for the admin to approve — the admin stays the one
// authority who decides, the AI only suggests.

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { requestIcon, volunteerIcon, ngoIcon } from '../lib/mapIcons';
import { distanceKm } from '../lib/distance';
import { Header } from '../components/Header';
import { UrgencyFilterBar, type UrgencyFilterKey } from '../components/UrgencyFilterBar';
import type { SosRequest, VolunteerProfile, Ngo, NgoAreaAssignment } from '../lib/types';

const DEFAULT_CENTER: [number, number] = [22.2587, 71.1924];

export function AdminPanel() {
  const navigate = useNavigate();

  // "checking" = still verifying who's logged in, "true"/"false" =
  // confirmed. Nothing below renders until this resolves, so a
  // non-admin never sees so much as a flash of this page's contents.
  const [authorized, setAuthorized] = useState<'checking' | true | false>('checking');

  const [requests, setRequests] = useState<SosRequest[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [areaAssignments, setAreaAssignments] = useState<NgoAreaAssignment[]>([]);
  const [selected, setSelected] = useState<SosRequest | null>(null);
  const [activeUrgencies, setActiveUrgencies] = useState<Set<UrgencyFilterKey>>(
    new Set(['critical', 'high', 'medium', 'low', 'unclassified'])
  );

  const ALL_URGENCY_KEYS: UrgencyFilterKey[] = ['critical', 'high', 'medium', 'low', 'unclassified'];

  function toggleUrgency(key: UrgencyFilterKey) {
    setActiveUrgencies((current) => {
      // Same fix as Map.tsx: clicking a chip while everything is
      // showing now ISOLATES to just that category, instead of
      // hiding whatever you clicked. See Map.tsx's comment for the
      // full reasoning.
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
      return next.size === 0 ? new Set(ALL_URGENCY_KEYS) : next;
    });
  }
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // THE ACTUAL GATE. Checks who's logged in, looks up their role in
  // profiles, and only lets them stay if role === 'admin'. Anyone
  // else — logged out, a volunteer, an NGO — gets sent home.
  useEffect(() => {
    async function checkAdmin() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setAuthorized(false);
        navigate('/');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single();

      if (profile?.role === 'admin') {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        navigate('/');
      }
    }
    checkAdmin();
  }, [navigate]);

  useEffect(() => {
    // Don't bother loading any data until we know this person is
    // actually allowed to see it.
    if (authorized !== true) return;

    async function loadInitialData() {
      const { data: requestData } = await supabase.from('sos_requests').select('*');
      if (requestData) setRequests(requestData);
      const { data: volunteerData } = await supabase.from('volunteer_profiles').select('*').eq('available', true);
      if (volunteerData) setVolunteers(volunteerData);
      // Only approved NGOs are assignable — same status check the
      // rest of the app already relies on (see schema.sql's "anyone
      // can view approved ngos" policy, which is what allows this
      // select to actually return rows).
      const { data: ngoData } = await supabase.from('ngos').select('*').eq('status', 'approved');
      if (ngoData) setNgos(ngoData);
      const { data: areaData } = await supabase.from('ngo_area_assignments').select('*');
      if (areaData) setAreaAssignments(areaData);
    }
    loadInitialData();

    const channel = supabase
      .channel('admin-map')
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ngos' }, (payload) => {
        setNgos((current) => {
          if (payload.eventType === 'INSERT') return [...current, payload.new as Ngo];
          if (payload.eventType === 'UPDATE') return current.map((n) => (n.id === payload.new.id ? (payload.new as Ngo) : n));
          if (payload.eventType === 'DELETE') return current.filter((n) => n.id !== payload.old.id);
          return current;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authorized]);

  // Bug fix: this used to only ever look at volunteers, which is
  // why NGOs never showed up as assignable. Now it builds one
  // combined, distance-sorted list out of BOTH available volunteers
  // AND approved NGOs, each tagged with which kind it is so the
  // assign button knows what to write to assigned_responder_type.
  const nearbyResponders = selected
    ? [
        ...volunteers.map((v) => ({
          id: v.id,
          type: 'volunteer' as const,
          name: v.full_name ?? 'Volunteer',
          detail: v.skills.join(', ') || 'no skills listed',
          km: v.latitude && v.longitude ? distanceKm(selected.latitude, selected.longitude, v.latitude, v.longitude) : Infinity,
        })),
        ...ngos.map((n) => ({
          id: n.id,
          type: 'ngo' as const,
          name: n.org_name,
          detail: n.resources_available || 'no resources listed',
          km: n.latitude && n.longitude ? distanceKm(selected.latitude, selected.longitude, n.latitude, n.longitude) : Infinity,
        })),
      ]
        .sort((a, b) => a.km - b.km)
        .slice(0, 6)
    : [];

  async function assignResponder(responderId: string, responderType: 'volunteer' | 'ngo') {
    if (!selected) return;
    setAssigning(true);
    setAssignError('');

    const { error: updateError } = await supabase
      .from('sos_requests')
      .update({
        status: 'assigned',
        assigned_responder_id: responderId,
        assigned_responder_type: responderType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    if (updateError) {
      setAssigning(false);
      setAssignError(`Could not assign: ${updateError.message}`);
      return;
    }

    await supabase.from('assignments').insert({
      sos_request_id: selected.id,
      responder_id: responderId,
      responder_type: responderType,
    });

    setAssigning(false);
    // Bug fix: previously we closed the panel here (setSelected(null))
    // but that was the whole problem — closing it meant the NEXT time
    // this same pin got clicked, `selected` was rebuilt from the
    // `requests` array using data that hadn't caught up yet for a
    // moment, and the assign UI would flash back before the realtime
    // update landed. Updating `selected` directly and immediately
    // (instead of closing it) means the "already assigned" state
    // below renders instantly, with no flash back to assignable.
    setSelected((current) => (current ? { ...current, status: 'assigned', assigned_responder_id: responderId, assigned_responder_type: responderType } : current));
  }

  // Nothing renders until the role check finishes — this is what
  // stops a non-admin from ever seeing this page's contents, even
  // for a split second.
  if (authorized !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <p className="text-muted">Checking access...</p>
      </div>
    );
  }

  // Same filtering logic as the public Map page — an unclassified
  // request (urgency still null) is matched against the
  // 'unclassified' key so it behaves exactly the way it visually
  // reads (hide "Unclassified" → the black pins disappear).
  const visibleRequests = requests.filter((r) => activeUrgencies.has((r.urgency ?? 'unclassified') as UrgencyFilterKey));

  return (
    <div className="flex h-screen w-screen flex-col overflow-x-hidden bg-ink">
      <Header />
      <UrgencyFilterBar active={activeUrgencies} onToggle={toggleUrgency} />
      <div className="flex items-center justify-end border-b border-hairline bg-panel px-6 py-2">
        <Link to="/admin/ngos" className="text-sm text-signal hover:underline">
          NGO approvals →
        </Link>
      </div>
      <div className="relative flex-1">
        <MapContainer center={DEFAULT_CENTER} zoom={7} style={{ height: '100%', width: '100%' }}>
          {/* Standard OpenStreetMap tiles — same reasoning as
              Map.tsx: a dark basemap looked nicer but hid hospital
              icons and named landmarks, and hit a zoom ceiling on
              its free tier. Real place detail matters more here than
              matching the dark theme. */}
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

          {/* Same area-assignment circles as the public map — the
              admin who created these obviously already knows what
              they are, but seeing them drawn out spatially still
              helps when deciding whether a NEW area assignment would
              overlap with one that already exists. */}
          {areaAssignments.map((area) => {
            const ngo = ngos.find((n) => n.id === area.ngo_id);
            return (
              <Circle
                key={area.id}
                center={[area.center_lat, area.center_lng]}
                radius={area.radius_km * 1000}
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

        {selected && (
          <div className="fixed right-0 top-0 z-[1000] h-full w-80 overflow-y-auto border-l border-hairline bg-panel p-5 shadow-lg">
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
              {selected.reporter_phone && (
                <div>
                  <dt className="inline text-muted">Phone: </dt>
                  <dd className="inline font-data text-paper">{selected.reporter_phone}</dd>
                </div>
              )}
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

            <h3 className="mt-6 text-sm font-semibold text-paper">
              {selected.status === 'pending' ? 'Nearby available responders' : 'Assignment'}
            </h3>

            {/* This is the actual fix for "I can still assign someone
                after already assigning someone" — the old code only
                ever showed this section unconditionally. Now it only
                renders the assignable list when the request is still
                'pending'; anything already assigned shows a plain
                status line instead, with no way to reassign from here. */}
            {selected.status === 'pending' ? (
              <>
                {nearbyResponders.length === 0 && <p className="mt-2 text-sm text-muted">None found nearby yet.</p>}
                <ul className="mt-2 space-y-2">
                  {nearbyResponders.map((r) => (
                    <li key={`${r.type}-${r.id}`} className="flex items-center justify-between rounded-md border border-hairline p-2">
                      <div>
                        <p className="text-sm font-medium text-paper">
                          {r.name} <span className="text-xs text-muted">({r.type === 'ngo' ? 'NGO' : 'Volunteer'})</span>
                        </p>
                        <p className="font-data text-xs text-muted">
                          {r.km.toFixed(1)} km away · {r.detail}
                        </p>
                      </div>
                      <button
                        onClick={() => assignResponder(r.id, r.type)}
                        disabled={assigning}
                        className="rounded-md bg-signal px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        Assign
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 rounded-md border border-hairline bg-ink p-3 text-sm text-muted">
                {/* Note: this box now uses solid bg-ink (pure white)
                    instead of the old bg-ink/40 — that translucent
                    version was tuned for the previous near-black
                    theme, where it created a subtly darker recessed
                    box. On the new white/light theme, a translucent
                    white over an already-light panel background was
                    nearly invisible; a solid white box against the
                    slightly-tinted panel behind it reads clearly. */}
                {/* Grammar bug fixed here: the old version always
                    said "assigned as a" and then appended either "an
                    NGO" or "a volunteer" after it, producing "assigned
                    as a an NGO" — the article now lives entirely
                    inside one string per status, so there's only ever
                    one determiner, never two. */}
                {selected.status === 'assigned' &&
                  (selected.assigned_responder_type === 'ngo' ? 'Assigned to an NGO.' : 'Assigned to a volunteer.')}
                {selected.status === 'en_route' &&
                  (selected.assigned_responder_type === 'ngo' ? 'An NGO is en route.' : 'A volunteer is en route.')}
                {selected.status === 'resolved' && 'Resolved.'}
              </p>
            )}

            {assignError && <p className="mt-3 text-sm text-red-400">{assignError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
