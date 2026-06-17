import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import Svg, { Path, Rect } from 'react-native-svg';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';
import { t, useLang } from '../i18n';

type Props = NavProps & { recipeName: string; steps: string[] };

// 단계 텍스트에서 조리 시간을 추출해 초로 반환. 못 찾으면 null.
// "5분", "30초", "1시간 30분", "5~7분", "for 10 minutes", "30 sec" 등 대응.
export function parseStepDuration(text: string): number | null {
  let total = 0;
  let found = false;
  const h = text.match(/(\d+)\s*(?:시간|hours?|hrs?)/i);
  if (h) { total += parseInt(h[1], 10) * 3600; found = true; }
  // 범위(5~7분)면 더 긴 쪽을 채택 (덜 익히는 것보다 안전)
  const m = text.match(/(\d+)\s*(?:[~\-–]\s*(\d+))?\s*(?:분|minutes?|mins?)/i);
  if (m) { total += parseInt(m[2] || m[1], 10) * 60; found = true; }
  const s = text.match(/(\d+)\s*(?:[~\-–]\s*(\d+))?\s*(?:초|seconds?|secs?)/i);
  if (s) { total += parseInt(s[2] || s[1], 10); found = true; }
  return found && total > 0 ? total : null;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const TIMER_MIN = 10;
const TIMER_MAX = 99 * 60;

// ── 아이콘 ──
function IconSound({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z" fill={color} />
      <Path d="M16 8.8a4 4 0 0 1 0 6.4" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M18.4 6.2a7.5 7.5 0 0 1 0 11.6" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
function IconStop({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={6} y={6} width={12} height={12} rx={3} fill={color} />
    </Svg>
  );
}
function IconMinus({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 12h12" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}
function IconPlus({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 6v12M6 12h12" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

export default function CookModeScreen({ goBack, recipeName, steps }: Props) {
  useKeepAwake();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const ttsLang = lang === 'en' ? 'en-US' : 'ko-KR';

  const [idx, setIdx]           = useState(0);
  const [finished, setFinished] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [auto, setAuto]         = useState(false);

  // 타이머: setSeconds(설정값) / remaining(진행값, null이면 미시작)
  const parsed = parseStepDuration(steps[idx] ?? '');
  const [timerOpen, setTimerOpen] = useState(parsed != null);
  const [setSeconds, setSetSeconds] = useState(parsed ?? 60);
  const [remaining, setRemaining]   = useState<number | null>(null);
  const [running, setRunning]       = useState(false);
  const [timerDone, setTimerDone]   = useState(false);

  const speak = (text: string) => {
    Speech.stop();
    setSpeaking(true);
    Speech.speak(text, {
      language: ttsLang,
      onDone:    () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError:   () => setSpeaking(false),
    });
  };

  // 단계 전환 시: 음성 중지 + 타이머 초기화 + (자동읽기면) 새 단계 읽기
  useEffect(() => {
    Speech.stop();
    setSpeaking(false);
    const d = parseStepDuration(steps[idx] ?? '');
    setTimerOpen(d != null);
    setSetSeconds(d ?? 60);
    setRemaining(null);
    setRunning(false);
    setTimerDone(false);
    if (auto && steps[idx]) speak(steps[idx]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // 화면 벗어날 때 음성 정리
  useEffect(() => () => { Speech.stop(); }, []);

  // 타이머 카운트다운
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining(r => {
        if (r === null) return r;
        if (r <= 1) {
          clearInterval(id);
          setRunning(false);
          setTimerDone(true);
          haptic.success();
          Speech.speak(t('cookMode.timerDoneVoice'), { language: ttsLang });
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const toggleSpeak = () => {
    if (speaking) { Speech.stop(); setSpeaking(false); }
    else if (steps[idx]) speak(steps[idx]);
  };

  const toggleAuto = () => {
    haptic.light();
    const next = !auto;
    setAuto(next);
    if (next && steps[idx]) speak(steps[idx]);
    else { Speech.stop(); setSpeaking(false); }
  };

  const adjust = (delta: number) => {
    haptic.light();
    setSetSeconds(s => Math.max(TIMER_MIN, Math.min(TIMER_MAX, s + delta)));
  };
  const startTimer = () => {
    haptic.medium();
    setRemaining(setSeconds);
    setTimerDone(false);
    setRunning(true);
  };
  const togglePause = () => {
    if (remaining == null || remaining <= 0) return;
    haptic.light();
    setRunning(r => !r);
  };
  const resetTimer = () => {
    haptic.light();
    setRunning(false);
    setTimerDone(false);
    setRemaining(null);
  };

  const goPrev = () => { if (idx > 0) { haptic.light(); setIdx(idx - 1); } };
  const goNext = () => {
    haptic.light();
    if (idx < steps.length - 1) setIdx(idx + 1);
    else { Speech.stop(); haptic.success(); setFinished(true); }
  };

  const confirmExit = () => {
    Alert.alert(t('cookMode.exitTitle'), t('cookMode.exitMsg'), [
      { text: t('cookMode.cancel'), style: 'cancel' },
      { text: t('cookMode.exitConfirm'), style: 'destructive', onPress: () => { Speech.stop(); goBack(); } },
    ]);
  };

  // ── 완료 화면 ──
  if (finished) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <Image source={require('../../assets/quokka.png')} style={styles.doneQuokka} resizeMode="contain" />
        <Text style={styles.doneTitle}>{t('cookMode.doneTitle')}</Text>
        <Text style={styles.doneSub}>{t('cookMode.doneSub')}</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => { haptic.light(); goBack(); }} activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>{t('cookMode.doneClose')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLast = idx === steps.length - 1;
  const progress = steps.length > 0 ? (idx + 1) / steps.length : 0;
  const inSetup = remaining === null && !timerDone;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── 상단 바 ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={confirmExit} style={styles.exitBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.exitText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.recipeName} numberOfLines={1}>{recipeName}</Text>
        <TouchableOpacity onPress={toggleAuto} style={[styles.autoBtn, auto && styles.autoBtnOn]} activeOpacity={0.8}>
          <IconSound color={auto ? '#fff' : Colors.inkSoft} />
          <Text style={[styles.autoText, auto && styles.autoTextOn]}>{t('cookMode.auto')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── 진행 바 ── */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.stepOf}>{t('cookMode.stepOf', { current: idx + 1, total: steps.length })}</Text>

      {/* ── 단계 본문 ── */}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.quokkaWrap}>
          <Image source={require('../../assets/quokka_2.png')} style={styles.stepQuokka} resizeMode="contain" />
          <View style={styles.stepNumBadge}>
            <Text style={styles.stepNumText}>{idx + 1}</Text>
          </View>
        </View>

        <Text style={styles.stepText}>{steps[idx]}</Text>

        {/* 읽어주기 */}
        <TouchableOpacity onPress={toggleSpeak} style={[styles.speakBtn, speaking && styles.speakBtnOn]} activeOpacity={0.85}>
          {speaking ? <IconStop color={Colors.forestDeep} /> : <IconSound color={Colors.inkSoft} />}
          <Text style={[styles.speakLabel, speaking && styles.speakLabelOn]}>
            {speaking ? t('cookMode.stop') : t('cookMode.readAloud')}
          </Text>
        </TouchableOpacity>

        {/* ── 타이머 ── */}
        {!timerOpen && (
          <TouchableOpacity style={styles.addTimerBtn} onPress={() => { haptic.light(); setTimerOpen(true); }} activeOpacity={0.8}>
            <Text style={styles.addTimerText}>⏱  {t('cookMode.addTimer')}</Text>
          </TouchableOpacity>
        )}

        {timerOpen && inSetup && (
          <View style={styles.timerCard}>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => adjust(-30)} activeOpacity={0.7}>
                <IconMinus color={Colors.orangeDeep} />
              </TouchableOpacity>
              <Text style={styles.timerCount}>{fmt(setSeconds)}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => adjust(30)} activeOpacity={0.7}>
                <IconPlus color={Colors.orangeDeep} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.timerStartBtn} onPress={startTimer} activeOpacity={0.85}>
              <Text style={styles.timerStartText}>{t('cookMode.timerStartShort')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {timerOpen && !inSetup && (
          <View style={[styles.timerCard, timerDone && styles.timerCardDone]}>
            {timerDone ? (
              <Text style={styles.timerDoneText}>{t('cookMode.timerDoneTitle')}</Text>
            ) : (
              <Text style={styles.timerCountLive}>{fmt(remaining ?? 0)}</Text>
            )}
            <View style={styles.timerCtrlRow}>
              {!timerDone && (
                <TouchableOpacity style={styles.timerCtrlBtn} onPress={togglePause} activeOpacity={0.8}>
                  <Text style={styles.timerCtrlText}>{running ? `⏸ ${t('cookMode.pause')}` : `▶ ${t('cookMode.resume')}`}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.timerCtrlBtn} onPress={resetTimer} activeOpacity={0.8}>
                <Text style={styles.timerCtrlText}>↺ {t('cookMode.reset')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── 하단 네비 ── */}
      <View style={[styles.navBar, { paddingBottom: 12 + Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.prevBtn, idx === 0 && styles.prevBtnDisabled]}
          onPress={goPrev}
          disabled={idx === 0}
          activeOpacity={0.85}
        >
          <Text style={[styles.prevText, idx === 0 && styles.prevTextDisabled]}>◀ {t('cookMode.prev')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nextBtn, isLast && styles.nextBtnFinish]} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>{isLast ? `${t('cookMode.finishBtn')} ✓` : `${t('cookMode.next')} ▶`}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, gap: 10,
  },
  exitBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', ...shadow.sm,
  },
  exitText: { fontSize: 18, fontWeight: '700', color: Colors.inkSoft },
  recipeName: { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.ink, textAlign: 'center' },
  autoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.line,
  },
  autoBtnOn: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  autoText: { fontSize: 12, fontWeight: '800', color: Colors.inkSoft },
  autoTextOn: { color: '#fff' },

  progressTrack: {
    height: 6, backgroundColor: Colors.creamDark, borderRadius: 3,
    marginHorizontal: 20, marginTop: 6, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: Colors.forest, borderRadius: 3 },
  stepOf: {
    textAlign: 'center', marginTop: 10, fontSize: 13, fontWeight: '800',
    color: Colors.forestDeep, letterSpacing: 0.3,
  },

  body: { flex: 1 },
  bodyContent: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 24 },

  quokkaWrap: { width: 132, height: 116, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14 },
  stepQuokka: { width: 132, height: 116 },
  stepNumBadge: {
    position: 'absolute', right: 2, top: 2,
    minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 6,
    backgroundColor: Colors.forest, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.cream, ...shadow.sm,
  },
  stepNumText: { fontSize: 15, fontWeight: '900', color: '#fff' },

  stepText: {
    fontSize: 26, lineHeight: 40, fontWeight: '700', color: Colors.ink,
    textAlign: 'center', letterSpacing: -0.3,
  },

  speakBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 24, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 26,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.line, ...shadow.sm,
  },
  speakBtnOn: { backgroundColor: Colors.forestSoft, borderColor: Colors.forest },
  speakLabel: { fontSize: 14, fontWeight: '800', color: Colors.inkSoft },
  speakLabelOn: { color: Colors.forestDeep },

  addTimerBtn: {
    marginTop: 22, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14,
    backgroundColor: Colors.creamSoft, borderWidth: 1.5, borderColor: Colors.line, borderStyle: 'dashed',
  },
  addTimerText: { fontSize: 14, fontWeight: '800', color: Colors.inkSoft },

  timerCard: {
    marginTop: 24, backgroundColor: Colors.white, borderRadius: 20,
    paddingVertical: 18, paddingHorizontal: 22, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.orange, ...shadow.sm, minWidth: 240,
  },
  timerCardDone: { borderColor: Colors.forest, backgroundColor: Colors.forestSoft },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepperBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.orangeSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  timerCount: { fontSize: 46, fontWeight: '900', color: Colors.orangeDeep, letterSpacing: 1, fontVariant: ['tabular-nums'], minWidth: 116, textAlign: 'center' },
  timerCountLive: { fontSize: 52, fontWeight: '900', color: Colors.orangeDeep, letterSpacing: 1, fontVariant: ['tabular-nums'] },
  timerStartBtn: {
    marginTop: 16, backgroundColor: Colors.orangeDeep, borderRadius: 14,
    paddingHorizontal: 44, paddingVertical: 13, ...shadow.sm,
  },
  timerStartText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  timerDoneText: { fontSize: 24, fontWeight: '900', color: Colors.forestDeep },
  timerCtrlRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  timerCtrlBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12,
    backgroundColor: Colors.creamSoft, borderWidth: 1, borderColor: Colors.line,
  },
  timerCtrlText: { fontSize: 13, fontWeight: '800', color: Colors.inkSoft },

  navBar: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.cream, borderTopWidth: 1, borderTopColor: Colors.line,
  },
  prevBtn: {
    paddingHorizontal: 22, paddingVertical: 16, borderRadius: 16,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  prevBtnDisabled: { opacity: 0.4 },
  prevText: { fontSize: 15, fontWeight: '800', color: Colors.inkSoft },
  prevTextDisabled: { color: Colors.inkMute },
  nextBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: Colors.forest,
    alignItems: 'center', justifyContent: 'center', ...shadow.sm,
  },
  nextBtnFinish: { backgroundColor: Colors.orangeDeep },
  nextText: { fontSize: 16, fontWeight: '900', color: '#fff' },

  doneQuokka: { width: 200, height: 200, marginBottom: 8 },
  doneTitle: { fontSize: 30, fontWeight: '900', color: Colors.ink, textAlign: 'center', marginBottom: 12 },
  doneSub: { fontSize: 16, fontWeight: '600', color: Colors.inkSoft, textAlign: 'center', marginBottom: 36 },
  doneBtn: {
    backgroundColor: Colors.forest, borderRadius: 16, paddingHorizontal: 40, paddingVertical: 15, ...shadow.sm,
  },
  doneBtnText: { fontSize: 16, fontWeight: '900', color: '#fff' },
});
