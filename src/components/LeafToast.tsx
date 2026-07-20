import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, Easing } from 'react-native';
import { Colors, shadow } from '../constants/colors';
import { LeafIcon } from './LeafIcon';
import { onLeafSpend, LeafSpendEvent } from '../services/leafToast';
import { t } from '../i18n';

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 잎사귀 사용 토스트. 앱 루트에 한 번만 마운트.
 * AI 동작으로 잎사귀가 차감되면 아래서 살짝 떠오르며 잠깐 표시된다.
 */
export function LeafToast() {
  const [msg, setMsg] = useState<LeafSpendEvent | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onLeafSpend((e) => {
      setMsg(e);
      anim.stopAnimation();
      Animated.timing(anim, {
        toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(anim, {
          toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true,
        }).start(({ finished }) => { if (finished) setMsg(null); });
      }, 1900);
    });
    return () => {
      onLeafSpend(null);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [anim]);

  if (!msg) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      <View style={styles.pill}>
        <LeafIcon size={16} />
        <Text style={styles.used}>{t('leafToast.used', { count: round1(msg.spent) })}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.left}>{t('leafToast.left', { count: round1(msg.total) })}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 96,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.line,
    ...shadow.md,
  },
  used: { fontSize: 13.5, fontWeight: '800', color: Colors.forestDeep },
  dot:  { fontSize: 13, color: Colors.inkMute },
  left: { fontSize: 13, fontWeight: '600', color: Colors.inkSoft },
});
