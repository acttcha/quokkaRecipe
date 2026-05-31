import { Alert } from 'react-native';
import { canSpend, LEAF_COST, ACTION_LABEL, LeafAction, AD_REWARD } from './leaves';

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
        onPress: () => {
          // TODO: AdMob 보상형 광고 통합 시 → addBonusLeaves(AD_REWARD)
          Alert.alert('곧 지원돼요', '광고 기반 충전은 준비 중이에요 🐾');
        },
      },
      { text: '확인', style: 'cancel' },
    ],
  );
  return false;
}
