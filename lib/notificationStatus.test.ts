import { describe, expect, it } from 'vitest';

import { getNotificationStatusCopy } from './notificationStatus';

describe('notification status copy', () => {
  it('explains notifications are off before the user enables them', () => {
    expect(
      getNotificationStatusCopy({
        enabled: false,
        isAuthenticated: false,
        permissionStatus: 'undetermined',
      }),
    ).toEqual({
      body: '켜기를 누르면 휴대폰 알림 권한을 요청해요.',
      label: 'OFF',
      tone: 'off',
    });
  });

  it('warns when the phone notification permission is blocked', () => {
    const copy = getNotificationStatusCopy({
      enabled: true,
      isAuthenticated: true,
      permissionStatus: 'denied',
    });

    expect(copy.label).toBe('권한 차단');
    expect(copy.body).toContain('Android 설정');
    expect(copy.tone).toBe('blocked');
  });

  it('shows account push status when permissions are granted and logged in', () => {
    expect(
      getNotificationStatusCopy({
        enabled: true,
        isAuthenticated: true,
        permissionStatus: 'granted',
      }),
    ).toEqual({
      body: '친구 요청, 약속 카드, 리마인드를 이 휴대폰과 계정에 연결해요.',
      label: '계정 알림 준비됨',
      tone: 'ready',
    });
  });

  it('explains local-only notification behavior before login', () => {
    const copy = getNotificationStatusCopy({
      enabled: true,
      isAuthenticated: false,
      permissionStatus: 'granted',
    });

    expect(copy.label).toBe('기기 알림 준비됨');
    expect(copy.body).toContain('로그인');
    expect(copy.tone).toBe('local');
  });
});
