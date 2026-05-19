import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Image, ImageBackground, Animated,
} from 'react-native';
import { Colors, shadow } from '../constants/colors';
import { UserPreferences } from '../types/preferences';
import { savePreferences } from '../services/preferences';

interface Props { onDone: () => void }

const { width } = Dimensions.get('window');

// ── 질문 데이터 ──────────────────────────────────────────────────
const STEPS = [
  {
    id: 'allergies', type: 'multi' as const,
    question: '혹시 못 드시는 재료가\n있으신가요?',
    hint: '여러 개 선택 가능해요',
    exclusive: '없음',
    options: [
      { label: '없어요', value: '없음' },
      { label: '견과류', value: '견과류' },
      { label: '유제품', value: '유제품' },
      { label: '해산물', value: '해산물' },
      { label: '글루텐', value: '글루텐' },
      { label: '계란', value: '계란' },
      { label: '돼지고기', value: '돼지고기' },
      { label: '소고기', value: '소고기' },
    ],
  },
  {
    id: 'spiceLevel', type: 'single' as const,
    question: '매운 음식은 얼마나\n잘 드세요?',
    options: [
      { label: '전혀 못 먹어요', emoji: '🥛', value: '매운 음식 전혀 못 먹음' },
      { label: '조금만요', emoji: '🌶️', value: '약간 매운 정도만 가능' },
      { label: '보통이요', emoji: '🌶️🌶️', value: '보통 매운 음식 가능' },
      { label: '잘 먹어요', emoji: '🌶️🌶️🌶️', value: '매운 음식 잘 먹음' },
      { label: '마라도 OK!', emoji: '🔥', value: '아주 매운 음식도 좋아함' },
    ],
  },
  {
    id: 'cookingTime', type: 'single' as const,
    question: '요리에 얼마나 시간을\n쓸 수 있어요?',
    options: [
      { label: '10분 이내', emoji: '⚡', value: '10분 이내 초간단 요리' },
      { label: '30분 이내', emoji: '🕐', value: '30분 이내' },
      { label: '1시간 이내', emoji: '🕑', value: '1시간 이내' },
      { label: '시간 여유 있어요', emoji: '🍱', value: '시간 여유 있어 정성 요리 가능' },
    ],
  },
  {
    id: 'dietType', type: 'single' as const,
    question: '식단 제한이\n있으신가요?',
    options: [
      { label: '없어요', emoji: '🍽️', value: '일반 (제한 없음)' },
      { label: '채식', emoji: '🥗', value: '채식 (육류 제외)' },
      { label: '비건', emoji: '🌱', value: '비건 (동물성 식품 모두 제외)' },
      { label: '저탄수화물', emoji: '💪', value: '저탄수화물/키토' },
      { label: '다이어트 중', emoji: '⚖️', value: '저칼로리 다이어트식' },
    ],
  },
  {
    id: 'cookingSkill', type: 'single' as const,
    question: '요리 실력이\n어느 정도예요?',
    options: [
      { label: '요린이예요', emoji: '👶', value: '초보 (쉬운 레시피만)' },
      { label: '가정 요리 가능', emoji: '🏠', value: '중급 (일반 가정 요리)' },
      { label: '요리 좋아해요', emoji: '👨‍🍳', value: '중상급 (다양한 요리 도전 가능)' },
      { label: '집밥 고수!', emoji: '⭐', value: '고급 (복잡한 레시피도 가능)' },
    ],
  },
  {
    id: 'cuisineStyles', type: 'multi' as const,
    question: '좋아하는 음식 스타일이\n있나요?',
    hint: '여러 개 선택 가능 · 건너뛸 수 있어요',
    exclusive: '상관없음',
    options: [
      { label: '한식', value: '한식' },
      { label: '양식', value: '양식' },
      { label: '중식', value: '중식' },
      { label: '일식', value: '일식' },
      { label: '동남아', value: '동남아' },
      { label: '멕시코', value: '멕시코' },
      { label: '인도', value: '인도' },
      { label: '상관없어요', value: '상관없음' },
    ],
  },
];

export default function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [allergies, setAllergies]         = useState<string[]>([]);
  const [spiceLevel, setSpiceLevel]       = useState('');
  const [cookingTime, setCookingTime]     = useState('');
  const [dietType, setDietType]           = useState('');
  const [cookingSkill, setCookingSkill]   = useState('');
  const [cuisineStyles, setCuisineStyles] = useState<string[]>([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // ── 이동 헬퍼 ─────────────────────────────────────────────────
  const transition = (fn: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      fn();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const goNext = () => {
    if (isLast) {
      finish();
    } else {
      transition(() => setStep(s => s + 1));
    }
  };

  const goBack = () => {
    if (step === 0) return;
    transition(() => setStep(s => s - 1));
  };

  const finish = async () => {
    const prefs: UserPreferences = {
      allergies:     allergies.filter(a => a !== '없음'),
      spiceLevel,
      cookingTime,
      dietType,
      cookingSkill,
      cuisineStyles: cuisineStyles.filter(c => c !== '상관없음'),
    };
    await savePreferences(prefs);
    onDone();
  };

  // ── single-select 처리 ─────────────────────────────────────────
  const handleSingle = (id: string, value: string) => {
    switch (id) {
      case 'spiceLevel':   setSpiceLevel(value);   break;
      case 'cookingTime':  setCookingTime(value);   break;
      case 'dietType':     setDietType(value);      break;
      case 'cookingSkill': setCookingSkill(value);  break;
    }
    setTimeout(goNext, 380);
  };

  const getSingleVal = (id: string) => {
    switch (id) {
      case 'spiceLevel':   return spiceLevel;
      case 'cookingTime':  return cookingTime;
      case 'dietType':     return dietType;
      case 'cookingSkill': return cookingSkill;
      default: return '';
    }
  };

  // ── multi-select 처리 ──────────────────────────────────────────
  const toggleMulti = (id: string, val: string) => {
    const exclusive = (current as any).exclusive;
    const getSet = id === 'allergies' ? [allergies, setAllergies] as const
                                      : [cuisineStyles, setCuisineStyles] as const;
    const [arr, setArr] = getSet;

    if (exclusive && val === exclusive) { setArr([exclusive]); return; }
    const filtered = arr.filter(a => a !== exclusive);
    setArr(filtered.includes(val) ? filtered.filter(a => a !== val) : [...filtered, val]);
  };

  const getMultiVal = (id: string) =>
    id === 'allergies' ? allergies : cuisineStyles;

  // ── 옵션 렌더링 ────────────────────────────────────────────────
  const renderOptions = () => {
    if (current.type === 'single') {
      const sel = getSingleVal(current.id);
      return (
        <View style={styles.optionList}>
          {(current.options as any[]).map((opt) => {
            const active = sel === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => handleSingle(current.id, opt.value)}
                activeOpacity={0.75}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // multi
    const sel = getMultiVal(current.id);
    return (
      <>
        {'hint' in current && (
          <Text style={styles.multiHint}>{(current as any).hint}</Text>
        )}
        <View style={styles.chipWrap}>
          {(current.options as any[]).map((opt) => {
            const active = sel.includes(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleMulti(current.id, opt.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>{isLast ? '완료! 레시피 보러가기 🎉' : '다음으로 →'}</Text>
        </TouchableOpacity>
      </>
    );
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
        <TouchableOpacity onPress={step > 0 ? goBack : onDone} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{step > 0 ? '←' : '✕'}</Text>
        </TouchableOpacity>
        <Image source={require('../../assets/main_logo.png')} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity onPress={onDone} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>건너뛰기</Text>
        </TouchableOpacity>
      </View>

      {/* ── 진행 점 ── */}
      <View style={styles.dotsRow}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i < step && styles.dotDone, i === step && styles.dotCurrent]} />
        ))}
      </View>

      {/* ── 쿼카 + 말풍선 ── */}
      <Animated.View style={[styles.charArea, { opacity: fadeAnim }]}>
        {/* 말풍선 */}
        <View style={styles.bubbleOuter}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{current.question}</Text>
          </View>
          <View style={styles.bubbleTail} />
        </View>
        {/* 쿼카 */}
        <Image
          source={require('../../assets/quokka_question.png')}
          style={styles.quokka}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── 옵션 패널 ── */}
      <Animated.View style={[styles.panel, { opacity: fadeAnim }]}>
        <ScrollView
          contentContainerStyle={styles.panelContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderOptions()}
        </ScrollView>
      </Animated.View>
    </ImageBackground>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
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
  dotDone: { backgroundColor: Colors.accent, width: 8 },
  dotCurrent: { backgroundColor: Colors.primary, width: 22, borderRadius: 4 },

  charArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
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
    maxHeight: 380,
    ...shadow.md,
  },
  panelContent: {
    padding: 24,
    paddingBottom: 36,
  },

  // single-select
  optionList: { gap: 10 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F5F2',
    borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 2, borderColor: 'transparent',
  },
  optionRowActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  optionEmoji: { fontSize: 22, marginRight: 12, width: 30, textAlign: 'center' },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textMid },
  optionLabelActive: { color: Colors.primary },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.accent },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.accent },

  // multi-select
  multiHint: { fontSize: 12, color: Colors.textMuted, marginBottom: 14 },
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
