import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readAppFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('bottom tab UI contract', () => {
  it('keeps visible bottom tabs in the requested product order', () => {
    const source = readAppFile('app/(tabs)/_layout.tsx');
    const visibleScreens = Array.from(source.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g))
      .map((match) => match[1])
      .filter((name) => name !== 'index');

    expect(visibleScreens).toEqual(['create', 'manage', 'schedule', 'friends', 'profile']);
  });
});

describe('schedule and friends surface notices', () => {
  it('does not show the account-save notice on schedule or friends screens', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const friendsSource = readAppFile('app/(tabs)/friends.tsx');

    expect(scheduleSource).not.toContain('StorageModeNotice');
    expect(friendsSource).not.toContain('StorageModeNotice');
  });

  it('closes the card action modal before opening the schedule delete confirmation', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const requestDeleteStart = scheduleSource.indexOf('function requestDeleteCardSchedule');
    const requestDeleteEnd = scheduleSource.indexOf('function requestDeleteEditingScheduleItem', requestDeleteStart);
    const requestDeleteBlock = scheduleSource.slice(requestDeleteStart, requestDeleteEnd);

    expect(requestDeleteStart).toBeGreaterThan(-1);
    expect(requestDeleteBlock.indexOf('setCardActionItem(null);')).toBeGreaterThan(-1);
    expect(requestDeleteBlock.indexOf('setCardActionItem(null);')).toBeLessThan(
      requestDeleteBlock.indexOf('showScheduleConfirm({'),
    );
  });

  it('refreshes card schedules when the schedule tab is focused', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');

    expect(scheduleSource).toContain('const { scheduleItems, reload: reloadPromiseData } = usePromiseData();');
    expect(scheduleSource).toContain('void reloadPromiseData({ force: true });');
  });

  it('uses delete actions on card schedules and the same card layout for manual schedules', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const cardBranchStart = scheduleSource.indexOf("if (item.source === 'CARD')");
    const cardBranchEnd = scheduleSource.indexOf('const color = getManualScheduleColor(item.colorKey);', cardBranchStart);
    const manualBranchEnd = scheduleSource.indexOf('function TodoPanel', cardBranchEnd);
    const cardBranch = scheduleSource.slice(cardBranchStart, cardBranchEnd);
    const manualBranch = scheduleSource.slice(cardBranchEnd, manualBranchEnd);

    expect(cardBranchStart).toBeGreaterThan(-1);
    expect(cardBranchEnd).toBeGreaterThan(cardBranchStart);
    expect(manualBranchEnd).toBeGreaterThan(cardBranchEnd);
    expect(cardBranch).toContain('onPress={() => onDeleteCardSchedule(item)}');
    expect(cardBranch).toContain('<Trash2 size={15}');
    expect(cardBranch).not.toContain('onPress={() => onManageCard(item)}');
    expect(manualBranch).toContain('styles.cardScheduleCard');
    expect(manualBranch).toContain('styles.manualScheduleCard');
    expect(manualBranch).toContain('styles.cardScheduleInfoRow');
    expect(manualBranch).not.toContain('manualDateBlock');
  });

  it('keeps appointment cards coral and removes coral from direct schedule colors', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const stylesStart = scheduleSource.indexOf('const styles = StyleSheet.create');
    const cardStyleStart = scheduleSource.indexOf('cardScheduleCard:', stylesStart);
    const cardStyleEnd = scheduleSource.indexOf('cardScheduleInfoRow:', cardStyleStart);
    const cardStyleBlock = scheduleSource.slice(cardStyleStart, cardStyleEnd);
    const scheduleColorPickerStart = scheduleSource.indexOf('<ColorPicker', scheduleSource.indexOf('{!isEditingCardSchedule ? ('));
    const scheduleColorPickerEnd = scheduleSource.indexOf('/>', scheduleColorPickerStart);
    const scheduleColorPickerBlock = scheduleSource.slice(scheduleColorPickerStart, scheduleColorPickerEnd);

    expect(cardStyleBlock).toContain('backgroundColor: palette.coralSoft');
    expect(scheduleSource).toContain("const scheduleColorOptions = colorOptions.filter((option) => option.key !== 'coral');");
    expect(scheduleSource).toContain("function getManualScheduleColor(key: ScheduleColorKey = 'sky')");
    expect(scheduleColorPickerBlock).toContain('options={scheduleColorOptions}');
    expect(scheduleSource).toContain('const color = getManualScheduleColor(item.colorKey);');
  });

  it('hides confirmed and past tabs from sent and received manage tabs', () => {
    const manageSource = readAppFile('app/(tabs)/manage.tsx');
    const sentTabsStart = manageSource.indexOf('const sentTabs: ManagedCardInboxTab[]');
    const sentTabsEnd = manageSource.indexOf('const receivedTabs', sentTabsStart);
    const receivedTabsEnd = manageSource.indexOf('const tabsByScope', sentTabsEnd);
    const sentTabsBlock = manageSource.slice(sentTabsStart, sentTabsEnd);
    const receivedTabsBlock = manageSource.slice(sentTabsEnd, receivedTabsEnd);

    expect(sentTabsBlock).toContain("'SENT_NO_RESPONSE'");
    expect(sentTabsBlock).toContain("'SENT_HAS_RESPONSE'");
    expect(sentTabsBlock).not.toContain('SENT_CONFIRMED');
    expect(sentTabsBlock).not.toContain('SENT_PAST');
    expect(receivedTabsBlock).toContain("'RECEIVED_NEEDS_REPLY'");
    expect(receivedTabsBlock).toContain("'RECEIVED_REPLIED'");
    expect(receivedTabsBlock).not.toContain('RECEIVED_CONFIRMED');
    expect(receivedTabsBlock).not.toContain('RECEIVED_PAST');
    expect(manageSource).toContain('const legacyGroupTabs: Partial<Record<ManagedStatusGroup, ManagedCardInboxTab>>');
  });
});

describe('friends empty state', () => {
  it('keeps the no-friends empty card informational without an inline add button', () => {
    const source = readAppFile('app/(tabs)/friends.tsx');
    const emptyStateStart = source.indexOf('title="아직 친구가 없어요"');
    const emptyStateEnd = source.indexOf('/>', emptyStateStart);
    const emptyStateBlock = source.slice(emptyStateStart, emptyStateEnd);

    expect(emptyStateStart).toBeGreaterThan(-1);
    expect(emptyStateBlock).not.toContain('actionLabel');
    expect(emptyStateBlock).not.toContain('onAction');
  });
});

describe('profile public identity sharing', () => {
  it('keeps sharing behind the id row action instead of a profile-link row', () => {
    const source = readAppFile('app/(tabs)/profile.tsx');
    const profileSectionStart = source.indexOf('<SectionHeader title="공개 프로필"');
    const profileSectionEnd = source.indexOf('<SectionHeader title="계정 데이터"', profileSectionStart);
    const profileSection = source.slice(profileSectionStart, profileSectionEnd);

    expect(profileSectionStart).toBeGreaterThan(-1);
    expect(profileSectionEnd).toBeGreaterThan(profileSectionStart);
    expect(profileSection).not.toContain('label="프로필 링크"');
    expect(profileSection).not.toContain('styles.profileShareActions');
    expect(profileSection).toContain('label="아이디"');
    expect(profileSection).toContain('onPress={openProfileShare}');
    expect(source).toContain('<ProfileShareModal');
  });

  it('does not show the generated id in the profile edit modal', () => {
    const source = readAppFile('app/(tabs)/profile.tsx');
    const editCallStart = source.indexOf('<ProfileEditModal');
    const editCallEnd = source.indexOf('/>', editCallStart);
    const editCall = source.slice(editCallStart, editCallEnd);
    const editDefinitionStart = source.indexOf('function ProfileEditModal');
    const editDefinitionEnd = source.indexOf('function ProfileShareModal', editDefinitionStart);
    const editDefinition = source.slice(editDefinitionStart, editDefinitionEnd);

    expect(editCallStart).toBeGreaterThan(-1);
    expect(editDefinitionStart).toBeGreaterThan(-1);
    expect(editDefinitionEnd).toBeGreaterThan(editDefinitionStart);
    expect(editCall).not.toContain('handle={handle}');
    expect(editCall).not.toContain('onChangeHandle');
    expect(editDefinition).not.toContain('onChangeHandle');
    expect(editDefinition).not.toContain('accessibilityLabel="프로필 아이디"');
    expect(editDefinition).not.toContain('<Text style={styles.inputLabel}>아이디</Text>');
    expect(editDefinition).not.toContain('styles.handleReadonly');
  });

  it('uses a profile-complete title after saving profile changes', () => {
    const source = readAppFile('app/(tabs)/profile.tsx');
    const saveStart = source.indexOf('async function handleSaveProfile');
    const saveEnd = source.indexOf('return (', saveStart);
    const saveBlock = source.slice(saveStart, saveEnd);
    const noticeModalStart = source.indexOf('function NoticeModal');
    const noticeModalEnd = source.indexOf('const styles = StyleSheet.create', noticeModalStart);
    const noticeModal = source.slice(noticeModalStart, noticeModalEnd);

    expect(saveStart).toBeGreaterThan(-1);
    expect(noticeModalStart).toBeGreaterThan(-1);
    expect(noticeModalEnd).toBeGreaterThan(noticeModalStart);
    expect(saveBlock).toContain("setNoticeTitle('수정 완료');");
    expect(noticeModal).toContain('<Text style={styles.cardKicker}>안내</Text>');
    expect(noticeModal).toContain('<Text style={styles.modalTitle}>{title}</Text>');
    expect(noticeModal).not.toContain('처리 결과');
    expect(noticeModal).not.toContain('연결 설정이 필요해요');
  });
});

describe('friends add modal copy', () => {
  it('asks for a friend id instead of a profile link', () => {
    const source = readAppFile('app/(tabs)/friends.tsx');
    const addModalStart = source.indexOf('function AddFriendModal');
    const addModalEnd = source.indexOf('function ConfirmModal', addModalStart);
    const addModal = source.slice(addModalStart, addModalEnd);
    const sendStart = source.indexOf('async function handleSendFriendRequest');
    const sendEnd = source.indexOf('function handleDeleteFriend', sendStart);
    const sendBlock = source.slice(sendStart, sendEnd);

    expect(addModalStart).toBeGreaterThan(-1);
    expect(addModalEnd).toBeGreaterThan(addModalStart);
    expect(sendStart).toBeGreaterThan(-1);
    expect(sendEnd).toBeGreaterThan(sendStart);
    expect(addModal).toContain('친구 아이디 입력');
    expect(addModal).toContain('accessibilityLabel="친구 아이디 입력"');
    expect(addModal).not.toContain('아이디 또는 프로필 링크');
    expect(addModal).not.toContain('whenbollae.app/@handle');
    expect(sendBlock).toContain('친구 아이디를 입력해 주세요.');
  });
});

describe('create card optional message input', () => {
  it('focuses the message field after opening it from the collapsed add button', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const cardMenuSource = readAppFile('components/card-menu.tsx');
    const addMessageButtonStart = createSource.indexOf('setIsMessageOpen(true);');
    const addMessageButtonBlock = createSource.slice(addMessageButtonStart, addMessageButtonStart + 160);

    expect(addMessageButtonStart).toBeGreaterThan(-1);
    expect(cardMenuSource).toContain('forwardRef<TextInput, DraftInputProps>');
    expect(cardMenuSource).toContain('ref={ref}');
    expect(createSource).toContain('const messageInputRef = useRef<TextInput>(null);');
    expect(createSource).toContain('function focusMessageInput()');
    expect(createSource).toContain('messageInputRef.current?.focus();');
    expect(createSource).toContain('ref={messageInputRef}');
    expect(addMessageButtonBlock).toContain('focusMessageInput();');
  });
});

describe('create card app friend picker', () => {
  it('refreshes registered app friends when the create tab is focused', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const useFriendsStart = createSource.indexOf('useFriends();');
    const focusRefreshStart = createSource.indexOf('useFocusEffect(');
    const focusRefreshBlock = createSource.slice(focusRefreshStart, focusRefreshStart + 180);

    expect(createSource).toContain("import { useFocusEffect, useRouter } from 'expo-router';");
    expect(useFriendsStart).toBeGreaterThan(-1);
    expect(createSource.slice(useFriendsStart - 90, useFriendsStart + 20)).toContain('reload: reloadFriends');
    expect(focusRefreshStart).toBeGreaterThan(-1);
    expect(focusRefreshBlock).toContain('void reloadFriends();');
  });

  it('builds the app friend picker from registered friends', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const pickerOptionsStart = createSource.indexOf('getPreviewFriendOptions(friends)');
    const recipientStart = createSource.indexOf('getPreviewRecipientProfileIds(friends, selectedFriendIds)');

    expect(pickerOptionsStart).toBeGreaterThan(-1);
    expect(recipientStart).toBeGreaterThan(-1);
  });
});

describe('received card reply UI', () => {
  it('lets receivers add a one-line message and submits it with the reply', () => {
    const source = readAppFile('app/(tabs)/manage.tsx');
    const submitStart = source.indexOf('async function handleSubmitResponse');
    const submitEnd = source.indexOf('function setCandidateChoice', submitStart);
    const submitBlock = source.slice(submitStart, submitEnd);
    const modalStart = source.indexOf('{responseCard ? (');
    const modalEnd = source.indexOf('</Modal>', modalStart);
    const modalBlock = source.slice(modalStart, modalEnd);

    expect(source).toContain('TextInput');
    expect(source).toContain("const [responseComment, setResponseComment] = useState('');");
    expect(submitBlock).toContain('respondToReceivedCard(responseCard.id, responses, responseComment)');
    expect(modalBlock).toContain('accessibilityLabel="한마디"');
    expect(modalBlock).toContain('value={responseComment}');
    expect(modalBlock).toContain('onChangeText={setResponseComment}');
  });

  it('uses reply badges instead of a red status text row on received cards', () => {
    const cardMenuSource = readAppFile('components/card-menu.tsx');
    const rowStart = cardMenuSource.indexOf('function ManagedCardRow');
    const rowEnd = cardMenuSource.indexOf('function ManagedResponseStats', rowStart);
    const rowBlock = cardMenuSource.slice(rowStart, rowEnd);

    expect(rowBlock).toContain('shouldShowManagedCardRowMeta(card)');
    expect(rowBlock).toContain(') : shouldShowRowMeta ? (');
    expect(rowBlock).toContain('<ManagedReceivedResponseBadges');
    expect(rowBlock).not.toContain('{responseSummary}');
  });
});

describe('managed card confirmation schedule handoff', () => {
  it('opens the confirmed card date in schedule after confirmation', () => {
    const source = readAppFile('app/(tabs)/manage.tsx');
    const confirmStart = source.indexOf('async function handleConfirmCandidate');
    const confirmEnd = source.indexOf('async function handleSubmitResponse', confirmStart);
    const confirmBlock = source.slice(confirmStart, confirmEnd);

    expect(confirmStart).toBeGreaterThan(-1);
    expect(confirmEnd).toBeGreaterThan(confirmStart);
    expect(confirmBlock).toContain('const confirmedCard = await confirmManagedCard(card.id, candidateId);');
    expect(confirmBlock).toContain('await reloadManagedCards({ force: true });');
    expect(confirmBlock).toContain('router.push(getConfirmedCardSchedulePath(confirmedCard));');
  });
});

describe('received card realtime refresh', () => {
  it('reloads promise data when card recipients change', () => {
    const source = readAppFile('hooks/usePromiseData.ts');

    expect(source).toContain(".on('postgres_changes', { event: '*', schema: 'public', table: 'card_recipients' }");
  });
});
