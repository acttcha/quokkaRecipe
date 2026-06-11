import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Image, ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, shadow } from '../constants/colors';
import { addIngredients, markFridgeSetupDone } from '../services/fridge';
import { t } from '../i18n';

interface Props { onDone: () => void }

const { width } = Dimensions.get('window');
const PANEL_HEIGHT = 360;

const FRIDGE_ALL = [
  '소금', '설탕', '간장', '된장', '고추장',
  '식용유', '참기름', '들기름', '올리브오일',
  '후추', '고춧가루', '참깨',
  '다진마늘', '식초', '맛술', '굴소스',
];

const FRIDGE_DEFAULTS = [
  '소금', '설탕', '간장', '된장',
  '식용유', '참기름', '후추', '고춧가루', '다진마늘',
];

export default function FridgeSetupScreen({ onDone }: Props) {
  const [selected, setSelected] = useState<string[]>([...FRIDGE_DEFAULTS]);
  const insets = useSafeAreaInsets();

  const toggle = (item: string) => {
    setSelected(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const finish = async () => {
    if (selected.length > 0) await addIngredients(selected.map(i => t(`fridgeSetup.ing.${i}`)));
    await markFridgeSetupDone();
    onDone();
  };

  const skip = async () => {
    await markFridgeSetupDone();
    onDone();
  };

  return (
    <ImageBackground
      source={require('../../assets/background.png')}
      style={styles.root}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── 상단 바 ── */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity onPress={skip} style={styles.backBtn}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <Image source={require('../../assets/main_logo.png')} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity onPress={skip} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>{t('fridgeSetup.skip')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── 진행 점 (단일) ── */}
      <View style={styles.dotsRow}>
        <View style={[styles.dot, styles.dotCurrent]} />
      </View>

      {/* ── 쿼카 + 말풍선 ── */}
      <View style={styles.charArea}>
        <View style={styles.bubbleOuter}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{t('fridgeSetup.bubble')}</Text>
          </View>
          <View style={styles.bubbleTail} />
        </View>
        <Image
          source={require('../../assets/quokka_question.png')}
          style={styles.quokka}
          resizeMode="contain"
        />
      </View>

      {/* ── 옵션 패널 ── */}
      <View style={styles.panel}>
        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={styles.panelContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>
            {t('fridgeSetup.hint')}
          </Text>
          <View style={styles.chipWrap}>
            {FRIDGE_ALL.map(item => {
              const active = selected.includes(item);
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggle(item)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {active ? '✓ ' : ''}{t(`fridgeSetup.ing.${item}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <View style={styles.btnBar}>
          <TouchableOpacity style={styles.nextBtn} onPress={finish} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>{t('fridgeSetup.done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 4,
    // paddingTop은 insets.top 으로 동적 설정
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 17, fontWeight: '700', color: Colors.primary },
  logo: { flex: 1, height: 58, marginHorizontal: 8 },
  skipBtn: { width: 60, alignItems: 'flex-end', paddingVertical: 8 },
  skipBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textMid },

  dotsRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, paddingVertical: 10,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  dotCurrent: { backgroundColor: Colors.primary, width: 22, borderRadius: 4 },

  charArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bubbleOuter: { alignItems: 'center', marginBottom: -6 },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 16,
    maxWidth: width * 0.72,
    ...shadow.md,
  },
  bubbleText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
    textAlign: 'center',
    lineHeight: 26,
  },
  bubbleTail: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderLeftColor: 'transparent',
    borderRightWidth: 10, borderRightColor: 'transparent',
    borderTopWidth: 12, borderTopColor: '#FFFFFF',
  },
  quokka: {
    width: width * 0.90,
    flex: 1,
    maxHeight: 340,
    minHeight: 160,
  },

  panel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: PANEL_HEIGHT,
    ...shadow.md,
  },
  panelScroll: { flex: 1 },
  panelContent: {
    padding: 24,
    paddingBottom: 12,
  },
  btnBar: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  hint: { fontSize: 12, color: Colors.textMuted, marginBottom: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22,
    backgroundColor: '#F7F5F2',
    borderWidth: 2, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  chipText: { fontSize: 14, fontWeight: '700', color: Colors.textMid },
  chipTextActive: { color: Colors.primary },

  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.sm,
  },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
});
