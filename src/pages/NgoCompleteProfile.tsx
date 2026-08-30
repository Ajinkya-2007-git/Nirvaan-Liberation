// NGO signup — STAGE 2 of 2. Reached after login, same reasoning as
// CompleteVolunteerProfile.tsx: a real session has to exist before
// RLS will allow this insert. Submitting here creates a row in
// "ngos" with status defaulting to 'pending_approval' (see
// schema.sql) — nothing here can set it to 'approved' directly; only
// an admin account can flip that column (also enforced by RLS, not
// just app logic).

import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';

export function NgoCompleteProfile() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [areaOfOperation, setAreaOfOperation] = useState('');
  const [resourcesAvailable, setResourcesAvailable] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate('/volunteer/login');
        return;
      }
      setUserId(data.user.id);
    }
    checkSession();
  }, [navigate]);

  function detectLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setError('Could not detect your location. Please allow location access and try again.');
        setLocating(false);
      },
      // Without this, a failed location lookup can hang forever
      // instead of failing — see useQuickSos.ts for the full
      // explanation of why this happens and why 10s is a sensible cap.
      { timeout: 10000, maximumAge: 0 }
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!location) {
      setError('Please share your organization\'s location.');
      return;
    }
    if (!userId) {
      setError('Not logged in.');
      return;
    }

    setSubmitting(true);

    // The organization's display name was saved as "full_name" on
    // their profiles row during signup (see NgoSignup.tsx for why
    // it's stored under that key) — pull it back out here.
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();

    const { error: insertError } = await supabase.from('ngos').insert({
      id: userId,
      org_name: profile?.full_name ?? 'Unnamed organization',
      registration_number: registrationNumber || null,
      area_of_operation: areaOfOperation,
      resources_available: resourcesAvailable,
      latitude: location.lat,
      longitude: location.lng,
      // status isn't set here at all — it defaults to
      // 'pending_approval' in the database (schema.sql), and no
      // policy lets this insert set it to anything else.
    });

    setSubmitting(false);

    if (insertError) {
      setError(`Could not save your organization's details: ${insertError.message}`);
      return;
    }

    navigate('/ngo/pending');
  }

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-paper">Organization details</h1>
        <p className="mt-1 text-sm text-muted">Step 2 of 2 — an admin reviews this before your organization goes live.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-paper">Registration number (optional)</label>
            <input
              type="text"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">Area of operation</label>
            <input
              type="text"
              required
              placeholder="e.g. Vadodara and surrounding districts"
              value={areaOfOperation}
              onChange={(e) => setAreaOfOperation(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">Resources available</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. 2 boats, 15 volunteers, medical supplies"
              value={resourcesAvailable}
              onChange={(e) => setResourcesAvailable(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">Location</label>
            <button
              type="button"
              onClick={detectLocation}
              disabled={locating}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-4 py-2 text-paper hover:border-signal"
            >
              {locating ? 'Detecting...' : location ? 'Location detected ✓' : 'Use current location'}
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !userId}
            className="rounded-md bg-signal px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit for review'}
          </button>
        </form>
      </div>
    </div>
  );
}
