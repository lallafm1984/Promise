import type { HostProfile } from '@/types/promise';

type ShareableProfile = Pick<HostProfile, 'displayName' | 'handle' | 'profileUrl'>;

function getHttpsProfileUrl(profileUrl: string) {
  const trimmedUrl = profileUrl.trim();

  return /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
}

export function getProfileShareUrlForClipboard(profile: Pick<ShareableProfile, 'profileUrl'>) {
  return getHttpsProfileUrl(profile.profileUrl);
}

export function getProfileShareUrlForMessage(profile: Pick<ShareableProfile, 'profileUrl'>) {
  return getHttpsProfileUrl(profile.profileUrl).replace(/^https?:\/\//i, '');
}

export function getProfileHandleForClipboard(profile: Pick<ShareableProfile, 'handle'>) {
  return `@${profile.handle}`;
}

export function buildProfileShareMessage(profile: ShareableProfile) {
  return [
    `${profile.displayName}님의 언제볼래 친구 아이디`,
    `@${profile.handle}`,
    '언제볼래에서 친구 추가해 주세요.',
  ].join('\n');
}
