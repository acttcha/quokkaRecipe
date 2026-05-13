import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Image, ImageBackground, Dimensions, Alert,
} from 'react-native';
import { NavProps, SavedRecipe } from '../types';
import { getSavedRecipes, removeRecipe } from '../services/savedRecipes';
import { Colors, shadow } from '../constants/colors';

const { width } = Dimensions.get('window');

const CARD_ACCENT = ['#FFD166', '#74C0FC', '#52B788', '#FF9F7F', '#C77DFF'];
const FOOD_EMOJIS = ['🍳', '🥘', '🍜', '🥗', '🍱', '🫕', '🥙', '🍲'];
const DIFF = {
  Easy:   { label: '쉬워요',    color: Colors.accent,  bg: Colors.accentLight },
  Medium: { label: '보통이에요', color: '#D97706',      bg: Colors.yellowLight },
  Hard:   { label: '어려워요',  color: Colors.coral,   bg: Colors.coralLight },
};

export default function SavedScreen({ navigate, goBack }: NavProps) {
  const [recipes, setRecipes]   = useState<SavedRecipe[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getSavedRecipes();
    setRecipes(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (r: SavedRecipe) => {
    Alert.alert('삭제할까요?', `"${r.name}"을 저장 목록에서 삭제해요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await removeRecipe(r.id);
          await load();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 헤더 */}
      <ImageBackground
        source={require('../../assets/background.png')}
        style={styles.hero}
        resizeMode="cover"
      >
        <View style={styles.heroOverlay}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 돌아가기</Text>
          </TouchableOpacity>
          <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.heroSub}>
            {recipes.length > 0 ? `저장된 레시피 ${recipes.length}개` : '아직 저장된 레시피가 없어요'}
          </Text>
        </View>
      </ImageBackground>

      {/* 목록 */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {recipes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Image source={require('../../assets/quokka.png')} style={styles.emptyQuokka} resizeMode="contain" />
            <Text style={styles.emptyTitle}>저장된 레시피가 없어요</Text>
            <Text style={styles.emptySub}>레시피 화면에서 ♥ 버튼으로 저장해보세요!</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={() => navigate({ name: 'Camera' })}>
              <Text style={styles.scanBtnText}>📸  재료 스캔하러 가기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recipes.map((r, idx) => {
            const open = expanded === r.id;
            const diff = DIFF[r.difficulty];
            const accent = CARD_ACCENT[idx % CARD_ACCENT.length];
            const emoji = FOOD_EMOJIS[idx % FOOD_EMOJIS.length];
            return (
              <View key={r.id} style={styles.card}>
                {/* 컬러 헤더 — 좌(이모지+expand) / 우(삭제) 분리 */}
                <View style={[styles.cardHeader, { backgroundColor: accent }]}>
                  <TouchableOpacity
                    style={styles.cardHeaderLeft}
                    onPress={() => setExpanded(open ? null : r.id)}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.cardEmoji}>{emoji}</Text>
                    <View style={[styles.diffChip, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                      <Text style={[styles.diffText, { color: diff.color }]}>{diff.label}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(r)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>

                {/* 카드 본문 */}
                <TouchableOpacity
                  style={styles.cardBody}
                  onPress={() => setExpanded(open ? null : r.id)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.recipeName}>{r.name}</Text>
                  <Text style={styles.recipeDesc}>{r.description}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaChip}><Text style={styles.metaChipText}>⏱ {r.cookTime}</Text></View>
                    <View style={styles.metaChip}><Text style={styles.metaChipText}>👥 {r.servings}인분</Text></View>
                    {r.nutrition && (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>🔥 {r.nutrition.calories}kcal</Text>
                      </View>
                    )}
                    <View style={styles.expandBtn}>
                      <Text style={styles.expandBtnText}>{open ? '접기 ▲' : '보기 ▼'}</Text>
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
                            { label: '단백질', val: `${r.nutrition.protein}g`, color: '#74C0FC' },
                            { label: '탄수화물', val: `${r.nutrition.carbs}g`, color: '#FFD166' },
                            { label: '지방', val: `${r.nutrition.fat}g`, color: '#C77DFF' },
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
                        {r.ingredients.map((ing, n) => (
                          <View key={n} style={styles.ingredientChip}>
                            <Text style={styles.ingredientChipText}>{ing}</Text>
                          </View>
                        ))}
                      </View>

                      <Text style={[styles.detailHead, { marginTop: 16 }]}>👨‍🍳 만드는 법</Text>
                      {r.steps.map((s, n) => (
                        <View key={n} style={styles.stepRow}>
                          <View style={[styles.stepNum, { backgroundColor: accent }]}>
                            <Text style={styles.stepNumText}>{n + 1}</Text>
                          </View>
                          <Text style={styles.stepText}>{s}</Text>
                        </View>
                      ))}

                      {r.sourceIngredients.length > 0 && (
                        <View style={styles.sourceWrap}>
                          <Text style={styles.sourceLabel}>📸 스캔한 재료</Text>
                          <Text style={styles.sourceText}>{r.sourceIngredients.join(', ')}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  hero: { minHeight: 170 },
  heroOverlay: {
    flex: 1,
    paddingTop: 52, paddingHorizontal: 24, paddingBottom: 28,
    backgroundColor: 'rgba(255,255,255,0.45)',
    justifyContent: 'flex-end',
  },
  backBtn: { marginBottom: 10 },
  backBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  heroLogo: { width: '100%', height: 52, marginBottom: 6 },
  heroSub: { fontSize: 13, color: Colors.textMid, textAlign: 'center' },

  body: { flex: 1, backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
  bodyContent: { padding: 20, paddingBottom: 48 },

  emptyWrap: { alignItems: 'center', paddingTop: 20 },
  emptyQuokka: { width: width * 0.6, height: 200, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginBottom: 28 },
  scanBtn: {
    backgroundColor: Colors.accent, borderRadius: 18,
    paddingHorizontal: 28, paddingVertical: 14, ...shadow.sm,
  },
  scanBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  card: { backgroundColor: Colors.card, borderRadius: 24, marginBottom: 18, overflow: 'hidden', ...shadow.md },
  cardHeader: { height: 90, flexDirection: 'row', alignItems: 'stretch' },
  cardHeaderLeft: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  cardEmoji: { fontSize: 40 },
  diffChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  diffText: { fontSize: 12, fontWeight: '800' },
  deleteBtn: { width: 52, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 18 },

  cardBody: { padding: 18 },
  recipeName: { fontSize: 20, fontWeight: '900', color: Colors.text, marginBottom: 6 },
  recipeDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginBottom: 14 },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  metaChip: { backgroundColor: '#F7F5F2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  metaChipText: { fontSize: 12, color: Colors.textMid, fontWeight: '600' },
  expandBtn: { marginLeft: 'auto' as any, backgroundColor: Colors.accentLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  expandBtnText: { fontSize: 12, fontWeight: '800', color: Colors.primary },

  detail: { marginTop: 4 },
  detailLine: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  detailHead: { fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 10 },

  nutritionBox: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#F7F5F2', borderRadius: 16, padding: 16, marginBottom: 16,
  },
  nutritionItem: { alignItems: 'center', flex: 1 },
  nutritionVal: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  nutritionLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  ingredientChip: { backgroundColor: '#F7F5F2', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  ingredientChipText: { fontSize: 13, fontWeight: '600', color: Colors.textMid },

  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText: { fontSize: 13, fontWeight: '900', color: Colors.primary },
  stepText: { fontSize: 14, color: Colors.text, lineHeight: 22, flex: 1 },

  sourceWrap: { backgroundColor: Colors.cardGreen, borderRadius: 12, padding: 12, marginTop: 12 },
  sourceLabel: { fontSize: 12, fontWeight: '700', color: Colors.primaryMid, marginBottom: 4 },
  sourceText: { fontSize: 13, color: Colors.primaryMid },
});
