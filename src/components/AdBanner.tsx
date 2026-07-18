import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from '../services/ads';
import { isPro } from '../services/subscription';

/**
 * 공용 배너 광고. 콘텐츠 스크롤 "끝자리"에 두는 용도.
 * - Expo Go 에선 BannerAd 가 null 이라 아무것도 렌더링되지 않음.
 * - 개발 중엔 무조건 TestIds.BANNER (자기클릭 = 계정정지 위험).
 *   출시 때 AdMob 콘솔에서 만든 실제 배너 단위 ID 로 교체.
 *   TODO(release): 'ca-app-pub-8578688184080776/<실제 배너 unit ID>'
 */
export function AdBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  if (!BannerAd) return null;
  if (isPro()) return null;   // 쿼카 패스 = 광고 제거
  return (
    <View style={[styles.wrap, style]}>
      <BannerAd unitId={TestIds.BANNER} size={BannerAdSize.BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 16, marginBottom: 8 },
});
