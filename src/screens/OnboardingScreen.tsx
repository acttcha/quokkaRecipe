import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Image, ImageBackground, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, shadow } from '../constants/colors';
import { UserPreferences } from '../types/preferences';
import { savePreferences } from '../services/preferences';
import { t } from '../i18n';

interface Props { onDone: () => void }

const { width } = Dimensions.get('window');

// 다국어 매칭용 exclusive 값 (옵션 value 와 동일한 t() 결과를 사용해야 함)
const ALLERGY_NONE = t('onboarding.allergyNoneValue');
const CUISINE_ANY = t('onboarding.cuisineAnyValue');


// ── 질문 데이터 ──────────────────────────────────────────────────
const STEPS = [
  {
    id: 'allergies', type: 'multi' as const,
    question: t('onboarding.allergiesQuestion'),
    hint: t('onboarding.allergiesHint'),
    exclusive: ALLERGY_NONE,
    options: [
      { label: t('onboarding.allergyNoneLabel'), value: ALLERGY_NONE },
      { label: t('onboarding.allergyNutsLabel'), value: t('onboarding.allergyNutsValue') },
      { label: t('onboarding.allergyDairyLabel'), value: t('onboarding.allergyDairyValue') },
      { label: t('onboarding.allergySeafoodLabel'), value: t('onboarding.allergySeafoodValue') },
      { label: t('onboarding.allergyGlutenLabel'), value: t('onboarding.allergyGlutenValue') },
      { label: t('onboarding.allergyEggLabel'), value: t('onboarding.allergyEggValue') },
      { label: t('onboarding.allergyPorkLabel'), value: t('onboarding.allergyPorkValue') },
      { label: t('onboarding.allergyBeefLabel'), value: t('onboarding.allergyBeefValue') },
    ],
  },
  {
    id: 'spiceLevel', type: 'single' as const,
    question: t('onboarding.spiceQuestion'),
    options: [
      { label: t('onboarding.spiceNoneLabel'), emoji: '🥛', value: t('onboarding.spiceNoneValue') },
      { label: t('onboarding.spiceMildLabel'), emoji: '🌶️', value: t('onboarding.spiceMildValue') },
      { label: t('onboarding.spiceMediumLabel'), emoji: '🌶️🌶️', value: t('onboarding.spiceMediumValue') },
      { label: t('onboarding.spiceHotLabel'), emoji: '🌶️🌶️🌶️', value: t('onboarding.spiceHotValue') },
      { label: t('onboarding.spiceExtremeLabel'), emoji: '🔥', value: t('onboarding.spiceExtremeValue') },
    ],
  },
  {
    id: 'cookingTime', type: 'single' as const,
    question: t('onboarding.timeQuestion'),
    options: [
      { label: t('onboarding.time10Label'), emoji: '⚡', value: t('onboarding.time10Value') },
      { label: t('onboarding.time30Label'), emoji: '🕐', value: t('onboarding.time30Value') },
      { label: t('onboarding.time60Label'), emoji: '🕑', value: t('onboarding.time60Value') },
      { label: t('onboarding.timeRelaxedLabel'), emoji: '🍱', value: t('onboarding.timeRelaxedValue') },
    ],
  },
  {
    id: 'dietType', type: 'single' as const,
    question: t('onboarding.dietQuestion'),
    options: [
      { label: t('onboarding.dietNoneLabel'), emoji: '🍽️', value: t('onboarding.dietNoneValue') },
      { label: t('onboarding.dietVegetarianLabel'), emoji: '🥗', value: t('onboarding.dietVegetarianValue') },
      { label: t('onboarding.dietVeganLabel'), emoji: '🌱', value: t('onboarding.dietVeganValue') },
      { label: t('onboarding.dietLowCarbLabel'), emoji: '💪', value: t('onboarding.dietLowCarbValue') },
      { label: t('onboarding.dietDietingLabel'), emoji: '⚖️', value: t('onboarding.dietDietingValue') },
    ],
  },
  {
    id: 'cookingSkill', type: 'single' as const,
    question: t('onboarding.skillQuestion'),
    options: [
      { label: t('onboarding.skillBeginnerLabel'), emoji: '👶', value: t('onboarding.skillBeginnerValue') },
      { label: t('onboarding.skillHomeLabel'), emoji: '🏠', value: t('onboarding.skillHomeValue') },
      { label: t('onboarding.skillLoverLabel'), emoji: '👨‍🍳', value: t('onboarding.skillLoverValue') },
      { label: t('onboarding.skillMasterLabel'), emoji: '⭐', value: t('onboarding.skillMasterValue') },
    ],
  },
  {
    id: 'servings', type: 'single' as const,
    question: t('onboarding.servingsQuestion'),
    options: [
      { label: t('onboarding.servings1Label'), emoji: '🙂', value: '1' },
      { label: t('onboarding.servings2Label'), emoji: '🍽️', value: '2' },
      { label: t('onboarding.servings3Label'), emoji: '👨‍👩‍👦', value: '3' },
      { label: t('onboarding.servings4Label'), emoji: '👨‍👩‍👧‍👦', value: '4' },
    ],
  },
  {
    id: 'cuisineStyles', type: 'multi' as const,
    question: t('onboarding.cuisineQuestion'),
    hint: t('onboarding.cuisineHint'),
    exclusive: CUISINE_ANY,
    options: [
      { label: t('onboarding.cuisineKoreanLabel'), value: t('onboarding.cuisineKoreanValue') },
      { label: t('onboarding.cuisineWesternLabel'), value: t('onboarding.cuisineWesternValue') },
      { label: t('onboarding.cuisineChineseLabel'), value: t('onboarding.cuisineChineseValue') },
      { label: t('onboarding.cuisineJapaneseLabel'), value: t('onboarding.cuisineJapaneseValue') },
      { label: t('onboarding.cuisineSeaLabel'), value: t('onboarding.cuisineSeaValue') },
      { label: t('onboarding.cuisineMexicanLabel'), value: t('onboarding.cuisineMexicanValue') },
      { label: t('onboarding.cuisineIndianLabel'), value: t('onboarding.cuisineIndianValue') },
      { label: t('onboarding.cuisineAnyLabel'), value: CUISINE_ANY },
    ],
  },
];

export default function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [allergies, setAllergies]         = useState<string[]>([]);
  const [spiceLevel, setSpiceLevel]       = useState('');
  const [cookingTime, setCookingTime]     = useState('');
  const [dietType, setDietType]           = useState('');
  const [cookingSkill, setCookingSkill]   = useState('');
  const [cuisineStyles, setCuisineStyles] = useState<string[]>([]);
  const [servings, setServings]           = useState<number>(2);
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
      allergies:     allergies.filter(a => a !== ALLERGY_NONE),
      spiceLevel,
      cookingTime,
      dietType,
      cookingSkill,
      cuisineStyles: cuisineStyles.filter(c => c !== CUISINE_ANY),
      servings,
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
      case 'servings':     setServings(Number(value)); break;
    }
    setTimeout(goNext, 380);
  };

  const getSingleVal = (id: string) => {
    switch (id) {
      case 'spiceLevel':   return spiceLevel;
      case 'cookingTime':  return cookingTime;
      case 'dietType':     return dietType;
      case 'cookingSkill': return cookingSkill;
      case 'servings':     return String(servings);
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
          <Text style={styles.nextBtnText}>{isLast ? t('onboarding.finishBtn') : t('onboarding.nextBtn')}</Text>
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
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity onPress={step > 0 ? goBack : onDone} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{step > 0 ? '←' : '✕'}</Text>
        </TouchableOpacity>
        <Image source={require('../../assets/main_logo.png')} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity onPress={onDone} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>{t('onboarding.skip')}</Text>
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
  dotDone: { backgroundColor: Colors.accent, width: 8 },
  dotCurrent: { backgroundColor: Colors.primary, width: 22, borderRadius: 4 },

  charArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
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
