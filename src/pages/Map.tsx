// Live Map. Three columns on desktop (filters | map | request details); on phones the filters
// fold into a button above the map and the details slide up from the bottom. Real requests,
// volunteers and NGOs only load for admins, volunteers and approved NGOs; everyone else sees
// the map with a log-in prompt. Responders also get their assignments, chat and area reports here.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { X, SlidersHorizontal, ChevronDown, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { requestIcon, volunteerIcon, ngoIcon } from '../lib/mapIcons';
import { Header } from '../components/Header';
import { AdminTabs } from '../components/AdminTabs';
import { PhoneActions } from '../components/PhoneActions';
import { RequestChat } from '../components/RequestChat';
import { timeAgo } from '../lib/timeAgo';
import { useRole } from '../hooks/useRole';
import { usePlaceName } from '../hooks/usePlaceName';
import { distanceKm } from '../lib/distance';
import type { SosRequest, VolunteerProfile, Ngo, NgoAreaAssignment, Category } from '../lib/types';

const DEFAULT_CENTER: [number, number] = [22.2587, 71.1924]; // Gujarat, India

type UrgencyKey = 'critical' | 'high' | 'medium' | 'low' | 'unclassified';

// Same colours as the pins. "text" is the readable label colour on top of each colour.
const URGENCY_OPTIONS: { key: UrgencyKey; color: string; text: string }[] = [
  { key: 'critical', color: '#dc2626', text: '#ffffff' },
  { key: 'high', color: '#ea580c', text: '#000000' },
  { key: 'medium', color: '#eab308', text: '#000000' },
  { key: 'low', color: '#fef08a', text: '#000000' },
  { key: 'unclassified', color: '#111827', text: '#ffffff' },
];

const CATEGORIES: Category[] = ['medical', 'food', 'shelter', 'rescue'];

// First sentence of the description, used as a short heading.
function titleOf(description: string): string {
  const first = description.split(/[.\n!?]/)[0].trim() || description;
  return first.length > 70 ? `${first.slice(0, 67)}…` : first;
}

export function Map() {
  const { t } = useTranslation();
  const { loading: roleLoading, userId: currentUserId, canSeeData, role } = useRole();
  const isAdmin = role === 'admin';

  const [requests, setRequests] = useState<SosRequest[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [areaAssignments, setAreaAssignments] = useState<NgoAreaAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters: all on by default, so the map starts showing everything.
  const [category, setCategory] = useState<Category | ''>('');
  const [urgencies, setUrgencies] = useState<Set<UrgencyKey>>(new Set(URGENCY_OPTIONS.map((o) => o.key)));
  const [show, setShow] = useState({ requests: true, volunteers: true, ngos: true, radii: true });
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Responder panel state.
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [chatOpenFor, setChatOpenFor] = useState<string | null>(null);
  const [reportingAreaId, setReportingAreaId] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Admin-only: assigning a responder to the selected request.
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Load the data and keep it live, but only for people allowed to see it.
  useEffect(() => {
    if (!canSeeData) {
      // Logged out (or not allowed): drop everything that was loaded so nothing stays on screen.
      setRequests([]);
      setVolunteers([]);
      setNgos([]);
      setAreaAssignments([]);
      setSelectedId(null);
      return;
    }

    async function load() {
      const { data: requestData } = await supabase.from('sos_requests').select('*');
      if (requestData) setRequests(requestData);
      const { data: volunteerData } = await supabase.from('volunteer_profiles').select('*').eq('available', true);
      if (volunteerData) setVolunteers(volunteerData);
      const { data: ngoData } = await supabase.from('ngos').select('*').eq('status', 'approved');
      if (ngoData) setNgos(ngoData);
      const { data: areaData } = await supabase.from('ngo_area_assignments').select('*');
      if (areaData) setAreaAssignments(areaData);
    }
    load();

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
  }, [canSeeData]);

  const selected = requests.find((r) => r.id === selectedId) ?? null;
  const selectedPlace = usePlaceName(selected?.latitude, selected?.longitude);

  const visibleRequests = useMemo(
    () =>
      requests.filter((r) => {
        if (category && r.category !== category) return false;
        return urgencies.has((r.urgency ?? 'unclassified') as UrgencyKey);
      }),
    [requests, category, urgencies]
  );

  // What's assigned to the person looking (a request, an area, or both).
  const myAssignments = currentUserId ? requests.filter((r) => r.assigned_responder_id === currentUserId) : [];
  const myAreaAssignments = currentUserId ? areaAssignments.filter((a) => a.ngo_id === currentUserId) : [];
  const assignmentCount = myAssignments.length + myAreaAssignments.length;

  function toggleUrgency(key: UrgencyKey) {
    setUrgencies((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetFilters() {
    setCategory('');
    setUrgencies(new Set(URGENCY_OPTIONS.map((o) => o.key)));
    setShow({ requests: true, volunteers: true, ngos: true, radii: true });
  }

  async function updateMyRequestStatus(requestId: string, status: 'en_route' | 'resolved') {
    setUpdatingStatus(requestId);
    await supabase.from('sos_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', requestId);
    setUpdatingStatus(null);
  }

  // An NGO reports it only partly covered its area. The database trigger limits what this can change.
  async function reportPartialFulfillment(areaId: string) {
    setSubmittingReport(true);
    await supabase.from('ngo_area_assignments').update({ status: 'partially_fulfilled', notes: reportNotes }).eq('id', areaId);
    setSubmittingReport(false);
    setReportingAreaId(null);
  }

  // Admin-only: the closest available volunteers and approved NGOs to the selected request.
  const nearbyResponders = useMemo(() => {
    if (!isAdmin || !selected) return [];
    return [
      ...volunteers.map((v) => ({
        id: v.id,
        type: 'volunteer' as const,
        name: v.full_name ?? 'Volunteer',
        phone: v.phone,
        detail: v.skills.join(', ') || 'no skills listed',
        km: v.latitude && v.longitude ? distanceKm(selected.latitude, selected.longitude, v.latitude, v.longitude) : Infinity,
      })),
      ...ngos.map((n) => ({
        id: n.id,
        type: 'ngo' as const,
        name: n.org_name,
        phone: n.contact_phone,
        detail: n.resources_available || 'no resources listed',
        km: n.latitude && n.longitude ? distanceKm(selected.latitude, selected.longitude, n.latitude, n.longitude) : Infinity,
      })),
    ]
      .sort((a, b) => a.km - b.km)
      .slice(0, 6);
  }, [isAdmin, selected, volunteers, ngos]);

  // Admin-only: gives the selected request to a volunteer or NGO and logs it in the history table.
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

    // Update the screen right away (the live feed would also do it a moment later).
    setRequests((current) =>
      current.map((r) =>
        r.id === selected.id
          ? { ...r, status: 'assigned', assigned_responder_id: responderId, assigned_responder_type: responderType }
          : r
      )
    );
    setAssigning(false);
  }

  const showToggles: { key: keyof typeof show; label: string; color: string }[] = [
    { key: 'requests', label: t('map.requests'), color: '#0f7c7c' },
    { key: 'volunteers', label: t('map.volunteers'), color: '#2563eb' },
    { key: 'ngos', label: t('map.ngos'), color: '#16a34a' },
    { key: 'radii', label: t('map.radii'), color: '#16a34a' },
  ];

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <AdminTabs />

      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="font-display text-3xl font-bold text-paper">{t('map.title')}</h1>
          <p className="text-sm text-muted">{t('map.subtitle')}</p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
          {/* ---------- LEFT: filters + my assignments ---------- */}
          <aside className="flex flex-col gap-4">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className="flex min-h-12 items-center justify-between rounded-xl border border-hairline bg-panel px-4 font-semibold text-paper lg:hidden"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal size={18} />
                {t('map.filters')}
              </span>
              <ChevronDown size={18} className={filtersOpen ? 'rotate-180' : ''} />
            </button>

            <div className={`${filtersOpen ? 'block' : 'hidden'} rounded-xl border border-hairline bg-panel p-5 lg:block`}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-paper">{t('map.filters')}</h2>
                <button onClick={resetFilters} className="text-sm font-semibold text-signal hover:underline">
                  {t('map.reset')}
                </button>
              </div>

              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t('map.category')}</p>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category | '')}
                className="mt-2 min-h-11 w-full rounded-xl border border-hairline bg-panel px-3 text-paper"
              >
                <option value="">{t('map.allCategories')}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`categories.${c}`)}
                  </option>
                ))}
              </select>

              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t('map.urgency')}</p>
              <div className="mt-3 flex flex-col gap-2">
                {URGENCY_OPTIONS.map((o) => (
                  <label key={o.key} className="flex min-h-9 cursor-pointer items-center gap-3 text-paper">
                    <input
                      type="checkbox"
                      checked={urgencies.has(o.key)}
                      onChange={() => toggleUrgency(o.key)}
                      className="h-5 w-5"
                      style={{ accentColor: o.color }}
                    />
                    {t(`urgencyFilter.${o.key}`)}
                  </label>
                ))}
              </div>

              <div className="my-5 border-t border-hairline" />

              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('map.showOnMap')}</p>
              <div className="mt-3 flex flex-col gap-2">
                {showToggles.map((s) => (
                  <label key={s.key} className="flex min-h-9 cursor-pointer items-center gap-3 text-paper">
                    <input
                      type="checkbox"
                      checked={show[s.key]}
                      onChange={() => setShow((cur) => ({ ...cur, [s.key]: !cur[s.key] }))}
                      className="h-5 w-5"
                      style={{ accentColor: s.color }}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Responder panel: only appears when something is assigned to the person looking. */}
            {canSeeData && assignmentCount > 0 && (
              <div className="rounded-xl border border-hairline bg-panel">
                <button
                  onClick={() => setAssignmentsOpen((o) => !o)}
                  className="flex min-h-12 w-full items-center justify-between px-5 font-semibold text-paper lg:cursor-default"
                >
                  <span>Your assignments ({assignmentCount})</span>
                  <ChevronDown size={18} className={`lg:hidden ${assignmentsOpen ? 'rotate-180' : ''}`} />
                </button>

                <div className={`${assignmentsOpen ? 'block' : 'hidden'} max-h-[60vh] overflow-y-auto px-5 pb-5 lg:block`}>
                  {myAreaAssignments.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-paper">Your assigned area</h3>
                      <ul className="mt-2 flex flex-col gap-3">
                        {myAreaAssignments.map((area) => (
                          <li key={area.id} className="rounded-lg border border-hairline p-3">
                            <p className="text-sm font-semibold text-paper">{area.area_name || 'Unnamed area'}</p>
                            <p className="mt-1 font-data text-xs text-muted">
                              {area.radius_km} km radius · center {area.center_lat.toFixed(4)}, {area.center_lng.toFixed(4)}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              Category: {area.category ? area.category.charAt(0).toUpperCase() + area.category.slice(1) : 'Any'} · Urgency:{' '}
                              {area.urgency ? area.urgency.charAt(0).toUpperCase() + area.urgency.slice(1) : 'Any'}
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

                            {area.status === 'active' && (
                              <div className="mt-2">
                                {reportingAreaId === area.id ? (
                                  <div className="flex flex-col gap-2">
                                    <textarea
                                      rows={2}
                                      placeholder="What's still needed in this area?"
                                      value={reportNotes}
                                      onChange={(e) => setReportNotes(e.target.value)}
                                      className="rounded-lg border border-hairline bg-ink px-2 py-1.5 text-xs text-paper"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => reportPartialFulfillment(area.id)}
                                        disabled={submittingReport}
                                        className="rounded-lg bg-signal-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                      >
                                        {submittingReport ? 'Submitting...' : 'Submit report'}
                                      </button>
                                      <button
                                        onClick={() => setReportingAreaId(null)}
                                        className="rounded-lg border border-hairline px-3 py-1.5 text-xs text-muted hover:text-paper"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setReportingAreaId(area.id);
                                      setReportNotes('');
                                    }}
                                    className="text-xs font-medium text-signal-orange hover:underline"
                                  >
                                    Report partial fulfillment
                                  </button>
                                )}
                              </div>
                            )}

                            {area.status === 'partially_fulfilled' && (
                              <div className="mt-2 rounded-lg border border-signal-orange/40 bg-signal-orange/10 p-2">
                                <p className="text-xs font-semibold text-signal-orange">Reported: needs additional support</p>
                                {area.notes && <p className="mt-1 text-xs text-muted">"{area.notes}"</p>}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {myAssignments.length > 0 && (
                    <ul className="flex flex-col gap-3">
                      {myAssignments.map((r) => {
                        const badge = r.urgency ? URGENCY_OPTIONS.find((o) => o.key === r.urgency) : null;
                        // Google Maps works out the route from wherever the phone currently is.
                        const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`;
                        return (
                          <li key={r.id} className="rounded-lg border border-hairline p-3">
                            <div className="flex items-center justify-between">
                              {badge ? (
                                <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: badge.color, color: badge.text }}>
                                  {t(`urgencyFilter.${badge.key}`)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted">{t('urgencyFilter.unclassified')}</span>
                              )}
                              <span className="font-data text-xs text-muted">{timeAgo(r.created_at)}</span>
                            </div>

                            <p className="mt-2 text-sm text-paper">{r.description}</p>
                            <p className="mt-2 text-xs text-muted">
                              Reporter: <span className="text-paper">{r.reporter_name ?? 'Anonymous (Quick SOS)'}</span>
                              {r.reporter_name ? ` (${r.relationship})` : ''}
                            </p>
                            {r.reporter_phone && (
                              <div className="mt-1 text-xs">
                                <PhoneActions phone={r.reporter_phone} />
                              </div>
                            )}
                            {r.landmark && <p className="mt-1 text-xs text-muted">Landmark: <span className="text-paper">{r.landmark}</span></p>}

                            <a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-signal hover:underline">
                              Get directions →
                            </a>
                            <p className="mt-2 font-data text-xs text-muted">Status: {r.status}</p>

                            <div className="mt-2 flex gap-2">
                              {r.status === 'assigned' && (
                                <button
                                  onClick={() => updateMyRequestStatus(r.id, 'en_route')}
                                  disabled={updatingStatus === r.id}
                                  className="rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                >
                                  Mark en route
                                </button>
                              )}
                              {r.status === 'en_route' && (
                                <button
                                  onClick={() => updateMyRequestStatus(r.id, 'resolved')}
                                  disabled={updatingStatus === r.id}
                                  className="rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                >
                                  Mark resolved
                                </button>
                              )}
                              {r.status === 'resolved' && <span className="text-xs text-muted">Resolved ✓</span>}
                            </div>

                            {r.status !== 'pending' && (
                              <div className="mt-2">
                                <button
                                  onClick={() => setChatOpenFor(chatOpenFor === r.id ? null : r.id)}
                                  className="text-xs font-medium text-signal hover:underline"
                                >
                                  {chatOpenFor === r.id ? 'Hide chat' : '💬 Message reporter'}
                                </button>
                                {chatOpenFor === r.id && currentUserId && (
                                  <div className="mt-2">
                                    <RequestChat requestId={r.id} senderType="responder" senderId={currentUserId} />
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* ---------- CENTER: the map ---------- */}
          <section className="min-w-0">
            <div className="overflow-hidden rounded-xl border border-hairline bg-panel">
              {/* "isolate" keeps the map's layers underneath the sticky header and bottom bar. */}
              <div className="relative isolate h-[56vh] min-h-[340px] lg:h-[calc(100vh-17rem)]">
                <MapContainer center={DEFAULT_CENTER} zoom={7} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {canSeeData &&
                    show.requests &&
                    visibleRequests.map((r) => (
                      <Marker
                        key={r.id}
                        position={[r.latitude, r.longitude]}
                        icon={requestIcon(r.urgency)}
                        zIndexOffset={1000}
                        eventHandlers={{ click: () => setSelectedId(r.id) }}
                      >
                        <Popup>
                          <strong>{titleOf(r.description)}</strong>
                          <br />
                          {r.status}
                        </Popup>
                      </Marker>
                    ))}

                  {canSeeData &&
                    show.volunteers &&
                    volunteers.map(
                      (v) =>
                        v.latitude &&
                        v.longitude && (
                          <Marker key={v.id} position={[v.latitude, v.longitude]} icon={volunteerIcon()}>
                            <Popup>
                              <strong>{v.full_name ?? 'Volunteer'}</strong>
                              <br />
                              {v.skills.join(', ') || '—'}
                            </Popup>
                          </Marker>
                        )
                    )}

                  {canSeeData &&
                    show.ngos &&
                    ngos.map(
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

                  {/* Area circles: 'reassigned' ones are hidden (a newer circle replaced them);
                      'partially fulfilled' ones are drawn in orange so they stand out. */}
                  {canSeeData &&
                    show.radii &&
                    areaAssignments
                      .filter((a) => a.status !== 'reassigned')
                      .map((area) => {
                        const ngo = ngos.find((n) => n.id === area.ngo_id);
                        const isPartial = area.status === 'partially_fulfilled';
                        const color = isPartial ? '#ea580c' : '#16a34a';
                        return (
                          <Circle
                            key={area.id}
                            center={[area.center_lat, area.center_lng]}
                            radius={area.radius_km * 1000}
                            pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 1.5, dashArray: '6 4' }}
                          >
                            <Popup>
                              <strong>{area.area_name || ngo?.org_name || 'NGO area'}</strong>
                              <br />
                              {ngo?.org_name ?? 'NGO'}
                              <br />
                              {area.radius_km} km
                              {area.category ? ` · ${area.category}` : ''}
                              {area.urgency ? ` · ${area.urgency}` : ''}
                              {isPartial && (
                                <>
                                  <br />
                                  <strong>Partially fulfilled</strong> — needs additional support
                                </>
                              )}
                            </Popup>
                          </Circle>
                        );
                      })}
                </MapContainer>

                {!roleLoading && !canSeeData && (
                  <div className="absolute inset-x-4 top-4 z-[500] rounded-xl border border-hairline bg-panel p-4 shadow-lg sm:max-w-sm">
                    <p className="font-semibold text-paper">{t('map.restrictedTitle')}</p>
                    <p className="mt-1 text-sm text-muted">{t('map.restrictedBody')}</p>
                    <Link
                      to="/volunteer/login"
                      className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-signal px-5 font-semibold text-white hover:opacity-90"
                    >
                      {t('home.logIn')}
                    </Link>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-hairline px-5 py-4 text-sm text-muted">
                {URGENCY_OPTIONS.slice(0, 4).map((o) => (
                  <span key={o.key} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border border-black/20" style={{ background: o.color }} />
                    {t(`urgencyFilter.${o.key}`)}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#2563eb' }} />
                  {t('map.volunteers')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#16a34a' }} />
                  {t('home.legendNgos')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full border border-dashed" style={{ borderColor: '#16a34a' }} />
                  {t('map.legendRadius')}
                </span>
              </div>
            </div>
          </section>

          {/* ---------- RIGHT: request details (a bottom sheet on phones) ---------- */}
          <aside
            className={`${selected ? 'block' : 'hidden'} fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[1000] max-h-[65vh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-panel p-5 shadow-2xl sm:bottom-0 lg:static lg:z-auto lg:block lg:max-h-none lg:rounded-xl lg:border lg:shadow-none`}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-paper">{t('map.details')}</h2>
              {selected && (
                <button onClick={() => setSelectedId(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-aqua">
                  <X size={18} />
                </button>
              )}
            </div>

            {selected ? (
              <>
                <h3 className="mt-4 font-display text-2xl font-bold text-paper">{titleOf(selected.description)}</h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.urgency &&
                    (() => {
                      const o = URGENCY_OPTIONS.find((x) => x.key === selected.urgency);
                      return o ? (
                        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: o.color, color: o.text }}>
                          {t(`urgencyFilter.${o.key}`)}
                        </span>
                      ) : null;
                    })()}
                  {selected.category && (
                    <span className="rounded-full bg-aqua px-3 py-1 text-xs font-semibold text-signal">{t(`categories.${selected.category}`)}</span>
                  )}
                </div>

                <div className="mt-5 border-t border-hairline pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('map.situation')}</p>
                  <p className="mt-2 text-paper">{selected.description}</p>
                </div>

                <div className="mt-5 border-t border-hairline pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('map.location')}</p>
                  <p className="mt-2 flex items-start gap-2 text-paper">
                    <MapPin size={16} className="mt-1 shrink-0 text-signal" />
                    <span>
                      {selectedPlace ?? `${selected.latitude.toFixed(4)}, ${selected.longitude.toFixed(4)}`}
                      {selected.landmark && <span className="block text-sm text-muted">{selected.landmark}</span>}
                    </span>
                  </p>
                </div>

                <div className="mt-5 border-t border-hairline pt-4 text-sm">
                  <p className="text-muted">
                    {t('map.reporter')}: <span className="text-paper">{selected.reporter_name ?? '—'}</span>
                  </p>
                  {selected.reporter_phone && (
                    <div className="mt-1">
                      <PhoneActions phone={selected.reporter_phone} />
                    </div>
                  )}
                  <p className="mt-1 text-muted">
                    {t('map.status')}: <span className="text-paper">{selected.status}</span>
                  </p>
                </div>

                {isAdmin ? (
                  <div className="mt-5 border-t border-hairline pt-4">
                    {selected.status === 'pending' ? (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Assign a responder</p>
                        {nearbyResponders.length === 0 && <p className="mt-2 text-sm text-muted">None found nearby yet.</p>}
                        <ul className="mt-3 flex flex-col gap-2">
                          {nearbyResponders.map((r) => (
                            <li key={`${r.type}-${r.id}`} className="rounded-lg border border-hairline p-3">
                              <div className="flex items-start justify-between gap-2">
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
                                  className="shrink-0 rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                >
                                  Assign
                                </button>
                              </div>
                              {r.phone && (
                                <div className="mt-1.5 text-xs">
                                  <PhoneActions phone={r.phone} />
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                        {assignError && <p className="mt-2 text-sm text-red-400">{assignError}</p>}
                      </>
                    ) : (
                      <p className="rounded-lg bg-aqua p-3 text-sm text-muted">
                        {selected.status === 'assigned' &&
                          (selected.assigned_responder_type === 'ngo' ? 'Assigned to an NGO.' : 'Assigned to a volunteer.')}
                        {selected.status === 'en_route' &&
                          (selected.assigned_responder_type === 'ngo' ? 'An NGO is en route.' : 'A volunteer is en route.')}
                        {selected.status === 'resolved' && 'Resolved.'}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl bg-aqua p-4">
                    <p className="font-semibold text-paper">{t('map.coordinated')}</p>
                    <p className="mt-1 text-sm text-muted">{t('map.coordinatedBody')}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-muted">{t('map.selectPrompt')}</p>
            )}

            {!isAdmin && (
              <>
                <p className="mt-6 font-semibold text-paper">{t('map.needHelp')}</p>
                <Link
                  to="/request-help"
                  className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-signal font-semibold text-white hover:opacity-90"
                >
                  {t('nav.requestHelp')}
                </Link>
              </>
            )}
          </aside>
        </div>

        <p className="mt-6 text-sm text-muted">
          {t('emergency.banner')} 112 · {t('emergency.nationalNumber')}
        </p>
      </main>
    </div>
  );
}
