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
import { AdminTabs } from '../components/AdminTabs';
import { LocationPicker } from '../components/LocationPicker';
import { PhoneActions } from '../components/PhoneActions';
import type { Category, Urgency, NgoAreaAssignment } from '../lib/types';

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

  // Areas an NGO reported it can't fully cover, and (while an admin is reassigning one)
  // which old assignment the NEW allocation will replace when saved.
  const [partialAreas, setPartialAreas] = useState<NgoAreaAssignment[]>([]);
  const [supersedingAreaId, setSupersedingAreaId] = useState<string | null>(null);

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

      const { data: partialData } = await supabase.from('ngo_area_assignments').select('*').eq('status', 'partially_fulfilled');
      if (partialData) setPartialAreas(partialData);
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

  // Pre-fills the allocation form from a partially-fulfilled area so the admin only has to
  // pick a DIFFERENT organization; the old assignment is closed out when the new one is saved.
  function startReassign(area: NgoAreaAssignment) {
    setSupersedingAreaId(area.id);
    setSelectedNgoId('');
    setAreaName(area.area_name ?? '');
    setCenter({ lat: area.center_lat, lng: area.center_lng });
    setRadiusKm(String(area.radius_km));
    setCategory(area.category ?? '');
    setUrgency(area.urgency ?? '');
    setSuccess('');
    document.getElementById('area-allocation')?.scrollIntoView({ behavior: 'smooth' });
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

    // .select().single() returns the new row so the old assignment can point to it.
    const { data: newArea, error: insertError } = await supabase
      .from('ngo_area_assignments')
      .insert({
        ngo_id: selectedNgoId,
        center_lat: center.lat,
        center_lng: center.lng,
        radius_km: radius,
        area_name: areaName || null,
        category: category || null,
        urgency: urgency || null,
      })
      .select()
      .single();

    if (insertError || !newArea) {
      setAllocating(false);
      setError(`Could not allocate area: ${insertError?.message}`);
      return;
    }

    // Reassigning: close the old assignment so its circle disappears from every map.
    if (supersedingAreaId) {
      await supabase
        .from('ngo_area_assignments')
        .update({ status: 'reassigned', superseded_by: newArea.id })
        .eq('id', supersedingAreaId);
      setPartialAreas((current) => current.filter((a) => a.id !== supersedingAreaId));
      setSupersedingAreaId(null);
    }

    setAllocating(false);

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
      <AdminTabs />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-paper">NGO approvals</h1>
          <Link to="/map" className="text-sm text-signal hover:underline">
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

        {partialAreas.length > 0 && (
          <>
            <h2 className="mt-12 font-display text-lg font-semibold text-signal-orange">Areas needing attention</h2>
            <p className="mt-1 text-sm text-muted">
              An NGO reported it could only partly cover these areas. Reassign to bring in another organization.
            </p>
            <ul className="mt-4 flex flex-col gap-4">
              {partialAreas.map((area) => (
                <li key={area.id} className="rounded-xl border border-signal-orange/40 bg-panel p-5">
                  <p className="font-display text-base font-semibold text-paper">{area.area_name || 'Unnamed area'}</p>
                  <p className="mt-1 text-xs text-muted">
                    Assigned to {approved.find((n) => n.id === area.ngo_id)?.org_name ?? 'an NGO'} · {area.radius_km} km ·{' '}
                    {area.category ?? 'any category'} · {area.urgency ?? 'any urgency'}
                  </p>
                  {area.notes && <p className="mt-2 text-sm text-paper">"{area.notes}"</p>}
                  <button
                    onClick={() => startReassign(area)}
                    className="mt-3 rounded-md bg-signal-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Reassign to another NGO
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 id="area-allocation" className="mt-12 font-display text-lg font-semibold text-paper">
          Area allocation
        </h2>
        <p className="mt-1 text-sm text-muted">
          Give one organization exclusive responsibility for an area, category, and urgency so two teams never go to
          the same place.
        </p>

        {success && <p className="mt-4 text-sm text-signal">{success}</p>}

        {supersedingAreaId && (
          <p className="mt-4 rounded-md border border-signal-orange/40 bg-signal-orange/10 p-3 text-sm text-paper">
            Reassigning an area an NGO could only partly cover — pick a different organization below. The old
            assignment is closed out when you allocate.
            <button onClick={() => setSupersedingAreaId(null)} className="ml-2 text-xs text-muted underline">
              Cancel
            </button>
          </p>
        )}

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
