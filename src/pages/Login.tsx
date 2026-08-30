// Login — shared by volunteers, NGOs, and admins alike. It's one
// email/password form regardless of account type; what happens
// AFTER logging in branches by role, since each type of account
// goes to a completely different part of the app.

import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Set instead of navigating away when an NGO account exists but
  // isn't approved yet — there's nowhere useful to send them, so we
  // just explain their status right here on the login page.
  const [statusMessage, setStatusMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setStatusMessage('');
    setSubmitting(true);

    // Everything below is now wrapped in try/catch/finally. Before
    // this fix, ANY unexpected error partway through (a network
    // hiccup, a Supabase project waking up from being idle, etc.)
    // would throw past every setSubmitting(false) call in this
    // function and leave the button stuck on "Logging in..."
    // forever, with no error message and no way to tell what went
    // wrong. The "finally" block guarantees setSubmitting(false)
    // always runs no matter what happens above it, and the "catch"
    // guarantees you see an actual error message instead of silence.
    try {
      // Attempt the actual login. On success, Supabase stores a
      // session in the browser automatically — every future request
      // (including our RLS-protected inserts) will now include it.
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

      if (loginError || !data.user) {
        // Supabase deliberately gives a vague message here ("Invalid
        // login credentials") rather than saying which part was wrong —
        // that's a security best practice, so we don't need to fix it,
        // just pass it through as-is.
        setError(loginError?.message ?? 'Login failed');
        return;
      }

      // Now check the type of account this is. Admins skip the
      // volunteer-profile check entirely and go straight to the admin
      // panel — the two roles use completely separate parts of the app.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      // A missing profiles row (rather than just a query error) means
      // the signup trigger never ran for this account — most likely
      // it was created before that trigger existed. Say so plainly
      // instead of silently falling through to the volunteer flow,
      // which would just confuse things further.
      if (profileError) {
        setError('No profile found for this account. It may have been created before the current sign-up flow — try signing up again.');
        return;
      }

      if (profile?.role === 'admin') {
        navigate('/admin');
        return;
      }

      if (profile?.role === 'ngo_admin') {
        const { data: ngo } = await supabase.from('ngos').select('status').eq('id', data.user.id).maybeSingle();

        if (!ngo) {
          navigate('/ngo/complete-profile');
          return;
        }
        if (ngo.status === 'pending_approval') {
          setStatusMessage("Your organization is under review. You'll be notified once approved.");
          return;
        }
        if (ngo.status === 'rejected') {
          setStatusMessage('Your organization application was not approved. Contact the event organizers for details.');
          return;
        }
        // status === 'approved'
        navigate('/map');
        return;
      }

      // Now check: does this volunteer already have a completed
      // profile (stage 2)? ".maybeSingle()" (instead of ".single()")
      // returns null instead of throwing an error when no row exists —
      // exactly what we want here, since "no row yet" is an expected,
      // normal case for a first-time login, not a bug.
      const { data: volunteerProfile } = await supabase
        .from('volunteer_profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!volunteerProfile) {
        navigate('/volunteer/complete-profile');
      } else {
        navigate('/map');
      }
    } catch (err) {
      // Catches anything NOT already handled above — a network
      // failure, the Supabase project being temporarily unreachable,
      // etc. Without this, an error here would previously vanish
      // into the browser console with the button stuck forever.
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto max-w-md px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-paper">Log in</h1>

        {statusMessage ? (
          <p className="mt-6 rounded-md border border-hairline bg-panel p-4 text-sm text-paper">{statusMessage}</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-paper">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-paper">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-signal px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Logging in...' : 'Log in'}
            </button>

            <p className="text-center text-sm text-muted">
              No account yet?{' '}
              <Link to="/volunteer/signup" className="text-signal hover:underline">
                Volunteer sign up
              </Link>{' '}
              ·{' '}
              <Link to="/ngo/signup" className="text-signal hover:underline">
                NGO sign up
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
