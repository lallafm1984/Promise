import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock3, Search, Trash2, UserPlus, UsersRound, X } from 'lucide-react-native';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, AppScreen, Card, SectionHeader } from '@/components/ui';
import { palette, radius, spacing } from '@/constants/theme';
import { useFriends } from '@/hooks/useFriends';
import { normalizeFriendHandle, type AppFriend, type FriendRequest } from '@/lib/friends';

type FriendTab = 'FRIENDS' | 'REQUESTS';
type ConfirmDialogState = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<unknown>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '요청을 처리하지 못했어요.';
}

export default function FriendsScreen() {
  const {
    friends,
    requests,
    summary,
    acceptRequest,
    declineRequest,
    sendRequestToHandle,
    deleteFriend,
    cancelRequest,
    error: friendStoreError,
    isLoading,
    isMutating,
  } = useFriends();
  const [activeTab, setActiveTab] = useState<FriendTab>('FRIENDS');
  const [friendInput, setFriendInput] = useState('');
  const [friendInputError, setFriendInputError] = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const incomingRequests = useMemo(
    () => requests.filter((request) => request.direction === 'INCOMING'),
    [requests],
  );
  const outgoingRequests = useMemo(
    () => requests.filter((request) => request.direction === 'OUTGOING'),
    [requests],
  );

  function openAddFriendModal() {
    setFriendInput('');
    setFriendInputError(null);
    setAddModalVisible(true);
  }

  function closeAddFriendModal() {
    setAddModalVisible(false);
    setFriendInput('');
    setFriendInputError(null);
  }

  function handleChangeFriendInput(value: string) {
    setFriendInput(value);
    if (friendInputError) {
      setFriendInputError(null);
    }
  }

  function requestConfirmation(nextDialog: ConfirmDialogState) {
    setConfirmDialog(nextDialog);
  }

  function closeConfirmDialog() {
    setConfirmDialog(null);
  }

  function confirmAndClose() {
    void confirmDialog?.onConfirm();
    setConfirmDialog(null);
  }

  async function handleSendFriendRequest() {
    const handle = normalizeFriendHandle(friendInput);

    if (handle.length === 0) {
      setFriendInputError('친구 아이디나 프로필 링크를 입력해 주세요.');
      return;
    }

    const alreadyFriend = friends.some(
      (friend) => friend.handle.toLowerCase() === handle || friend.profileId === `profile-${handle}`,
    );
    const alreadyRequested = requests.some(
      (request) => request.handle.toLowerCase() === handle || request.profileId === `profile-${handle}`,
    );

    if (alreadyFriend) {
      setFriendInputError(`@${handle}는 이미 친구 목록에 있어요.`);
      return;
    }

    if (alreadyRequested) {
      setFriendInputError(`@${handle}에게는 이미 요청이 있어요. 요청 탭에서 확인해 주세요.`);
      return;
    }

    try {
      await sendRequestToHandle(handle);
      closeAddFriendModal();
      setActiveTab('REQUESTS');
    } catch (error) {
      setFriendInputError(getErrorMessage(error));
    }
  }

  function handleDeleteFriend(friend: AppFriend) {
    requestConfirmation({
      title: '친구 삭제',
      body: `${friend.displayName}님을 친구 목록에서 삭제할까요?`,
      confirmLabel: '삭제',
      onConfirm: () => deleteFriend(friend.id),
    });
  }

  function handleCancelRequest(request: FriendRequest) {
    requestConfirmation({
      title: '보낸 요청 취소',
      body: `${request.displayName}님에게 보낸 친구 요청을 취소할까요?`,
      confirmLabel: '요청 취소',
      onConfirm: () => cancelRequest(request.id),
    });
  }

  return (
    <>
      <AppScreen reserveBottomTabs>
        <View style={styles.header}>
          <View style={styles.headerShapePrimary} />
          <View style={styles.headerShapeMint} />
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>언제볼래</Text>
            <Text style={styles.title}>친구</Text>
            <Text style={styles.subtitle}>친구를 관리하고, 약속 카드를 보낼 대상을 빠르게 고르세요.</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Metric label="친구" value={String(summary.friendCount)} tone="friend" />
          <Metric label="받은 요청" value={String(summary.incomingCount)} tone="incoming" />
          <Metric label="보낸 요청" value={String(summary.outgoingCount)} tone="outgoing" />
        </View>

        <View style={styles.tabRow}>
          <FriendTabButton
            count={friends.length}
            label="친구"
            selected={activeTab === 'FRIENDS'}
            onPress={() => setActiveTab('FRIENDS')}
          />
          <FriendTabButton
            count={incomingRequests.length + outgoingRequests.length}
            label="요청"
            selected={activeTab === 'REQUESTS'}
            onPress={() => setActiveTab('REQUESTS')}
          />
        </View>

        <Pressable
          accessibilityLabel="친구 추가"
          accessibilityRole="button"
          onPress={openAddFriendModal}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <UserPlus size={18} color={palette.onLight} />
          <Text style={styles.addButtonText}>친구 추가</Text>
        </Pressable>

        {isLoading ? (
          <View style={styles.statusNotice}>
            <ActivityIndicator color={palette.primaryDeep} />
            <Text style={styles.statusNoticeText}>친구 정보를 불러오는 중</Text>
          </View>
        ) : null}
        {friendStoreError ? <Text style={styles.storeError}>{friendStoreError}</Text> : null}

        {activeTab === 'FRIENDS' ? (
          <FriendsList friends={friends} onDeleteFriend={handleDeleteFriend} />
        ) : (
          <RequestsList
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
            onAcceptRequest={(request) => {
              acceptRequest(request.id);
              setActiveTab('FRIENDS');
            }}
            onCancelRequest={handleCancelRequest}
            onDeclineRequest={(request) => {
              requestConfirmation({
                title: '요청 거절',
                body: `${request.displayName}님의 친구 요청을 거절할까요?`,
                confirmLabel: '거절',
                onConfirm: () => declineRequest(request.id),
              });
            }}
          />
        )}
      </AppScreen>

      <AddFriendModal
        error={friendInputError}
        friendInput={friendInput}
        isSubmitting={isMutating}
        visible={addModalVisible}
        onChangeFriendInput={handleChangeFriendInput}
        onClose={closeAddFriendModal}
        onSubmit={handleSendFriendRequest}
      />
      <ConfirmModal
        confirmLabel={confirmDialog?.confirmLabel ?? ''}
        body={confirmDialog?.body ?? ''}
        title={confirmDialog?.title ?? ''}
        visible={confirmDialog !== null}
        onCancel={closeConfirmDialog}
        onConfirm={confirmAndClose}
      />
    </>
  );
}

function FriendsList({
  friends,
  onDeleteFriend,
}: {
  friends: AppFriend[];
  onDeleteFriend: (friend: AppFriend) => void;
}) {
  return (
    <View style={styles.sectionStack}>
      <SectionHeader title="친구 목록" action={`${friends.length}명`} />
      {friends.length > 0 ? (
        <View style={styles.stack}>
          {friends.map((friend) => (
            <FriendRow key={friend.id} friend={friend} onDelete={() => onDeleteFriend(friend)} />
          ))}
        </View>
      ) : (
        <EmptyCard
          title="아직 친구가 없어요"
          body="위의 친구 추가 버튼으로 아이디나 프로필 링크 요청을 보낼 수 있어요."
        />
      )}
    </View>
  );
}

function RequestsList({
  incomingRequests,
  outgoingRequests,
  onAcceptRequest,
  onCancelRequest,
  onDeclineRequest,
}: {
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  onAcceptRequest: (request: FriendRequest) => void;
  onCancelRequest: (request: FriendRequest) => void;
  onDeclineRequest: (request: FriendRequest) => void;
}) {
  return (
    <View style={styles.sectionStack}>
      <SectionHeader title="받은 친구 요청" action={`${incomingRequests.length}개`} />
      <View style={styles.stack}>
        {incomingRequests.length > 0 ? (
          incomingRequests.map((request) => (
            <FriendRequestRow
              key={request.id}
              request={request}
              onAccept={() => onAcceptRequest(request)}
              onDecline={() => onDeclineRequest(request)}
            />
          ))
        ) : (
          <EmptyCard title="새 요청이 없어요" body="상대가 친구 요청을 보내면 여기서 수락하거나 거절합니다." />
        )}
      </View>

      <SectionHeader title="보낸 요청" action={`${outgoingRequests.length}개`} />
      <View style={styles.stack}>
        {outgoingRequests.length > 0 ? (
          outgoingRequests.map((request) => (
            <OutgoingRequestRow key={request.id} request={request} onCancel={() => onCancelRequest(request)} />
          ))
        ) : (
          <EmptyCard title="대기 중인 요청이 없어요" body="친구 요청을 보내면 상대가 수락하기 전까지 이곳에 표시됩니다." />
        )}
      </View>
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'friend' | 'incoming' | 'outgoing' }) {
  return (
    <View style={[styles.metric, styles[`${tone}Metric`]]}>
      <Text style={[styles.metricLabel, styles[`${tone}MetricLabel`]]}>{label}</Text>
      <Text style={[styles.metricValue, styles[`${tone}MetricValue`]]}>{value}</Text>
    </View>
  );
}

function FriendTabButton({
  count,
  label,
  selected,
  onPress,
}: {
  count: number;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tabButton, selected && styles.selectedTabButton, pressed && styles.pressed]}>
      <Text style={[styles.tabButtonText, selected && styles.selectedTabButtonText]}>{label}</Text>
      <Text style={[styles.tabCount, selected && styles.selectedTabCount]}>{count}</Text>
    </Pressable>
  );
}

function FriendAvatar({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color }]}>
      <Text style={styles.avatarText}>{label}</Text>
    </View>
  );
}

function FriendRow({ friend, onDelete }: { friend: AppFriend; onDelete: () => void }) {
  return (
    <Card style={styles.personCard}>
      <FriendAvatar label={friend.avatarLabel} color={friend.color} />
      <View style={styles.personCopy}>
        <Text style={styles.personName}>{friend.displayName}</Text>
        <Text style={styles.personMeta}>
          @{friend.handle} · {friend.lastActiveLabel}
        </Text>
      </View>
      <DeleteButton accessibilityLabel={`${friend.displayName} 친구 삭제`} onPress={onDelete} />
    </Card>
  );
}

function FriendRequestRow({
  request,
  onAccept,
  onDecline,
}: {
  request: FriendRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Card style={styles.requestCard}>
      <View style={styles.personLine}>
        <FriendAvatar label={request.avatarLabel} color={request.color} />
        <View style={styles.personCopy}>
          <Text style={styles.personName}>{request.displayName}</Text>
          <Text style={styles.personMeta}>@{request.handle}</Text>
        </View>
      </View>
      {request.message ? <Text style={styles.requestMessage}>{request.message}</Text> : null}
      <View style={styles.rowActions}>
        <ActionButton label="수락" icon={<Check size={17} color={palette.onLight} />} fullWidth onPress={onAccept} />
        <ActionButton
          label="거절"
          variant="danger"
          icon={<X size={17} color={palette.onLight} />}
          fullWidth
          onPress={onDecline}
        />
      </View>
    </Card>
  );
}

function OutgoingRequestRow({ request, onCancel }: { request: FriendRequest; onCancel: () => void }) {
  return (
    <Card style={styles.personCard}>
      <FriendAvatar label={request.avatarLabel} color={request.color} />
      <View style={styles.personCopy}>
        <Text style={styles.personName}>{request.displayName}</Text>
        <Text style={styles.personMeta}>@{request.handle} · 응답 대기</Text>
      </View>
      <View style={styles.pendingBadge}>
        <Clock3 size={13} color={palette.primaryDeep} />
        <Text style={styles.pendingText}>대기</Text>
      </View>
      <DeleteButton accessibilityLabel={`${request.displayName}에게 보낸 요청 취소`} onPress={onCancel} />
    </Card>
  );
}

function DeleteButton({ accessibilityLabel, onPress }: { accessibilityLabel: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
      <Trash2 size={16} color={palette.primaryDeep} />
    </Pressable>
  );
}

function EmptyCard({
  actionLabel,
  body,
  title,
  onAction,
}: {
  actionLabel?: string;
  body: string;
  title: string;
  onAction?: () => void;
}) {
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <UsersRound size={22} color={palette.primaryDeep} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>{body}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}>
            <Text style={styles.emptyActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function AddFriendModal({
  error,
  friendInput,
  isSubmitting,
  visible,
  onChangeFriendInput,
  onClose,
  onSubmit,
}: {
  error: string | null;
  friendInput: string;
  isSubmitting: boolean;
  visible: boolean;
  onChangeFriendInput: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<unknown>;
}) {
  const disabled = isSubmitting || normalizeFriendHandle(friendInput).length === 0;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleGroup}>
              <Text style={styles.modalKicker}>친구 요청</Text>
              <Text style={styles.modalTitle}>친구 추가</Text>
            </View>
            <Pressable
              accessibilityLabel="친구 추가 닫기"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}>
              <X size={19} color={palette.primaryDeep} />
            </Pressable>
          </View>

          <View style={styles.modalInputShell}>
            <View style={styles.modalInputLabelRow}>
              <Search size={16} color={palette.primaryDeep} />
              <Text style={styles.modalInputLabel}>아이디 또는 프로필 링크</Text>
            </View>
            <TextInput
              accessibilityLabel="친구 아이디 또는 프로필 링크"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={onChangeFriendInput}
              placeholder="@handle 또는 whenbollae.app/@handle"
              placeholderTextColor={palette.inkSoft}
              style={styles.modalInput}
              value={friendInput}
            />
          </View>
          {error ? <Text style={styles.modalError}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <ActionButton label="닫기" variant="secondary" fullWidth onPress={onClose} />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.modalSubmitButton,
                disabled && styles.disabledSubmitButton,
                pressed && !disabled && styles.pressed,
              ]}>
              <UserPlus size={17} color={disabled ? palette.inkSoft : palette.onLight} />
              <Text style={[styles.modalSubmitText, disabled && styles.disabledSubmitText]}>
                {isSubmitting ? '처리 중' : '요청 보내기'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmModal({
  body,
  confirmLabel,
  title,
  visible,
  onCancel,
  onConfirm,
}: {
  body: string;
  confirmLabel: string;
  title: string;
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <View style={styles.confirmIcon}>
            <AlertTriangle size={24} color={palette.danger} />
          </View>
          <View style={styles.confirmCopy}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.confirmBody}>{body}</Text>
          </View>
          <View style={styles.modalActions}>
            <ActionButton label="취소" variant="secondary" fullWidth onPress={onCancel} />
            <ActionButton label={confirmLabel} variant="danger" fullWidth onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: palette.mintSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 136,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  headerShapePrimary: {
    backgroundColor: palette.primary,
    height: 96,
    position: 'absolute',
    right: -24,
    top: -24,
    transform: [{ rotate: '14deg' }],
    width: 126,
  },
  headerShapeMint: {
    backgroundColor: palette.lime,
    bottom: -22,
    height: 74,
    left: -20,
    position: 'absolute',
    transform: [{ rotate: '-10deg' }],
    width: 112,
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
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 35,
  },
  subtitle: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metric: {
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flex: 1,
    minHeight: 68,
    padding: spacing.sm,
  },
  friendMetric: {
    backgroundColor: palette.limeSoft,
  },
  incomingMetric: {
    backgroundColor: palette.skySoft,
  },
  outgoingMetric: {
    backgroundColor: palette.amberSoft,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '900',
  },
  friendMetricLabel: {
    color: palette.primaryDeep,
  },
  incomingMetricLabel: {
    color: palette.sky,
  },
  outgoingMetricLabel: {
    color: palette.primaryDeep,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  friendMetricValue: {
    color: palette.primaryDeep,
  },
  incomingMetricValue: {
    color: palette.ink,
  },
  outgoingMetricValue: {
    color: palette.ink,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tabButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.sm,
  },
  selectedTabButton: {
    backgroundColor: palette.primary,
  },
  tabButtonText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  selectedTabButtonText: {
    color: palette.onLight,
  },
  tabCount: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
    minWidth: 28,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    textAlign: 'center',
  },
  selectedTabCount: {
    backgroundColor: palette.surface,
    color: palette.primaryDeep,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 46,
  },
  addButtonText: {
    color: palette.onLight,
    fontSize: 15,
    fontWeight: '900',
  },
  statusNotice: {
    alignItems: 'center',
    backgroundColor: palette.skySoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  statusNoticeText: {
    color: palette.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  storeError: {
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    color: palette.danger,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionStack: {
    gap: spacing.md,
  },
  stack: {
    gap: spacing.sm,
  },
  personCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  requestCard: {
    gap: spacing.sm,
  },
  personLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatar: {
    alignItems: 'center',
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  personCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  personName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  personMeta: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  requestMessage: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderLeftColor: palette.primaryDeep,
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    padding: spacing.sm,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pendingBadge: {
    alignItems: 'center',
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  pendingText: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: palette.skySoft,
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  emptyCopy: {
    flex: 1,
    gap: 4,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyBody: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  emptyAction: {
    alignSelf: 'flex-start',
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  emptyActionText: {
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
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  modalTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  modalKicker: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 27,
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
  modalInputShell: {
    backgroundColor: palette.paper,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalInputLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modalInputLabel: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  modalInput: {
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
  modalSubmitButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 2,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  disabledSubmitButton: {
    backgroundColor: palette.paper,
    borderColor: palette.line,
  },
  modalSubmitText: {
    color: palette.onLight,
    fontSize: 15,
    fontWeight: '900',
  },
  disabledSubmitText: {
    color: palette.inkSoft,
  },
  modalError: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 18,
  },
  confirmIcon: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.coralSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.md,
    borderWidth: 1.5,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  confirmCopy: {
    gap: spacing.xs,
  },
  confirmBody: {
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});
