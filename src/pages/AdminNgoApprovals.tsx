// TWO jobs on this page:
//   1. The original "verification" step — approve/reject pending NGOs.
//   2. Area allocation — give one approved NGO exclusive
//      responsibility for a specific area (a center point the admin
//      clicks on a map, plus a radius), optionally narrowed to one
//      category and/or one urgency level, so two organizations never
//      get sent to the same neighborhood for the same kind of need.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';
import { LocationPicker } from '../components/LocationPicker';
import { PhoneActions } from '../components/PhoneActions';
import type { Category, Urgency } from '../lib/types';

interface PendingNgo {
  id: string;
  org_name: string;
  registration_number: string | null;
  contact_phone: string | null;
  area_of_operation: string;
  resources_available: string;
}

interface ApprovedNgo {
  id: string;
  org_name: string;
}

const CATEGORY_OPTIONS: { value: Category | ''; label: string }[] = [
  { value: '', label: 'Any' },
  { value: 'medical', label: 'Medical' },
  { value: 'food', label: 'Food' },
  { value: 'shelter', label: 'Shelter' },
  { value: 'rescue', label: 'Rescue' },
];

const URGENCY_OPTIONS: { value: Urgency | ''; label: string }[] = [
  { value: '', label: 'Any' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function AdminNgoApprovals() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<'checking' | true | false>('checking');
  const [pending, setPending] = useState<PendingNgo[]>([]);
  const [approved, setApproved] = useState<ApprovedNgo[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // The area-allocation form — one shared form, not one per NGO,
  // matching the actual workflow: an admin picks WHICH NGO, WHERE,
  // and under what conditions, as one deliberate action rather than
  // filling in a row inline next to every single NGO in a list.
  const [selectedNgoId, setSelectedNgoId] = useState('');
  const [areaName, setAreaName] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState('3');
  const [category, setCategory] = useState<Category | ''>('');
  const [urgency, setUrgency] = useState<Urgency | ''>('');
  const [allocating, setAllocating] = useState(false);

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

    async function loadNgos() {
      const { data: pendingData } = await supabase
        .from('ngos')
        .select('id, org_name, registration_number, contact_phone, area_of_operation, resources_available')
        .eq('status', 'pending_approval');
      if (pendingData) setPending(pendingData);

      const { data: approvedData } = await supabase.from('ngos').select('id, org_name').eq('status', 'approved');
      if (approvedData) setApproved(approvedData);
    }
    loadNgos();
  }, [authorized]);

  async function decide(ngoId: string, decision: 'approved' | 'rejected') {
    setActioning(ngoId);
    setError('');

    const { error: updateError } = await supabase.from('ngos').update({ status: decision }).eq('id', ngoId);

    setActioning(null);

    if (updateError) {
      setError(`Could not update: ${updateError.message}`);
      return;
    }

    setPending((current) => current.filter((n) => n.id !== ngoId));
  }

  async function handleAllocate() {
    setError('');
    setSuccess('');

    if (!selectedNgoId) {
      setError('Choose which organization this area is for.');
      return;
    }
    if (!center) {
      setError('Click the map to place the center of the area.');
      return;
    }
    const radius = Number(radiusKm);
    if (!radiusKm || Number.isNaN(radius) || radius <= 0) {
      setError('Enter a valid radius (in km).');
      return;
    }

    setAllocating(true);

    const { error: insertError } = await supabase.from('ngo_area_assignments').insert({
      ngo_id: selectedNgoId,
      center_lat: center.lat,
      center_lng: center.lng,
      radius_km: radius,
      area_name: areaName || null,
      category: category || null,
      urgency: urgency || null,
    });

    setAllocating(false);

    if (insertError) {
      setError(`Could not allocate area: ${insertError.message}`);
      return;
    }

    const ngoName = approved.find((n) => n.id === selectedNgoId)?.org_name ?? 'the organization';
    setSuccess(`Area allocated to ${ngoName}. It's now visible on the live map.`);

    // Reset the form for the next allocation, but deliberately leave
    // the map center where it was — an admin allocating several
    // nearby areas in a row usually wants to click nearby, not start
    // from scratch every time.
    setSelectedNgoId('');
    setAreaName('');
    setRadiusKm('3');
    setCategory('');
    setUrgency('');
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
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-paper">NGO approvals</h1>
          <Link to="/admin" className="text-sm text-signal hover:underline">
            ← Back to live map
          </Link>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <h2 className="mt-8 font-display text-lg font-semibold text-paper">Pending review</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-muted">No organizations waiting for review right now.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {pending.map((ngo) => (
              <li key={ngo.id} className="rounded-xl border border-hairline bg-panel p-5">
                <p className="font-display text-lg font-semibold text-paper">{ngo.org_name}</p>
                {ngo.registration_number && (
                  <p className="mt-1 font-data text-xs text-muted">Reg. no. {ngo.registration_number}</p>
                )}
                {ngo.contact_phone && (
                  <div className="mt-2 text-xs">
                    <PhoneActions phone={ngo.contact_phone} label="Contact" />
                  </div>
                )}
                <p className="mt-3 text-sm text-muted">
                  <span className="text-paper">Area of operation: </span>
                  {ngo.area_of_operation}
                </p>
                <p className="mt-1 text-sm text-muted">
                  <span className="text-paper">Resources: </span>
                  {ngo.resources_available}
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => decide(ngo.id, 'approved')}
                    disabled={actioning === ngo.id}
                    className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(ngo.id, 'rejected')}
                    disabled={actioning === ngo.id}
                    className="rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-paper hover:border-signal-red disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-12 font-display text-lg font-semibold text-paper">Area allocation</h2>
        <p className="mt-1 text-sm text-muted">
          Give one organization exclusive responsibility for an area, category, and urgency so two teams never go to
          the same place.
        </p>

        {success && <p className="mt-4 text-sm text-signal">{success}</p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="mb-2 text-sm text-muted">Click the map to place the center of the area.</p>
            <LocationPicker value={center} onChange={(lat, lng) => setCenter({ lat, lng })} radiusKm={Number(radiusKm)} />
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-panel p-5">
            <div>
              <label className="block text-sm font-medium text-paper">Organization</label>
              <select
                value={selectedNgoId}
                onChange={(e) => setSelectedNgoId(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-ink px-3 py-2 text-paper"
              >
                <option value="">—</option>
                {approved.map((ngo) => (
                  <option key={ngo.id} value={ngo.id}>
                    {ngo.org_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-paper">Area name</label>
              <input
                type="text"
                placeholder="e.g. Sama - Savli Road"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-ink px-3 py-2 text-paper"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-paper">Radius (km)</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(e.target.value)}
                  className="mt-1 w-full rounded-md border border-hairline bg-ink px-3 py-2 text-paper"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-paper">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category | '')}
                  className="mt-1 w-full rounded-md border border-hairline bg-ink px-3 py-2 text-paper"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-paper">Urgency</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as Urgency | '')}
                  className="mt-1 w-full rounded-md border border-hairline bg-ink px-3 py-2 text-paper"
                >
                  {URGENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleAllocate}
              disabled={allocating}
              className="mt-2 rounded-md bg-signal px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {allocating ? 'Allocating...' : 'Allocate area'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
