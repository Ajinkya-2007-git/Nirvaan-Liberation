// Volunteer signup — STAGE 2 of 2. Reached only after a successful
// login (see Login.tsx), which means we now have a real session and
// auth.uid() actually resolves to this person — so our RLS policy
// "volunteers can manage own profile" (auth.uid() = id) will accept
// this insert, unlike a Stage 1 attempt would have.

import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';

const SKILL_OPTIONS = ['medical', 'general', 'boat', 'rescue'] as const;
type Skill = (typeof SKILL_OPTIONS)[number];

export function CompleteVolunteerProfile() {
  const navigate = useNavigate();

  // We need to know WHO is logged in before we can submit anything —
  // this holds their id once we've fetched it.
  const [userId, setUserId] = useState<string | null>(null);

  const [signupType, setSignupType] = useState<'individual' | 'group'>('individual');
  const [memberCount, setMemberCount] = useState('');
  const [skills, setSkills] = useState<Set<Skill>>(new Set());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // On page load, ask Supabase who's currently logged in. If nobody
  // is, send them to login instead of showing a form that would just
  // fail on submit.
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

  function toggleSkill(skill: Skill) {
    const next = new Set(skills);
    if (next.has(skill)) {
      next.delete(skill);
    } else {
      next.add(skill);
    }
    setSkills(next);
  }

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
      setError('Please share your location so nearby requests can find you.');
      return;
    }
    if (!userId) {
      setError('Not logged in.');
      return;
    }

    setSubmitting(true);

    // We need the profile's name/phone (saved by the trigger during
    // signup) to duplicate onto this row for the map to display —
    // see add-volunteer-contact-fields.sql for why we duplicate it.
    const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', userId).single();

    const { error: insertError } = await supabase.from('volunteer_profiles').insert({
      id: userId,
      full_name: profile?.full_name,
      phone: profile?.phone,
      signup_type: signupType,
      member_count: signupType === 'group' ? Number(memberCount) : null,
      skills: Array.from(skills),
      latitude: location.lat,
      longitude: location.lng,
    });

    setSubmitting(false);

    if (insertError) {
      setError(`Could not save your profile: ${insertError.message}`);
      return;
    }

    navigate('/map');
  }

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-paper">Complete your volunteer profile</h1>
      <p className="mt-1 text-sm text-muted">Step 2 of 2 — this is what shows on the live map.</p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setSignupType('individual')}
          className={`flex-1 rounded-md border px-4 py-2 ${
            signupType === 'individual' ? 'border-signal bg-signal/10 text-signal' : 'border-hairline text-muted'
          }`}
        >
          Individual
        </button>
        <button
          type="button"
          onClick={() => setSignupType('group')}
          className={`flex-1 rounded-md border px-4 py-2 ${
            signupType === 'group' ? 'border-signal bg-signal/10 text-signal' : 'border-hairline text-muted'
          }`}
        >
          Group / team
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        {signupType === 'group' && (
          <div>
            <label className="block text-sm font-medium text-paper">Estimated member count</label>
            <input
              type="number"
              min={1}
              required
              value={memberCount}
              onChange={(e) => setMemberCount(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-paper">Skills available</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SKILL_OPTIONS.map((skill) => (
              <label key={skill} className="flex items-center gap-2 text-sm capitalize text-paper">
                <input type="checkbox" checked={skills.has(skill)} onChange={() => toggleSkill(skill)} />
                {skill}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-paper">Location</label>
          <button
            type="button"
            onClick={detectLocation}
            disabled={locating}
            className="mt-1 w-full rounded-md border border-hairline bg-panel px-4 py-2 text-paper hover:border-signal"
          >
            {locating ? 'Detecting...' : location ? 'Location detected ✓' : 'Use my current location'}
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !userId}
          className="rounded-md bg-signal px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'Finish setup'}
        </button>
      </form>
      </div>
    </div>
  );
}
