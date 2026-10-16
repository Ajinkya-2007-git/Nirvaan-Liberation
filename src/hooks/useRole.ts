// Tells components WHO is looking at the page, so live request data can be limited to
// admins, volunteers and approved NGOs (everyone else sees no real request data).
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type AppRole = 'admin' | 'volunteer' | 'ngo_admin' | 'user' | null;

export function useRole() {
  const [state, setState] = useState<{ loading: boolean; userId: string | null; role: AppRole; ngoApproved: boolean }>({
    loading: true,
    userId: null,
    role: null,
    ngoApproved: false,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        if (active) setState({ loading: false, userId: null, role: null, ngoApproved: false });
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const role = (profile?.role ?? 'user') as AppRole;
      let ngoApproved = false;
      if (role === 'ngo_admin') {
        const { data: ngo } = await supabase.from('ngos').select('status').eq('id', user.id).maybeSingle();
        ngoApproved = ngo?.status === 'approved';
      }
      if (active) setState({ loading: false, userId: user.id, role, ngoApproved });
    }
    load();

    // Re-check on login/logout. Deferred with setTimeout because calling Supabase
    // directly inside this callback can deadlock.
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => load(), 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const canSeeData =
    state.role === 'admin' || state.role === 'volunteer' || (state.role === 'ngo_admin' && state.ngoApproved);

  return { ...state, canSeeData };
}
