import { Alert } from 'react-native';
import {
  canSpend, addBonusLeaves, getAdWatchesLeft, getAdCooldownRemaining, recordAdWatch,
  LEAF_COST, ACTION_LABEL, LeafAction, AD_REWARD, AD_DAILY_LIMIT,
} from './leaves';
import { showRewardedAd, isExpoGo } from './ads';

/**
 * 보상형 광고를 보여주고, 보상 획득 시 잎사귀를 지급한다.
 * 제한: 하루 AD_DAILY_LIMIT 회 + 광고 간 30분 쿨다운 (무한/연달아 파밍 방지).
 * @returns 잎사귀가 실제로 충전되면 true.
 */
export async function watchAdForLeaves(): Promise<boolean> {
  if (isExpoGo) {
    Alert.alert('실제 앱에서만 가능해요', '광고는 빌드된 앱에서만 재생돼요 (Expo Go 미지원) 🐾');
    return false;
  }
  const left = await getAdWatchesLeft();
  if (left <= 0) {
    Alert.alert(
      '오늘은 여기까지예요 🌙',
      `광고로 잎사귀 충전은 하루 ${AD_DAILY_LIMIT}번까지예요.\n내일 자정에 다시 가능해요 🐾`,
    );
    return false;
  }
  const cooldown = await getAdCooldownRemaining();
  if (cooldown > 0) {
    const min = Math.ceil(cooldown / 60000);
    Alert.alert(
      '조금 뒤에 다시 와주세요 ⏳',
      `광고 충전은 30분에 한 번이에요.\n약 ${min}분 뒤에 다시 가능해요 🐾`,
    );
    return false;
  }
  const earned = await showRewardedAd();
  if (!earned) {
    Alert.alert('광고를 불러오지 못했어요', '잠시 후 다시 시도해 주세요 🐾');
    return false;
  }
  await addBonusLeaves(AD_REWARD);
  await recordAdWatch();
  return true;
}

/**
 * AI 호출 직전에 사용. 잎사귀 충분하면 true, 부족하면 Alert 띄우고 false.
 * 호출 측은 false면 즉시 return, true면 API 호출 후 spend(action) 호출.
 */
export async function checkLeafOrAlert(action: LeafAction): Promise<boolean> {
  const ok = await canSpend(action);
  if (ok) return true;

  const cost = LEAF_COST[action];
  Alert.alert(
    '잎사귀가 부족해요 🍃',
    `${ACTION_LABEL[action]}에는 잎사귀 ${cost}개가 필요해요.\n광고를 보거나 내일 다시 와주세요 (매일 자정에 새로 충전돼요) 🐾`,
    [
      {
        text: `📺 광고 보고 +${AD_REWARD}🍃`,
        onPress: async () => {
          const ok = await watchAdForLeaves();
          if (ok) {
            Alert.alert('잎사귀 충전 완료 🍃', `잎사귀 ${AD_REWARD}개가 충전됐어요! 다시 시도해 주세요 🐾`);
          }
        },
      },
      { text: '확인', style: 'cancel' },
    ],
  );
  return false;
}
