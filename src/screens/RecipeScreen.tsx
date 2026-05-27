import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Image, ImageBackground,
  StatusBar, Modal, KeyboardAvoidingView, Platform, Dimensions, Share, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavProps, Recipe, YouTubeVideo } from '../types';
import { identifyIngredients, generateRecipes, generateRecipeByName, askQuokka } from '../services/claude';
import { searchYouTubeRecipes, openYouTubeSearch, openCoupang, formatViewCount, cleanIngredientName, formatDuration, formatRelativeDate } from '../services/youtube';
import { saveRecipe, isRecipeSaved, removeRecipe, getSavedRecipes } from '../services/savedRecipes';
import { incrementScanCount } from '../services/stats';
import { addIngredients, getFridgeIngredients, matchesFridge, getMissingIngredients } from '../services/fridge';
import { recordUsage } from '../services/usage';
import { checkUsageOrAlert } from '../services/usageGate';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';
import { POPULAR_INGREDIENTS } from '../constants/ingredients';

const { width } = Dimensions.get('window');

type Props = NavProps & (
  | { imageBase64: string; mimeType: string; prefillIngredients?: never; dishName?: never }
  | { imageBase64?: never; mimeType?: never; prefillIngredients: string[]; dishName?: never }
  | { imageBase64?: never; mimeType?: never; prefillIngredients?: never; dishName: string }
);
type Step = 'identifying' | 'review' | 'generating' | 'results' | 'error';
type Tab = 'ai' | 'youtube';

const DIFF = {
  Easy:   { label: '쉬워요',    color: Colors.accent,  bg: Colors.accentLight },
  Medium: { label: '보통이에요', color: '#D97706',      bg: Colors.yellowLight },
  Hard:   { label: '어려워요',  color: Colors.coral,   bg: Colors.coralLight },
};

function getRecipeEmoji(name: string, ingredients: string[]): string {
  const t = (name + ' ' + ingredients.join(' ')).toLowerCase();
  if (/비빔밥|덮밥/.test(t))            return '🍱';
  if (/볶음밥|필라프/.test(t))           return '🍚';
  if (/김치/.test(t))                   return '🥬';
  if (/계란|달걀/.test(t))              return '🍳';
  if (/찌개|전골/.test(t))              return '🍲';
  if (/국|탕|스프|죽/.test(t))          return '🥣';
  if (/면|국수|파스타|라면|우동/.test(t)) return '🍜';
  if (/닭|치킨/.test(t))                return '🍗';
  if (/소고기|갈비|스테이크/.test(t))    return '🥩';
  if (/돼지|삼겹|항정/.test(t))         return '🥓';
  if (/새우/.test(t))                   return '🦐';
  if (/생선|연어|참치|고등어|조기/.test(t)) return '🐟';
  if (/카레/.test(t))                   return '🍛';
  if (/샐러드/.test(t))                 return '🥗';
  if (/전|부침/.test(t))                return '🥞';
  if (/볶음/.test(t))                   return '🥘';
  if (/구이/.test(t))                   return '🍖';
  if (/두부/.test(t))                   return '🫕';
  if (/나물|무침/.test(t))              return '🥦';
  return '🍽️';
}

export default function RecipeScreen({ navigate, goBack, imageBase64, mimeType, prefillIngredients, dishName }: Props) {
  const [step, setStep]             = useState<Step>('identifying');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [fridgeItems, setFridgeItems] = useState<string[]>([]);
  const [recipes, setRecipes]       = useState<Recipe[]>([]);
  const [videos, setVideos]         = useState<YouTubeVideo[]>([]);
  const [newIng, setNewIng]         = useState('');
  const [expanded, setExpanded]     = useState<number | null>(null);
  const [tab, setTab]               = useState<Tab>('ai');
  const [errorMsg, setErrorMsg]     = useState('');
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());

  // 쿼카 질문 모달
  const [askModal, setAskModal]   = useState<Recipe | null>(null);
  const [question, setQuestion]   = useState('');
  const [answer, setAnswer]       = useState('');
  const [asking, setAsking]       = useState(false);

  const loadSaved = useCallback(async () => {
    const saved = await getSavedRecipes();
    setSavedNames(new Set(saved.map(r => r.name)));
  }, []);

  const identify = useCallback(async () => {
    // 1) 특정 요리 검색 모드 — 재료 확인 단계 스킵, 바로 레시피 생성
    if (dishName) {
      if (!await checkUsageOrAlert('recipe')) {
        goBack();
        return;
      }
      setFridgeItems(await getFridgeIngredients());
      setStep('generating');
      try {
        const [found, vids] = await Promise.all([
          generateRecipeByName(dishName),
          searchYouTubeRecipes([dishName]),
        ]);
        await recordUsage('recipe');
        setRecipes(found);
        setVideos(vids);
        await loadSaved();
        setStep('results');
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setStep('error');
      }
      return;
    }
    // 2) 냉장고 재료 기반 (FridgeRecipes)
    if (prefillIngredients) {
      setIngredients(prefillIngredients);
      setFridgeItems(await getFridgeIngredients());
      setStep('review');
      return;
    }
    // 3) 카메라 스캔 기반 (Recipes)
    if (!await checkUsageOrAlert('scan')) {
      goBack();
      return;
    }
    setStep('identifying');
    try {
      const found = await identifyIngredients(imageBase64!, mimeType!);
      await recordUsage('scan');
      await addIngredients(found);
      setIngredients(found);
      setFridgeItems(await getFridgeIngredients());
      await incrementScanCount();
      setStep('review');
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStep('error');
    }
  }, [imageBase64, mimeType, prefillIngredients, dishName, goBack, loadSaved]);

  useEffect(() => { identify(); }, [identify]);

  const handleGetRecipes = async () => {
    if (ingredients.length === 0) { Alert.alert('앗!', '재료를 1개 이상 추가해주세요 🥺'); return; }
    if (!await checkUsageOrAlert('recipe')) return;
    setStep('generating');
    try {
      const [found, vids] = await Promise.all([
        generateRecipes(ingredients),
        searchYouTubeRecipes(ingredients),
      ]);
      await recordUsage('recipe');
      setRecipes(found);
      setVideos(vids);
      await loadSaved();
      setStep('results');
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStep('error');
    }
  };

  const addIng = () => {
    const t = newIng.trim();
    if (t && !ingredients.includes(t)) setIngredients(p => [...p, t]);
    setNewIng('');
  };

  const addIngDirect = (item: string) => {
    if (!ingredients.includes(item)) {
      haptic.light();
      setIngredients(p => [...p, item]);
      setNewIng('');
    }
  };

  const shareRecipe = async (r: Recipe) => {
    haptic.light();
    const diffLabel = DIFF[r.difficulty]?.label ?? r.difficulty;
    const text = [
      `🍽 ${r.name}`,
      '',
      r.description,
      '',
      `⏱ ${r.cookTime}  |  👥 ${r.servings}인분  |  ${diffLabel}`,
      '',
      '🧂 재료',
      r.ingredients.join(', '),
      '',
      '👨‍🍳 만드는 법',
      ...r.steps.map((s, i) => `${i + 1}. ${s}`),
      '',
      '🐾 쿼카레시피 앱으로 만들었어요',
    ].join('\n');
    try { await Share.share({ message: text }); } catch {}
  };

  const reviewSuggestions = newIng.trim().length > 0
    ? POPULAR_INGREDIENTS.filter(item => !ingredients.includes(item) && item.includes(newIng.trim()))
    : [];

  const toggleSave = async (r: Recipe) => {
    const wasSaved = savedNames.has(r.name);
    wasSaved ? haptic.light() : haptic.success();
    setSavedNames(prev => {
      const next = new Set(prev);
      if (wasSaved) next.delete(r.name); else next.add(r.name);
      return next;
    });
    try {
      if (wasSaved) {
        const saved = await getSavedRecipes();
        const found = saved.find(s => s.name === r.name);
        if (found) await removeRecipe(found.id);
      } else {
        await saveRecipe(r, ingredients);
      }
      await loadSaved();
    } catch (e) {
      await loadSaved(); // 실패 시 실제 상태로 복원
      Alert.alert('저장 오류', String(e));
    }
  };

  const availableIngredients = Array.from(new Set([...fridgeItems, ...ingredients]));

  const handleAsk = async () => {
    if (!askModal || !question.trim()) return;
    if (!await checkUsageOrAlert('qa')) return;
    haptic.light();
    setAsking(true);
    setAnswer('');
    try {
      const res = await askQuokka(askModal, question.trim());
      await recordUsage('qa');
      setAnswer(res);
      haptic.success();
    } catch {
      setAnswer('앗, 오류가 생겼어요. 다시 시도해주세요 🙏');
      haptic.error();
    } finally {
      setAsking(false);
    }
  };


  // ── 로딩 ──
  if (step === 'identifying' || step === 'generating') {
    const isId = step === 'identifying';
    return (
      <ImageBackground source={require('../../assets/background.png')} style={styles.loadRoot} resizeMode="cover">
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <Image
          source={isId ? require('../../assets/quokka.png') : require('../../assets/loading.png')}
          style={isId ? styles.loadQuokka : styles.loadCooking}
          resizeMode="contain"
        />
        <View style={styles.loadCard}>
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginBottom: 14 }} />
          <Text style={styles.loadTitle}>{isId ? '재료를 인식하는 중...' : '레시피를 만드는 중...'}</Text>
          <Text style={styles.loadSub}>{isId ? 'AI가 이미지를 분석하고 있어요' : '쿼카 셰프가 열심히 요리 중이에요 🍳'}</Text>
        </View>
      </ImageBackground>
    );
  }

  // ── 에러 ──
  if (step === 'error') {
    return (
      <ImageBackground source={require('../../assets/background.png')} style={styles.loadRoot} resizeMode="cover">
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={styles.loadCard}>
          <Text style={styles.loadIcon}>😵</Text>
          <Text style={styles.loadTitle}>문제가 생겼어요</Text>
          <Text style={styles.loadSub}>{errorMsg}</Text>
          <TouchableOpacity style={styles.greenBtn} onPress={identify}>
            <Text style={styles.greenBtnText}>다시 시도하기</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goBack} style={styles.textBtn}>
            <Text style={styles.textBtnText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    );
  }

  // ── 재료 확인 ──
  if (step === 'review') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.7]} style={styles.reviewHero}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 다시 찍기</Text>
          </TouchableOpacity>
          <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.reviewSub}>탭하면 삭제돼요 · 재료 추가도 가능해요</Text>
        </LinearGradient>

        <ScrollView style={styles.reviewBody} contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput} value={newIng} onChangeText={setNewIng}
              placeholder="예) 두부, 된장, 파..." placeholderTextColor={Colors.textMuted}
              onSubmitEditing={addIng} returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addIng}>
              <Text style={styles.addBtnText}>추가</Text>
            </TouchableOpacity>
          </View>
          {reviewSuggestions.length > 0 && (
            <View style={styles.suggestWrap}>
              {reviewSuggestions.map(item => (
                <TouchableOpacity
                  key={item}
                  style={styles.suggestChip}
                  onPress={() => addIngDirect(item)}
                >
                  <Text style={styles.suggestChipText}>+ {item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.tagsWrap}>
            {ingredients.map(ing => (
              <TouchableOpacity
                key={ing} style={styles.ingTag}
                onPress={() => setIngredients(p => p.filter(i => i !== ing))}
              >
                <Text style={styles.ingTagText}>{ing}</Text>
                <Text style={styles.ingTagX}>×</Text>
              </TouchableOpacity>
            ))}
          </View>
          {ingredients.length === 0 && (
            <View style={styles.emptyCard}><Text style={styles.emptyCardText}>😅 재료를 직접 추가해보세요!</Text></View>
          )}
          <TouchableOpacity style={styles.greenBtn} onPress={handleGetRecipes}>
            <Text style={styles.greenBtnText}>👨‍🍳  레시피 추천받기</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── 결과 ──
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.7]} style={styles.resultsHero}>
        <TouchableOpacity
          onPress={() => dishName ? goBack() : setStep('review')}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>
            {dishName ? '← 돌아가기' : '← 재료 수정'}
          </Text>
        </TouchableOpacity>
        <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
        <Text style={styles.resultsSub} numberOfLines={1}>
          {ingredients.slice(0, 3).join(' · ')}{ingredients.length > 3 ? ` +${ingredients.length - 3}개` : ''}
        </Text>
      </LinearGradient>

      {/* 탭 */}
      <View style={styles.tabWrap}>
        {[
          { id: 'ai' as Tab, label: '🤖 AI 레시피' },
          { id: 'youtube' as Tab, label: '📺 유튜브' },
        ].map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => { haptic.light(); setTab(t.id); }}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false}>

        {/* AI 레시피 */}
        {tab === 'ai' && recipes.map((r, idx) => {
          const open = expanded === idx;
          const diff = DIFF[r.difficulty];
          const isSaved = savedNames.has(r.name);
          return (
            <View key={idx} style={styles.recipeCard}>
              {/* 상단 행: 이름 + 공유 + 북마크 */}
              <View style={styles.cardTopRow}>
                <Text style={styles.recipeName}>{r.name}</Text>
                <TouchableOpacity style={styles.shareBtn} onPress={() => shareRecipe(r)}>
                  <Text style={styles.shareBtnText}>공유 ↗</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bookmarkBtn} onPress={() => toggleSave(r)}>
                  <Text style={styles.bookmarkIcon}>{isSaved ? '♥' : '♡'}</Text>
                </TouchableOpacity>
              </View>

              {/* 카드 본문 */}
              <TouchableOpacity
                style={styles.recipeBody}
                onPress={() => { haptic.light(); setExpanded(open ? null : idx); }}
                activeOpacity={0.9}
              >
                <Text style={styles.recipeDesc}>{r.description}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.diffChip, { backgroundColor: diff.bg }]}>
                    <Text style={[styles.diffText, { color: diff.color }]}>{diff.label}</Text>
                  </View>
                  <View style={styles.metaChip}><Text style={styles.metaChipText}>⏱ {r.cookTime}</Text></View>
                  <View style={styles.metaChip}><Text style={styles.metaChipText}>👥 {r.servings}인분</Text></View>
                  {r.nutrition && (
                    <View style={styles.metaChip}><Text style={styles.metaChipText}>🔥 {r.nutrition.calories}kcal</Text></View>
                  )}
                  {(() => {
                    const missing = getMissingIngredients(availableIngredients, r.ingredients).length;
                    return missing === 0
                      ? <View style={styles.ingOkChip}><Text style={styles.ingOkText}>재료 완비 ✓</Text></View>
                      : <View style={styles.ingMissingChip}><Text style={styles.ingMissingText}>{missing}개 부족</Text></View>;
                  })()}
                  <View style={styles.expandBtn}>
                    <Text style={styles.expandBtnText}>{open ? '접기 ▲' : '레시피 보기 ▼'}</Text>
                  </View>
                </View>

                {open && (
                  <View style={styles.detail}>
                    <View style={styles.detailLine} />

                    {/* 영양정보 */}
                    {r.nutrition && (
                      <View style={styles.nutritionBox}>
                        {[
                          { label: '칼로리', val: `${r.nutrition.calories}kcal`, color: '#FF9F7F' },
                          { label: '단백질', val: `${r.nutrition.protein}g`,     color: '#74C0FC' },
                          { label: '탄수화물', val: `${r.nutrition.carbs}g`,     color: '#FFD166' },
                          { label: '지방', val: `${r.nutrition.fat}g`,           color: '#C77DFF' },
                        ].map(n => (
                          <View key={n.label} style={styles.nutritionItem}>
                            <Text style={[styles.nutritionVal, { color: n.color }]}>{n.val}</Text>
                            <Text style={styles.nutritionLabel}>{n.label}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <Text style={styles.detailHead}>🧂 재료</Text>
                    <View style={styles.ingredientGrid}>
                      {r.ingredients.map((ing, n) => {
                        const have = matchesFridge(availableIngredients, ing);
                        return (
                          <View key={n} style={[styles.ingredientChip, have ? styles.ingredientChipHave : styles.ingredientChipMissing]}>
                            <Text style={[styles.ingredientChipText, have ? styles.ingredientChipTextHave : styles.ingredientChipTextMissing]}>
                              {have ? '✓ ' : '✗ '}{ing}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    <Text style={[styles.detailHead, { marginTop: 16 }]}>👨‍🍳 만드는 법</Text>
                    {r.steps.map((s, n) => (
                      <View key={n} style={styles.stepRow}>
                        <View style={styles.stepNum}>
                          <Text style={styles.stepNumText}>{n + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{s}</Text>
                      </View>
                    ))}

                    {/* 쿼카에게 질문 */}
                    <TouchableOpacity
                      style={styles.askBtn}
                      onPress={() => { setAskModal(r); setQuestion(''); setAnswer(''); }}
                    >
                      <Image source={require('../../assets/quokka.png')} style={styles.askBtnQuokka} resizeMode="contain" />
                      <Text style={styles.askBtnText}>쿼카에게 질문하기 🐾</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        {/* 유튜브 */}
        {tab === 'youtube' && (
          <View>
            <View style={styles.ytHeader}>
              <Text style={styles.ytHeaderText}>인기 영상 🔥</Text>
              <TouchableOpacity style={styles.ytMoreBtn} onPress={() => openYouTubeSearch(ingredients)}>
                <Text style={styles.ytMoreText}>유튜브에서 보기 →</Text>
              </TouchableOpacity>
            </View>
            {videos.map((v, i) => {
              const durationText = v.durationSec ? formatDuration(v.durationSec) : '';
              const dateText = v.publishedAt ? formatRelativeDate(v.publishedAt) : '';
              return (
                <View key={v.id} style={styles.videoCard}>
                  <View style={styles.videoCardTop}>
                    <View style={[styles.thumb, { backgroundColor: v.thumbnailColor }]}>
                      {v.thumbnailUrl ? (
                        <Image source={{ uri: v.thumbnailUrl }} style={styles.thumbImage} resizeMode="cover" />
                      ) : (
                        <Text style={styles.thumbEmoji}>{v.thumbnailEmoji}</Text>
                      )}
                      <View style={styles.rankBadge}><Text style={styles.rankText}>{i + 1}위</Text></View>
                      {!!durationText && (
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>{durationText}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.videoInfo}>
                      <Text style={styles.videoTitle} numberOfLines={2}>{v.title}</Text>
                      <Text style={styles.videoChannel}>{v.channel}</Text>
                      <View style={styles.viewMetaRow}>
                        <View style={styles.viewBadge}><Text style={styles.viewText}>👁  {formatViewCount(v.viewCount)}</Text></View>
                        {!!dateText && (
                          <View style={styles.dateBadge}><Text style={styles.dateText}>{dateText}</Text></View>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.videoActionRow}>
                    <TouchableOpacity
                      style={styles.videoOpenBtn}
                      onPress={() => { haptic.light(); Linking.openURL(v.url); }}
                      activeOpacity={0.85}
                    >
                      <View style={styles.ytLogo}>
                        <Text style={styles.ytLogoPlay}>▶</Text>
                      </View>
                      <Text style={styles.videoOpenBtnText}>유튜브로 이동</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.videoAnalyzeBtn}
                      onPress={() => {
                        haptic.light();
                        navigate({
                          name: 'YoutubeRecipe',
                          directVideo: { videoId: v.id, title: v.title, channelTitle: v.channel },
                        });
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.videoAnalyzeBtnText}>🤖 레시피 분석</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 쿠팡 — 없는 재료만 */}
        {tab === 'ai' && (() => {
          const allMissing = [...new Set(recipes.flatMap(r => getMissingIngredients(availableIngredients, r.ingredients)))];
          if (allMissing.length === 0) return null;
          return (
            <View style={styles.coupangBar}>
              <Text style={styles.coupangBarLabel}>🛒 없는 재료 바로 구매</Text>
              <Text style={styles.coupangBarSub}>집에 없는 재료만 쿠팡에서 바로 주문해요</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {allMissing.map(ing => (
                    <TouchableOpacity key={ing} style={styles.coupangChip} onPress={() => openCoupang(ing)}>
                      <Text style={styles.coupangChipText}>{cleanIngredientName(ing)}</Text>
                      <Text style={styles.coupangChipIcon}>→</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          );
        })()}

        <TouchableOpacity style={styles.homeBtn} onPress={() => navigate({ name: 'Home' })}>
          <Text style={styles.homeBtnText}>🏠  처음으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 쿼카 질문 모달 */}
      <Modal visible={!!askModal} animationType="slide" transparent onRequestClose={() => setAskModal(null)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            {/* 핸들 */}
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Image source={require('../../assets/quokka.png')} style={styles.modalQuokka} resizeMode="contain" />
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>쿼카에게 물어보기</Text>
                <Text style={styles.modalSub} numberOfLines={1}>{askModal?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setAskModal(null)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 답변 영역 */}
            {asking && (
              <View style={styles.answerBox}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.answerLoading}>쿼카가 생각하는 중... 🐾</Text>
              </View>
            )}
            {!!answer && !asking && (
              <View style={styles.answerBox}>
                <Text style={styles.answerText}>{answer}</Text>
              </View>
            )}

            {/* 빠른 질문 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
              {QUICK_QUESTIONS.map(q => (
                <TouchableOpacity key={q} style={styles.quickChip} onPress={() => setQuestion(q)}>
                  <Text style={styles.quickChipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 입력창 */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.modalInput}
                value={question}
                onChangeText={setQuestion}
                placeholder="궁금한 것을 물어보세요..."
                placeholderTextColor={Colors.textMuted}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!question.trim() || asking) && styles.sendBtnDisabled]}
                onPress={handleAsk}
                disabled={!question.trim() || asking}
              >
                <Text style={styles.sendBtnText}>전송</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const QUICK_QUESTIONS = [
  '더 쉽게 만들 수 있어?',
  '칼로리 낮추려면?',
  '이 재료 대신 뭐 써도 돼?',
  '보관은 어떻게 해?',
  '맛있게 하는 팁 있어?',
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  // 로딩/에러
  loadRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  loadQuokka: { width: 200, height: 200, marginBottom: 8 },
  loadCooking: { width: 300, height: 300, marginBottom: -16 },
  loadCard: { backgroundColor: 'rgba(255,249,236,0.92)', borderRadius: 28, padding: 32, alignItems: 'center', width: '100%', ...shadow.md },
  loadIcon: { fontSize: 40, marginBottom: 12 },
  loadTitle: { fontSize: 20, fontWeight: '800', color: Colors.ink, marginBottom: 8 },
  loadSub: { fontSize: 14, color: Colors.inkSoft, textAlign: 'center', lineHeight: 20 },

  greenBtn: { backgroundColor: Colors.forest, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', marginTop: 16, ...shadow.sm },
  greenBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  textBtn: { padding: 12, alignItems: 'center' },
  textBtnText: { color: Colors.inkMute, fontSize: 14, fontWeight: '600' },

  // 재료 확인 화면
  reviewHero: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 24 },
  heroLogo: { width: '100%', height: 52, marginBottom: 8 },
  backBtn: { marginBottom: 12 },
  backBtnText: { color: Colors.ink, fontSize: 14, fontWeight: '700' },
  reviewSub: { fontSize: 13, color: Colors.inkSoft, fontWeight: '500' },

  reviewBody: { flex: 1, backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, ...shadow.sm },
  reviewContent: { padding: 20, paddingBottom: 48 },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  ingTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.orangeSoft, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: '#F2994A50', ...shadow.sm },
  ingTagText: { fontSize: 14, fontWeight: '700', color: Colors.ink },
  ingTagX: { fontSize: 14, color: Colors.inkMute, fontWeight: '700' },
  emptyCard: { backgroundColor: Colors.creamDark, borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 18 },
  emptyCardText: { fontSize: 15, fontWeight: '700', color: Colors.ink },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  addInput: { flex: 1, backgroundColor: Colors.creamSoft, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.line, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: Colors.ink },
  addBtn: { backgroundColor: Colors.forest, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  // 결과 화면
  resultsHero: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 20 },
  resultsSub: { fontSize: 13, color: Colors.inkSoft, fontWeight: '500' },

  tabWrap: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, backgroundColor: Colors.cream },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 14, backgroundColor: Colors.white, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.line },
  tabActive: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  tabText: { fontSize: 14, fontWeight: '700', color: Colors.inkSoft },
  tabTextActive: { color: '#FFF', fontWeight: '800' },

  resultsContent: { paddingHorizontal: 20, paddingBottom: 48 },

  // 레시피 카드
  recipeCard: { backgroundColor: Colors.white, borderRadius: 24, marginBottom: 18, overflow: 'hidden', ...shadow.md },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 2 },
  recipeName: { fontSize: 20, fontWeight: '900', color: Colors.ink, flex: 1, marginRight: 8 },
  bookmarkBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bookmarkIcon: { fontSize: 22, color: Colors.coral },
  diffChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  diffText: { fontSize: 12, fontWeight: '800' },
  recipeBody: { paddingHorizontal: 18, paddingBottom: 18, paddingTop: 8 },
  recipeDesc: { fontSize: 13, color: Colors.inkSoft, lineHeight: 19, marginBottom: 14 },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  metaChip: { backgroundColor: Colors.creamSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  metaChipText: { fontSize: 12, color: Colors.inkSoft, fontWeight: '600' },
  expandBtn: { marginLeft: 'auto' as any, backgroundColor: Colors.forestSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  expandBtnText: { fontSize: 12, fontWeight: '800', color: Colors.forest },

  detail: { marginTop: 4 },
  detailLine: { height: 1, backgroundColor: Colors.line, marginVertical: 14 },
  detailHead: { fontSize: 13, fontWeight: '800', color: Colors.ink, marginBottom: 10 },

  nutritionBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.creamSoft, borderRadius: 16, padding: 16, marginBottom: 16 },
  nutritionItem: { alignItems: 'center', flex: 1 },
  nutritionVal: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  nutritionLabel: { fontSize: 11, color: Colors.inkMute, fontWeight: '600' },

  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  ingredientChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  ingredientChipHave: { backgroundColor: '#F0FFF4', borderColor: '#86EFAC' },
  ingredientChipMissing: { backgroundColor: '#FFF5F5', borderColor: '#FCA5A5' },
  ingredientChipText: { fontSize: 13, fontWeight: '600' },
  ingredientChipTextHave: { color: '#166534' },
  ingredientChipTextMissing: { color: '#991B1B' },

  ingOkChip: { backgroundColor: '#DCFCE7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  ingOkText: { fontSize: 12, fontWeight: '800', color: '#166534' },
  ingMissingChip: { backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  ingMissingText: { fontSize: 12, fontWeight: '800', color: '#991B1B' },

  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: Colors.orangeSoft },
  stepNumText: { fontSize: 13, fontWeight: '900', color: Colors.orangeDeep },
  stepText: { fontSize: 14, color: Colors.ink, lineHeight: 22, flex: 1 },

  askBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.forestSoft, borderRadius: 16, padding: 14, marginTop: 16, gap: 10 },
  askBtnQuokka: { width: 40, height: 40 },
  askBtnText: { fontSize: 14, fontWeight: '800', color: Colors.forestDeep },

  // 유튜브
  ytHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 },
  ytHeaderText: { fontSize: 16, fontWeight: '800', color: Colors.ink },
  ytMoreBtn: { backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  ytMoreText: { fontSize: 12, fontWeight: '700', color: Colors.youtube },
  videoCard: { backgroundColor: Colors.white, borderRadius: 18, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm },
  videoCardTop: { flexDirection: 'row' },
  thumb: { width: 110, height: 86, alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' },
  thumbImage: { width: '100%', height: '100%' },
  thumbEmoji: { fontSize: 36 },
  durationBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  durationText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  dateBadge: { backgroundColor: Colors.creamSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  dateText: { fontSize: 11, fontWeight: '600', color: Colors.inkSoft },
  videoActionRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4,
  },
  videoOpenBtn: {
    flex: 1, flexDirection: 'row', gap: 8,
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  videoOpenBtnText: { fontSize: 13, fontWeight: '700', color: Colors.ink },
  ytLogo: {
    width: 24, height: 17, borderRadius: 5,
    backgroundColor: Colors.youtube,
    alignItems: 'center', justifyContent: 'center',
  },
  ytLogoPlay: { color: '#FFF', fontSize: 9, marginLeft: 1 },
  videoAnalyzeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.forest, alignItems: 'center', justifyContent: 'center',
  },
  videoAnalyzeBtnText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  rankBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  rankText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  videoInfo: { flex: 1, padding: 12, justifyContent: 'center' },
  videoTitle: { fontSize: 14, fontWeight: '700', color: Colors.ink, lineHeight: 19, marginBottom: 4 },
  videoChannel: { fontSize: 12, color: Colors.inkMute },
  viewMetaRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  viewBadge: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  viewText: { fontSize: 11, fontWeight: '700', color: Colors.youtube },

  // 쿠팡
  coupangBar: { backgroundColor: Colors.white, borderRadius: 22, padding: 18, marginBottom: 14, marginTop: 8, borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm },
  coupangBarLabel: { fontSize: 15, fontWeight: '800', color: Colors.ink },
  coupangBarSub: { fontSize: 12, color: Colors.inkSoft, marginTop: 2 },
  coupangChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF5F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: '#FFD0D0' },
  coupangChipText: { fontSize: 13, fontWeight: '700', color: Colors.ink },
  coupangChipIcon: { fontSize: 12, color: Colors.coupang, fontWeight: '800' },

  suggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  suggestChip: {
    backgroundColor: Colors.forestSoft, borderRadius: 999,
    borderWidth: 1, borderColor: '#3D8B5E40',
    paddingHorizontal: 12, paddingVertical: 7,
  },
  suggestChipText: { fontSize: 12, fontWeight: '700', color: Colors.forestDeep },

  shareBtn: { backgroundColor: Colors.creamSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginRight: 4 },
  shareBtnText: { fontSize: 12, fontWeight: '700', color: Colors.inkSoft },

  homeBtn: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: Colors.line },
  homeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.inkSoft },

  // 모달
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.line, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  modalQuokka: { width: 52, height: 52 },
  modalHeaderText: { flex: 1 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: Colors.ink },
  modalSub: { fontSize: 12, color: Colors.inkMute, marginTop: 2 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.creamSoft, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 14, color: Colors.inkSoft, fontWeight: '700' },

  answerBox: { backgroundColor: Colors.forestSoft, borderRadius: 18, padding: 16, marginBottom: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  answerLoading: { fontSize: 14, color: Colors.forest, fontWeight: '600' },
  answerText: { fontSize: 14, color: Colors.ink, lineHeight: 22, flex: 1 },

  quickRow: { marginBottom: 12 },
  quickChip: { backgroundColor: Colors.creamDark, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  quickChipText: { fontSize: 13, fontWeight: '700', color: Colors.ink },

  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  modalInput: { flex: 1, backgroundColor: Colors.creamSoft, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: Colors.ink, maxHeight: 100 },
  sendBtn: { backgroundColor: Colors.forest, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12 },
  sendBtnDisabled: { backgroundColor: Colors.line },
  sendBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
