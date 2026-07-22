import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Image, Modal, KeyboardAvoidingView, Platform,
  TextInput, ActivityIndicator, Alert, Share, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { NavProps, SavedRecipe, Folder } from '../types';
import { askQuokka } from '../services/claude';
import { openCoupangPartners, COUPANG_PARTNERS_URL, openYouTubeByName } from '../services/youtube';
import { getMemo, saveMemo, getQAHistory, addQAEntry, deleteQAEntry, QAEntry } from '../services/recipeNotes';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';
import { moveRecipeToFolder, updateRecipe } from '../services/savedRecipes';
import { getFolders, createFolder } from '../services/folders';
import { getFridgeIngredients, matchesFridge } from '../services/fridge';
import { getCookLogsForRecipe, removeCookLog, CookLog } from '../services/cookingLog';
import { BackButton } from '../components/BackButton';
import { LeafToast } from '../components/LeafToast';
import { formatRelativeDate } from '../services/youtube';
import { checkLeafOrAlert } from '../services/leafGate';
import { AdBanner } from '../components/AdBanner';
import { t } from '../i18n';

const DIFF: Record<string, { label: string; color: string; bg: string }> = {
  Easy:   { label: t('savedDetail.diffEasy'),   color: Colors.accent,  bg: Colors.accentLight },
  Medium: { label: t('savedDetail.diffMedium'), color: '#D97706',      bg: Colors.yellowLight },
  Hard:   { label: t('savedDetail.diffHard'),   color: Colors.coral,   bg: Colors.coralLight },
};

const QUICK_QUESTIONS = [
  t('savedDetail.quick1'),
  t('savedDetail.quick2'),
  t('savedDetail.quick3'),
  t('savedDetail.quick4'),
  t('savedDetail.quick5'),
];

function IconEdit() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke={Colors.inkSoft} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"
        stroke={Colors.inkSoft} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconCheck() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L19 7" stroke={Colors.forest} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconTrash() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke={Colors.inkMute} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return t('savedDetail.savedDate', { date: `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}` });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

type Props = NavProps & { recipe: SavedRecipe };

export default function SavedRecipeDetailScreen({ goBack, navigate, recipe: initialRecipe }: Props) {
  const insets = useSafeAreaInsets();
  const [r, setR] = useState(initialRecipe);
  const [memo, setMemo]               = useState('');
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoInput, setMemoInput]     = useState('');
  const [qaHistory, setQaHistory]     = useState<QAEntry[]>([]);
  const [question, setQuestion]       = useState('');
  const [answer, setAnswer]           = useState('');
  const [asking, setAsking]           = useState(false);
  const [askVisible, setAskVisible]             = useState(false);
  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [detailFolders, setDetailFolders]       = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId]   = useState<string | undefined>(r.folderId);
  const [showNewFolderInDetail, setShowNewFolderInDetail] = useState(false);
  const [newFolderNameInDetail, setNewFolderNameInDetail] = useState('');

  const [fridgeItems, setFridgeItems] = useState<string[]>([]);
  const [cookPhotos, setCookPhotos]   = useState<CookLog[]>([]);
  const [photoViewer, setPhotoViewer] = useState<CookLog | null>(null);

  const [editVisible, setEditVisible]         = useState(false);
  const [editName, setEditName]               = useState('');
  const [editDesc, setEditDesc]               = useState('');
  const [editCookTime, setEditCookTime]       = useState('');
  const [editServings, setEditServings]       = useState('');
  const [editDifficulty, setEditDifficulty]   = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [editIngredients, setEditIngredients] = useState<string[]>([]);
  const [editSteps, setEditSteps]             = useState<string[]>([]);

  const diff = DIFF[r.difficulty] ?? DIFF.Medium;

  const loadNotes = useCallback(async () => {
    const [m, qa] = await Promise.all([getMemo(r.id), getQAHistory(r.id)]);
    setMemo(m);
    setQaHistory(qa);
  }, [r.id]);

  useEffect(() => {
    loadNotes();
    getFolders().then(setDetailFolders);
    getFridgeIngredients().then(setFridgeItems);
    getCookLogsForRecipe(r.name).then(setCookPhotos);
  }, [loadNotes, r.name]);

  const hasIngredient = (recipeIng: string) => matchesFridge(fridgeItems, recipeIng);

  const handleSaveMemo = async () => {
    await saveMemo(r.id, memoInput.trim());
    setMemo(memoInput.trim());
    setEditingMemo(false);
    haptic.success();
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    if (!await checkLeafOrAlert('qa')) return;
    haptic.light();
    setAsking(true);
    setAnswer('');
    try {
      const res = await askQuokka(r, question.trim());
      setAnswer(res);
      haptic.success();
      await addQAEntry(r.id, question.trim(), res);
      const updated = await getQAHistory(r.id);
      setQaHistory(updated);
    } catch {
      setAnswer(t('savedDetail.askError'));
      haptic.error();
    } finally {
      setAsking(false);
    }
  };

  const handleShare = async () => {
    haptic.light();
    const diffLabel = diff.label;
    const text = [
      `🍽 ${r.name}`,
      '',
      r.description,
      '',
      `⏱ ${r.cookTime}  |  👥 ${t('savedDetail.servings', { count: r.servings })}  |  ${diffLabel}`,
      '',
      t('savedDetail.shareIngredients'),
      r.ingredients.join(', '),
      '',
      t('savedDetail.shareSteps'),
      ...r.steps.map((s, i) => `${i + 1}. ${s}`),
      '',
      t('savedDetail.shareFooter'),
    ].join('\n');
    try { await Share.share({ message: text }); } catch {}
  };

  const handleDeleteQA = (entryId: string) => {
    haptic.warning();
    Alert.alert(t('savedDetail.deleteQaTitle'), t('savedDetail.deleteQaMsg'), [
      { text: t('savedDetail.cancel'), style: 'cancel' },
      {
        text: t('savedDetail.delete'), style: 'destructive',
        onPress: async () => {
          await deleteQAEntry(r.id, entryId);
          setQaHistory(prev => prev.filter(e => e.id !== entryId));
        },
      },
    ]);
  };

  const handleMoveFolderInDetail = async (folderId: string | null) => {
    haptic.light();
    await moveRecipeToFolder(r.id, folderId);
    setCurrentFolderId(folderId ?? undefined);
    setFolderPickerVisible(false);
    setShowNewFolderInDetail(false);
    setNewFolderNameInDetail('');
  };

  const handleCreateFolderInDetail = async () => {
    const name = newFolderNameInDetail.trim();
    if (!name) return;
    haptic.success();
    const folder = await createFolder(name);
    setDetailFolders(prev => [...prev, folder]);
    await moveRecipeToFolder(r.id, folder.id);
    setCurrentFolderId(folder.id);
    setFolderPickerVisible(false);
    setShowNewFolderInDetail(false);
    setNewFolderNameInDetail('');
  };

  const currentDetailFolder = detailFolders.find(f => f.id === currentFolderId);

  const openEdit = () => {
    setEditName(r.name);
    setEditDesc(r.description);
    setEditCookTime(r.cookTime);
    setEditServings(String(r.servings));
    setEditDifficulty(r.difficulty);
    setEditIngredients([...r.ingredients]);
    setEditSteps([...r.steps]);
    setEditVisible(true);
  };

  const handleSaveEdit = async () => {
    const name = editName.trim();
    if (!name) return;
    haptic.success();
    const updates = {
      name,
      description: editDesc.trim(),
      cookTime: editCookTime.trim() || r.cookTime,
      servings: parseInt(editServings) || r.servings,
      difficulty: editDifficulty,
      ingredients: editIngredients.map(s => s.trim()).filter(Boolean),
      steps: editSteps.map(s => s.trim()).filter(Boolean),
    };
    await updateRecipe(r.id, updates);
    setR(prev => ({ ...prev, ...updates }));
    setEditVisible(false);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 헤더 */}
      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.85]} style={styles.header}>
        <View style={styles.headerNav}>
          <BackButton onPress={goBack} label={t('savedDetail.back')} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.editHeaderBtn} onPress={openEdit}>
              <Text style={styles.editHeaderBtnText}>{t('savedDetail.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Text style={styles.shareBtnText}>{t('savedDetail.share')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.headerTitle} numberOfLines={2}>{r.name}</Text>
        <View style={styles.chipRow}>
          <View style={[styles.diffChip, { backgroundColor: diff.bg }]}>
            <Text style={[styles.diffText, { color: diff.color }]}>{diff.label}</Text>
          </View>
          <View style={styles.metaChip}><Text style={styles.metaChipText}>⏱ {r.cookTime}</Text></View>
          <View style={styles.metaChip}><Text style={styles.metaChipText}>👥 {t('savedDetail.servings', { count: r.servings })}</Text></View>
          <TouchableOpacity style={styles.folderChip} onPress={() => setFolderPickerVisible(true)}>
            <Text style={styles.folderChipText}>
              {currentDetailFolder ? `📁 ${currentDetailFolder.name}` : t('savedDetail.assignFolder')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.savedAtRow}>
          <Text style={styles.savedAt}>{formatDate(r.savedAt)}</Text>
          <Text style={styles.savedAtDivider}>·</Text>
          {r.source === 'youtube' ? (
            <View style={styles.sourceBadgeYt}>
              <Text style={styles.sourceBadgeYtText}>{t('savedDetail.sourceYoutube')}</Text>
            </View>
          ) : r.source === 'manual' ? (
            <View style={styles.sourceBadgeManual}>
              <Text style={styles.sourceBadgeManualText}>{t('savedDetail.sourceManual')}</Text>
            </View>
          ) : (
            <View style={styles.sourceBadgeAi}>
              <Text style={styles.sourceBadgeAiText}>{t('savedDetail.sourceAi')}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* 유튜브 원본 영상 카드 */}
        {r.source === 'youtube' && r.youtubeVideoId && (
          <TouchableOpacity
            style={styles.ytSourceCard}
            onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${r.youtubeVideoId}`)}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri: r.youtubeThumbnail ?? `https://img.youtube.com/vi/${r.youtubeVideoId}/mqdefault.jpg` }}
              style={styles.ytSourceThumb}
            />
            <View style={styles.ytSourceInfo}>
              <Text style={styles.ytSourceBadge}>{t('savedDetail.originalVideo')}</Text>
              <Text style={styles.ytSourceTitle} numberOfLines={2}>
                {r.youtubeTitle ?? t('savedDetail.youtubeVideo')}
              </Text>
              <Text style={styles.ytSourceAction}>{t('savedDetail.watchOnYoutube')}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 설명 */}
        <Text style={styles.desc}>{r.description}</Text>

        {/* 영양정보 */}
        {r.nutrition && (
          <View style={styles.nutritionBox}>
            {[
              { label: t('savedDetail.calories'), val: `${r.nutrition.calories}kcal`, color: '#FF9F7F' },
              { label: t('savedDetail.protein'),  val: `${r.nutrition.protein}g`,     color: '#74C0FC' },
              { label: t('savedDetail.carbs'),    val: `${r.nutrition.carbs}g`,       color: '#FFD166' },
              { label: t('savedDetail.fat'),      val: `${r.nutrition.fat}g`,         color: '#C77DFF' },
            ].map(n => (
              <View key={n.label} style={styles.nutritionItem}>
                <Text style={[styles.nutritionVal, { color: n.color }]}>{n.val}</Text>
                <Text style={styles.nutritionLabel}>{n.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 재료 */}
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionHead}>{t('savedDetail.ingredientsHead')}</Text>
          {fridgeItems.length > 0 && (() => {
            const missing = r.ingredients.filter(i => !hasIngredient(i)).length;
            return missing > 0
              ? <Text style={styles.ingredientMissingBadge}>{t('savedDetail.missingBadge', { count: missing })}</Text>
              : <Text style={styles.ingredientOkBadge}>{t('savedDetail.allHaveBadge')}</Text>;
          })()}
        </View>
        <View style={styles.ingredientGrid}>
          {r.ingredients.map((ing, n) => {
            const have = fridgeItems.length > 0 && hasIngredient(ing);
            const checked = fridgeItems.length > 0;
            return (
              <View key={n} style={[
                styles.ingredientChip,
                checked && have  && styles.ingredientChipHave,
                checked && !have && styles.ingredientChipMissing,
              ]}>
                {checked && (
                  <Text style={have ? styles.ingredientDotHave : styles.ingredientDotMissing}>
                    {have ? '✓' : '✗'}
                  </Text>
                )}
                <Text style={[
                  styles.ingredientChipText,
                  checked && have  && styles.ingredientChipTextHave,
                  checked && !have && styles.ingredientChipTextMissing,
                ]}>{ing}</Text>
              </View>
            );
          })}
        </View>

        {/* 재료 밑 쿠팡 CTA (소프트 배너) + 대가성 문구 */}
        {!!COUPANG_PARTNERS_URL && (
          <View style={styles.coupangInline}>
            <TouchableOpacity onPress={openCoupangPartners} activeOpacity={0.8} style={styles.coupangBanner}>
              <Text style={styles.coupangBannerText}>{t('savedDetail.coupangInlineLabel')}</Text>
              <Text style={styles.coupangBannerArrow}>→</Text>
            </TouchableOpacity>
            <Text style={styles.coupangInlineDisclosure}>{t('savedDetail.coupangDisclosure')}</Text>
          </View>
        )}

        {/* 만드는 법 */}
        <Text style={[styles.sectionHead, { marginTop: 20, marginBottom: 12 }]}>{t('savedDetail.stepsHead')}</Text>
        {r.steps.map((s, n) => (
          <View key={n} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{n + 1}</Text>
            </View>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}

        {/* ── 단계별 조리 모드 ── */}
        <TouchableOpacity
          style={styles.cookStartBtn}
          onPress={() => navigate({ name: 'CookMode', recipeName: r.name, steps: r.steps })}
          activeOpacity={0.85}
        >
          <Text style={styles.cookStartText} numberOfLines={1}>{t('cookMode.start')}</Text>
        </TouchableOpacity>

        {/* ── 내가 만든 요리 (완성 사진) ── */}
        {cookPhotos.length > 0 && (
          <>
            <Text style={[styles.sectionHead, { marginTop: 20 }]}>{t('cookLog.savedDetailTitle')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cookPhotoRow}>
              {cookPhotos.map(p => (
                <TouchableOpacity key={p.id} activeOpacity={0.85} onPress={() => { haptic.light(); setPhotoViewer(p); }}>
                  <Image source={{ uri: p.photoUri }} style={styles.cookPhotoThumb} resizeMode="cover" />
                  <Text style={styles.cookPhotoDate}>{formatRelativeDate(p.cookedAt)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── 메모 카드 ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('savedDetail.myMemo')}</Text>
            {!editingMemo && (
              <TouchableOpacity style={styles.editBtn} onPress={() => { setMemoInput(memo); setEditingMemo(true); }}>
                <IconEdit />
                <Text style={styles.editBtnText}>{memo ? t('savedDetail.edit') : t('savedDetail.add')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingMemo ? (
            <>
              <TextInput
                style={styles.memoInput}
                value={memoInput}
                onChangeText={setMemoInput}
                placeholder={t('savedDetail.memoPlaceholder')}
                placeholderTextColor={Colors.inkMute}
                multiline
                autoFocus
              />
              <View style={styles.memoActions}>
                <TouchableOpacity style={styles.memoCancelBtn} onPress={() => setEditingMemo(false)}>
                  <Text style={styles.memoCancelText}>{t('savedDetail.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.memoSaveBtn} onPress={handleSaveMemo}>
                  <Text style={styles.memoSaveText}>{t('savedDetail.save')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : memo ? (
            <Text style={styles.memoText}>{memo}</Text>
          ) : (
            <TouchableOpacity onPress={() => { setMemoInput(''); setEditingMemo(true); }}>
              <Text style={styles.memoEmpty}>{t('savedDetail.memoEmpty')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 쿼카 카드 (질문하기 + 기록) ── */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.quokkaRow}
            onPress={() => { setAskVisible(true); setQuestion(''); setAnswer(''); }}
            activeOpacity={0.82}
          >
            <Image source={require('../../assets/quokka_question_mini.png')} style={styles.askQuokka} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('savedDetail.askQuokkaTitle')}</Text>
              <Text style={styles.cardSub}>{t('savedDetail.askQuokkaSub')}</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          <Text style={styles.cardSectionLabel}>{t('savedDetail.qaHistoryLabel')}</Text>
          {qaHistory.length === 0 ? (
            <Text style={styles.qaEmpty}>{t('savedDetail.qaEmpty')}</Text>
          ) : (
            qaHistory.map(entry => (
              <View key={entry.id} style={styles.qaEntry}>
                <View style={styles.qaEntryHeader}>
                  <Text style={styles.qaTime}>{formatTime(entry.askedAt)}</Text>
                  <TouchableOpacity onPress={() => handleDeleteQA(entry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <IconTrash />
                  </TouchableOpacity>
                </View>
                <View style={styles.qaQ}>
                  <Text style={styles.qaQLabel}>Q</Text>
                  <Text style={styles.qaQText}>{entry.question}</Text>
                </View>
                <View style={styles.qaA}>
                  <Text style={styles.qaALabel}>A</Text>
                  <Text style={styles.qaAText}>{entry.answer}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── 외부 링크 카드 (유튜브) ── */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.linkRow} onPress={() => openYouTubeByName(r.name)} activeOpacity={0.82}>
            <Text style={styles.linkEmoji}>📺</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>{t('savedDetail.youtubeLinkTitle')}</Text>
              <Text style={styles.linkSub}>{t('savedDetail.youtubeLinkSub')}</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <AdBanner />
      </ScrollView>

      {/* ── 완성 사진 뷰어 ── */}
      <Modal visible={!!photoViewer} transparent animationType="fade" onRequestClose={() => setPhotoViewer(null)}>
        <View style={styles.photoViewerOverlay}>
          {photoViewer && (
            <>
              <Image source={{ uri: photoViewer.photoUri }} style={styles.photoViewerImg} resizeMode="contain" />
              <Text style={styles.photoViewerName}>{r.name}</Text>
              <Text style={styles.photoViewerDate}>{formatRelativeDate(photoViewer.cookedAt)}</Text>
              <View style={styles.photoViewerBtns}>
                <TouchableOpacity
                  style={styles.photoViewerDelete}
                  activeOpacity={0.85}
                  onPress={() => {
                    const target = photoViewer;
                    Alert.alert(t('cookLog.deleteTitle'), t('cookLog.deleteMsg'), [
                      { text: t('cookLog.cancel'), style: 'cancel' },
                      {
                        text: t('cookLog.delete'), style: 'destructive',
                        onPress: async () => {
                          await removeCookLog(target.id);
                          setPhotoViewer(null);
                          haptic.success();
                          setCookPhotos(await getCookLogsForRecipe(r.name));
                        },
                      },
                    ]);
                  }}
                >
                  <Text style={styles.photoViewerDeleteText}>{t('cookLog.delete')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoViewerClose} activeOpacity={0.85} onPress={() => setPhotoViewer(null)}>
                  <Text style={styles.photoViewerCloseText}>{t('cookLog.close')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* ── 쿼카 질문 모달 ── */}
      <Modal visible={askVisible} animationType="slide" transparent onRequestClose={() => setAskVisible(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Image source={require('../../assets/quokka.png')} style={styles.modalQuokka} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{t('savedDetail.modalAskTitle')}</Text>
                <Text style={styles.modalSub} numberOfLines={1}>{r.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setAskVisible(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {asking && (
              <View style={styles.answerBox}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.answerLoading}>{t('savedDetail.thinking')}</Text>
              </View>
            )}
            {!!answer && !asking && (
              <View style={styles.answerBox}>
                <Text style={styles.answerText}>{answer}</Text>
                <Text style={styles.answerSaved}>{t('savedDetail.answerSaved')}</Text>
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
              {QUICK_QUESTIONS.map(q => (
                <TouchableOpacity key={q} style={styles.quickChip} onPress={() => setQuestion(q)}>
                  <Text style={styles.quickChipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.modalInput}
                value={question}
                onChangeText={setQuestion}
                placeholder={t('savedDetail.questionPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!question.trim() || asking) && styles.sendBtnDisabled]}
                onPress={handleAsk}
                disabled={!question.trim() || asking}
              >
                <Text style={styles.sendBtnText}>{t('savedDetail.send')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        <LeafToast anchor="top" />
      </Modal>

      {/* ── 레시피 수정 모달 ── */}
      <Modal visible={editVisible} animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.editRoot}>
          <View style={styles.editNavBar}>
            <View style={[styles.editNavSide, { alignItems: 'flex-start' }]}>
              <TouchableOpacity
                style={styles.editNavCancel}
                onPress={() => setEditVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.editNavCancelText}>{t('savedDetail.cancel')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.editNavTitle}>{t('savedDetail.editRecipeTitle')}</Text>
            <View style={[styles.editNavSide, { alignItems: 'flex-end' }]}>
              <TouchableOpacity onPress={handleSaveEdit} style={styles.editNavSave}>
                <Text style={styles.editNavSaveText}>{t('savedDetail.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.editContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* 기본 정보 */}
              <Text style={styles.editSectionLabel}>{t('savedDetail.basicInfo')}</Text>
              <View style={styles.editCard}>
                <Text style={styles.editFieldLabel}>{t('savedDetail.dishName')}</Text>
                <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholder={t('savedDetail.dishName')} placeholderTextColor={Colors.inkMute} />
                <View style={styles.editDivider} />
                <Text style={styles.editFieldLabel}>{t('savedDetail.descLabel')}</Text>
                <TextInput style={[styles.editInput, styles.editInputMulti]} value={editDesc} onChangeText={setEditDesc} placeholder={t('savedDetail.descPlaceholder')} placeholderTextColor={Colors.inkMute} multiline />
              </View>

              {/* 조리 정보 */}
              <Text style={styles.editSectionLabel}>{t('savedDetail.cookInfo')}</Text>
              <View style={styles.editCard}>
                <View style={styles.editRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editFieldLabel}>{t('savedDetail.cookTimeLabel')}</Text>
                    <TextInput style={styles.editInput} value={editCookTime} onChangeText={setEditCookTime} placeholder={t('savedDetail.cookTimePlaceholder')} placeholderTextColor={Colors.inkMute} />
                  </View>
                  <View style={styles.editRowDivider} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editFieldLabel}>{t('savedDetail.servingsLabel')}</Text>
                    <TextInput style={styles.editInput} value={editServings} onChangeText={setEditServings} placeholder="2" placeholderTextColor={Colors.inkMute} keyboardType="number-pad" />
                  </View>
                </View>
                <View style={styles.editDivider} />
                <Text style={styles.editFieldLabel}>{t('savedDetail.difficultyLabel')}</Text>
                <View style={styles.diffRow}>
                  {(['Easy', 'Medium', 'Hard'] as const).map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.diffPill, editDifficulty === d && styles.diffPillActive]}
                      onPress={() => setEditDifficulty(d)}
                    >
                      <Text style={[styles.diffPillText, editDifficulty === d && styles.diffPillTextActive]}>
                        {DIFF[d].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 재료 */}
              <Text style={styles.editSectionLabel}>{t('savedDetail.ingredientsSection')}</Text>
              <View style={styles.editCard}>
                {editIngredients.map((ing, i) => (
                  <View key={i} style={styles.editListRow}>
                    <TextInput
                      style={[styles.editInput, { flex: 1 }]}
                      value={ing}
                      onChangeText={v => setEditIngredients(prev => prev.map((x, j) => j === i ? v : x))}
                      placeholder={t('savedDetail.ingredientPlaceholder', { num: i + 1 })}
                      placeholderTextColor={Colors.inkMute}
                    />
                    <TouchableOpacity
                      style={styles.editListRemove}
                      onPress={() => setEditIngredients(prev => prev.filter((_, j) => j !== i))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.editListRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.editAddBtn} onPress={() => setEditIngredients(prev => [...prev, ''])}>
                  <Text style={styles.editAddBtnText}>{t('savedDetail.addIngredient')}</Text>
                </TouchableOpacity>
              </View>

              {/* 만드는 법 */}
              <Text style={styles.editSectionLabel}>{t('savedDetail.stepsSection')}</Text>
              <View style={styles.editCard}>
                {editSteps.map((step, i) => (
                  <View key={i} style={styles.editListRow}>
                    <View style={styles.editStepNum}>
                      <Text style={styles.editStepNumText}>{i + 1}</Text>
                    </View>
                    <TextInput
                      style={[styles.editInput, { flex: 1 }]}
                      value={step}
                      onChangeText={v => setEditSteps(prev => prev.map((x, j) => j === i ? v : x))}
                      placeholder={t('savedDetail.stepPlaceholder', { num: i + 1 })}
                      placeholderTextColor={Colors.inkMute}
                      multiline
                    />
                    <TouchableOpacity
                      style={styles.editListRemove}
                      onPress={() => setEditSteps(prev => prev.filter((_, j) => j !== i))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.editListRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.editAddBtn} onPress={() => setEditSteps(prev => [...prev, ''])}>
                  <Text style={styles.editAddBtnText}>{t('savedDetail.addStep')}</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 폴더 이동 모달 */}
      <Modal visible={folderPickerVisible} transparent animationType="slide" onRequestClose={() => setFolderPickerVisible(false)}>
        <TouchableOpacity style={styles.fpOverlay} activeOpacity={1} onPress={() => setFolderPickerVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[styles.fpSheet, { paddingBottom: insets.bottom }]}>
                <View style={styles.fpHandle} />
                <Text style={styles.fpTitle}>{t('savedDetail.moveFolder')}</Text>
                <Text style={styles.fpSub} numberOfLines={1}>{r.name}</Text>

                <TouchableOpacity
                  style={[styles.fpOption, !currentFolderId && styles.fpOptionActive]}
                  onPress={() => handleMoveFolderInDetail(null)}
                >
                  <Text style={styles.fpOptionIcon}>📂</Text>
                  <Text style={[styles.fpOptionText, !currentFolderId && styles.fpOptionTextActive]}>{t('savedDetail.noFolder')}</Text>
                  {!currentFolderId && <IconCheck />}
                </TouchableOpacity>

                {detailFolders.map(folder => (
                  <TouchableOpacity
                    key={folder.id}
                    style={[styles.fpOption, currentFolderId === folder.id && styles.fpOptionActive]}
                    onPress={() => handleMoveFolderInDetail(folder.id)}
                  >
                    <Text style={styles.fpOptionIcon}>📁</Text>
                    <Text style={[styles.fpOptionText, currentFolderId === folder.id && styles.fpOptionTextActive]}>
                      {folder.name}
                    </Text>
                    {currentFolderId === folder.id && <IconCheck />}
                  </TouchableOpacity>
                ))}

                {showNewFolderInDetail ? (
                  <View style={styles.fpNewRow}>
                    <TextInput
                      style={styles.fpNewInput}
                      value={newFolderNameInDetail}
                      onChangeText={setNewFolderNameInDetail}
                      placeholder={t('savedDetail.newFolderPlaceholder')}
                      placeholderTextColor={Colors.inkMute}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleCreateFolderInDetail}
                    />
                    <TouchableOpacity
                      style={[styles.fpNewBtn, !newFolderNameInDetail.trim() && styles.fpNewBtnDisabled]}
                      onPress={handleCreateFolderInDetail}
                    >
                      <Text style={styles.fpNewBtnText}>{t('savedDetail.create')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fpOptionAdd} onPress={() => setShowNewFolderInDetail(true)}>
                    <Text style={styles.fpOptionAddText}>{t('savedDetail.createNewFolder')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  header: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 18 },
  headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  shareBtn: {
    backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtnText: { fontSize: 12, fontWeight: '700', color: Colors.inkSoft, lineHeight: 16 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: Colors.ink, letterSpacing: -0.6, marginBottom: 12 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  diffChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  diffText: { fontSize: 12, fontWeight: '800' },
  metaChip: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  metaChipText: { fontSize: 12, color: Colors.inkSoft, fontWeight: '600' },
  savedAtRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  savedAt: { fontSize: 11, color: Colors.inkMute, fontWeight: '500' },
  savedAtDivider: { fontSize: 11, color: Colors.inkMute },
  sourceBadgeYt: {
    backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  sourceBadgeYtText: { fontSize: 10, fontWeight: '700', color: '#CC0000' },
  sourceBadgeAi: {
    backgroundColor: 'rgba(61,139,94,0.12)', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  sourceBadgeAiText: { fontSize: 10, fontWeight: '700', color: Colors.forestDeep },
  sourceBadgeManual: {
    backgroundColor: 'rgba(224,123,43,0.12)', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  sourceBadgeManualText: { fontSize: 10, fontWeight: '700', color: Colors.orangeDeep },

  ytSourceCard: {
    flexDirection: 'row', backgroundColor: Colors.white,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
    marginBottom: 16,
  },
  ytSourceThumb: { width: 110, height: 80 },
  ytSourceInfo: { flex: 1, padding: 10, justifyContent: 'space-between' },
  ytSourceBadge: { fontSize: 9, fontWeight: '800', color: '#CC0000', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  ytSourceTitle: { fontSize: 12, fontWeight: '700', color: Colors.ink, lineHeight: 16, flex: 1 },
  ytSourceAction: { fontSize: 11, fontWeight: '700', color: Colors.inkMute, marginTop: 4 },

  content: { padding: 22, paddingBottom: 60 },

  desc: { fontSize: 14, color: Colors.inkSoft, lineHeight: 21, marginBottom: 16 },

  nutritionBox: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: 18, padding: 16,
    marginBottom: 20, ...shadow.sm,
  },
  nutritionItem: { alignItems: 'center', flex: 1 },
  nutritionVal: { fontSize: 15, fontWeight: '900', marginBottom: 3 },
  nutritionLabel: { fontSize: 11, color: Colors.inkSoft, fontWeight: '600' },

  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionHead: { fontSize: 14, fontWeight: '800', color: Colors.ink },
  ingredientMissingBadge: { fontSize: 11, fontWeight: '700', color: '#C0392B', backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ingredientOkBadge: { fontSize: 11, fontWeight: '700', color: Colors.forestDeep, backgroundColor: Colors.forestSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  ingredientChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.white, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.line,
  },
  ingredientChipHave: { backgroundColor: Colors.forestSoft, borderColor: Colors.forest },
  ingredientChipMissing: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  ingredientDotHave: { fontSize: 11, fontWeight: '900', color: Colors.forest },
  ingredientDotMissing: { fontSize: 11, fontWeight: '900', color: '#EF4444' },
  ingredientChipText: { fontSize: 13, fontWeight: '600', color: Colors.inkSoft },
  ingredientChipTextHave: { color: Colors.forestDeep },
  ingredientChipTextMissing: { color: '#B91C1C' },

  cookStartBtn: { backgroundColor: Colors.forest, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20, ...shadow.sm },
  cookStartText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  cookPhotoRow: { gap: 10, paddingVertical: 10, paddingRight: 8 },
  cookPhotoThumb: { width: 120, height: 120, borderRadius: 14, backgroundColor: Colors.creamDark, ...shadow.sm },
  cookPhotoDate: { fontSize: 11, fontWeight: '600', color: Colors.inkMute, marginTop: 5, textAlign: 'center' },
  photoViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  photoViewerImg: { width: '100%', height: '60%', borderRadius: 20 },
  photoViewerName: { fontSize: 18, fontWeight: '900', color: '#fff', marginTop: 20 },
  photoViewerDate: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  photoViewerBtns: { flexDirection: 'row', gap: 12, marginTop: 28 },
  photoViewerDelete: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  photoViewerDeleteText: { fontSize: 15, fontWeight: '800', color: '#FF8A80' },
  photoViewerClose: { paddingHorizontal: 32, paddingVertical: 13, borderRadius: 14, backgroundColor: '#fff' },
  photoViewerCloseText: { fontSize: 15, fontWeight: '800', color: Colors.ink },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  stepNum: {
    width: 26, height: 26, borderRadius: 13, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.orangeSoft,
  },
  stepNumText: { fontSize: 13, fontWeight: '900', color: Colors.orangeDeep },
  stepText: { fontSize: 14, color: Colors.ink, lineHeight: 22, flex: 1 },

  // 공통 카드
  card: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 18,
    marginTop: 16, borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.ink },
  cardSub: { fontSize: 12, color: Colors.inkSoft, marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: Colors.line, opacity: 0.6, marginVertical: 14 },
  cardSectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.inkMute, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  rowArrow: { fontSize: 22, color: Colors.inkMute, fontWeight: '300', lineHeight: 26 },

  // 메모
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: Colors.inkSoft },
  memoText: { fontSize: 14, color: Colors.ink, lineHeight: 21 },
  memoEmpty: { fontSize: 13, color: Colors.inkMute, fontStyle: 'italic' },
  memoInput: {
    backgroundColor: Colors.cream, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.line, padding: 14, fontSize: 14, color: Colors.ink,
    lineHeight: 21, minHeight: 90, textAlignVertical: 'top',
  },
  memoActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 10 },
  memoCancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.line },
  memoCancelText: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft },
  memoSaveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.forest },
  memoSaveText: { fontSize: 13, fontWeight: '800', color: '#FFF' },

  // 쿼카 질문 행
  quokkaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  askQuokka: { width: 42, height: 42 },

  // 질문 기록
  qaEmpty: { fontSize: 13, color: Colors.inkMute, fontStyle: 'italic' },
  qaEntry: { borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: 14, marginTop: 14 },
  qaEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  qaTime: { fontSize: 11, color: Colors.inkMute, fontWeight: '500' },
  qaQ: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  qaQLabel: { fontSize: 12, fontWeight: '900', color: Colors.orangeDeep, width: 16, paddingTop: 1 },
  qaQText: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.ink, lineHeight: 19 },
  qaA: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  qaALabel: { fontSize: 12, fontWeight: '900', color: Colors.forest, width: 16, paddingTop: 1 },
  qaAText: { flex: 1, fontSize: 13, color: Colors.inkSoft, lineHeight: 19 },

  // 외부 링크 행
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkEmoji: { fontSize: 26, width: 34, textAlign: 'center' },
  linkTitle: { fontSize: 14, fontWeight: '700', color: Colors.ink },
  linkSub: { fontSize: 12, color: Colors.inkSoft, marginTop: 2 },

  // 쿠팡 칩
  coupangInline: { marginTop: 12, marginBottom: 4 },
  coupangBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.creamSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  coupangBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.ink },
  coupangBannerArrow: { fontSize: 14, fontWeight: '800', color: Colors.orangeDeep },
  coupangInlineDisclosure: { fontSize: 10, color: Colors.inkMute, marginTop: 6, lineHeight: 14 },

  // 모달
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  modalQuokka: { width: 52, height: 52 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: Colors.primary },
  modalSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F7F5F2', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 14, color: Colors.textMid, fontWeight: '700' },
  answerBox: { backgroundColor: Colors.cardGreen, borderRadius: 18, padding: 16, marginBottom: 14 },
  answerLoading: { fontSize: 14, color: Colors.primaryMid, fontWeight: '600' },
  answerText: { fontSize: 14, color: Colors.text, lineHeight: 22, marginBottom: 6 },
  answerSaved: { fontSize: 12, color: Colors.accent, fontWeight: '700' },
  quickRow: { marginBottom: 12 },
  quickChip: { backgroundColor: Colors.accentLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  quickChipText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  modalInput: { flex: 1, backgroundColor: '#F7F5F2', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: Colors.text, maxHeight: 100 },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12 },
  sendBtnDisabled: { backgroundColor: Colors.border },
  sendBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  folderChip: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(61,139,94,0.3)',
  },
  folderChipText: { fontSize: 11, fontWeight: '700', color: Colors.forestDeep },

  editHeaderBtn: {
    backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  editHeaderBtnText: { fontSize: 12, fontWeight: '700', color: Colors.forestDeep, lineHeight: 16 },

  editRoot: { flex: 1, backgroundColor: Colors.cream },
  editNavBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 18, paddingBottom: 14,
    backgroundColor: Colors.cream, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  editNavSide: { width: 72, justifyContent: 'center' },
  editNavCancel: {
    width: 60, height: 34,
    borderWidth: 1.5, borderColor: Colors.line, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  editNavCancelText: { fontSize: 14, fontWeight: '800', color: Colors.inkSoft },
  editNavTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.ink, textAlign: 'center' },
  editNavSave: {
    width: 60, height: 34,
    backgroundColor: Colors.forest, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  editNavSaveText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  editContent: { padding: 20, paddingBottom: 60, gap: 8 },
  editSectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.inkMute, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 8, marginBottom: 6, paddingHorizontal: 2 },
  editCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm },
  editFieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.inkMute, marginBottom: 6 },
  editInput: {
    fontSize: 14, color: Colors.ink, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  editInputMulti: { minHeight: 60, textAlignVertical: 'top', lineHeight: 20 },
  editDivider: { height: 1, backgroundColor: Colors.line, opacity: 0.5, marginVertical: 14 },
  editRow: { flexDirection: 'row', gap: 12 },
  editRowDivider: { width: 1, backgroundColor: Colors.line, opacity: 0.5, marginHorizontal: 4 },

  diffRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  diffPill: {
    flex: 1, paddingVertical: 8, borderRadius: 12,
    backgroundColor: Colors.creamSoft, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center',
  },
  diffPillActive: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  diffPillText: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft },
  diffPillTextActive: { color: '#fff' },

  editListRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  editListRemove: { padding: 4 },
  editListRemoveText: { fontSize: 22, color: Colors.inkMute, lineHeight: 24 },
  editStepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.orangeSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  editStepNumText: { fontSize: 12, fontWeight: '900', color: Colors.orangeDeep },
  editAddBtn: { paddingVertical: 10, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.inkMute, marginTop: 4 },
  editAddBtnText: { fontSize: 13, fontWeight: '700', color: Colors.inkMute },

  fpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  fpSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  fpHandle: { width: 40, height: 4, backgroundColor: Colors.line, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  fpTitle: { fontSize: 17, fontWeight: '800', color: Colors.ink, marginBottom: 4 },
  fpSub: { fontSize: 13, color: Colors.inkSoft, marginBottom: 16 },
  fpOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 12, borderRadius: 14, marginBottom: 4,
  },
  fpOptionActive: { backgroundColor: Colors.forestSoft },
  fpOptionIcon: { fontSize: 18 },
  fpOptionText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.ink },
  fpOptionTextActive: { color: Colors.forestDeep },
  fpOptionAdd: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12 },
  fpOptionAddText: { fontSize: 15, fontWeight: '700', color: Colors.forest },
  fpNewRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  fpNewInput: {
    flex: 1, height: 44, backgroundColor: Colors.creamSoft,
    borderRadius: 12, paddingHorizontal: 12, fontSize: 14, color: Colors.ink,
    borderWidth: 1, borderColor: Colors.line,
  },
  fpNewBtn: {
    height: 44, backgroundColor: Colors.forest, borderRadius: 12,
    paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
  },
  fpNewBtnDisabled: { backgroundColor: Colors.inkMute },
  fpNewBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
