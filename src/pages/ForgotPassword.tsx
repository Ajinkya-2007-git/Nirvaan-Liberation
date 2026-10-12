// Password reset using a typed one-time CODE (not a clickable email link), for the
// same reason as signup: email scanners can silently "click" links and burn them.
// Stages: 1) enter email  2) type the emailed code  3) choose a new password.
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<'email' | 'code' | 'newPassword'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    // Emails the code. The "Reset Password" email template in Supabase must show {{ .Token }}.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setStage('code');
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    // type 'recovery' = this code is for a password reset (not a signup confirmation).
    const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    setSubmitting(false);
    if (verifyError || !data.session) {
      setError(verifyError?.message ?? 'Invalid or expired code. Please check and try again.');
      return;
    }
    setStage('newPassword'); // a real session now exists, so the password can be changed
  }

  async function handleSetNewPassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    const { data: userData, error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError || !userData.user) {
      setSubmitting(false);
      setError(updateError?.message ?? 'Could not update password.');
      return;
    }

    // Already signed in, so route by account type exactly like Login.tsx does.
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single();
    setSubmitting(false);

    if (profile?.role === 'admin') {
      navigate('/admin');
      return;
    }
    if (profile?.role === 'ngo_admin') {
      const { data: ngo } = await supabase.from('ngos').select('status').eq('id', userData.user.id).maybeSingle();
      navigate(!ngo ? '/ngo/complete-profile' : ngo.status === 'approved' ? '/map' : '/ngo/pending');
      return;
    }
    const { data: volunteerProfile } = await supabase
      .from('volunteer_profiles')
      .select('id')
      .eq('id', userData.user.id)
      .maybeSingle();
    navigate(volunteerProfile ? '/map' : '/volunteer/complete-profile');
  }

  const inputClass = 'mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper';
  const buttonClass = 'rounded-md bg-signal px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60';

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto max-w-md px-6 py-10">
        {stage === 'email' && (
          <>
            <h1 className="font-display text-2xl font-semibold text-paper">Reset your password</h1>
            <p className="mt-1 text-sm text-muted">Enter your account's email and we'll send you a code.</p>
            <form onSubmit={handleSendCode} className="mt-6 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-paper">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={submitting} className={buttonClass}>
                {submitting ? 'Sending code...' : 'Send code'}
              </button>
              <p className="text-center text-sm text-muted">
                <Link to="/volunteer/login" className="text-signal hover:underline">
                  Back to login
                </Link>
              </p>
            </form>
          </>
        )}

        {stage === 'code' && (
          <>
            <h1 className="font-display text-2xl font-semibold text-paper">Enter your code</h1>
            <p className="mt-1 text-sm text-muted">
              We sent a code to <strong className="text-paper">{email}</strong>.
            </p>
            <form onSubmit={handleVerifyCode} className="mt-6 flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                required
                placeholder="Enter the code from your email"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-md border border-hairline bg-panel px-3 py-3 text-center text-2xl tracking-widest text-paper"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={submitting} className={buttonClass}>
                {submitting ? 'Verifying...' : 'Verify code'}
              </button>
            </form>
          </>
        )}

        {stage === 'newPassword' && (
          <>
            <h1 className="font-display text-2xl font-semibold text-paper">Choose a new password</h1>
            <form onSubmit={handleSetNewPassword} className="mt-6 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-paper">New password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={submitting} className={buttonClass}>
                {submitting ? 'Saving...' : 'Save new password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
