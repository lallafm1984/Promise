import type { HostProfile } from '@/types/promise';

export function resolveDisplayProfile(profile: HostProfile | null, savedProfile: HostProfile | null) {
  if (!savedProfile) {
    return profile;
  }

  if (!profile) {
    return savedProfile;
  }

  return savedProfile.id === profile.id ? savedProfile : profile;
}
