import { useState, type ReactNode } from 'react';
import {
  AtSign,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Database,
  Globe2,
  KeyRound,
  LogIn,
  Link2,
  LogOut,
  PencilLine,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, AppScreen, Card, SectionHeader } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { mapProfileToHostProfile, updateAuthenticatedProfile } from '@/data/supabaseProfile';
import { useNotificationSettings } from '@/hooks/useAppNotifications';
import { usePromiseData } from '@/hooks/usePromiseData';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { getNotificationStatusCopy } from '@/lib/notificationStatus';
import { resolveDisplayProfile } from '@/lib/profileDisplay';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getAuthRedirectUrl, signInWithSocialProvider, signOutFromSupabase } from '@/lib/supabaseAuth';

type ProviderId = 'google' | 'kakao';

const providerMeta: Record<ProviderId, { label: string; badge: string; backgroundColor: string; textColor: string }> = {
  google: {
    label: 'Google',
    badge: 'G',
    backgroundColor: palette.surface,
    textColor: palette.ink,
  },
  kakao: {
    label: '카카오톡',
    badge: 'K',
    backgroundColor: palette.kakao,
    textColor: palette.ink,
  },
};

export default function ProfileScreen() {
  const router = useRouter();
  const { profile } = usePromiseData();
  const { isAuthenticated, user } = useSupabaseAuth();
  const notificationSettings = useNotificationSettings();
  const [notice, setNotice] = useState<string | null>(null);
  const [profileDraftName, setProfileDraftName] = useState('');
  const [profileDraftHandle, setProfileDraftHandle] = useState('');
  const [profileEditVisible, setProfileEditVisible] = useState(false);
  const [profileEditError, setProfileEditError] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState(profile);
  const [isAuthWorking, setIsAuthWorking] = useState(false);
  const currentProfile = resolveDisplayProfile(profile, savedProfile);
  const displayName = currentProfile?.displayName ?? user?.email ?? '내 프로필';
  const handle = currentProfile?.handle ?? 'handle';
  const profileUrl = currentProfile?.profileUrl ?? 'whenbollae.app/@handle';
  const avatarLabel = displayName.slice(0, 1);
  const notificationStatus = getNotificationStatusCopy({
    enabled: notificationSettings.enabled,
    isAuthenticated,
    permissionStatus: notificationSettings.permissionStatus,
  });

  async function handleProviderPress(provider: ProviderId) {
    const providerLabel = providerMeta[provider].label;

    if (!isSupabaseConfigured) {
      setNotice(`${providerLabel} 로그인은 Supabase 프로젝트 URL과 publishable key 설정 후 연결할 수 있어요.`);
      return;
    }

    setIsAuthWorking(true);

    try {
      const session = await signInWithSocialProvider(provider);
      setNotice(
        session
          ? `${providerLabel} 로그인이 완료됐어요.`
          : `${providerLabel} 로그인 창을 열었어요. 완료되지 않으면 Supabase Redirect URL에 ${getAuthRedirectUrl()}을 추가해 주세요.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${providerLabel} 로그인을 완료하지 못했어요.`);
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleSignOut() {
    setIsAuthWorking(true);

    try {
      await signOutFromSupabase();
      setNotice('로그아웃했어요.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '로그아웃하지 못했어요.');
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleNotificationToggle() {
    if (notificationSettings.enabled) {
      await notificationSettings.disable();
      setNotice('폰 알림을 껐어요.');
      return;
    }

    const enabled = await notificationSettings.enable();
    setNotice(
      enabled
        ? '폰 알림을 켰어요. 새 친구 요청, 친구 추가 완료, 새 약속 카드, 약속 리마인드가 알림으로 표시됩니다.'
        : notificationSettings.error ?? '휴대폰 알림 권한이 필요해요.',
    );
  }

  async function handleNotificationTest() {
    const sent = await notificationSettings.sendTest();

    setNotice(sent ? '테스트 알림을 보냈어요.' : '테스트 알림을 보내지 못했어요. 알림 권한과 설정을 확인해 주세요.');
  }

  function openProfileEdit() {
    if (!isAuthenticated) {
      setNotice('프로필을 수정하려면 먼저 로그인해 주세요.');
      return;
    }

    setProfileDraftName(displayName);
    setProfileDraftHandle(handle);
    setProfileEditError(null);
    setProfileEditVisible(true);
  }

  function closeProfileEdit() {
    if (isAuthWorking) {
      return;
    }

    setProfileEditVisible(false);
    setProfileEditError(null);
  }

  async function handleSaveProfile() {
    setIsAuthWorking(true);
    setProfileEditError(null);

    try {
      const updatedProfile = await updateAuthenticatedProfile({
        displayName: profileDraftName,
        handle: profileDraftHandle,
      });
      setSavedProfile(mapProfileToHostProfile(updatedProfile));
      setProfileEditVisible(false);
      setNotice('프로필을 저장했어요.');
    } catch (error) {
      setProfileEditError(error instanceof Error ? error.message : '프로필을 저장하지 못했어요.');
    } finally {
      setIsAuthWorking(false);
    }
  }

  return (
    <>
      <AppScreen reserveBottomTabs>
        <View style={styles.header}>
          <View style={styles.headerShapePrimary} />
          <View style={styles.headerShapeMint} />
          <View style={styles.headerShapeLime} />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLabel}</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>내정보</Text>
            <Text style={styles.title}>{displayName}</Text>
            <Text style={styles.subtitle}>로그인, 공개 프로필, 계정 데이터를 관리해요.</Text>
          </View>
        </View>

        <Card style={styles.authCard}>
          <View style={styles.authTopRow}>
            <View style={styles.authIcon}>
              <ShieldCheck size={22} color={palette.primaryDeep} />
            </View>
            <View style={styles.authCopy}>
              <Text style={styles.cardKicker}>Supabase Auth</Text>
              <Text style={styles.authTitle}>
                {isAuthenticated ? '로그인됨' : isSupabaseConfigured ? '로그인 연결 준비됨' : '로그인 설정 대기'}
              </Text>
            </View>
            <StatusPill
              tone={isAuthenticated || isSupabaseConfigured ? 'ready' : 'pending'}
              label={isAuthenticated ? '동기화' : isSupabaseConfigured ? '준비됨' : '설정 필요'}
            />
          </View>
          <Text style={styles.authBody}>
            {isAuthenticated
              ? '카드와 일정이 Supabase 계정에 저장됩니다.'
              : `Google 또는 카카오톡으로 로그인하면 프로필, 친구, 약속 카드가 계정에 묶입니다. Redirect: ${getAuthRedirectUrl()}`}
          </Text>
          {isAuthenticated ? (
            <ActionButton label={isAuthWorking ? '처리 중' : '로그아웃'} variant="secondary" fullWidth onPress={() => void handleSignOut()} />
          ) : (
            <View style={styles.providerStack}>
              <ActionButton
                label="로그인 페이지 열기"
                icon={<LogIn size={17} color={palette.onLight} />}
                fullWidth
                onPress={() => router.push('/login' as never)}
              />
              <ProviderButton provider="google" disabled={isAuthWorking} onPress={() => void handleProviderPress('google')} />
              <ProviderButton provider="kakao" disabled={isAuthWorking} onPress={() => void handleProviderPress('kakao')} />
            </View>
          )}
        </Card>

        <SectionHeader title="공개 프로필" action={`@${handle}`} />
        <Card style={styles.identityCard}>
          <ProfileLine icon={<UserRound size={18} color={palette.primaryDeep} />} label="이름" value={displayName} />
          <ProfileLine icon={<AtSign size={18} color={palette.primaryDeep} />} label="아이디" value={`@${handle}`} />
          <ProfileLine icon={<Link2 size={18} color={palette.primaryDeep} />} label="프로필 링크" value={profileUrl} />
          <ActionButton
            label="프로필 수정"
            variant="secondary"
            icon={<PencilLine size={17} color={palette.primaryDeep} />}
            fullWidth
            onPress={openProfileEdit}
          />
        </Card>

        <SectionHeader title="계정 데이터" action="동기화 대상" />
        <View style={styles.syncGrid}>
          <SyncTile icon={<UserRound size={18} color={palette.primaryDeep} />} title="프로필" body="이름, 아이디, 링크" />
          <SyncTile icon={<Globe2 size={18} color={palette.primaryDeep} />} title="친구" body="친구 목록과 요청" />
          <SyncTile icon={<Database size={18} color={palette.primaryDeep} />} title="카드" body="보낸 카드와 응답" />
          <SyncTile icon={<BellRing size={18} color={palette.primaryDeep} />} title="알림" body="친구/카드/리마인드" />
        </View>

        <SectionHeader title="폰 알림" action={notificationSettings.enabled ? 'ON' : 'OFF'} />
        <Card style={styles.notificationCard}>
          <View style={styles.notificationIcon}>
            <BellRing size={20} color={palette.primaryDeep} />
          </View>
          <View style={styles.notificationCopy}>
            <View style={styles.notificationTitleRow}>
              <Text style={styles.notificationTitle}>알림 설정</Text>
              <View style={[styles.notificationStatusPill, styles[`${notificationStatus.tone}NotificationStatusPill`]]}>
                <Text style={styles.notificationStatusText}>{notificationStatus.label}</Text>
              </View>
            </View>
            <Text style={styles.notificationBody}>
              친구 요청과 친구 추가 완료, 받은 약속 카드, 약속 리마인드를 휴대폰 알림으로 받아요.
            </Text>
            <Text style={styles.notificationStatusBody}>{notificationStatus.body}</Text>
            {notificationSettings.error ? <Text style={styles.notificationError}>{notificationSettings.error}</Text> : null}
          </View>
          <View style={styles.notificationActions}>
            <ActionButton
              label={notificationSettings.isWorking ? '처리 중' : notificationSettings.enabled ? '끄기' : '켜기'}
              variant={notificationSettings.enabled ? 'secondary' : 'primary'}
              disabled={notificationSettings.isWorking}
              onPress={() => void handleNotificationToggle()}
            />
            <ActionButton
              label="테스트"
              variant="ghost"
              disabled={!notificationSettings.enabled || notificationSettings.isWorking}
              onPress={() => void handleNotificationTest()}
            />
          </View>
        </Card>

        <SectionHeader title="로그인 설정" />
        <View style={styles.settingStack}>
          <SettingRow
            icon={<KeyRound size={19} color={palette.primaryDeep} />}
            title="세션 저장"
            body="앱을 다시 열어도 로그인 상태 유지"
            value="자동"
          />
          <SettingRow
            icon={<ShieldCheck size={19} color={palette.primaryDeep} />}
            title="데이터 보호"
            body="사용자별 접근 권한으로 관리"
            value="RLS"
          />
          <SettingRow
            icon={<LogOut size={19} color={palette.primaryDeep} />}
            title="로그아웃"
            body="로그인 연결 후 사용 가능"
            value="대기"
          />
        </View>
      </AppScreen>

      <ProfileEditModal
        displayName={profileDraftName}
        error={profileEditError}
        handle={profileDraftHandle}
        isSaving={isAuthWorking}
        visible={profileEditVisible}
        onChangeDisplayName={setProfileDraftName}
        onChangeHandle={setProfileDraftHandle}
        onClose={closeProfileEdit}
        onSave={() => void handleSaveProfile()}
      />
      <NoticeModal message={notice} onClose={() => setNotice(null)} />
    </>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'ready' | 'pending' }) {
  return (
    <View style={[styles.statusPill, tone === 'ready' ? styles.readyPill : styles.pendingPill]}>
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

function ProviderButton({ disabled, provider, onPress }: { disabled?: boolean; provider: ProviderId; onPress: () => void }) {
  const meta = providerMeta[provider];

  return (
    <Pressable
      accessibilityLabel={`${meta.label} 로그인`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerButton,
        { backgroundColor: meta.backgroundColor },
        provider === 'kakao' && styles.kakaoProviderButton,
        disabled && styles.disabledProviderButton,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.providerBadge, provider === 'kakao' && styles.kakaoProviderBadge]}>
        <Text style={[styles.providerBadgeText, provider === 'kakao' && styles.kakaoProviderBadgeText]}>{meta.badge}</Text>
      </View>
      <Text style={[styles.providerText, { color: meta.textColor }]}>{meta.label}로 계속</Text>
      <ChevronRight size={18} color={meta.textColor} />
    </Pressable>
  );
}

function ProfileLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.profileLine}>
      <View style={styles.profileLineIcon}>{icon}</View>
      <View style={styles.profileLineCopy}>
        <Text style={styles.profileLineLabel}>{label}</Text>
        <Text style={styles.profileLineValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SyncTile({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Card style={styles.syncTile}>
      <View style={styles.syncIcon}>{icon}</View>
      <Text style={styles.syncTitle}>{title}</Text>
      <Text style={styles.syncBody}>{body}</Text>
    </Card>
  );
}

function SettingRow({
  icon,
  title,
  body,
  value,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  value: string;
}) {
  return (
    <Card style={styles.settingCard}>
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingBody}>{body}</Text>
      </View>
      <View style={styles.settingValuePill}>
        <Text style={styles.settingValue}>{value}</Text>
      </View>
    </Card>
  );
}

function ProfileEditModal({
  displayName,
  error,
  handle,
  isSaving,
  visible,
  onChangeDisplayName,
  onChangeHandle,
  onClose,
  onSave,
}: {
  displayName: string;
  error: string | null;
  handle: string;
  isSaving: boolean;
  visible: boolean;
  onChangeDisplayName: (value: string) => void;
  onChangeHandle: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable disabled={isSaving} style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.cardKicker}>공개 프로필</Text>
                <Text style={styles.modalTitle}>프로필 수정</Text>
              </View>
              <Pressable
                accessibilityLabel="프로필 수정 닫기"
                accessibilityRole="button"
                disabled={isSaving}
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.modalCloseButton, pressed && !isSaving && styles.pressed]}>
                <X size={19} color={palette.primaryDeep} />
              </Pressable>
            </View>

            <View style={styles.inputStack}>
              <View style={styles.inputShell}>
                <Text style={styles.inputLabel}>이름</Text>
                <TextInput
                  accessibilityLabel="프로필 이름"
                  maxLength={60}
                  onChangeText={onChangeDisplayName}
                  placeholder="이름을 입력하세요"
                  placeholderTextColor={palette.inkSoft}
                  style={styles.textInput}
                  value={displayName}
                />
              </View>
              <View style={styles.inputShell}>
                <Text style={styles.inputLabel}>아이디</Text>
                <View style={styles.handleInputRow}>
                  <Text style={styles.handlePrefix}>@</Text>
                  <TextInput
                    accessibilityLabel="프로필 아이디"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={30}
                    onChangeText={onChangeHandle}
                    placeholder="handle"
                    placeholderTextColor={palette.inkSoft}
                    style={[styles.textInput, styles.handleInput]}
                    value={handle}
                  />
                </View>
              </View>
            </View>

            {error ? <Text style={styles.modalError}>{error}</Text> : null}

            <View style={styles.modalActions}>
              <ActionButton label="취소" variant="secondary" disabled={isSaving} fullWidth onPress={onClose} />
              <ActionButton label={isSaving ? '저장 중' : '저장'} disabled={isSaving} fullWidth onPress={onSave} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NoticeModal({ message, onClose }: { message: string | null; onClose: () => void }) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={message !== null}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.cardKicker}>로그인 준비</Text>
                <Text style={styles.modalTitle}>연결 설정이 필요해요</Text>
              </View>
              <Pressable
                accessibilityLabel="안내 닫기"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}>
                <X size={19} color={palette.primaryDeep} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>{message}</Text>
            <ActionButton label="확인" fullWidth onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 138,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  headerShapePrimary: {
    backgroundColor: palette.lilac,
    height: 112,
    position: 'absolute',
    right: -30,
    top: -28,
    transform: [{ rotate: '18deg' }],
    width: 104,
  },
  headerShapeMint: {
    backgroundColor: palette.aquaSoft,
    bottom: -22,
    height: 84,
    left: -18,
    position: 'absolute',
    transform: [{ rotate: '-12deg' }],
    width: 132,
  },
  headerShapeLime: {
    backgroundColor: palette.primary,
    borderRadius: radius.pill,
    height: 42,
    position: 'absolute',
    right: 98,
    top: 20,
    width: 42,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 3,
    height: 66,
    justifyContent: 'center',
    width: 66,
    zIndex: 1,
  },
  avatarText: {
    color: palette.onLight,
    fontSize: 25,
    fontWeight: '900',
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    zIndex: 1,
  },
  kicker: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: palette.ink,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 34,
  },
  subtitle: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  authCard: {
    backgroundColor: palette.skySoft,
    gap: spacing.md,
  },
  authTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  authIcon: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  authCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  cardKicker: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  authTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },
  authBody: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  statusPill: {
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  readyPill: {
    backgroundColor: palette.limeSoft,
  },
  pendingPill: {
    backgroundColor: palette.amberSoft,
  },
  statusPillText: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  providerStack: {
    gap: spacing.sm,
  },
  providerButton: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  kakaoProviderButton: {
    borderColor: '#B89E00',
  },
  disabledProviderButton: {
    opacity: 0.55,
  },
  providerBadge: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  kakaoProviderBadge: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  providerBadgeText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  kakaoProviderBadgeText: {
    color: palette.kakao,
  },
  providerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  identityCard: {
    gap: spacing.sm,
  },
  profileLine: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileLineIcon: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  profileLineCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  profileLineLabel: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  profileLineValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  syncGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  syncTile: {
    backgroundColor: palette.surface,
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 112,
  },
  syncIcon: {
    alignItems: 'center',
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  syncTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  syncBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  settingStack: {
    gap: spacing.sm,
  },
  notificationCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  notificationIcon: {
    alignItems: 'center',
    backgroundColor: palette.limeSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  notificationCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  notificationActions: {
    gap: spacing.xs,
    width: 104,
  },
  notificationTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  notificationTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  notificationStatusPill: {
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  readyNotificationStatusPill: {
    backgroundColor: palette.limeSoft,
  },
  localNotificationStatusPill: {
    backgroundColor: palette.skySoft,
  },
  blockedNotificationStatusPill: {
    backgroundColor: palette.coralSoft,
  },
  offNotificationStatusPill: {
    backgroundColor: palette.paper,
  },
  pendingNotificationStatusPill: {
    backgroundColor: palette.amberSoft,
  },
  notificationStatusText: {
    color: palette.primaryDeep,
    fontSize: 11,
    fontWeight: '900',
  },
  notificationBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  notificationStatusBody: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
  },
  notificationError: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
  },
  settingCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  settingIcon: {
    alignItems: 'center',
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  settingCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  settingTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  settingBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  settingValuePill: {
    backgroundColor: palette.surfaceMint,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  settingValue: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(75, 52, 40, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalPressGuard: {
    alignItems: 'center',
    width: '100%',
  },
  modalPanel: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    gap: spacing.md,
    maxWidth: 390,
    padding: spacing.md,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 27,
  },
  modalBody: {
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  inputStack: {
    gap: spacing.sm,
  },
  inputShell: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputLabel: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  textInput: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    minHeight: 34,
    padding: 0,
  },
  handleInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  handlePrefix: {
    color: palette.primaryDeep,
    fontSize: 16,
    fontWeight: '900',
  },
  handleInput: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalError: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 18,
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});
