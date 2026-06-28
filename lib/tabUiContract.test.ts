import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readAppFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('bottom tab UI contract', () => {
  it('keeps app icon assets and portrait orientation wired into config and Android', () => {
    const appConfig = JSON.parse(readAppFile('app.json')).expo;
    const notificationPlugin = appConfig.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-notifications');
    const splashPlugin = appConfig.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
    const androidManifest = readAppFile('android/app/src/main/AndroidManifest.xml');

    expect(appConfig.icon).toBe('./assets/images/icon.png');
    expect(appConfig.orientation).toBe('portrait');
    expect(appConfig.ios.requireFullScreen).toBe(true);
    expect(appConfig.android.adaptiveIcon.backgroundColor).toBe('#FD6572');
    expect(appConfig.android.adaptiveIcon.foregroundImage).toBe('./assets/images/android-icon-foreground.png');
    expect(appConfig.android.adaptiveIcon.backgroundImage).toBe('./assets/images/android-icon-background.png');
    expect(appConfig.android.adaptiveIcon.monochromeImage).toBe('./assets/images/android-icon-monochrome.png');
    expect(notificationPlugin?.[1]).toMatchObject({
      icon: './assets/images/android-icon-monochrome.png',
      color: '#FD6572',
    });
    expect(splashPlugin?.[1]).toMatchObject({
      image: './assets/images/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    });
    expect(androidManifest).toContain('android:screenOrientation="portrait"');
  });

  it('wires Firebase Google Services into native Android when the config file is present', () => {
    const appConfigSource = readAppFile('app.config.js');
    const rootGradle = readAppFile('android/build.gradle');
    const appGradle = readAppFile('android/app/build.gradle');

    expect(appConfigSource).toContain("withOptionalFileConfig(expo, 'android', 'googleServicesFile', GOOGLE_SERVICES_JSON)");
    expect(rootGradle).toContain("classpath('com.google.gms:google-services:4.5.0')");
    expect(appGradle).toContain('google-services.json');
    expect(appGradle).toContain('com.google.gms.google-services');
  });

  it('loads the native AdMob app id from .env before using the Google test fallback', () => {
    const appConfigSource = readAppFile('app.config.js');
    const appGradle = readAppFile('android/app/build.gradle');
    const dotEnvFallbackIndex = appGradle.indexOf('readDotEnvValue("ADMOB_ANDROID_APP_ID")');
    const testFallbackIndex = appGradle.indexOf('ca-app-pub-3940256099942544~3347511713');

    expect(appConfigSource).toContain('process.env.ADMOB_ANDROID_APP_ID || GOOGLE_TEST_ANDROID_APP_ID');
    expect(appGradle).toContain('def readDotEnvValue = { String key ->');
    expect(dotEnvFallbackIndex).toBeGreaterThan(-1);
    expect(testFallbackIndex).toBeGreaterThan(dotEnvFallbackIndex);
  });

  it('keeps visible bottom tabs in the requested product order', () => {
    const source = readAppFile('app/(tabs)/_layout.tsx');
    const visibleScreens = Array.from(source.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g))
      .map((match) => match[1])
      .filter((name) => name !== 'index');

    expect(visibleScreens).toEqual(['create', 'manage', 'schedule', 'friends', 'profile']);
  });

  it('opens schedule by default for normal app entry and login completion', () => {
    const tabsLayoutSource = readAppFile('app/(tabs)/_layout.tsx');
    const tabsIndexSource = readAppFile('app/(tabs)/index.tsx');
    const loginSource = readAppFile('app/login.tsx');
    const rootLayoutSource = readAppFile('app/_layout.tsx');

    expect(tabsLayoutSource).toContain('initialRouteName="schedule"');
    expect(tabsIndexSource).toContain('<Redirect href="/schedule" />');
    expect(loginSource).toContain('<Redirect href="/schedule" />');
    expect(loginSource).toContain("router.replace('/schedule');");
    expect(rootLayoutSource).toContain("router.replace('/schedule');");
  });

  it('keeps one shared banner ad above the bottom tab menu', () => {
    const layoutSource = readAppFile('app/(tabs)/_layout.tsx');
    const uiSource = readAppFile('components/ui.tsx');
    const layoutInsetsSource = readAppFile('lib/layoutInsets.ts');
    const bannerTabs = ['create', 'manage', 'friends', 'profile', 'schedule'];

    expect(layoutSource).toContain("import { BottomBannerAd } from '@/components/bottom-banner-ad';");
    expect(layoutSource).toContain('BOTTOM_BANNER_AD_HEIGHT');
    expect(layoutSource).toContain('<BottomBannerAd />');
    expect(layoutSource).toContain('styles.commonBanner');
    expect(layoutSource).toContain('bottom: getTabBarHeight(bottomInset)');
    expect(layoutInsetsSource).toContain(
      'BOTTOM_BANNER_AD_HEIGHT +',
    );
    expect(layoutInsetsSource).toContain(
      '(getTabBarHeight(bottomInset) + spacing.xs * PREVIOUS_BOTTOM_EXTRA_GAP_RATIO) *',
    );
    expect(layoutInsetsSource).toContain(
      'TAB_SCREEN_VISIBLE_GAP_RATIO_AFTER_REDUCTION',
    );
    expect(layoutInsetsSource).toContain(
      'bottomInset + spacing.xl * BOTTOM_EXTRA_GAP_RATIO_AFTER_REDUCTION',
    );
    expect(uiSource).not.toContain('footer?: ReactNode;');
    expect(uiSource).not.toContain('screenContentWithFooter');
    expect(uiSource).not.toContain('screenFooter');

    for (const tab of bannerTabs) {
      const source = readAppFile(`app/(tabs)/${tab}.tsx`);

      expect(source).not.toContain("import { BottomBannerAd } from '@/components/bottom-banner-ad';");
      expect(source).not.toContain('footer={<BottomBannerAd />}');
      expect(source).not.toMatch(/<BottomBannerAd \/>\s*<\/AppScreen>/);
    }
  });

  it('requests interstitial ads only at configured user action points', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');

    expect(createSource).toContain("import { requestInterstitialAd } from '@/lib/interstitialAds';");
    expect(createSource.match(/requestInterstitialAd\('card_create_pressed'\)/g)).toHaveLength(1);
    expect(createSource).not.toContain("requestInterstitialAd('card_delivery_success')");
    expect(scheduleSource).toContain("import { requestInterstitialAd } from '@/lib/interstitialAds';");
    expect(scheduleSource.match(/requestInterstitialAd\('manual_schedule_saved'\)/g)).toHaveLength(2);
    expect(scheduleSource.match(/requestInterstitialAd\('todo_saved'\)/g)).toHaveLength(1);
  });

  it('preloads direct schedule planner data from the tab layout before the schedule screen opens', () => {
    const layoutSource = readAppFile('app/(tabs)/_layout.tsx');
    const plannerSource = readAppFile('hooks/useSchedulePlanner.ts');
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const providerStart = layoutSource.indexOf('<SchedulePlannerProvider>');
    const tabsStart = layoutSource.indexOf('<Tabs');

    expect(layoutSource).toContain("import { SchedulePlannerProvider } from '@/hooks/useSchedulePlanner';");
    expect(providerStart).toBeGreaterThan(-1);
    expect(tabsStart).toBeGreaterThan(providerStart);
    expect(layoutSource).toContain('</SchedulePlannerProvider>');
    expect(plannerSource).toContain('const SchedulePlannerContext = createContext');
    expect(plannerSource).toContain('function useSchedulePlannerController()');
    expect(plannerSource).toContain('export function SchedulePlannerProvider');
    expect(plannerSource).toContain('useContext(SchedulePlannerContext)');
    expect(scheduleSource).toContain('} = useSchedulePlanner();');
  });

  it('keeps direct schedules and todos local-only instead of using a Supabase schedule repository', () => {
    const plannerSource = readAppFile('hooks/useSchedulePlanner.ts');
    const notificationSource = readAppFile('hooks/useAppNotifications.ts');

    expect(plannerSource).toContain(
      "import { refreshEnabledNotificationsWithManualScheduleItems } from '@/hooks/useAppNotifications';",
    );
    expect(plannerSource.match(/refreshEnabledNotificationsWithManualScheduleItems\(nextState\.manualScheduleItems\)/g)).toHaveLength(3);
    expect(plannerSource).not.toContain("import { getActiveScheduleRepository }");
    expect(plannerSource).not.toContain('repository.createManualScheduleItem');
    expect(plannerSource).not.toContain('repository.createTodo');
    expect(plannerSource).toContain('createLocalTodoItem');
    expect(notificationSource).toContain('export async function refreshEnabledNotificationsWithManualScheduleItems');
    expect(notificationSource).toContain('scheduleAppointmentReminders(profile, [...cardScheduleItems, ...manualScheduleItems])');
    expect(notificationSource).not.toContain("import { getActiveScheduleRepository }");
  });

  it('preloads friend data from the tab layout before friend-dependent screens open', () => {
    const layoutSource = readAppFile('app/(tabs)/_layout.tsx');
    const friendsHookSource = readAppFile('hooks/useFriends.ts');
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const manageSource = readAppFile('app/(tabs)/manage.tsx');
    const providerStart = layoutSource.indexOf('<FriendsProvider>');
    const tabsStart = layoutSource.indexOf('<Tabs');

    expect(layoutSource).toContain("import { FriendsProvider } from '@/hooks/useFriends';");
    expect(providerStart).toBeGreaterThan(-1);
    expect(tabsStart).toBeGreaterThan(providerStart);
    expect(layoutSource).toContain('</FriendsProvider>');
    expect(friendsHookSource).toContain('const FriendsContext = createContext');
    expect(friendsHookSource).toContain('function useFriendsController()');
    expect(friendsHookSource).toContain('export function FriendsProvider');
    expect(friendsHookSource).toContain('useContext(FriendsContext)');
    expect(friendsHookSource).toContain('AsyncStorage.getItem');
    expect(friendsHookSource).toContain('buildFriendDataCache');
    expect(friendsHookSource).toContain('parseFriendDataCache');
    expect(createSource).toContain('useFriends();');
    expect(manageSource).toContain('useFriends();');
  });
});

describe('schedule and friends surface notices', () => {
  it('does not show the account-save notice on schedule or friends screens', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const friendsSource = readAppFile('app/(tabs)/friends.tsx');

    expect(scheduleSource).not.toContain('StorageModeNotice');
    expect(friendsSource).not.toContain('StorageModeNotice');
  });

  it('does not render the schedule planner storage error banner', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const contentStart = scheduleSource.indexOf('<Animated.View style={[styles.contentStack');
    const contentEnd = scheduleSource.indexOf('</Animated.View>', contentStart);
    const contentBlock = scheduleSource.slice(contentStart, contentEnd);

    expect(contentStart).toBeGreaterThan(-1);
    expect(contentEnd).toBeGreaterThan(contentStart);
    expect(contentBlock).not.toContain('plannerError');
    expect(scheduleSource).not.toContain('errorText:');
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

  it('does not flash an empty direct-schedule state while planner data is still loading', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const panelStart = scheduleSource.indexOf('function SchedulePanel');
    const panelEnd = scheduleSource.indexOf('function ScheduleItemCard', panelStart);
    const panelBlock = scheduleSource.slice(panelStart, panelEnd);

    expect(scheduleSource).toContain('isLoading={plannerLoading}');
    expect(panelBlock).toContain('isLoading');
    expect(panelBlock).toContain('selectedItems.length === 0 && isLoading');
    expect(panelBlock).toContain('일정을 불러오고 있어요');
    expect(panelBlock.indexOf('selectedItems.length === 0 && isLoading')).toBeLessThan(
      panelBlock.indexOf('selectedItems.length > 0 ?'),
    );
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
    expect(cardBranch).not.toContain('<Chip label="약속 카드"');
    expect(manualBranch).not.toContain('<Chip label="직접 추가"');
    expect(scheduleSource).toContain('manualScheduleActionGroup:');
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

  it('shows an edit action on registered todo rows and routes edit/delete through the composer', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const todoPanelStart = scheduleSource.indexOf('function TodoPanel');
    const todoPanelEnd = scheduleSource.indexOf('function CardScheduleActionModal', todoPanelStart);
    const todoPanelBlock = scheduleSource.slice(todoPanelStart, todoPanelEnd);
    const composerStart = scheduleSource.indexOf('function ComposerModal');
    const composerEnd = scheduleSource.indexOf('function ColorPicker', composerStart);
    const composerBlock = scheduleSource.slice(composerStart, composerEnd);

    expect(todoPanelStart).toBeGreaterThan(-1);
    expect(todoPanelEnd).toBeGreaterThan(todoPanelStart);
    expect(scheduleSource).toContain('const [editingTodoItem, setEditingTodoItem]');
    expect(scheduleSource).toContain('function openTodoEditor(todo: TodoItem)');
    expect(scheduleSource).toContain('await updateTodo(editingTodoItem.id, input);');
    expect(scheduleSource).toContain('function requestDeleteEditingTodoItem()');
    expect(scheduleSource).toContain('void deleteTodo(todo.id)');
    expect(scheduleSource).toContain('toggleTodoOptimistic');
    expect(scheduleSource).toContain('const completedTodoColorByKey: Record<ScheduleColorKey, string>');
    expect(todoPanelBlock).toContain('onEdit={() => onEdit(todo)}');
    expect(todoPanelBlock).toContain('accessibilityLabel={`${todo.title} 편집`}');
    expect(todoPanelBlock).toContain('<Pencil size={18}');
    expect(todoPanelBlock).toContain('styles.todoEditButtonText');
    expect(todoPanelBlock).toContain('const backgroundColor = todo.done ? getCompletedTodoBackgroundColor(todo.colorKey) : color.soft;');
    expect(todoPanelBlock).not.toContain('todo.done ? palette.mintSoft : color.soft');
    expect(composerBlock).toContain('isEditingTodo');
    expect(composerBlock).toContain("'할일 편집'");
    expect(composerBlock).toContain('onDeleteTodo');
    expect(composerBlock).toContain('할일 삭제');
  });

  it('shows completed todo count against the total count on the todo tab', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const todoPanelStart = scheduleSource.indexOf('function TodoPanel');
    const todoPanelEnd = scheduleSource.indexOf('function TodoRow', todoPanelStart);
    const todoPanelBlock = scheduleSource.slice(todoPanelStart, todoPanelEnd);

    expect(todoPanelStart).toBeGreaterThan(-1);
    expect(todoPanelEnd).toBeGreaterThan(todoPanelStart);
    expect(scheduleSource).toContain('const completedTodoCount = selectedTodos.filter((todo) => todo.done).length;');
    expect(todoPanelBlock).toContain('completedCount');
    expect(todoPanelBlock).toContain('totalCount');
    expect(todoPanelBlock).toContain('완료 ${completedCount}/${totalCount}');
    expect(todoPanelBlock).not.toContain('개 남음');
  });

  it('keeps the schedule composer actions visible when the form needs to scroll', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const modalStart = scheduleSource.indexOf('function ComposerModal');
    const modalEnd = scheduleSource.indexOf('function ColorPicker', modalStart);
    const modalBlock = scheduleSource.slice(modalStart, modalEnd);
    const formScrollIndex = modalBlock.indexOf('style={styles.scheduleComposerFormScroll}');
    const formScrollEndIndex = modalBlock.indexOf('</ScrollView>', formScrollIndex);
    const formIndex = modalBlock.indexOf('contentContainerStyle={styles.scheduleComposerForm}');
    const footerIndex = modalBlock.indexOf('style={styles.scheduleComposerFooter}');
    const submitIndex = modalBlock.indexOf('styles.modalSubmitButton');
    const panelStyleStart = scheduleSource.indexOf('scheduleComposerPanel:');
    const panelStyleEnd = scheduleSource.indexOf('scheduleComposerKeyboardAvoider:', panelStyleStart);
    const panelStyleBlock = scheduleSource.slice(panelStyleStart, panelStyleEnd);

    expect(modalStart).toBeGreaterThan(-1);
    expect(modalEnd).toBeGreaterThan(modalStart);
    expect(modalBlock).toContain('<KeyboardAvoidingView');
    expect(modalBlock).toContain('style={styles.scheduleComposerKeyboardAvoider}');
    expect(modalBlock).toContain('styles.modalBackdropTouchable');
    expect(modalBlock).toContain('styles.scheduleComposerPressGuard');
    expect(modalBlock).toContain('<ScrollView');
    expect(modalBlock).toContain('keyboardShouldPersistTaps="handled"');
    expect(modalBlock).toContain('nestedScrollEnabled');
    expect(modalBlock).toContain('<CompactScheduleTimeField');
    expect(scheduleSource).toContain('scheduleComposerPanel:');
    expect(scheduleSource).toContain('scheduleComposerKeyboardAvoider:');
    expect(scheduleSource).toContain('scheduleComposerPressGuard:');
    expect(scheduleSource).toContain('scheduleComposerFormScroll:');
    expect(scheduleSource).toContain('scheduleComposerForm:');
    expect(scheduleSource).toContain('compactTimeShell:');
    expect(scheduleSource).toContain('compactColorPickerShell:');
    expect(scheduleSource).toContain('scheduleComposerFooter:');
    expect(panelStyleStart).toBeGreaterThan(-1);
    expect(panelStyleEnd).toBeGreaterThan(panelStyleStart);
    expect(formScrollIndex).toBeGreaterThan(-1);
    expect(formIndex).toBeGreaterThan(-1);
    expect(formScrollEndIndex).toBeGreaterThan(formIndex);
    expect(footerIndex).toBeGreaterThan(formScrollEndIndex);
    expect(submitIndex).toBeGreaterThan(footerIndex);
    expect(scheduleSource).toContain("alignSelf: 'stretch'");
    expect(scheduleSource).toContain("maxHeight: '86%'");
    expect(scheduleSource).toContain('flexGrow: 0');
    expect(scheduleSource).toContain('flexShrink: 1');
    expect(scheduleSource).toContain('minHeight: 0');
    expect(scheduleSource).toContain('paddingBottom: spacing.xs');
    expect(scheduleSource).toContain('padding: spacing.md');
    expect(panelStyleBlock).not.toContain('padding: spacing.xs');
    expect(scheduleSource).not.toContain("scheduleComposerPanel: {\n    gap: spacing.xs,\n    height: '86%'");
  });

  it('opens a recurring todo manager from the todo screen', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const todoPanelStart = scheduleSource.indexOf('function TodoPanel');
    const todoPanelEnd = scheduleSource.indexOf('function TodoRow', todoPanelStart);
    const todoPanelBlock = scheduleSource.slice(todoPanelStart, todoPanelEnd);
    const modalStart = scheduleSource.indexOf('function RecurringTodoModal');
    const modalEnd = scheduleSource.indexOf('function CardScheduleActionModal', modalStart);
    const modalBlock = scheduleSource.slice(modalStart, modalEnd);
    const formBodyIndex = modalBlock.indexOf('style={styles.recurringTodoFormBody}');
    const formBlockIndex = modalBlock.indexOf('style={styles.recurringTodoForm}', formBodyIndex);
    const listScrollIndex = modalBlock.indexOf('<ScrollView');
    const listScrollEndIndex = modalBlock.indexOf('</ScrollView>', listScrollIndex);

    expect(scheduleSource).toContain("const [isRecurringTodoModalOpen, setIsRecurringTodoModalOpen] = useState(false);");
    expect(scheduleSource).toContain('<RecurringTodoModal');
    expect(todoPanelBlock).toContain('onOpenRecurring');
    expect(todoPanelBlock).toContain('반복할일');
    expect(todoPanelBlock).toContain('<Repeat2 size={17}');
    expect(modalStart).toBeGreaterThan(-1);
    expect(modalEnd).toBeGreaterThan(modalStart);
    expect(scheduleSource).toContain("{ value: 1, label: '월' }");
    expect(scheduleSource).toContain("{ value: 0, label: '일' }");
    expect(modalBlock).toContain('recurringWeekdayOptions.map');
    expect(modalBlock).toContain('추가하기');
    expect(modalBlock).toContain('삭제');
    expect(modalBlock).toContain('selectedRecurringWeekdayButton');
    expect(modalBlock).toContain('{!isFormOpen ? (');
    expect(modalBlock).toContain('<KeyboardAvoidingView');
    expect(modalBlock).toContain('styles.recurringTodoKeyboardAvoider');
    expect(modalBlock).toContain('<View style={styles.modalBackdrop}>');
    expect(modalBlock).toContain('styles.modalBackdropTouchable');
    expect(modalBlock).not.toContain('<Pressable style={styles.modalBackdrop} onPress={onClose}>');
    expect(modalBlock).toContain('[styles.modalPressGuard, styles.recurringTodoPressGuard]');
    expect(modalBlock).toContain('[styles.modalPanel, styles.recurringTodoPanel, isFormOpen && styles.recurringTodoFormPanel]');
    expect(scheduleSource).toContain('recurringTodoPanel:');
    expect(scheduleSource).toContain('recurringTodoFormPanel:');
    expect(scheduleSource).toContain('recurringTodoPressGuard:');
    expect(scheduleSource).toContain('recurringTodoKeyboardAvoider:');
    expect(scheduleSource).toContain("height: '62%'");
    expect(scheduleSource).toContain("height: '86%'");
    expect(scheduleSource).toContain('recurringTodoFooter:');
    expect(modalBlock).toContain('styles.recurringTodoFooter');
    expect(formBodyIndex).toBeGreaterThan(-1);
    expect(formBlockIndex).toBeGreaterThan(formBodyIndex);
    expect(listScrollIndex).toBeGreaterThan(-1);
    expect(listScrollEndIndex).toBeLessThan(formBodyIndex);
    expect(scheduleSource).toContain('recurringTodoFormBody:');
    expect(modalBlock).toContain('isFormOpen ? (');
    expect(scheduleSource).toContain('flexShrink: 1');
    expect(scheduleSource).toContain('flexGrow: 1');
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

  it('does not promise profile-link entry when friend add only accepts ids', () => {
    const source = readAppFile('app/(tabs)/friends.tsx');
    const emptyStateStart = source.indexOf('title="아직 친구가 없어요"');
    const emptyStateEnd = source.indexOf('/>', emptyStateStart);
    const emptyStateBlock = source.slice(emptyStateStart, emptyStateEnd);

    expect(emptyStateStart).toBeGreaterThan(-1);
    expect(emptyStateBlock).toContain('친구 아이디');
    expect(emptyStateBlock).not.toContain('프로필 링크');
  });
});

describe('profile public identity sharing', () => {
  it('keeps sharing behind the id row action instead of a profile-link row', () => {
    const source = readAppFile('app/(tabs)/profile.tsx');
    const profileSectionStart = source.indexOf('<SectionHeader title="공개 프로필"');
    const profileSectionEnd = source.indexOf('<SectionHeader title="알림 설정"', profileSectionStart);
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

  it('keeps profile settings focused on identity, notifications, and a bottom logout button', () => {
    const source = readAppFile('app/(tabs)/profile.tsx');
    const notificationStart = source.indexOf('<SectionHeader title="알림 설정"');
    const logoutStart = source.indexOf('styles.logoutFooter', notificationStart);
    const notificationBlock = source.slice(notificationStart, logoutStart);

    expect(notificationStart).toBeGreaterThan(-1);
    expect(logoutStart).toBeGreaterThan(notificationStart);
    expect(source).not.toContain('Supabase Auth');
    expect(source).not.toContain('<SectionHeader title="계정 데이터"');
    expect(source).not.toContain('<SectionHeader title="로그인 설정"');
    expect(source).not.toContain('function SyncTile');
    expect(source).not.toContain('function SettingRow');
    expect(source).not.toContain('ProviderButton');
    expect(notificationBlock).toContain('권한 켜기');
    expect(notificationBlock).toContain('<NotificationToggleRow');
    expect(notificationBlock).toContain('<ReminderLeadButton');
    expect(notificationBlock).toContain("category=\"friendRequests\"");
    expect(notificationBlock).toContain("category=\"cardReceived\"");
    expect(notificationBlock).toContain("category=\"reminders\"");
    expect(notificationBlock).toContain('label="일정 리마인드"');
    expect(notificationBlock).not.toContain('label="약속 리마인드"');
    expect(source).toContain('logoutFooter:');
    expect(source).toContain("label={isAuthWorking ? '처리 중' : '로그아웃'}");
  });

  it('reloads notification settings when the profile tab receives focus', () => {
    const source = readAppFile('app/(tabs)/profile.tsx');
    const focusStart = source.indexOf('useFocusEffect(');
    const focusEnd = source.indexOf('async function handleNotificationPermissionEnable', focusStart);
    const focusBlock = source.slice(focusStart, focusEnd);

    expect(source).toContain("import { useFocusEffect } from 'expo-router';");
    expect(focusStart).toBeGreaterThan(-1);
    expect(focusEnd).toBeGreaterThan(focusStart);
    expect(focusBlock).toContain('notificationSettings.reload');
  });

  it('keeps reminder lead choices in a single horizontal row', () => {
    const source = readAppFile('app/(tabs)/profile.tsx');
    const rowStart = source.indexOf('reminderLeadRow:');
    const buttonStart = source.indexOf('reminderLeadButton:', rowStart);
    const selectedStart = source.indexOf('selectedReminderLeadButton:', buttonStart);
    const rowStyles = source.slice(rowStart, buttonStart);
    const buttonStyles = source.slice(buttonStart, selectedStart);

    expect(rowStart).toBeGreaterThan(-1);
    expect(buttonStart).toBeGreaterThan(rowStart);
    expect(rowStyles).toContain("flexDirection: 'row'");
    expect(rowStyles).toContain('flexWrap:');
    expect(rowStyles).toContain("'nowrap'");
    expect(buttonStyles).toContain('flex: 1');
    expect(buttonStyles).not.toContain('minWidth: 96');
  });

  it('asks for confirmation before signing out', () => {
    const source = readAppFile('app/(tabs)/profile.tsx');
    const footerStart = source.indexOf('styles.logoutFooter');
    const footerEnd = source.indexOf('</View>', footerStart);
    const footerBlock = source.slice(footerStart, footerEnd);

    expect(source).toContain('const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);');
    expect(source).toContain('function openLogoutConfirm()');
    expect(footerBlock).toContain('onPress={openLogoutConfirm}');
    expect(source).toContain('<ConfirmActionModal');
    expect(source).toContain('title="로그아웃할까요?"');
    expect(source).toContain('confirmLabel={isAuthWorking ?');
    expect(source).toContain("onConfirm={() => void handleSignOut()}");
  });

  it('applies notification preference changes optimistically without waiting for reminder refresh', () => {
    const source = readAppFile('hooks/useAppNotifications.ts');
    const categoryStart = source.indexOf('const setCategoryEnabled = useCallback');
    const reminderStart = source.indexOf('const setReminderLead = useCallback');
    const sendTestStart = source.indexOf('const sendTest = useCallback', reminderStart);
    const categoryBlock = source.slice(categoryStart, reminderStart);
    const reminderBlock = source.slice(reminderStart, sendTestStart);

    expect(categoryStart).toBeGreaterThan(-1);
    expect(reminderStart).toBeGreaterThan(categoryStart);
    expect(categoryBlock).toContain('setPreferences((currentPreferences) => ({');
    expect(categoryBlock).toContain('[category]: nextEnabled');
    expect(categoryBlock).toContain('void refreshEnabledNotifications();');
    expect(categoryBlock).not.toContain('await refreshEnabledNotifications();');
    expect(reminderBlock).toContain('setPreferences((currentPreferences) => ({');
    expect(reminderBlock).toContain('reminderLead');
    expect(reminderBlock).toContain('void refreshEnabledNotifications();');
    expect(reminderBlock).not.toContain('await refreshEnabledNotifications();');
  });
});

describe('friends add modal copy', () => {
  it('does not show sync status copy in friend list rows', () => {
    const friendsSource = readAppFile('app/(tabs)/friends.tsx');
    const repositorySource = readAppFile('data/supabaseFriendRepository.ts');
    const rowStart = friendsSource.indexOf('function FriendRow');
    const rowEnd = friendsSource.indexOf('function FriendRequestRow', rowStart);
    const rowBlock = friendsSource.slice(rowStart, rowEnd);

    expect(rowStart).toBeGreaterThan(-1);
    expect(rowEnd).toBeGreaterThan(rowStart);
    expect(rowBlock).toContain('<Text style={styles.personMeta}>@{friend.handle}</Text>');
    expect(rowBlock).not.toContain('friend.lastActiveLabel');
    expect(friendsSource).not.toContain('계정 동기화됨');
    expect(repositorySource).not.toContain('계정 동기화됨');
  });

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

  it('focuses the friend id field and explains where to find that id', () => {
    const source = readAppFile('app/(tabs)/friends.tsx');
    const addModalStart = source.indexOf('function AddFriendModal');
    const addModalEnd = source.indexOf('function ConfirmModal', addModalStart);
    const addModal = source.slice(addModalStart, addModalEnd);

    expect(addModalStart).toBeGreaterThan(-1);
    expect(addModalEnd).toBeGreaterThan(addModalStart);
    expect(addModal).toContain('inputRef.current?.focus();');
    expect(addModal).toContain('autoFocus={visible}');
    expect(addModal).toContain('상대방 내정보 화면의 친구 아이디를 입력해 주세요.');
  });

  it('waits for friend request acceptance before switching to the friend list tab', () => {
    const source = readAppFile('app/(tabs)/friends.tsx');
    const acceptStart = source.indexOf('async function handleAcceptRequest');
    const acceptEnd = source.indexOf('function handleCancelRequest', acceptStart);
    const acceptBlock = source.slice(acceptStart, acceptEnd);

    expect(acceptStart).toBeGreaterThan(-1);
    expect(acceptEnd).toBeGreaterThan(acceptStart);
    expect(acceptBlock).toContain('await acceptRequest(request.id);');
    expect(acceptBlock.indexOf('await acceptRequest(request.id);')).toBeLessThan(
      acceptBlock.indexOf("setActiveTab('FRIENDS');"),
    );
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

describe('design audit responsive and contrast contract', () => {
  it('keeps create mode cards in one horizontal row for large Android text', () => {
    const cardMenuSource = readAppFile('components/card-menu.tsx');

    expect(cardMenuSource).not.toContain('useWindowDimensions');
    expect(cardMenuSource).not.toContain('shouldStackModes');
    expect(cardMenuSource).not.toContain('stackedMode');
    expect(cardMenuSource).toContain("flexDirection: 'row'");
    expect(cardMenuSource).toContain('flex: 1');
  });

  it('moves decorative create hero shapes away from copy in large text mode', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');

    expect(createSource).toContain('const isLargeTextLayout = fontScale >= 1.2 || width < 380;');
    expect(createSource).toContain('isLargeTextLayout && styles.largeTextHeader');
    expect(createSource).toContain('isLargeTextLayout && styles.largeTextHeaderShapePrimary');
    expect(createSource).toContain('isLargeTextLayout && styles.largeTextHeaderShapeMint');
    expect(createSource).toContain('isLargeTextLayout && styles.largeTextHeaderShapeLime');
    expect(createSource).toContain('bottom: -72');
    expect(createSource).toContain('left: -48');
    expect(createSource).toContain("fontWeight: '700'");
  });

  it('uses compact secondary heroes instead of full create-size banners', () => {
    const secondaryTabs = ['manage', 'schedule', 'friends', 'profile'];

    for (const tab of secondaryTabs) {
      const source = readAppFile(`app/(tabs)/${tab}.tsx`);

      expect(source).toContain("import { compactHero");
      expect(source).toContain('minHeight: compactHero.minHeight');
      expect(source).toContain('paddingHorizontal: compactHero.paddingHorizontal');
      expect(source).toContain('paddingVertical: compactHero.paddingVertical');
      expect(source).toContain('fontSize: compactHero.titleSize');
      expect(source).toContain("fontWeight: '700'");
    }
  });

  it('keeps schedule hero accent shapes out of the text column', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');

    expect(scheduleSource).toContain('bottom: -24');
    expect(scheduleSource).toContain('left: -44');
  });

  it('uses a stronger shared modal backdrop so tabs recede behind dialogs', () => {
    const sources = [
      readAppFile('app/(tabs)/create.tsx'),
      readAppFile('app/(tabs)/manage.tsx'),
      readAppFile('app/(tabs)/schedule.tsx'),
      readAppFile('app/(tabs)/friends.tsx'),
      readAppFile('app/(tabs)/profile.tsx'),
    ];

    expect(readAppFile('constants/theme.ts')).toContain("backdrop: 'rgba(75, 52, 40, 0.58)'");
    for (const source of sources) {
      expect(source).toContain('modalOverlay.backdrop');
    }
  });

  it('uses a darker disabled text token for important unavailable states', () => {
    const themeSource = readAppFile('constants/theme.ts');
    const uiSource = readAppFile('components/ui.tsx');
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');

    expect(themeSource).toContain("inkDisabled: '#6F5748'");
    expect(uiSource).toContain('color: palette.inkDisabled');
    expect(scheduleSource).toContain('color: palette.inkDisabled');
  });

  it('reduces friend summary card weight so the add-friend action remains dominant', () => {
    const friendsSource = readAppFile('app/(tabs)/friends.tsx');

    expect(friendsSource).toContain('minHeight: 56');
    expect(friendsSource).toContain('paddingHorizontal: spacing.sm');
    expect(friendsSource).toContain('fontSize: 20');
    expect(friendsSource).toContain("fontWeight: '800'");
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

  it('does not show test friends as if they were real app recipients', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const pickerStart = createSource.indexOf('{isFriendPickerOpen ? (');
    const pickerEnd = createSource.indexOf('</View>', createSource.indexOf('styles.secondaryActionRow', pickerStart));
    const pickerBlock = createSource.slice(pickerStart, pickerEnd);

    expect(pickerStart).toBeGreaterThan(-1);
    expect(pickerBlock).not.toContain('테스트 친구');
    expect(pickerBlock).toContain('친구 추가');
  });
  it('uses selection labels instead of a waiting-state label in friend pickers', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const manageSource = readAppFile('app/(tabs)/manage.tsx');

    expect(createSource).toContain("{selected ? '선택됨' : '선택하기'}");
    expect(manageSource).toContain("{selected ? '선택됨' : '선택하기'}");
    expect(createSource).not.toContain("{selected ? '선택' : '대기'}");
    expect(manageSource).not.toContain("{selected ? '선택' : '대기'}");
  });

  it('tells users the preview can be continued after adding a first friend', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const manageSource = readAppFile('app/(tabs)/manage.tsx');

    expect(createSource).toContain('친구 추가 후 카드 탭으로 돌아오면 이 미리보기가 유지돼요.');
    expect(manageSource).toContain('친구 추가 후 관리함으로 돌아오면 이 카드 보내기를 이어갈 수 있어요.');
  });

  it('keeps the app-friend send action on one line in the preview action row', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const manageSource = readAppFile('app/(tabs)/manage.tsx');
    const uiSource = readAppFile('components/ui.tsx');
    const appFriendActionStart = createSource.indexOf('label="앱 친구에게 보내기"');
    const appFriendActionEnd = createSource.indexOf('label="링크 복사"', appFriendActionStart);
    const appFriendActionBlock = createSource.slice(appFriendActionStart, appFriendActionEnd);
    const linkActionEnd = createSource.indexOf('onPress={() => {', appFriendActionEnd);
    const linkActionBlock = createSource.slice(appFriendActionEnd, linkActionEnd);
    const reshareActionsStart = manageSource.indexOf('<View style={styles.previewActions}>');
    const reshareAppFriendActionStart = manageSource.indexOf('label="앱 친구에게 보내기"', reshareActionsStart);
    const reshareAppFriendActionEnd = manageSource.indexOf('label="링크 복사"', reshareAppFriendActionStart);
    const reshareAppFriendActionBlock = manageSource.slice(reshareAppFriendActionStart, reshareAppFriendActionEnd);
    const reshareLinkActionEnd = manageSource.indexOf('onPress={() => void handleCopyReshareLink()}', reshareAppFriendActionEnd);
    const reshareLinkActionBlock = manageSource.slice(reshareAppFriendActionEnd, reshareLinkActionEnd);

    expect(appFriendActionStart).toBeGreaterThan(-1);
    expect(appFriendActionBlock).toContain('singleLineLabel');
    expect(appFriendActionBlock).toContain('style={styles.previewAppFriendButton}');
    expect(appFriendActionBlock).toContain('labelStyle={styles.previewSecondaryActionLabel}');
    expect(linkActionBlock).toContain('singleLineLabel');
    expect(linkActionBlock).toContain('style={styles.previewLinkButton}');
    expect(linkActionBlock).toContain('labelStyle={styles.previewSecondaryActionLabel}');
    expect(uiSource).toContain('singleLineLabel?: boolean;');
    expect(uiSource).toContain('style?: StyleProp<ViewStyle>;');
    expect(uiSource).toContain('labelStyle?: StyleProp<TextStyle>;');
    expect(uiSource).toContain('numberOfLines={singleLineLabel ? 1 : undefined}');
    expect(uiSource).toContain('adjustsFontSizeToFit={singleLineLabel}');
    expect(createSource).toContain('previewAppFriendButton:');
    expect(createSource).toContain('previewLinkButton:');
    expect(createSource).toContain('previewSecondaryActionLabel:');
    expect(reshareAppFriendActionStart).toBeGreaterThan(-1);
    expect(reshareAppFriendActionBlock).toContain('singleLineLabel');
    expect(reshareAppFriendActionBlock).toContain('style={styles.previewAppFriendButton}');
    expect(reshareAppFriendActionBlock).toContain('labelStyle={styles.previewSecondaryActionLabel}');
    expect(reshareLinkActionBlock).toContain('singleLineLabel');
    expect(reshareLinkActionBlock).toContain('style={styles.previewLinkButton}');
    expect(reshareLinkActionBlock).toContain('labelStyle={styles.previewSecondaryActionLabel}');
    expect(manageSource).toContain('previewAppFriendButton:');
    expect(manageSource).toContain('previewLinkButton:');
    expect(manageSource).toContain('previewSecondaryActionLabel:');
  });

  it('uses a compact, scrollable friend picker instead of the full preview card while choosing app friends', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const summaryStart = createSource.indexOf('{isFriendPickerOpen ? (');
    const pickerStart = createSource.indexOf('{isFriendPickerOpen ? (', summaryStart + 1);
    const pickerEnd = createSource.indexOf('<View style={styles.previewActions}>', pickerStart);
    const summaryBlock = createSource.slice(summaryStart, pickerStart);
    const pickerBlock = createSource.slice(pickerStart, pickerEnd);
    const compactSummaryStart = summaryBlock.indexOf('<PreviewFriendSendSummary card={previewCard} />');
    const fullPreviewStart = summaryBlock.indexOf('<DraftPreviewCard card={previewCard} />');

    expect(summaryStart).toBeGreaterThan(-1);
    expect(pickerStart).toBeGreaterThan(-1);
    expect(pickerEnd).toBeGreaterThan(pickerStart);
    expect(compactSummaryStart).toBeGreaterThan(-1);
    expect(fullPreviewStart).toBeGreaterThan(-1);
    expect(compactSummaryStart).toBeLessThan(fullPreviewStart);
    expect(pickerBlock).toContain('style={styles.friendPickerListScroller}');
    expect(pickerBlock).toContain('contentContainerStyle={styles.friendPickerListContent}');
    expect(pickerBlock).toContain('nestedScrollEnabled');
    expect(pickerBlock).not.toContain('<DraftPreviewCard');
    expect(createSource).toContain('friendPickerPanel:');
    expect(createSource).toContain('previewCompactSummary:');
    expect(createSource).toContain('modalBackdropTouchable:');
    expect(createSource).toContain("{isFriendPickerOpen ? '앱 친구에게 보내기' : '공유 전 미리보기'}");
  });

  it('does not inject QA-only friends into the app friend picker', () => {
    const createSource = readAppFile('app/(tabs)/create.tsx');
    const previewFriendsSource = readAppFile('lib/previewFriends.ts');

    expect(createSource).not.toContain('getQaPreviewFriendOptions');
    expect(previewFriendsSource).not.toContain('EXPO_PUBLIC_QA_PREVIEW_FRIEND_COUNT');
    expect(previewFriendsSource).not.toContain('qa-preview-friend');
    expect(previewFriendsSource).not.toContain('QA 친구');
  });
});

describe('received card response choices', () => {
  it('uses semantic green and red response choice colors with darker selected states', () => {
    const manageSource = readAppFile('app/(tabs)/manage.tsx');
    const responseButtonStart = manageSource.indexOf('function ResponseChoiceButton');
    const responseButtonEnd = manageSource.indexOf('function ResponseBadgeSummary', responseButtonStart);
    const responseButtonBlock = manageSource.slice(responseButtonStart, responseButtonEnd);
    const responseChoiceStylesStart = manageSource.indexOf('responseChoiceButton:');
    const responseChoiceStylesEnd = manageSource.indexOf('responseChoiceText:', responseChoiceStylesStart);
    const responseChoiceStylesBlock = manageSource.slice(responseChoiceStylesStart, responseChoiceStylesEnd);

    expect(responseButtonStart).toBeGreaterThan(-1);
    expect(responseButtonEnd).toBeGreaterThan(responseButtonStart);
    expect(responseButtonBlock).toContain("choice === 'YES' ? styles.responseChoiceYesButton : styles.responseChoiceNoButton");
    expect(responseButtonBlock).toContain("choice === 'YES' ? styles.selectedResponseChoiceYesButton : styles.selectedResponseChoiceNoButton");
    expect(responseChoiceStylesBlock).toContain('responseChoiceYesButton:');
    expect(responseChoiceStylesBlock).toContain('backgroundColor: palette.mintSoft');
    expect(responseChoiceStylesBlock).toContain('responseChoiceNoButton:');
    expect(responseChoiceStylesBlock).toContain('backgroundColor: palette.coralSoft');
    expect(responseChoiceStylesBlock).toContain('selectedResponseChoiceYesButton:');
    expect(responseChoiceStylesBlock).toContain('backgroundColor: palette.mint');
    expect(responseChoiceStylesBlock).toContain('selectedResponseChoiceNoButton:');
    expect(responseChoiceStylesBlock).toContain('backgroundColor: palette.danger');
    expect(responseChoiceStylesBlock).not.toContain('backgroundColor: palette.surface');
  });

  it('uses the same accept and reject color language on friend requests and auth copy', () => {
    const friendsSource = readAppFile('app/(tabs)/friends.tsx');
    const authCallbackSource = readAppFile('app/auth/callback.tsx');

    expect(friendsSource).toContain('style={styles.acceptActionButton}');
    expect(friendsSource).toContain('acceptActionButton:');
    expect(friendsSource).toContain('backgroundColor: palette.mint');
    expect(friendsSource).toContain('variant="danger"');
    expect(authCallbackSource).toContain('계정 연결을 마무리하고 있어요. 잠시만 기다려 주세요.');
    expect(authCallbackSource).not.toContain('Supabase 계정');
  });

  it('shows the app icon safely on the auth callback waiting screen', () => {
    const authCallbackSource = readAppFile('app/auth/callback.tsx');
    const iconFrameStart = authCallbackSource.indexOf('iconFrame:');
    const iconFrameEnd = authCallbackSource.indexOf('brandImage:', iconFrameStart);
    const iconFrameBlock = authCallbackSource.slice(iconFrameStart, iconFrameEnd);
    const brandImageStart = authCallbackSource.indexOf('brandImage:');
    const brandImageEnd = authCallbackSource.indexOf('title:', brandImageStart);
    const brandImageBlock = authCallbackSource.slice(brandImageStart, brandImageEnd);

    expect(authCallbackSource).toContain("const authCallbackBrandImage = require('../../assets/images/android-icon-foreground.png');");
    expect(authCallbackSource).toContain('<Image');
    expect(authCallbackSource).toContain('resizeMode="contain"');
    expect(authCallbackSource).toContain('source={authCallbackBrandImage}');
    expect(authCallbackSource).toContain('style={styles.brandImage}');
    expect(authCallbackSource).not.toContain('CheckCircle2');
    expect(iconFrameBlock).toContain('height: 92');
    expect(iconFrameBlock).toContain('width: 92');
    expect(brandImageBlock).toContain('height: 72');
    expect(brandImageBlock).toContain('width: 72');
  });
});

describe('schedule empty state actions', () => {
  it('places the schedule add action inside the empty state card', () => {
    const scheduleSource = readAppFile('app/(tabs)/schedule.tsx');
    const panelStart = scheduleSource.indexOf('function SchedulePanel');
    const panelEnd = scheduleSource.indexOf('function ScheduleItemCard', panelStart);
    const panel = scheduleSource.slice(panelStart, panelEnd);

    expect(panelStart).toBeGreaterThan(-1);
    expect(panelEnd).toBeGreaterThan(panelStart);
    expect(panel).toContain('styles.emptyAddButton');
    expect(panel).toContain('onPress={onAdd}');
    expect(panel).toContain('selectedItems.length > 0 ? (');
  });
});

describe('app notification runtime', () => {
  it('reinstalls realtime notification subscriptions after auth changes', () => {
    const source = readAppFile('hooks/useAppNotifications.ts');
    const runtimeStart = source.indexOf('export function useAppNotificationRuntime()');
    const runtimeEnd = source.indexOf('export function useNotificationSettings()', runtimeStart);
    const runtimeBlock = source.slice(runtimeStart, runtimeEnd);
    const authStart = runtimeBlock.indexOf('supabase?.auth.onAuthStateChange');
    const authBlock = runtimeBlock.slice(authStart, authStart + 220);

    expect(runtimeStart).toBeGreaterThan(-1);
    expect(runtimeEnd).toBeGreaterThan(runtimeStart);
    expect(runtimeBlock).toContain('async function reinstallRealtimeRefresh()');
    expect(runtimeBlock).toContain('removeRealtimeRefresh?.();');
    expect(runtimeBlock).toContain('void reinstallRealtimeRefresh();');
    expect(authBlock).toContain('void reinstallRealtimeRefresh();');
  });

  it('requests native phone notification permission once after the first app entry loads', () => {
    const rootLayoutSource = readAppFile('app/_layout.tsx');
    const tabsLayoutSource = readAppFile('app/(tabs)/_layout.tsx');
    const notificationHookSource = readAppFile('hooks/useAppNotifications.ts');
    const profileSource = readAppFile('app/(tabs)/profile.tsx');
    const initialPromptStart = notificationHookSource.indexOf('export function useInitialNotificationPermissionPrompt');
    const initialPromptEnd = notificationHookSource.indexOf('export function useNotificationSettings', initialPromptStart);
    const initialPromptBlock = notificationHookSource.slice(initialPromptStart, initialPromptEnd);

    expect(rootLayoutSource).toContain('useInitialNotificationPermissionPrompt({ enabled: authGate.canHideSplash });');
    expect(tabsLayoutSource).not.toContain('useInitialNotificationPermissionPrompt');
    expect(notificationHookSource).toContain('INITIAL_NOTIFICATION_PERMISSION_PROMPT_KEY');
    expect(initialPromptBlock).toContain('isAppNotificationEnabled()');
    expect(initialPromptBlock).toContain('appNotificationEnabled');
    expect(initialPromptBlock).toContain('enableAppNotifications()');
    expect(initialPromptBlock).toContain('seedCurrentSocialNotificationState()');
    expect(initialPromptBlock).toContain('await refreshEnabledNotifications();');
    expect(initialPromptBlock).not.toContain('Alert.alert(');
    expect(profileSource).toContain('notificationSettings.enable()');
    expect(profileSource).toContain('onPress={() => void handleNotificationPermissionEnable()}');
  });
});

describe('received card reply UI', () => {
  it('lets receivers add a one-line message and submits it with the reply', () => {
    const source = readAppFile('app/(tabs)/manage.tsx');
    const submitStart = source.indexOf('async function handleSubmitResponse');
    const submitEnd = source.indexOf('function setCandidateChoice', submitStart);
    const submitBlock = source.slice(submitStart, submitEnd);
    const responseModalStart = source.indexOf('<Modal transparent visible={Boolean(responseCard)}');
    const responseModalEnd = source.indexOf('</Modal>', responseModalStart);
    const responseModalBlock = source.slice(responseModalStart, responseModalEnd);
    const modalStart = source.indexOf('{responseCard ? (');
    const modalEnd = source.indexOf('</Modal>', modalStart);
    const modalBlock = source.slice(modalStart, modalEnd);

    expect(responseModalStart).toBeGreaterThan(-1);
    expect(responseModalEnd).toBeGreaterThan(responseModalStart);
    expect(source).toContain('TextInput');
    expect(source).toContain("const [responseComment, setResponseComment] = useState('');");
    expect(submitBlock).toContain('respondToReceivedCard(responseCard.id, responses, responseComment)');
    expect(source).toContain('const responseModalScrollRef = useRef<ScrollView>(null);');
    expect(source).toContain('const RESPONSE_COMMENT_SCROLL_DELAY_MS = 240;');
    expect(source).toContain('const scrollResponseCommentIntoView = useCallback(() => {');
    expect(source).toContain('responseModalScrollRef.current?.scrollToEnd({ animated: true });');
    expect(responseModalBlock).toContain('<KeyboardAvoidingView');
    expect(responseModalBlock).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");
    expect(responseModalBlock).toContain('style={styles.responseModalKeyboardAvoider}');
    expect(modalBlock).toContain('ref={responseModalScrollRef}');
    expect(modalBlock).toContain('styles.responseModalBodyContent');
    expect(modalBlock).toContain('accessibilityLabel="한마디"');
    expect(modalBlock).toContain('value={responseComment}');
    expect(modalBlock).toContain('onChangeText={setResponseComment}');
    expect(modalBlock).toContain('onFocus={scrollResponseCommentIntoView}');
    expect(source).toContain('responseModalKeyboardAvoider:');
    expect(source).toContain('responseModalBodyContent:');
  });

  it('shows feedback and refreshes when a received card can no longer accept responses', () => {
    const source = readAppFile('app/(tabs)/manage.tsx');
    const submitStart = source.indexOf('async function handleSubmitResponse');
    const submitEnd = source.indexOf('function setCandidateChoice', submitStart);
    const submitBlock = source.slice(submitStart, submitEnd);
    const modalStart = source.indexOf('{responseCard ? (');
    const modalEnd = source.indexOf('</Modal>', modalStart);
    const modalBlock = source.slice(modalStart, modalEnd);

    expect(source).toContain("const [responseFeedback, setResponseFeedback] = useState<string | null>(null);");
    expect(source).toContain('isReceivedCardResponseUnavailableError');
    expect(source).toContain('getReceivedCardResponseErrorMessage');
    expect(submitBlock).toContain('setResponseFeedback(null);');
    expect(submitBlock).toContain('setResponseFeedback(getReceivedCardResponseErrorMessage(error));');
    expect(submitBlock).toContain('hideReceivedRepliedCard(responseCard, now, currentProfile);');
    expect(submitBlock).toContain('await reloadManagedCards({ force: true });');
    expect(modalBlock).toContain('responseFeedback ? (');
    expect(modalBlock).toContain('styles.responseFeedback');
    expect(source).not.toContain('받은 카드 목록을 새로고침했어요');
    expect(source).not.toContain('지난 카드는 내용을 확인만 할 수 있어요');
  });

  it('checks social notifications immediately before slower reminder refresh work', () => {
    const source = readAppFile('hooks/useAppNotifications.ts');

    expect(source).toContain('ensureAppNotificationEnabledForGrantedPermission');
    expect(source).toContain('async function refreshSocialNotificationsImmediately()');
    expect(source).toContain('await checkSocialNotifications();');
    expect(source).toContain('void refreshEnabledNotifications();');
    expect(source).toContain('installSocialNotificationRealtimeRefresh(refreshSocialNotificationsImmediately)');
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

  it('shows the sender on received cards and suppresses duplicate location details', () => {
    const cardMenuSource = readAppFile('components/card-menu.tsx');
    const manageSource = readAppFile('app/(tabs)/manage.tsx');
    const rowStart = cardMenuSource.indexOf('function ManagedCardRow');
    const rowEnd = cardMenuSource.indexOf('function ManagedResponseStats', rowStart);
    const rowBlock = cardMenuSource.slice(rowStart, rowEnd);
    const quickConfirmStart = manageSource.indexOf('function QuickConfirmCard');
    const quickConfirmEnd = manageSource.indexOf('function getResponseChoiceStyle', quickConfirmStart);
    const quickConfirmBlock = manageSource.slice(quickConfirmStart, quickConfirmEnd);

    expect(rowStart).toBeGreaterThan(-1);
    expect(rowEnd).toBeGreaterThan(rowStart);
    expect(rowBlock).toContain("getManagedCardScope(card) === 'RECEIVED'");
    expect(rowBlock).toContain('senderName');
    expect(rowBlock).toContain('님이 보낸 카드');
    expect(rowBlock).toContain('shouldShowCardLocationDetail(card)');
    expect(rowBlock).toContain('shouldShowLocation ? <InfoPill');
    expect(quickConfirmBlock).toContain('shouldShowCardLocationDetail(card)');
    expect(quickConfirmBlock).toContain('shouldShowLocation ? (');
    expect(manageSource).toContain('shouldShowCardLocationDetail(resultCard) ? (');
    expect(manageSource).toContain('shouldShowCardLocationDetail(responseCard) ? (');
  });
});

describe('managed card confirmation schedule handoff', () => {
  it('force-refreshes manage data on focus so received cards reflect sender confirmations', () => {
    const source = readAppFile('app/(tabs)/manage.tsx');
    const focusStart = source.indexOf('useFocusEffect(');
    const focusEnd = source.indexOf('useEffect(() => {', focusStart);
    const focusBlock = source.slice(focusStart, focusEnd);

    expect(focusStart).toBeGreaterThan(-1);
    expect(focusEnd).toBeGreaterThan(focusStart);
    expect(focusBlock).toContain('void reloadManagedCards({ force: true });');
  });

  it('force-refreshes promise data when the app returns foreground', () => {
    const source = readAppFile('hooks/usePromiseData.ts');
    const appStateStart = source.indexOf("AppState.addEventListener('change'");
    const appStateEnd = source.indexOf('const {', appStateStart);
    const appStateBlock = source.slice(appStateStart, appStateEnd);

    expect(appStateStart).toBeGreaterThan(-1);
    expect(appStateEnd).toBeGreaterThan(appStateStart);
    expect(appStateBlock).toContain('scheduleLoad({ force: true });');
  });

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
  it('reloads promise data from one per-account mobile sync version subscription', () => {
    const source = readAppFile('hooks/usePromiseData.ts');

    expect(source).toContain("table: 'mobile_sync_versions'");
    expect(source).toContain('filter: `user_id=eq.${accountId}`');
    expect(source).not.toContain("table: 'appointment_cards'");
    expect(source).not.toContain("table: 'appointment_respondents'");
    expect(source).not.toContain("table: 'appointment_candidate_responses'");
    expect(source).not.toContain("table: 'card_recipients'");
    expect(source).not.toContain("table: 'appointments'");
  });

  it('reloads friend data from one per-account mobile sync version subscription', () => {
    const source = readAppFile('hooks/useFriends.ts');

    expect(source).toContain("table: 'mobile_sync_versions'");
    expect(source).toContain('filter: `user_id=eq.${accountId}`');
    expect(source).not.toContain("table: 'friend_requests'");
  });
});
