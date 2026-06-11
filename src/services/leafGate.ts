import { Alert } from 'react-native';
import {
  canSpend, addBonusLeaves, getAdWatchesLeft, getAdCooldownRemaining, recordAdWatch,
  LEAF_COST, LeafAction, AD_REWARD, AD_DAILY_LIMIT,
} from './leaves';
import { showRewardedAd, isExpoGo } from './ads';
import { t } from '../i18n';

/**
 * 보상형 광고를 보여주고, 보상 획득 시 잎사귀를 지급한다.
 * 제한: 하루 AD_DAILY_LIMIT 회 + 광고 간 30분 쿨다운 (무한/연달아 파밍 방지).
 * @returns 잎사귀가 실제로 충전되면 true.
 */
export async function watchAdForLeaves(): Promise<boolean> {
  if (isExpoGo) {
    Alert.alert(t('leafGate.onlyRealAppTitle'), t('leafGate.onlyRealAppMsg'));
    return false;
  }
  const left = await getAdWatchesLeft();
  if (left <= 0) {
    Alert.alert(
      t('leafGate.dailyDoneTitle'),
      t('leafGate.dailyDoneMsg', { limit: AD_DAILY_LIMIT }),
    );
    return false;
  }
  const cooldown = await getAdCooldownRemaining();
  if (cooldown > 0) {
    const min = Math.ceil(cooldown / 60000);
    Alert.alert(
      t('leafGate.cooldownTitle'),
      t('leafGate.cooldownMsg', { min }),
    );
    return false;
  }
  const earned = await showRewardedAd();
  if (!earned) {
    Alert.alert(t('leafGate.adFailTitle'), t('leafGate.adFailMsg'));
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
    t('leafGate.notEnoughTitle'),
    t('leafGate.notEnoughMsg', { action: t(`leaf.action.${action}`), cost }),
    [
      {
        text: t('leafGate.watchAdButton', { reward: AD_REWARD }),
        onPress: async () => {
          const ok = await watchAdForLeaves();
          if (ok) {
            Alert.alert(t('leafGate.chargedTitle'), t('leafGate.chargedMsg', { reward: AD_REWARD }));
          }
        },
      },
      { text: t('leafGate.ok'), style: 'cancel' },
    ],
  );
  return false;
}
