import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Image, ImageBackground,
} from 'react-native';
import { Colors, shadow } from '../constants/colors';
import { addIngredients, markFridgeSetupDone } from '../services/fridge';

interface Props { onDone: () => void }

const { width } = Dimensions.get('window');

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

  const toggle = (item: string) => {
    setSelected(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const finish = async () => {
    if (selected.length > 0) await addIngredients(selected);
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
      <View style={styles.topBar}>
        <TouchableOpacity onPress={skip} style={styles.backBtn}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <Image source={require('../../assets/main_logo.png')} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity onPress={skip} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>건너뛰기</Text>
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
            <Text style={styles.bubbleText}>{'냉장고에 있는\n기본 재료를 골라주세요!'}</Text>
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
            여러 개 선택 가능 · 나중에 냉장고에서 수정 가능해요
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
                    {active ? '✓ ' : ''}{item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <View style={styles.btnBar}>
          <TouchableOpacity style={styles.nextBtn} onPress={finish} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>완료</Text>
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
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 4,
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
    height: 310,
  },

  panel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: 380,
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
