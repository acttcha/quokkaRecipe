import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, StatusBar, Alert, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { NavProps } from '../types';
import {
  searchYoutubeForRecipe, getVideoDescription,
  fetchVideoTranscript, formatViewCount, YTSearchResult,
  extractYouTubeVideoId,
} from '../services/youtube';
import { analyzeYoutubeRecipe, YoutubeRecipeAnalysis } from '../services/claude';
import { recordUsage } from '../services/usage';
import { checkUsageOrAlert } from '../services/usageGate';
import { saveRecipe, isRecipeSaved } from '../services/savedRecipes';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';

type Props = NavProps & { recipeName?: string };
type Stage = 'input' | 'searching' | 'results' | 'analyzing' | 'done' | 'error';

const DIFF: Record<string, { label: string; color: string; bg: string }> = {
  Easy:   { label: '쉬워요',    color: Colors.accent,  bg: Colors.accentLight },
  Medium: { label: '보통이에요', color: '#D97706',      bg: Colors.yellowLight },
  Hard:   { label: '어려워요',  color: Colors.coral,   bg: Colors.coralLight },
};

function IconYoutube() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.45a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58Z"
        fill="#FF0000" />
      <Path d="m9.75 15.02 5.75-3.02-5.75-3.02v6.04Z" fill="#fff" />
    </Svg>
  );
}

function IconChevronLeft() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={Colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function YoutubeRecipeScreen({ goBack, recipeName }: Props) {
  const [stage, setStage]         = useState<Stage>(recipeName ? 'searching' : 'input');
  const [inputText, setInputText] = useState('');
  const [queryLabel, setQueryLabel] = useState(recipeName ?? '');
  const [videos, setVideos]       = useState<YTSearchResult[]>([]);
  const [selected, setSelected]   = useState<YTSearchResult | null>(null);
  const [result, setResult]       = useState<YoutubeRecipeAnalysis | null>(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    if (recipeName) search(recipeName);
  }, []);

  const search = async (query: string) => {
    setQueryLabel(query);
    setStage('searching');
    try {
      const items = await searchYoutubeForRecipe(query);
      if (!items.length) { setErrorMsg(`"${query}" 관련 영상을 찾지 못했어요`); setStage('error'); return; }
      setVideos(items);
      setStage('results');
    } catch (e: any) {
      console.error('[YT Search]', e);
      setErrorMsg(e.message || '검색 중 오류가 생겼어요');
      setStage('error');
    }
  };

  const handleInputSubmit = () => {
    const text = inputText.trim();
    if (!text) return;
    haptic.light();
    const videoId = extractYouTubeVideoId(text);
    if (videoId) {
      const mockVideo: YTSearchResult = {
        videoId,
        title: 'YouTube 영상',
        channelTitle: '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        viewCount: 0,
      };
      setQueryLabel(text);
      analyze(mockVideo);
    } else {
      search(text);
    }
  };

  const analyze = async (video: YTSearchResult) => {
    if (!await checkUsageOrAlert('recipe')) return;
    haptic.light();
    setSelected(video);
    setStage('analyzing');
    try {
      const [description, transcript] = await Promise.all([
        getVideoDescription(video.videoId),
        fetchVideoTranscript(video.videoId),
      ]);
      const analysis = await analyzeYoutubeRecipe(
        video.title, video.channelTitle, description, transcript,
      );
      await recordUsage('recipe');
      haptic.success();
      setResult(analysis);
      const alreadySaved = await isRecipeSaved(analysis.recipeName);
      setSaved(alreadySaved);
      setStage('done');
    } catch (e: any) {
      haptic.error();
      Alert.alert('분석 실패', e.message || '다시 시도해주세요');
      setStage('results');
    }
  };

  const handleSave = async () => {
    if (!result || saved) return;
    haptic.success();
    await saveRecipe({
      name: result.recipeName,
      description: result.recipeName,
      cookTime: result.cookTime,
      servings: result.servings,
      difficulty: result.difficulty,
      ingredients: result.ingredients,
      steps: result.steps,
    }, [], {
      source: 'youtube',
      youtubeVideoId: selected?.videoId,
      youtubeThumbnail: selected?.thumbnail,
      youtubeTitle: selected?.title,
    });
    setSaved(true);
  };

  const diff = result ? (DIFF[result.difficulty] ?? DIFF.Medium) : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.8]} style={styles.header}>
        <View style={styles.headerNav}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <IconChevronLeft />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <IconYoutube />
            <Text style={styles.headerTitle}>유튜브 레시피 분석</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        {stage !== 'input' && queryLabel ? (
          <View style={styles.searchPill}>
            <Text style={styles.searchPillText} numberOfLines={1}>{queryLabel}</Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* 입력 */}
      {stage === 'input' && (
        <KeyboardAvoidingView style={styles.inputStage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>유튜브 링크 또는 요리 이름</Text>
            <TextInput
              style={styles.inputField}
              value={inputText}
              onChangeText={setInputText}
              placeholder="된장찌개  또는  youtube.com/watch?v=..."
              placeholderTextColor={Colors.inkMute}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleInputSubmit}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.inputHints}>
              <Text style={styles.inputHint}>🔗 유튜브 링크를 붙여넣으면 바로 분석해요</Text>
              <Text style={styles.inputHint}>🔍 요리 이름을 입력하면 관련 영상을 검색해요</Text>
            </View>
            <TouchableOpacity
              style={[styles.inputSubmitBtn, !inputText.trim() && styles.inputSubmitDisabled]}
              onPress={handleInputSubmit}
              disabled={!inputText.trim()}
            >
              <Text style={styles.inputSubmitText}>시작하기</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* 검색 중 */}
      {stage === 'searching' && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.forest} />
          <Text style={styles.loadingText}>유튜브 영상 검색 중...</Text>
        </View>
      )}

      {/* 분석 중 */}
      {stage === 'analyzing' && selected && (
        <View style={styles.centerBox}>
          <View style={styles.analyzingCard}>
            <Image source={{ uri: selected.thumbnail }} style={styles.analyzingThumb} />
            <Text style={styles.analyzingTitle} numberOfLines={2}>{selected.title}</Text>
            <Text style={styles.analyzingChannel}>{selected.channelTitle}</Text>
          </View>
          <ActivityIndicator size="large" color={Colors.forest} style={{ marginTop: 28 }} />
          <Text style={styles.loadingText}>자막 추출 및 레시피 분석 중...</Text>
          <Text style={styles.loadingSubText}>30초 정도 걸릴 수 있어요</Text>
        </View>
      )}

      {/* 에러 */}
      {stage === 'error' && (
        <View style={styles.centerBox}>
          <Text style={styles.errorEmoji}>😢</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => search(queryLabel)}>
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 검색 결과 */}
      {stage === 'results' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.resultsHint}>영상을 선택하면 레시피를 분석해드려요</Text>
          {videos.map(v => (
            <TouchableOpacity key={v.videoId} style={styles.videoCard} onPress={() => analyze(v)} activeOpacity={0.85}>
              <Image source={{ uri: v.thumbnail }} style={styles.videoThumb} />
              <View style={styles.videoInfo}>
                <Text style={styles.videoTitle} numberOfLines={2}>{v.title}</Text>
                <Text style={styles.videoChannel}>{v.channelTitle}</Text>
                <View style={styles.videoMeta}>
                  <View style={styles.viewsBadge}>
                    <IconYoutube />
                    <Text style={styles.viewsText}>{formatViewCount(v.viewCount)}</Text>
                  </View>
                  <View style={styles.analyzeBtn}>
                    <Text style={styles.analyzeBtnText}>분석하기 →</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 분석 결과 */}
      {stage === 'done' && result && selected && (
        <>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

            {/* 출처 영상 */}
            <TouchableOpacity style={styles.sourceCard} activeOpacity={0.85}>
              <Image source={{ uri: selected.thumbnail }} style={styles.sourceThumb} />
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceLabel}>출처 영상</Text>
                <Text style={styles.sourceTitle} numberOfLines={2}>{selected.title}</Text>
                <Text style={styles.sourceChannel}>{selected.channelTitle}</Text>
              </View>
            </TouchableOpacity>

            {/* 레시피 헤더 */}
            <View style={styles.recipeHeader}>
              <Text style={styles.recipeName}>{result.recipeName}</Text>
              <View style={styles.chipRow}>
                {diff && (
                  <View style={[styles.chip, { backgroundColor: diff.bg }]}>
                    <Text style={[styles.chipText, { color: diff.color }]}>{diff.label}</Text>
                  </View>
                )}
                <View style={styles.chip}>
                  <Text style={styles.chipText}>⏱ {result.cookTime}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>👥 {result.servings}인분</Text>
                </View>
              </View>
            </View>

            {/* 재료 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🧂 재료</Text>
              <View style={styles.ingredientGrid}>
                {result.ingredients.map((ing, i) => (
                  <View key={i} style={styles.ingredientChip}>
                    <Text style={styles.ingredientText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 만드는 법 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👨‍🍳 만드는 법</Text>
              {result.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            {/* 팁 */}
            {result.tips.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💡 요리 팁</Text>
                {result.tips.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Text style={styles.tipBullet}>•</Text>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* 고정 하단 저장 바 */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={styles.reanalzeBtn}
              onPress={() => { setStage('results'); setSelected(null); setResult(null); setSaved(false); }}
            >
              <Text style={styles.reanalyzeBtnText}>다른 영상</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saved && styles.saveBtnDone]}
              onPress={handleSave}
              disabled={saved}
            >
              <Text style={styles.saveBtnText}>{saved ? '✓ 저장됨' : '♥ 레시피 저장'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  header: { paddingBottom: 16 },
  headerNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, marginBottom: 10,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.ink },
  headerRight: { width: 36 },
  searchPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(61,139,94,0.12)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  searchPillText: { fontSize: 14, fontWeight: '700', color: Colors.forestDeep },

  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 100, gap: 12 },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 16, fontSize: 15, fontWeight: '700', color: Colors.ink },
  loadingSubText: { marginTop: 6, fontSize: 13, color: Colors.inkSoft },

  analyzingCard: {
    width: '100%', backgroundColor: Colors.white, borderRadius: 16,
    overflow: 'hidden', ...shadow.sm,
  },
  analyzingThumb: { width: '100%', height: 160 },
  analyzingTitle: { fontSize: 14, fontWeight: '700', color: Colors.ink, padding: 12, paddingBottom: 4 },
  analyzingChannel: { fontSize: 12, color: Colors.inkSoft, paddingHorizontal: 12, paddingBottom: 12 },

  errorEmoji: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 15, color: Colors.ink, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    backgroundColor: Colors.forest, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 13, alignSelf: 'center', marginTop: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32,
    backgroundColor: Colors.cream,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  saveBtn: {
    flex: 1, backgroundColor: Colors.forest, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', ...shadow.sm,
  },
  saveBtnDone: { backgroundColor: Colors.inkMute },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  reanalzeBtn: {
    backgroundColor: Colors.white, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.line,
  },
  reanalyzeBtnText: { color: Colors.inkSoft, fontSize: 14, fontWeight: '700' },

  resultsHint: { fontSize: 13, color: Colors.inkSoft, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  videoCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  videoThumb: { width: 110, height: 88 },
  videoInfo: { flex: 1, padding: 10, justifyContent: 'space-between' },
  videoTitle: { fontSize: 13, fontWeight: '700', color: Colors.ink, lineHeight: 18 },
  videoChannel: { fontSize: 11, color: Colors.inkSoft, fontWeight: '500', marginTop: 3 },
  videoMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  viewsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewsText: { fontSize: 11, color: Colors.inkMute, fontWeight: '600' },
  analyzeBtn: {
    backgroundColor: Colors.forestSoft,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  analyzeBtnText: { fontSize: 12, fontWeight: '800', color: Colors.forestDeep },

  sourceCard: {
    backgroundColor: Colors.white, borderRadius: 14, flexDirection: 'row',
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
    marginBottom: 4,
  },
  sourceThumb: { width: 96, height: 72 },
  sourceInfo: { flex: 1, padding: 10, justifyContent: 'center' },
  sourceLabel: { fontSize: 10, fontWeight: '700', color: Colors.inkMute, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  sourceTitle: { fontSize: 12, fontWeight: '700', color: Colors.ink, lineHeight: 16 },
  sourceChannel: { fontSize: 11, color: Colors.inkSoft, marginTop: 2 },

  recipeHeader: {
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  recipeName: { fontSize: 20, fontWeight: '800', color: Colors.ink, letterSpacing: -0.4, marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { backgroundColor: Colors.creamSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.inkSoft },

  section: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.ink, marginBottom: 12 },

  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ingredientChip: {
    backgroundColor: Colors.creamSoft, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.line,
  },
  ingredientText: { fontSize: 13, fontWeight: '600', color: Colors.inkSoft },

  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.forest, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  stepNumText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  stepText: { flex: 1, fontSize: 14, color: Colors.ink, lineHeight: 21, fontWeight: '500' },

  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  tipBullet: { fontSize: 16, color: Colors.forest, lineHeight: 22 },
  tipText: { flex: 1, fontSize: 14, color: Colors.inkSoft, lineHeight: 20, fontWeight: '500' },

  inputStage: { flex: 1, justifyContent: 'center', padding: 24 },
  inputCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    padding: 22, borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  inputLabel: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft, marginBottom: 10 },
  inputField: {
    height: 50, backgroundColor: Colors.creamSoft,
    borderRadius: 14, paddingHorizontal: 14, fontSize: 15, color: Colors.ink,
    borderWidth: 1, borderColor: Colors.line,
  },
  inputHints: { marginTop: 14, gap: 6 },
  inputHint: { fontSize: 12, color: Colors.inkMute, fontWeight: '500' },
  inputSubmitBtn: {
    marginTop: 18, height: 50, backgroundColor: Colors.forest,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...shadow.sm,
  },
  inputSubmitDisabled: { backgroundColor: Colors.inkMute },
  inputSubmitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
