import { useState, type ReactNode } from 'react';
import {
  AtSign,
  BellRing,
  Copy,
  LogOut,
  PencilLine,
  Share2,
  UserRound,
  X,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, AppScreen, Card, SectionHeader } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { mapProfileToHostProfile, updateAuthenticatedProfile } from '@/data/supabaseProfile';
import { useNotificationSettings } from '@/hooks/useAppNotifications';
import { usePromiseData } from '@/hooks/usePromiseData';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { AppNotificationCategory } from '@/lib/appNotifications';
import { resolveDisplayProfile } from '@/lib/profileDisplay';
import {
  buildProfileShareMessage,
  getProfileHandleForClipboard,
} from '@/lib/profileShare';
import { signOutFromSupabase } from '@/lib/supabaseAuth';
import type { HostProfile, ReminderLead } from '@/types/promise';

const reminderLeadOptions: Array<{ value: ReminderLead; label: string }> = [
  { value: '10_MIN', label: '10분 전' },
  { value: '30_MIN', label: '30분 전' },
  { value: '1_HOUR', label: '1시간 전' },
];

export default function ProfileScreen() {
  const { profile } = usePromiseData();
  const { isAuthenticated, user } = useSupabaseAuth();
  const notificationSettings = useNotificationSettings();
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTitle, setNoticeTitle] = useState('안내');
  const [profileDraftName, setProfileDraftName] = useState('');
  const [profileEditVisible, setProfileEditVisible] = useState(false);
  const [profileShareVisible, setProfileShareVisible] = useState(false);
  const [profileEditError, setProfileEditError] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState(profile);
  const [isAuthWorking, setIsAuthWorking] = useState(false);
  const currentProfile = resolveDisplayProfile(profile, savedProfile);
  const displayName = currentProfile?.displayName ?? user?.email ?? '내 프로필';
  const handle = currentProfile?.handle ?? 'handle';
  const avatarLabel = displayName.slice(0, 1);

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

  async function handleNotificationPermissionEnable() {
    const enabled = await notificationSettings.enable();
    setNotice(enabled ? '알림 권한을 켰어요.' : notificationSettings.error ?? '휴대폰 알림 권한이 필요해요.');
  }

  async function handleShareProfile() {
    if (!currentProfile) {
      setNotice('친구 아이디를 공유하려면 먼저 로그인해 주세요.');
      return;
    }

    try {
      const result = await Share.share({
        message: buildProfileShareMessage(currentProfile),
      });

      if (result.action !== Share.dismissedAction) {
        setProfileShareVisible(false);
        setNotice('친구 아이디를 공유했어요.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '친구 아이디를 공유하지 못했어요.');
    }
  }

  async function handleCopyProfileHandle() {
    if (!currentProfile) {
      setNotice('친구 아이디를 복사하려면 먼저 로그인해 주세요.');
      return;
    }

    try {
      await Clipboard.setStringAsync(getProfileHandleForClipboard(currentProfile));
      setProfileShareVisible(false);
      setNotice('친구 아이디를 복사했어요.');
    } catch {
      setNotice('친구 아이디를 복사하지 못했어요.');
    }
  }

  function openProfileShare() {
    if (!currentProfile) {
      setNotice('친구 아이디를 공유하려면 먼저 로그인해 주세요.');
      return;
    }

    setProfileShareVisible(true);
  }

  function openProfileEdit() {
    if (!isAuthenticated) {
      setNotice('프로필을 수정하려면 먼저 로그인해 주세요.');
      return;
    }

    setProfileDraftName(displayName);
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
      });
      setSavedProfile(mapProfileToHostProfile(updatedProfile));
      setProfileEditVisible(false);
      setNoticeTitle('수정 완료');
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
            <Text style={styles.subtitle}>친구 아이디와 알림을 관리해요.</Text>
          </View>
        </View>

        <SectionHeader title="공개 프로필" action={`@${handle}`} />
        <Card style={styles.identityCard}>
          <ProfileLine icon={<UserRound size={18} color={palette.primaryDeep} />} label="이름" value={displayName} />
          <ProfileLine
            action={
              <Pressable
                accessibilityLabel="친구 아이디 공유"
                accessibilityRole="button"
                disabled={!currentProfile}
                hitSlop={8}
                onPress={openProfileShare}
                style={({ pressed }) => [
                  styles.profileLineAction,
                  !currentProfile && styles.disabledProfileLineAction,
                  pressed && currentProfile && styles.pressed,
                ]}>
                <Share2 size={18} color={palette.primaryDeep} />
              </Pressable>
            }
            icon={<AtSign size={18} color={palette.primaryDeep} />}
            label="아이디"
            value={`@${handle}`}
          />
          <ActionButton
            label="프로필 수정"
            variant="secondary"
            icon={<PencilLine size={17} color={palette.primaryDeep} />}
            fullWidth
            onPress={openProfileEdit}
          />
        </Card>

        <SectionHeader title="알림 설정" action={notificationSettings.enabled ? '권한 켜짐' : '권한 필요'} />
        <Card style={styles.notificationSettingsCard}>
          <View style={styles.notificationPermissionRow}>
            <View style={styles.notificationPermissionTitleRow}>
              <View style={styles.notificationIcon}>
                <BellRing size={20} color={palette.primaryDeep} />
              </View>
              <Text style={styles.notificationTitle}>알림 설정</Text>
            </View>
            <ActionButton
              label={notificationSettings.enabled ? '권한 켜짐' : '권한 켜기'}
              variant={notificationSettings.enabled ? 'secondary' : 'primary'}
              disabled={notificationSettings.enabled || notificationSettings.isWorking}
              onPress={() => void handleNotificationPermissionEnable()}
            />
          </View>
          {notificationSettings.error ? <Text style={styles.notificationError}>{notificationSettings.error}</Text> : null}

          <View style={styles.notificationToggleList}>
            <NotificationToggleRow
              category="friendRequests"
              disabled={notificationSettings.isWorking}
              enabled={notificationSettings.preferences.categories.friendRequests}
              label="친구 요청"
              onToggle={notificationSettings.setCategoryEnabled}
            />
            <NotificationToggleRow
              category="friendAccepted"
              disabled={notificationSettings.isWorking}
              enabled={notificationSettings.preferences.categories.friendAccepted}
              label="친구 수락"
              onToggle={notificationSettings.setCategoryEnabled}
            />
            <NotificationToggleRow
              category="cardReceived"
              disabled={notificationSettings.isWorking}
              enabled={notificationSettings.preferences.categories.cardReceived}
              label="받은 카드"
              onToggle={notificationSettings.setCategoryEnabled}
            />
            <NotificationToggleRow
              category="cardResponses"
              disabled={notificationSettings.isWorking}
              enabled={notificationSettings.preferences.categories.cardResponses}
              label="응답 도착"
              onToggle={notificationSettings.setCategoryEnabled}
            />
            <NotificationToggleRow
              category="cardConfirmed"
              disabled={notificationSettings.isWorking}
              enabled={notificationSettings.preferences.categories.cardConfirmed}
              label="약속 확정"
              onToggle={notificationSettings.setCategoryEnabled}
            />
            <NotificationToggleRow
              category="reminders"
              disabled={notificationSettings.isWorking}
              enabled={notificationSettings.preferences.categories.reminders}
              label="약속 리마인드"
              onToggle={notificationSettings.setCategoryEnabled}
            />
          </View>

          <View style={styles.reminderLeadSection}>
            <Text style={styles.reminderLeadTitle}>리마인드 시간</Text>
            <View style={styles.reminderLeadRow}>
              {reminderLeadOptions.map((option) => (
                <ReminderLeadButton
                  key={option.value}
                  disabled={notificationSettings.isWorking}
                  label={option.label}
                  selected={notificationSettings.preferences.reminderLead === option.value}
                  onPress={() => void notificationSettings.setReminderLead(option.value)}
                />
              ))}
            </View>
          </View>
        </Card>

        {isAuthenticated ? (
          <View style={styles.logoutFooter}>
            <ActionButton
              label={isAuthWorking ? '처리 중' : '로그아웃'}
              variant="danger"
              icon={<LogOut size={17} color={palette.onLight} />}
              disabled={isAuthWorking}
              fullWidth
              onPress={() => void handleSignOut()}
            />
          </View>
        ) : null}
      </AppScreen>

      <ProfileEditModal
        displayName={profileDraftName}
        error={profileEditError}
        isSaving={isAuthWorking}
        visible={profileEditVisible}
        onChangeDisplayName={setProfileDraftName}
        onClose={closeProfileEdit}
        onSave={() => void handleSaveProfile()}
      />
      <ProfileShareModal
        profile={currentProfile}
        visible={profileShareVisible}
        onClose={() => setProfileShareVisible(false)}
        onCopyId={() => void handleCopyProfileHandle()}
        onShare={() => void handleShareProfile()}
      />
      <NoticeModal
        message={notice}
        title={noticeTitle}
        onClose={() => {
          setNotice(null);
          setNoticeTitle('안내');
        }}
      />
    </>
  );
}

function ProfileLine({ action, icon, label, value }: { action?: ReactNode; icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.profileLine}>
      <View style={styles.profileLineIcon}>{icon}</View>
      <View style={styles.profileLineCopy}>
        <Text style={styles.profileLineLabel}>{label}</Text>
        <Text style={styles.profileLineValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {action}
    </View>
  );
}

function NotificationToggleRow({
  category,
  disabled,
  enabled,
  label,
  onToggle,
}: {
  category: AppNotificationCategory;
  disabled?: boolean;
  enabled: boolean;
  label: string;
  onToggle: (category: AppNotificationCategory, enabled: boolean) => void;
}) {
  return (
    <View style={styles.notificationToggleRow}>
      <Text style={styles.notificationToggleText}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label} 알림 ${enabled ? '끄기' : '켜기'}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled, disabled }}
        disabled={disabled}
        onPress={() => onToggle(category, !enabled)}
        style={({ pressed }) => [
          styles.notificationToggleButton,
          enabled ? styles.notificationToggleButtonOn : styles.notificationToggleButtonOff,
          disabled && styles.disabledToggleButton,
          pressed && !disabled && styles.pressed,
        ]}>
        <Text style={[styles.notificationToggleButtonText, enabled && styles.notificationToggleButtonTextOn]}>
          {enabled ? 'ON' : 'OFF'}
        </Text>
      </Pressable>
    </View>
  );
}

function ReminderLeadButton({
  disabled,
  label,
  selected,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} 리마인드`}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.reminderLeadButton,
        selected && styles.selectedReminderLeadButton,
        disabled && styles.disabledToggleButton,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={[styles.reminderLeadButtonText, selected && styles.selectedReminderLeadButtonText]}>{label}</Text>
    </Pressable>
  );
}

function ProfileEditModal({
  displayName,
  error,
  isSaving,
  visible,
  onChangeDisplayName,
  onClose,
  onSave,
}: {
  displayName: string;
  error: string | null;
  isSaving: boolean;
  visible: boolean;
  onChangeDisplayName: (value: string) => void;
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

function ProfileShareModal({
  profile,
  visible,
  onClose,
  onCopyId,
  onShare,
}: {
  profile: HostProfile | null;
  visible: boolean;
  onClose: () => void;
  onCopyId: () => void;
  onShare: () => void;
}) {
  const handleLabel = profile ? getProfileHandleForClipboard(profile) : '@handle';

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.cardKicker}>친구 공유</Text>
                <Text style={styles.modalTitle}>아이디 공유</Text>
              </View>
              <Pressable
                accessibilityLabel="아이디 공유 닫기"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}>
                <X size={19} color={palette.primaryDeep} />
              </Pressable>
            </View>

            <View style={styles.shareIdPreview}>
              <View style={styles.shareIdIcon}>
                <AtSign size={18} color={palette.primaryDeep} />
              </View>
              <View style={styles.shareIdCopy}>
                <Text style={styles.profileLineLabel}>친구 아이디</Text>
                <Text style={styles.shareIdValue} numberOfLines={1}>
                  {handleLabel}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <ActionButton
                label="카톡 공유"
                variant="kakao"
                icon={<Share2 size={17} color={palette.onLight} />}
                disabled={!profile}
                fullWidth
                onPress={onShare}
              />
              <ActionButton
                label="아이디 복사"
                variant="secondary"
                icon={<Copy size={17} color={palette.primaryDeep} />}
                disabled={!profile}
                fullWidth
                onPress={onCopyId}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NoticeModal({ message, title, onClose }: { message: string | null; title: string; onClose: () => void }) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={message !== null}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalPressGuard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.cardKicker}>안내</Text>
                <Text style={styles.modalTitle}>{title}</Text>
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
  kakaoProviderTone: {
    borderColor: '#B89E00',
  },
  disabledProviderTone: {
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
  profileLineAction: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  disabledProfileLineAction: {
    opacity: 0.5,
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
  notificationSettingsCard: {
    gap: spacing.md,
  },
  notificationPermissionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  notificationPermissionTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
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
  notificationToggleList: {
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  notificationToggleRow: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  notificationToggleText: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  notificationToggleButton: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 34,
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: spacing.sm,
  },
  notificationToggleButtonOn: {
    backgroundColor: palette.primary,
  },
  notificationToggleButtonOff: {
    backgroundColor: palette.surface,
  },
  disabledToggleButton: {
    opacity: 0.55,
  },
  notificationToggleButtonText: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  notificationToggleButtonTextOn: {
    color: palette.onLight,
  },
  reminderLeadSection: {
    gap: spacing.sm,
  },
  reminderLeadTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  reminderLeadRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reminderLeadButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 96,
    paddingHorizontal: spacing.md,
  },
  selectedReminderLeadButton: {
    backgroundColor: palette.amberSoft,
  },
  reminderLeadButtonText: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  selectedReminderLeadButtonText: {
    color: palette.primaryDeep,
  },
  logoutFooter: {
    paddingBottom: spacing.md,
    paddingTop: spacing.xl,
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
  shareIdPreview: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  shareIdIcon: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  shareIdCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  shareIdValue: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
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
