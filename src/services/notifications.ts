// 저녁 리마인더 (로컬 알림) — "오늘 뭐 먹지" 고민하는 시각에 앱을 떠올리게 한다.
// 서버 푸시(FCM/APNs 토큰)는 쓰지 않는다: 기기 안에서 예약하는 로컬 알림이라
// 별도 인프라·심사 리스크 없이 재방문만 끌어올린다.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { t } from '../i18n';

// 앱이 켜져 있는 동안 18:30 이 지나도 알림이 보이도록. (설정하지 않으면 iOS 는 무음 처리)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,   // 배지는 쓰지 않음
  }),
});

export const REMINDER_ENABLED_KEY = 'dinner_reminder_on';
export const REMINDER_ASKED_KEY   = 'dinner_reminder_asked';

// 퇴근 직후~집 도착 무렵. 17시대는 아직 근무 중이라 묻히고,
// 19시 넘으면 이미 저녁을 정한 뒤라 늦다.
const REMINDER_HOUR = 18;
const REMINDER_MINUTE = 30;

const CHANNEL_ID = 'dinner-reminder';

// 매번 같은 문구면 금방 무시당한다 → 예약할 때마다 랜덤으로 고른다.
function randomBody(): string {
  const n = 5;
  return t(`notif.dinnerBody${Math.floor(Math.random() * n) + 1}`);
}

let _enabled = false;

export function isReminderOn(): boolean {
  return _enabled;
}

export async function loadReminderSetting(): Promise<void> {
  try {
    _enabled = (await SecureStore.getItemAsync(REMINDER_ENABLED_KEY)) === '1';
  } catch {
    _enabled = false;
  }
}

/** 알림 제안을 이미 한 번 띄웠는지 (같은 제안을 반복하지 않기 위해). */
export async function wasReminderAsked(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(REMINDER_ASKED_KEY)) === '1';
  } catch {
    return true;   // 읽기 실패 시엔 조용히 넘어간다(과하게 조르지 않음)
  }
}

export async function markReminderAsked(): Promise<void> {
  try { await SecureStore.setItemAsync(REMINDER_ASKED_KEY, '1'); } catch { /* 무시 */ }
}

export const REMINDER_RECIPE_COUNT_KEY = 'reminder_recipe_count';

// 첫 레시피 직후에 권한 팝업을 띄우면 거부율이 높다 → 두 번째 레시피부터 제안.
const SUGGEST_AFTER_RECIPES = 2;

/**
 * 레시피를 뽑을 때마다 호출. 알림을 제안할 타이밍이면 true.
 * (이미 켜져 있거나 한 번 제안했으면 다시 묻지 않는다.)
 */
export async function shouldSuggestReminder(): Promise<boolean> {
  if (_enabled) return false;
  if (await wasReminderAsked()) return false;
  try {
    const raw = await SecureStore.getItemAsync(REMINDER_RECIPE_COUNT_KEY);
    const n = (raw ? parseInt(raw, 10) || 0 : 0) + 1;
    await SecureStore.setItemAsync(REMINDER_RECIPE_COUNT_KEY, String(n));
    return n >= SUGGEST_AFTER_RECIPES;
  } catch {
    return false;
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: t('notif.channelName'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** 켜기 — 권한을 요청하고 매일 반복 알림을 예약한다. 권한 거부 시 false. */
export async function enableReminder(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      })).granted;
    }
    if (!granted) return false;

    await ensureAndroidChannel();
    await scheduleDaily();
    _enabled = true;
    await SecureStore.setItemAsync(REMINDER_ENABLED_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export async function disableReminder(): Promise<void> {
  _enabled = false;
  try {
    await SecureStore.setItemAsync(REMINDER_ENABLED_KEY, '0');
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch { /* 무시 */ }
}

/** 예약 교체 — 기존 예약을 지우고 새 문구로 다시 건다. */
async function scheduleDaily(): Promise<void> {
  // 전체 취소 — 지금 앱이 예약하는 알림은 이 리마인더 하나뿐이다.
  // 다른 종류의 예약 알림이 생기면 식별자로 선별 취소하도록 바꿔야 한다.
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notif.dinnerTitle'),
      body: randomBody(),
      // iOS 는 sound 를 지정하지 않으면 무음으로 뜬다(= 알아채지 못함).
      // Android 는 채널 importance 를 따르므로 양쪽 모두 소리가 나게 된다.
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
}

/**
 * 앱 시작 시 호출 — 켜져 있으면 문구를 바꿔 다시 예약한다.
 * (권한이 사라졌으면 설정도 꺼서 상태를 일치시킨다.)
 */
export async function refreshReminder(): Promise<void> {
  await loadReminderSetting();
  if (!_enabled) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      await disableReminder();
      return;
    }
    await ensureAndroidChannel();
    await scheduleDaily();
  } catch { /* 무시 — 알림은 부가 기능이므로 앱 시작을 막지 않는다 */ }
}
