import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      if (!supabase) {
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (mounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setIsLoading(false);
      }) ?? { data: { subscription: null } };

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.user),
    isLoading,
  };
}
