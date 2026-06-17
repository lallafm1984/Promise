export type AppNotificationPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unknown';
export type NotificationStatusTone = 'ready' | 'local' | 'blocked' | 'off' | 'pending';

interface NotificationStatusInput {
  enabled: boolean;
  isAuthenticated: boolean;
  permissionStatus: AppNotificationPermissionStatus;
}

interface NotificationStatusCopy {
  body: string;
  label: string;
  tone: NotificationStatusTone;
}

export function getNotificationStatusCopy(input: NotificationStatusInput): NotificationStatusCopy {
  if (!input.enabled) {
    return {
      body: '켜기를 누르면 휴대폰 알림 권한을 요청해요.',
      label: 'OFF',
      tone: 'off',
    };
  }

  if (input.permissionStatus === 'denied') {
    return {
      body: 'Android 설정에서 언제볼래 알림 권한을 허용해야 받을 수 있어요.',
      label: '권한 차단',
      tone: 'blocked',
    };
  }

  if (input.permissionStatus !== 'granted') {
    return {
      body: '휴대폰 알림 권한 확인이 아직 끝나지 않았어요.',
      label: '권한 확인 필요',
      tone: 'pending',
    };
  }

  if (!input.isAuthenticated) {
    return {
      body: '이 기기 리마인드는 받을 수 있어요. 친구/카드 푸시는 로그인 후 계정에 연결돼요.',
      label: '기기 알림 준비됨',
      tone: 'local',
    };
  }

  return {
    body: '친구 요청, 약속 카드, 리마인드를 이 휴대폰과 계정에 연결해요.',
    label: '계정 알림 준비됨',
    tone: 'ready',
  };
}
