import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Animated, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, shadow } from '../constants/colors';
import { isPro } from '../services/subscription';
import { PERSONAS } from '../services/personas';
import { NavProps } from '../types';
import { haptic } from '../services/haptics';
import { t } from '../i18n';

// 쿼카 셰프 선택 바텀시트. 이용약관 시트(DraggableSheet)와 동일하게
//  핸들 영역을 잡고 아래로 당기면 오버레이가 함께 흐려지며 닫힘.
export function PersonaPickerSheet({ currentId, onSelect, onClose, navigate }: {
  currentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  navigate: NavProps['navigate'];
}) {
  const insets = useSafeAreaInsets();
  const pro = isPro();
  const translateY = useRef(new Animated.Value(700)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 12 }),
      Animated.timing(overlayOpacity, { toValue: 0.45, useNativeDriver: true, duration: 260 }),
    ]).start();
  }, [translateY, overlayOpacity]);

  // 놓을 때 손가락 속도(velocity)를 그대로 이어받아 흘려보냄 → 뚝 끊기지 않고 부드럽게 닫힘
  const dismiss = (cb?: () => void, velocity = 1.2) => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 900, velocity, useNativeDriver: true,
        stiffness: 220, damping: 34, mass: 1, overshootClamping: true,
      }),
      Animated.timing(overlayOpacity, { toValue: 0, useNativeDriver: true, duration: 200 }),
    ]).start(() => (cb ?? onClose)());
  };

  const settle = (velocity: number) => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, velocity, useNativeDriver: true, stiffness: 260, damping: 26, mass: 1 }),
      Animated.timing(overlayOpacity, { toValue: 0.45, useNativeDriver: true, duration: 160 }),
    ]).start();
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => gs.dy > 3,
    onPanResponderMove: (_, gs) => {
      // 위로 당기면 고무줄처럼 아주 조금만 따라오게(저항), 아래로는 1:1
      const d = gs.dy >= 0 ? gs.dy : gs.dy * 0.18;
      translateY.setValue(d);
      overlayOpacity.setValue(Math.max(0, 0.45 * (1 - Math.max(0, d) / 400)));
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 110 || gs.vy > 0.6) dismiss(undefined, gs.vy > 0 ? gs.vy : 1.2);
      else settle(gs.vy);
    },
  })).current;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'black', opacity: overlayOpacity }]} />
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => dismiss()} />

      <View style={s.overlay} pointerEvents="box-none">
        <Animated.View style={[s.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + 16 }]}>
          {/* 드래그 핸들 영역 — 잡고 아래로 당기면 닫힘 */}
          <View style={s.dragZone} {...pan.panHandlers}>
            <View style={s.handle} />
            <Text style={s.title}>{t('persona.pickTitle')}</Text>
            <Text style={s.sub}>{t('persona.pickSub')}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {!pro && (
              <TouchableOpacity style={s.promo} activeOpacity={0.85} onPress={() => { onClose(); navigate({ name: 'LeafShop' }); }}>
                <Text style={s.promoText}>{t('persona.proPromo')}</Text>
                <Text style={s.promoArrow}>›</Text>
              </TouchableOpacity>
            )}
            <View style={s.grid}>
              {PERSONAS.map(p => {
                const locked = !p.free && !pro;
                const selected = p.id === currentId;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.card, selected && s.cardSel]}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (locked) { haptic.light(); onClose(); navigate({ name: 'LeafShop' }); return; }  // 즉시 이동 (애니메이션 대기 X)
                      haptic.light();
                      onSelect(p.id);   // 즉시 반영 + 닫기 (애니메이션 대기 없이 빠르게)
                    }}
                  >
                    <View style={s.imgWrap}>
                      <Image source={p.image} style={[s.img, locked && s.imgLocked]} resizeMode="contain" />
                      {locked && <View style={s.lockOverlay}><Text style={s.lockText}>🔒</Text></View>}
                      {selected && <View style={s.selBadge}><Text style={s.selText}>✓</Text></View>}
                    </View>
                    <Text style={[s.name, selected && s.nameSel]} numberOfLines={1}>{t(`persona.${p.id}.name`)}</Text>
                    <Text style={s.desc} numberOfLines={2}>{t(`persona.${p.id}.desc`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10, maxHeight: '85%',
  },
  dragZone: { alignItems: 'center', paddingBottom: 12 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: Colors.line, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900', color: Colors.ink },
  sub: { fontSize: 13, color: Colors.inkSoft, marginTop: 4 },

  promo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.orangeSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
  },
  promoText: { flex: 1, fontSize: 13, fontWeight: '800', color: Colors.orangeDeep },
  promoArrow: { fontSize: 18, fontWeight: '900', color: Colors.orangeDeep },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '31%', backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.lineSoft,
    paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', marginBottom: 12, ...shadow.sm,
  },
  cardSel: { borderColor: Colors.forest, backgroundColor: Colors.forestSoft },
  imgWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  img: { width: 72, height: 72 },
  imgLocked: { opacity: 0.4 },
  lockOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  lockText: { fontSize: 22 },
  selBadge: {
    position: 'absolute', top: -2, right: 2, width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.forest, alignItems: 'center', justifyContent: 'center',
  },
  selText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  name: { fontSize: 12, fontWeight: '800', color: Colors.ink, textAlign: 'center' },
  nameSel: { color: Colors.forestDeep },
  desc: { fontSize: 10, color: Colors.inkMute, textAlign: 'center', marginTop: 2, lineHeight: 13 },
});
