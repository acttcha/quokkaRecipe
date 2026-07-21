import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, Easing } from 'react-native';
import { Colors, shadow } from '../constants/colors';
import { LeafIcon } from './LeafIcon';
import { subscribeLeafSpend, LeafSpendEvent } from '../services/leafToast';
import { t } from '../i18n';

const round1 = (n: number) => Math.round(n * 10) / 10;

interface Props {
  /** 'bottom'(기본, 앱 루트) | 'top'(모달 안 — 시트 위 빈 공간에 표시) */
  anchor?: 'bottom' | 'top';
}

/**
 * 잎사귀 사용 토스트. 앱 루트에 한 번, 그리고 AI 동작이 모달 안에서 일어나는 경우
 * 그 모달 안에도 anchor="top" 으로 하나 더 마운트한다. (RN 모달이 루트 토스트를 가리므로)
 */
export function LeafToast({ anchor = 'bottom' }: Props) {
  const [msg, setMsg] = useState<LeafSpendEvent | null>(null);
  const animRef = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = subscribeLeafSpend((e) => {
      setMsg(e);
      animRef.stopAnimation();
      Animated.timing(animRef, {
        toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(animRef, {
          toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true,
        }).start(({ finished }) => { if (finished) setMsg(null); });
      }, 1900);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [animRef]);

  if (!msg) return null;

  const slideFrom = anchor === 'top' ? -14 : 14;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        anchor === 'top' ? styles.top : styles.bottom,
        {
          opacity: animRef,
          transform: [{ translateY: animRef.interpolate({ inputRange: [0, 1], outputRange: [slideFrom, 0] }) }],
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
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  bottom: { bottom: 96 },
  top: { top: 60 },
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
