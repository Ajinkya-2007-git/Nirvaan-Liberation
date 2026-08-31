// NGO signup — STAGE 1 of 2, mirrors VolunteerSignup.tsx exactly:
// create the account with a one-time code (not an email link — see
// VolunteerSignup.tsx's comments for why), then collect
// organization-specific details afterward once a real session
// exists. The only real difference is role: 'ngo_admin' instead of
// 'volunteer', which is what our database trigger (trigger.sql)
// uses to set this account's role automatically.

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';

export function NgoSignup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [awaitingCode, setAwaitingCode] = useState(false);
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
        data: {
          // Reusing the "full_name" key (instead of adding an
          // "org_name" one) so our EXISTING trigger.sql works
          // unchanged for NGOs too — it just becomes this
          // organization's display name on their profiles row.
          full_name: orgName,
          phone,
          role: 'ngo_admin',
        },
      },
    });

    setSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (authData.session) {
      navigate('/ngo/complete-profile');
      return;
    }

    setAwaitingCode(true);
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setVerifyError('');
    setVerifying(true);

    const { data, error: verifyErr } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });

    setVerifying(false);

    if (verifyErr || !data.session) {
      setVerifyError(verifyErr?.message ?? 'Invalid or expired code. Please check and try again.');
      return;
    }

    navigate('/ngo/complete-profile');
  }

  if (awaitingCode) {
    return (
      <div className="min-h-screen bg-ink">
        <Header />
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <h1 className="font-display text-2xl font-semibold text-paper">{t('ngoSignup.enterCode')}</h1>
          <p className="text-muted">
            {t('ngoSignup.codeSentTo')} <strong className="text-paper">{email}</strong>. {t('ngoSignup.codeInstructions')}
          </p>

          <form onSubmit={handleVerifyCode} className="mt-4 flex w-full flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              required
              placeholder={t('ngoSignup.enterCode') ?? undefined}
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
              {verifying ? t('ngoSignup.verifying') : t('ngoSignup.verifyAndContinue')}
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
        <h1 className="font-display text-2xl font-semibold text-paper">{t('ngoSignup.title')}</h1>
        <p className="mt-1 text-sm text-muted">
          {t('ngoSignup.step1')}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-paper">{t('ngoSignup.orgName')}</label>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">{t('ngoSignup.contactPhone')}</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">{t('ngoSignup.email')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-paper"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper">{t('ngoSignup.password')}</label>
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
            {submitting ? t('ngoSignup.creatingAccount') : t('ngoSignup.continueBtn')}
          </button>

          <p className="text-center text-sm text-muted">
            {t('ngoSignup.alreadyHaveAccount')}{' '}
            <Link to="/volunteer/login" className="text-signal hover:underline">
              {t('ngoSignup.logIn')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
