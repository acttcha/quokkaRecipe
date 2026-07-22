import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';

// 인분(정수) 드래그 슬라이더.
//  - 썸은 손가락 따라 "부드럽게" 이동(Animated), 숫자(값)만 정수로 스냅.
//  - 손 떼면 정수 위치로 살짝 settle.
//  - pageX(절대) - 트랙 화면좌표로 계산 + onPanResponderTerminationRequest:false
//    → 모달/스크롤/터치 부모 안에서도 드래그가 안 뺏기고 정확.
const THUMB = 26;
const TRACK_H = 40;

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

export function ServingsSlider({ value, min, max, onChange }: Props) {
  const [w, setW] = useState(0);
  const wRef = useRef(0);
  const xRef = useRef(0);                        // 트랙의 화면상 left
  const trackRef = useRef<View | null>(null);
  const lastRef = useRef(value);
  const draggingRef = useRef(false);
  const thumbX = useRef(new Animated.Value(0)).current;

  const maxLeft = () => Math.max(0, wRef.current - THUMB);
  const leftForValue = (v: number) => (max > min ? (v - min) / (max - min) : 0) * maxLeft();

  function apply(relX: number) {
    const ml = maxLeft();
    if (ml <= 0) return;
    const rawLeft = Math.max(0, Math.min(ml, relX - THUMB / 2));
    thumbX.setValue(rawLeft);                     // 썸은 손가락 따라 부드럽게
    const val = min + Math.round((rawLeft / ml) * (max - min));
    if (val !== lastRef.current) { lastRef.current = val; haptic.light(); }
    onChange(val);
  }

  function settle() {
    Animated.spring(thumbX, {
      toValue: leftForValue(lastRef.current),
      useNativeDriver: false, tension: 180, friction: 18,
    }).start();
  }

  const measure = (cb?: (x: number) => void) =>
    trackRef.current?.measureInWindow((x) => { xRef.current = x; cb?.(x); });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,   // 부모에 반응 안 뺏김
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        draggingRef.current = true;
        const px = e.nativeEvent.pageX;
        measure((x) => apply(px - x));
      },
      onPanResponderMove: (e) => apply(e.nativeEvent.pageX - xRef.current),
      onPanResponderRelease: () => { draggingRef.current = false; settle(); },
      onPanResponderTerminate: () => { draggingRef.current = false; settle(); },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    wRef.current = e.nativeEvent.layout.width;
    setW(e.nativeEvent.layout.width);
    measure();
  };

  // 외부에서 값 바뀌거나 폭 확정 시(드래그 중 아닐 때) 썸 위치 동기화
  useEffect(() => {
    if (!draggingRef.current) thumbX.setValue(leftForValue(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, w]);

  const ready = w > 0;

  return (
    <View ref={trackRef} style={s.track} onLayout={onLayout} {...pan.panHandlers}>
      <View style={s.bar} />
      {ready && <Animated.View style={[s.fill, { width: Animated.add(thumbX, THUMB / 2) }]} />}
      {ready && <Animated.View pointerEvents="none" style={[s.thumb, { transform: [{ translateX: thumbX }] }]} />}
    </View>
  );
}

const s = StyleSheet.create({
  track: { height: TRACK_H, position: 'relative', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, top: TRACK_H / 2 - 3, height: 6, borderRadius: 3, backgroundColor: Colors.lineSoft },
  fill: { position: 'absolute', left: 0, top: TRACK_H / 2 - 3, height: 6, borderRadius: 3, backgroundColor: Colors.forest },
  thumb: {
    position: 'absolute', left: 0, top: (TRACK_H - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: Colors.forest, borderWidth: 3, borderColor: '#fff', ...shadow.sm,
  },
});
