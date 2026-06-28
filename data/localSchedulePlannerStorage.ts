import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAccountScopedStorageKey } from '@/lib/accountScopedStorage';
import { parseSchedulePlannerCache } from '@/lib/schedulePlannerState';
import { supabase } from '@/lib/supabase';

export const SCHEDULE_PLANNER_CACHE_PREFIX = '@whenbollae/schedule-planner-cache/v1';

export async function getSchedulePlannerCacheKey() {
  const authSession = await supabase?.auth.getSession();

  return getAccountScopedStorageKey(SCHEDULE_PLANNER_CACHE_PREFIX, authSession?.data.session?.user.id ?? null);
}

export async function readSchedulePlannerCache() {
  return parseSchedulePlannerCache(await AsyncStorage.getItem(await getSchedulePlannerCacheKey()));
}
