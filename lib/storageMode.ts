export type StorageModeSurface = 'cards' | 'friends' | 'schedule';
export type StorageModeTone = 'local' | 'persisted';

interface StorageModeCopy {
  body: string;
  title: string;
  tone: StorageModeTone;
}

const localBodies: Record<StorageModeSurface, string> = {
  cards: '로그인 전에는 카드가 이 기기에만 저장돼요. 로그인하면 계정 기준으로 이어서 관리할 수 있어요.',
  friends: '로그인 전 친구 목록은 이 기기에서만 확인돼요. 로그인하면 친구 요청과 친구 목록을 계정에 저장해요.',
  schedule: '로그인 전 직접 추가한 일정과 할일은 이 기기에만 저장돼요. 로그인하면 계정 일정으로 이어져요.',
};

const persistedBodies: Record<StorageModeSurface, string> = {
  cards: '카드와 응답 흐름을 계정에 저장하고 있어요.',
  friends: '친구 요청과 친구 목록을 계정에 저장하고 있어요.',
  schedule: '직접 추가한 일정과 할일을 계정에 저장하고 있어요.',
};

export function getStorageModeCopy(persisted: boolean, surface: StorageModeSurface): StorageModeCopy {
  if (persisted) {
    return {
      body: persistedBodies[surface],
      title: '계정에 저장 중',
      tone: 'persisted',
    };
  }

  return {
    body: localBodies[surface],
    title: '로그인 전 로컬 저장',
    tone: 'local',
  };
}
