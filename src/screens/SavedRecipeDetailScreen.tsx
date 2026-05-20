import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Image, Modal, KeyboardAvoidingView, Platform,
  TextInput, ActivityIndicator, Alert, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { NavProps, SavedRecipe, Folder } from '../types';
import { askQuokka } from '../services/claude';
import { openCoupang, openYouTubeByName } from '../services/youtube';
import { getMemo, saveMemo, getQAHistory, addQAEntry, deleteQAEntry, QAEntry } from '../services/recipeNotes';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';
import { moveRecipeToFolder } from '../services/savedRecipes';
import { getFolders, createFolder } from '../services/folders';

const DIFF: Record<string, { label: string; color: string; bg: string }> = {
  Easy:   { label: '쉬워요',    color: Colors.accent,  bg: Colors.accentLight },
  Medium: { label: '보통이에요', color: '#D97706',      bg: Colors.yellowLight },
  Hard:   { label: '어려워요',  color: Colors.coral,   bg: Colors.coralLight },
};

const QUICK_QUESTIONS = [
  '더 쉽게 만들 수 있어?',
  '칼로리 낮추려면?',
  '이 재료 대신 뭐 써도 돼?',
  '보관은 어떻게 해?',
  '맛있게 하는 팁 있어?',
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
  return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')} 저장`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

type Props = NavProps & { recipe: SavedRecipe };

export default function SavedRecipeDetailScreen({ goBack, navigate, recipe: r }: Props) {
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

  const diff = DIFF[r.difficulty] ?? DIFF.Medium;

  const loadNotes = useCallback(async () => {
    const [m, qa] = await Promise.all([getMemo(r.id), getQAHistory(r.id)]);
    setMemo(m);
    setQaHistory(qa);
  }, [r.id]);

  useEffect(() => {
    loadNotes();
    getFolders().then(setDetailFolders);
  }, [loadNotes]);

  const handleSaveMemo = async () => {
    await saveMemo(r.id, memoInput.trim());
    setMemo(memoInput.trim());
    setEditingMemo(false);
    haptic.success();
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
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
      setAnswer('앗, 오류가 생겼어요. 다시 시도해주세요 🙏');
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

  const handleDeleteQA = (entryId: string) => {
    haptic.warning();
    Alert.alert('삭제할까요?', '이 질문 기록을 삭제해요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
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

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 헤더 */}
      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.85]} style={styles.header}>
        <View style={styles.headerNav}>
          <TouchableOpacity onPress={goBack}>
            <Text style={styles.backBtnText}>← 돌아가기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>공유 ↗</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle} numberOfLines={2}>{r.name}</Text>
        <View style={styles.chipRow}>
          <View style={[styles.diffChip, { backgroundColor: diff.bg }]}>
            <Text style={[styles.diffText, { color: diff.color }]}>{diff.label}</Text>
          </View>
          <View style={styles.metaChip}><Text style={styles.metaChipText}>⏱ {r.cookTime}</Text></View>
          <View style={styles.metaChip}><Text style={styles.metaChipText}>👥 {r.servings}인분</Text></View>
          <TouchableOpacity style={styles.folderChip} onPress={() => setFolderPickerVisible(true)}>
            <Text style={styles.folderChipText}>
              {currentDetailFolder ? `📁 ${currentDetailFolder.name}` : '📂 폴더 지정'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.savedAt}>{formatDate(r.savedAt)}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* 설명 */}
        <Text style={styles.desc}>{r.description}</Text>

        {/* 영양정보 */}
        {r.nutrition && (
          <View style={styles.nutritionBox}>
            {[
              { label: '칼로리',   val: `${r.nutrition.calories}kcal`, color: '#FF9F7F' },
              { label: '단백질',   val: `${r.nutrition.protein}g`,     color: '#74C0FC' },
              { label: '탄수화물', val: `${r.nutrition.carbs}g`,       color: '#FFD166' },
              { label: '지방',     val: `${r.nutrition.fat}g`,         color: '#C77DFF' },
            ].map(n => (
              <View key={n.label} style={styles.nutritionItem}>
                <Text style={[styles.nutritionVal, { color: n.color }]}>{n.val}</Text>
                <Text style={styles.nutritionLabel}>{n.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 재료 */}
        <Text style={styles.sectionHead}>🧂 재료</Text>
        <View style={styles.ingredientGrid}>
          {r.ingredients.map((ing, n) => (
            <View key={n} style={styles.ingredientChip}>
              <Text style={styles.ingredientChipText}>{ing}</Text>
            </View>
          ))}
        </View>

        {/* 만드는 법 */}
        <Text style={[styles.sectionHead, { marginTop: 20 }]}>👨‍🍳 만드는 법</Text>
        {r.steps.map((s, n) => (
          <View key={n} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{n + 1}</Text>
            </View>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}

        {/* ── 메모 카드 ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📝 내 메모</Text>
            {!editingMemo && (
              <TouchableOpacity style={styles.editBtn} onPress={() => { setMemoInput(memo); setEditingMemo(true); }}>
                <IconEdit />
                <Text style={styles.editBtnText}>{memo ? '수정' : '추가'}</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingMemo ? (
            <>
              <TextInput
                style={styles.memoInput}
                value={memoInput}
                onChangeText={setMemoInput}
                placeholder="레시피에 대한 메모를 남겨보세요..."
                placeholderTextColor={Colors.inkMute}
                multiline
                autoFocus
              />
              <View style={styles.memoActions}>
                <TouchableOpacity style={styles.memoCancelBtn} onPress={() => setEditingMemo(false)}>
                  <Text style={styles.memoCancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.memoSaveBtn} onPress={handleSaveMemo}>
                  <Text style={styles.memoSaveText}>저장</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : memo ? (
            <Text style={styles.memoText}>{memo}</Text>
          ) : (
            <TouchableOpacity onPress={() => { setMemoInput(''); setEditingMemo(true); }}>
              <Text style={styles.memoEmpty}>+ 메모를 추가해보세요</Text>
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
              <Text style={styles.cardTitle}>쿼카에게 질문하기</Text>
              <Text style={styles.cardSub}>레시피에 대해 뭐든 물어보세요 🐾</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          <Text style={styles.cardSectionLabel}>질문 기록</Text>
          {qaHistory.length === 0 ? (
            <Text style={styles.qaEmpty}>아직 질문 기록이 없어요</Text>
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

        {/* ── 외부 링크 카드 (유튜브 + 쿠팡) ── */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.linkRow} onPress={() => openYouTubeByName(r.name)} activeOpacity={0.82}>
            <Text style={styles.linkEmoji}>📺</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>유튜브에서 레시피 보기</Text>
              <Text style={styles.linkSub}>영상으로 더 쉽게 따라해보세요</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.cardDivider} />

          <View style={styles.linkRowStatic}>
            <Text style={styles.linkEmoji}>🛒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>재료 바로 구매</Text>
              <Text style={styles.linkSub}>쿠팡에서 필요한 재료를 주문해요</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 2 }}>
              {r.ingredients.map(ing => (
                <TouchableOpacity key={ing} style={styles.coupangChip} onPress={() => openCoupang(ing)}>
                  <Text style={styles.coupangChipText}>{ing.split(' ')[0]}</Text>
                  <Text style={styles.coupangArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

      </ScrollView>

      {/* ── 쿼카 질문 모달 ── */}
      <Modal visible={askVisible} animationType="slide" transparent onRequestClose={() => setAskVisible(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Image source={require('../../assets/quokka.png')} style={styles.modalQuokka} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>쿼카에게 물어보기</Text>
                <Text style={styles.modalSub} numberOfLines={1}>{r.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setAskVisible(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {asking && (
              <View style={styles.answerBox}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.answerLoading}>쿼카가 생각하는 중... 🐾</Text>
              </View>
            )}
            {!!answer && !asking && (
              <View style={styles.answerBox}>
                <Text style={styles.answerText}>{answer}</Text>
                <Text style={styles.answerSaved}>✓ 기록에 저장됐어요</Text>
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

      {/* 폴더 이동 모달 */}
      <Modal visible={folderPickerVisible} transparent animationType="slide" onRequestClose={() => setFolderPickerVisible(false)}>
        <TouchableOpacity style={styles.fpOverlay} activeOpacity={1} onPress={() => setFolderPickerVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={styles.fpSheet}>
                <View style={styles.fpHandle} />
                <Text style={styles.fpTitle}>폴더 이동</Text>
                <Text style={styles.fpSub} numberOfLines={1}>{r.name}</Text>

                <TouchableOpacity
                  style={[styles.fpOption, !currentFolderId && styles.fpOptionActive]}
                  onPress={() => handleMoveFolderInDetail(null)}
                >
                  <Text style={styles.fpOptionIcon}>📂</Text>
                  <Text style={[styles.fpOptionText, !currentFolderId && styles.fpOptionTextActive]}>분류 없음</Text>
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
                      placeholder="새 폴더 이름"
                      placeholderTextColor={Colors.inkMute}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleCreateFolderInDetail}
                    />
                    <TouchableOpacity
                      style={[styles.fpNewBtn, !newFolderNameInDetail.trim() && styles.fpNewBtnDisabled]}
                      onPress={handleCreateFolderInDetail}
                    >
                      <Text style={styles.fpNewBtnText}>만들기</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.fpOptionAdd} onPress={() => setShowNewFolderInDetail(true)}>
                    <Text style={styles.fpOptionAddText}>+ 새 폴더 만들기</Text>
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
  backBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  shareBtn: { backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  shareBtnText: { fontSize: 12, fontWeight: '700', color: Colors.inkSoft },
  headerTitle: { fontSize: 26, fontWeight: '900', color: Colors.ink, letterSpacing: -0.6, marginBottom: 12 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  diffChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  diffText: { fontSize: 12, fontWeight: '800' },
  metaChip: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  metaChipText: { fontSize: 12, color: Colors.inkSoft, fontWeight: '600' },
  savedAt: { fontSize: 11, color: Colors.inkMute, fontWeight: '500', marginTop: 10 },

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

  sectionHead: { fontSize: 14, fontWeight: '800', color: Colors.ink, marginBottom: 12 },

  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  ingredientChip: {
    backgroundColor: Colors.white, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.line,
  },
  ingredientChipText: { fontSize: 13, fontWeight: '600', color: Colors.inkSoft },

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
  linkRowStatic: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkEmoji: { fontSize: 26, width: 34, textAlign: 'center' },
  linkTitle: { fontSize: 14, fontWeight: '700', color: Colors.ink },
  linkSub: { fontSize: 12, color: Colors.inkSoft, marginTop: 2 },

  // 쿠팡 칩
  coupangChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.creamSoft, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.line,
  },
  coupangChipText: { fontSize: 13, fontWeight: '700', color: Colors.ink },
  coupangArrow: { fontSize: 12, color: Colors.coupang, fontWeight: '800' },

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
