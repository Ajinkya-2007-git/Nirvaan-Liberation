// Volunteer signup — STAGE 1 of 2. This page creates the account,
// then confirms it using a ONE-TIME CODE rather than an email link.
//
// Why a code instead of a link? Email providers and corporate spam
// filters often "click" links inside emails automatically, to scan
// them for safety, BEFORE the real person ever opens the message.
// Supabase's confirmation link is single-use — if a scanner burns it
// first, the real click fails with "Email not confirmed" even though
// the person did everything right. A 6-digit code sitting as plain
// text in the email body can't be silently "clicked" by anything —
// only a human reading their inbox can type it in, which is exactly
// why this is Supabase's own documented fix for this problem.
//
//   Stage 1 (this file): create the account, then verify the code
//     the person receives by email. A database trigger (trigger.sql)
//     creates their "profiles" row automatically the moment the
//     account exists — no insert needed from this file.
//   Stage 2 (CompleteVolunteerProfile.tsx): once the code is
//     verified, Supabase gives us a real session immediately (no
//     separate login step needed), so we go straight there to
//     collect skills/location.

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';

export function VolunteerSignup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Once the account is created, we flip to the "enter your code"
  // screen — this being true is what triggers that view below.
  const [awaitingCode, setAwaitingCode] = useState(false);

  // The 6-digit code the user types in from their email.
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // This "options.data" object gets stored as raw_user_meta_data
        // on the new auth.users row. Our database trigger (trigger.sql)
        // reads it back out to fill in the profiles row automatically —
        // this is the ONLY place this data gets sent from our code.
        data: {
          full_name: fullName,
          phone,
          role: 'volunteer',
        },
      },
    });

    setSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // Supabase hands back an active session immediately when email
    // confirmation is turned OFF in project settings — in that rare
    // case there's nothing to verify at all, so skip straight to
    // stage 2. Otherwise, move to the "enter your code" screen.
    if (authData.session) {
      navigate('/volunteer/complete-profile');
      return;
    }

    setAwaitingCode(true);
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setVerifyError('');
    setVerifying(true);

    // This is the actual verification call. "type: 'signup'" tells
    // Supabase which KIND of code this is (it also issues codes for
    // password resets, email changes, etc. — this makes sure we're
    // checking it against the right one). On success, Supabase logs
    // the user in immediately and hands back a real session.
    const { data, error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    });

    setVerifying(false);

    if (verifyErr || !data.session) {
      setVerifyError(verifyErr?.message ?? 'Invalid or expired code. Please check and try again.');
      return;
    }

    // We now have a real session — go straight to stage 2.
    navigate('/volunteer/complete-profile');
  }

  // CODE ENTRY SCREEN
  if (awaitingCode) {
    return (
      <div className="min-h-screen bg-ink">
        <Header />
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <h1 className="font-display text-2xl font-semibold text-paper">Enter your code</h1>
          <p className="text-muted">
            We sent a code to <strong className="text-paper">{email}</strong>. Type it in below to confirm your account.
          </p>

          <form onSubmit={handleVerifyCode} className="mt-4 flex w-full flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              // Widened from an earlier guess of exactly 6 digits —
              // Supabase's actual code length can vary (yours came
              // through as 8), so this just needs to be generous
              // enough to fit any length it sends, not an exact match.
              maxLength={10}
              required
              placeholder="Enter the code from your email"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-md border border-hairline bg-panel px-3 py-3 text-center text-2xl tracking-widest text-paper"
            />

            {verifyError && <p className="text-sm text-red-400">{verifyError}</p>}

            <button
              type="submit"
              disabled={verifying}
              className="rounded-md bg-signal px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {verifying ? 'Verifying...' : 'Verify and continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-paper">Volunteer sign up</h1>
        <p className="mt-1 text-sm text-muted">Step 1 of 2 — create your account. You'll add your skills and location right after.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-paper">Your name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">Contact phone</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
            />
          </div>

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
              minLength={6}
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
            {submitting ? 'Creating account...' : 'Continue'}
          </button>

          <p className="text-center text-sm text-muted">
            Already have an account?{' '}
            <Link to="/volunteer/login" className="text-signal hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
