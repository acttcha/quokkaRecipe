import { Alert } from 'react-native';
import { canUse, AD_REWARD, FREE_DAILY_LIMIT, UsageType } from './usage';

const TYPE_LABEL: Record<UsageType, string> = {
  recipe: '레시피 추천',
  scan: '재료 스캔',
  qa: '쿼카 Q&A',
};

/**
 * API 호출 직전에 사용. 한도 남았으면 true, 없으면 Alert 띄우고 false 반환.
 * 호출 측은 false면 즉시 return, true면 API 호출 후 recordUsage()를 호출해야 함.
 */
export async function checkUsageOrAlert(type: UsageType): Promise<boolean> {
  const ok = await canUse(type);
  if (ok) return true;

  Alert.alert(
    '오늘 한도를 모두 사용했어요',
    `${TYPE_LABEL[type]} 일일 한도(${FREE_DAILY_LIMIT[type]}회)가 끝났어요.\n광고를 보거나 내일 다시 시도해주세요 🐾`,
    [
      {
        text: `📺 광고 보고 +${AD_REWARD[type]}회`,
        onPress: () => {
          // TODO: AdMob 통합 시 광고 표시 → 완료 콜백에서 addBonus(type, AD_REWARD[type])
          Alert.alert('곧 지원돼요', '광고 기반 충전 기능은 준비 중이에요 🐾');
        },
      },
      { text: '확인', style: 'cancel' },
    ],
  );
  return false;
}
