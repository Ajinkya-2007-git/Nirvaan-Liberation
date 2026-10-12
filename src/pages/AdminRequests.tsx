// A list-based alternative to assigning requests via the map. The
// map is great for spatial context, but clicking through individual
// pins isn't the fastest way to just work through everything
// pending, in priority order — this page is that: every request,
// sorted worst-first, with the same assign logic as the map's side
// panel (AdminPanel.tsx), just reached by scrolling a list instead
// of hunting for the right pin.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';
import { PhoneActions } from '../components/PhoneActions';
import { distanceKm } from '../lib/distance';
import type { SosRequest, VolunteerProfile, Ngo, Urgency, Category } from '../lib/types';

// Used to sort worst-first — a plain array index lookup is a simple,
// readable way to turn a severity WORD into a sortable NUMBER.
const URGENCY_ORDER: Urgency[] = ['critical', 'high', 'medium', 'low'];

const CATEGORY_OPTIONS: { value: Category | ''; label: string }[] = [
  { value: '', label: 'All categories' },
  { value: 'medical', label: 'Medical' },
  { value: 'food', label: 'Food' },
  { value: 'shelter', label: 'Shelter' },
  { value: 'rescue', label: 'Rescue' },
];

const URGENCY_OPTIONS: { value: Urgency | ''; label: string }[] = [
  { value: '', label: 'All urgencies' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const URGENCY_BADGE: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#dc2626' },
  high: { label: 'High', color: '#ea580c' },
  medium: { label: 'Medium', color: '#eab308' },
  low: { label: 'Low', color: '#fef08a' },
};

export function AdminRequests() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<'checking' | true | false>('checking');
  const [requests, setRequests] = useState<SosRequest[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | ''>('');
  const [filterUrgency, setFilterUrgency] = useState<Urgency | ''>('');

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
    if (authorized !== true) return;

    async function loadData() {
      const { data: requestData } = await supabase.from('sos_requests').select('*');
      if (requestData) setRequests(requestData);
      const { data: volunteerData } = await supabase.from('volunteer_profiles').select('*').eq('available', true);
      if (volunteerData) setVolunteers(volunteerData);
      const { data: ngoData } = await supabase.from('ngos').select('*').eq('status', 'approved');
      if (ngoData) setNgos(ngoData);
    }
    loadData();

    // Same live-update pattern as the map — this list stays current
    // without needing a manual refresh.
    const channel = supabase
      .channel('admin-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_requests' }, (payload) => {
        setRequests((current) => {
          if (payload.eventType === 'INSERT') return [...current, payload.new as SosRequest];
          if (payload.eventType === 'UPDATE') return current.map((r) => (r.id === payload.new.id ? (payload.new as SosRequest) : r));
          if (payload.eventType === 'DELETE') return current.filter((r) => r.id !== payload.old.id);
          return current;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authorized]);

  // Worst-first, then newest-first within the same severity —
  // exactly the order an admin working through a queue would want:
  // the most urgent, most recently reported things at the very top.
  const sortedRequests = [...requests].sort((a, b) => {
    const aStatusWeight = a.status === 'pending' ? 0 : 1; // pending requests always float above already-handled ones
    const bStatusWeight = b.status === 'pending' ? 0 : 1;
    if (aStatusWeight !== bStatusWeight) return aStatusWeight - bStatusWeight;

    const aRank = a.urgency ? URGENCY_ORDER.indexOf(a.urgency) : URGENCY_ORDER.length;
    const bRank = b.urgency ? URGENCY_ORDER.indexOf(b.urgency) : URGENCY_ORDER.length;
    if (aRank !== bRank) return aRank - bRank;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Applied AFTER sorting, not before — this way the sort order
  // (worst-first) stays consistent regardless of which filters are
  // active, instead of the two interacting in a confusing way.
  const filteredRequests = sortedRequests.filter((r) => {
    if (filterCategory && r.category !== filterCategory) return false;
    if (filterUrgency && r.urgency !== filterUrgency) return false;
    return true;
  });

  function nearbyResponders(request: SosRequest) {
    return [
      ...volunteers.map((v) => ({
        id: v.id,
        type: 'volunteer' as const,
        name: v.full_name ?? 'Volunteer',
        phone: v.phone,
        detail: v.skills.join(', ') || 'no skills listed',
        km: v.latitude && v.longitude ? distanceKm(request.latitude, request.longitude, v.latitude, v.longitude) : Infinity,
      })),
      ...ngos.map((n) => ({
        id: n.id,
        type: 'ngo' as const,
        name: n.org_name,
        phone: n.contact_phone,
        detail: n.resources_available || 'no resources listed',
        km: n.latitude && n.longitude ? distanceKm(request.latitude, request.longitude, n.latitude, n.longitude) : Infinity,
      })),
    ]
      .sort((a, b) => a.km - b.km)
      .slice(0, 6);
  }

  async function assignResponder(requestId: string, responderId: string, responderType: 'volunteer' | 'ngo') {
    setAssigning(true);
    setError('');

    const { error: updateError } = await supabase
      .from('sos_requests')
      .update({
        status: 'assigned',
        assigned_responder_id: responderId,
        assigned_responder_type: responderType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      setAssigning(false);
      setError(`Could not assign: ${updateError.message}`);
      return;
    }

    await supabase.from('assignments').insert({
      sos_request_id: requestId,
      responder_id: responderId,
      responder_type: responderType,
    });

    setAssigning(false);
    setExpandedId(null);
  }

  if (authorized !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <p className="text-muted">Checking access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold text-paper">Requests</h1>
          <div className="flex gap-4 text-sm">
            <Link to="/admin" className="text-signal hover:underline">
              ← Live map
            </Link>
            <Link to="/admin/ngos" className="text-signal hover:underline">
              NGO approvals →
            </Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          Every request, most urgent and most recent first — an alternative to clicking through pins on the map.
        </p>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-muted">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as Category | '')}
              className="mt-1 rounded-md border border-hairline bg-panel px-3 py-1.5 text-sm text-paper"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted">Urgency</label>
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value as Urgency | '')}
              className="mt-1 rounded-md border border-hairline bg-panel px-3 py-1.5 text-sm text-paper"
            >
              {URGENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {(filterCategory || filterUrgency) && (
            <button
              onClick={() => {
                setFilterCategory('');
                setFilterUrgency('');
              }}
              className="mt-5 text-xs text-muted hover:text-paper"
            >
              Clear filters
            </button>
          )}
        </div>

        {filteredRequests.length === 0 ? (
          <p className="mt-8 text-muted">{requests.length === 0 ? 'No requests yet.' : 'No requests match these filters.'}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {filteredRequests.map((r) => {
              const badge = r.urgency ? URGENCY_BADGE[r.urgency] : null;
              const isExpanded = expandedId === r.id;

              return (
                <li key={r.id} className="rounded-xl border border-hairline bg-panel p-5">
                  <div className="flex items-center justify-between gap-2">
                    {badge ? (
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-black" style={{ backgroundColor: badge.color }}>
                        {badge.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Not yet classified</span>
                    )}
                    <span className="font-data text-xs text-muted">{r.status}</span>
                  </div>

                  <p className="mt-2 text-sm text-paper">{r.description}</p>

                  <p className="mt-2 text-xs text-muted">
                    Reporter: {r.reporter_name ?? 'Anonymous (Quick SOS)'}
                    {r.relationship && r.reporter_name ? ` (${r.relationship})` : ''}
                  </p>
                  {r.reporter_phone && (
                    <div className="mt-1 text-xs">
                      <PhoneActions phone={r.reporter_phone} />
                    </div>
                  )}
                  {r.landmark && <p className="mt-1 text-xs text-muted">Landmark: {r.landmark}</p>}

                  {r.status === 'pending' ? (
                    <div className="mt-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        className="rounded-md bg-signal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        {isExpanded ? 'Hide responders' : 'Assign →'}
                      </button>

                      {isExpanded && (
                        <ul className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
                          {nearbyResponders(r).length === 0 && (
                            <p className="text-xs text-muted">None found nearby yet.</p>
                          )}
                          {nearbyResponders(r).map((resp) => (
                            <li key={`${resp.type}-${resp.id}`} className="rounded-md border border-hairline p-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium text-paper">
                                    {resp.name} <span className="text-xs text-muted">({resp.type === 'ngo' ? 'NGO' : 'Volunteer'})</span>
                                  </p>
                                  <p className="font-data text-xs text-muted">
                                    {resp.km.toFixed(1)} km away · {resp.detail}
                                  </p>
                                </div>
                                <button
                                  onClick={() => assignResponder(r.id, resp.id, resp.type)}
                                  disabled={assigning}
                                  className="shrink-0 rounded-md bg-signal px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                >
                                  Assign
                                </button>
                              </div>
                              {resp.phone && (
                                <div className="mt-1.5 text-xs">
                                  <PhoneActions phone={resp.phone} />
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted">
                      {r.assigned_responder_type === 'ngo' ? 'Assigned to an NGO' : 'Assigned to a volunteer'}
                      {r.status !== 'assigned' ? ` · ${r.status}` : ''}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
