import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Alert, Dimensions, Image, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { NavProps, SavedRecipe } from '../types';
import { getSavedRecipes, removeRecipe } from '../services/savedRecipes';
import { Colors, shadow } from '../constants/colors';
import { CircleIconButton, SearchIcon } from '../components/ui';

const { width } = Dimensions.get('window');

const CARD_COLORS = ['#F5C18D', '#FFD891', '#B7D9A8', '#E8C386', '#FFB3C6', '#AED6F1'];

function getRecipeEmoji(name: string, ingredients: string[]): string {
  const t = (name + ' ' + ingredients.join(' ')).toLowerCase();
  if (/비빔밥|덮밥/.test(t))             return '🍱';
  if (/볶음밥|필라프/.test(t))            return '🍚';
  if (/김치/.test(t))                    return '🥬';
  if (/계란|달걀/.test(t))               return '🍳';
  if (/찌개|전골/.test(t))               return '🍲';
  if (/국|탕|스프|죽/.test(t))           return '🥣';
  if (/면|국수|파스타|라면|우동/.test(t))  return '🍜';
  if (/닭|치킨/.test(t))                 return '🍗';
  if (/소고기|갈비|스테이크/.test(t))     return '🥩';
  if (/돼지|삼겹|항정/.test(t))          return '🥓';
  if (/새우/.test(t))                    return '🦐';
  if (/생선|연어|참치|고등어|조기/.test(t)) return '🐟';
  if (/카레/.test(t))                    return '🍛';
  if (/샐러드/.test(t))                  return '🥗';
  if (/전|부침/.test(t))                 return '🥞';
  if (/볶음/.test(t))                    return '🥘';
  if (/구이/.test(t))                    return '🍖';
  if (/두부/.test(t))                    return '🫕';
  if (/나물|무침/.test(t))               return '🥦';
  return '🍽️';
}

function IconClock() {
  return (
    <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={5.5} stroke={Colors.inkSoft} strokeWidth={1.4} />
      <Path d="M7 4v3.2L9 8.5" stroke={Colors.inkSoft} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function IconFlame() {
  return (
    <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
      <Path d="M7 1.5c.6 2.2 3 3.4 3 6.5A3 3 0 0 1 7 12a3 3 0 0 1-3-3c0-1.4.7-2.2 1.4-2.6.4 1 1 1 .6-.5-.4-1.5.4-3 1-4.4Z"
        stroke={Colors.inkSoft} strokeWidth={1.3} strokeLinejoin="round" />
    </Svg>
  );
}

function IconTrash() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={Colors.inkMute} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 18 18" fill="none">
      <Path
        d={open ? 'm4 11 5-5 5 5' : 'm4 7 5 5 5-5'}
        stroke={Colors.inkSoft} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

const DIFF_LABEL: Record<string, string> = {
  Easy: '쉬워요', Medium: '보통이에요', Hard: '어려워요',
};

export default function SavedScreen({ navigate }: NavProps) {
  const [recipes, setRecipes]       = useState<SavedRecipe[]>([]);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');

  const load = useCallback(async () => {
    const data = await getSavedRecipes();
    setRecipes(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSearch = () => {
    setSearchVisible(v => !v);
    setSearchQuery('');
  };

  const filtered = searchQuery.trim()
    ? recipes.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : recipes;

  const handleDelete = (r: SavedRecipe) => {
    Alert.alert('삭제할까요?', `"${r.name}"을 저장 목록에서 삭제해요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => { await removeRecipe(r.id); await load(); },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.7]} style={styles.header}>
        <View style={styles.headerSpacer} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>저장한 레시피</Text>
          <Text style={styles.headerSub}>
            {recipes.length > 0 ? `${recipes.length}개의 레시피를 보관 중이에요` : '아직 저장된 레시피가 없어요'}
          </Text>
        </View>
        <View style={styles.headerHairline} />
        <View style={styles.headerSearchBtn}>
          <CircleIconButton onPress={toggleSearch}>
            <SearchIcon size={18} color={searchVisible ? Colors.orangeDeep : Colors.ink} />
          </CircleIconButton>
        </View>
      </LinearGradient>

      {/* 검색바 */}
      {searchVisible && (
        <View style={styles.searchBar}>
          <SearchIcon size={16} color={Colors.inkMute} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="레시피 이름 검색..."
            placeholderTextColor={Colors.inkMute}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.searchClear}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {recipes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Image source={require('../../assets/quokka.png')} style={styles.emptyQuokka} resizeMode="contain" />
            <Text style={styles.emptyTitle}>저장된 레시피가 없어요</Text>
            <Text style={styles.emptySub}>레시피 화면에서 ♥ 버튼으로 저장해보세요!</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={() => navigate({ name: 'Camera' })}>
              <Text style={styles.scanBtnText}>📸  재료 스캔하러 가기</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
            <Text style={styles.emptySub}>"{searchQuery}"와 일치하는 레시피가 없어요</Text>
          </View>
        ) : (
          filtered.map((r, idx) => {
            const open    = expanded === r.id;
            const accent  = CARD_COLORS[idx % CARD_COLORS.length];
            const emoji   = getRecipeEmoji(r.name, r.ingredients);
            const diffLabel = DIFF_LABEL[r.difficulty] ?? r.difficulty;

            return (
              <View key={r.id} style={styles.card}>
                {/* 카드 메인 로우 */}
                <TouchableOpacity
                  style={styles.cardMain}
                  onPress={() => setExpanded(open ? null : r.id)}
                  activeOpacity={0.88}
                >
                  {/* 썸네일 */}
                  <View style={[styles.thumb, { backgroundColor: accent }]}>
                    <Text style={styles.thumbEmoji}>{emoji}</Text>
                  </View>

                  {/* 정보 */}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.recipeName} numberOfLines={1}>{r.name}</Text>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(r)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <IconTrash />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <IconClock />
                        <Text style={styles.metaText}>{r.cookTime}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <IconFlame />
                        <Text style={styles.metaText}>{diffLabel}</Text>
                      </View>
                    </View>

                    <View style={styles.tagRow}>
                      {r.ingredients.slice(0, 3).map(ing => (
                        <View key={ing} style={styles.tag}>
                          <Text style={styles.tagText}>{ing}</Text>
                        </View>
                      ))}
                      <View style={styles.expandToggle}>
                        <IconChevron open={open} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* 확장 상세 */}
                {open && (
                  <View style={styles.detail}>
                    <View style={styles.detailDivider} />

                    {r.nutrition && (
                      <View style={styles.nutritionRow}>
                        {[
                          { label: '칼로리', val: `${r.nutrition.calories}kcal`, color: '#FF9F7F' },
                          { label: '단백질', val: `${r.nutrition.protein}g`,     color: '#74C0FC' },
                          { label: '탄수화물', val: `${r.nutrition.carbs}g`,     color: '#FFD166' },
                          { label: '지방',   val: `${r.nutrition.fat}g`,         color: '#C77DFF' },
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
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  header: { height: 170 },
  headerSpacer: { flex: 1 },
  headerContent: { paddingHorizontal: 22, paddingBottom: 14 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.ink, letterSpacing: -0.6 },
  headerSub: { fontSize: 13, color: Colors.inkSoft, fontWeight: '500', marginTop: 4 },
  headerHairline: { height: 1, backgroundColor: Colors.line, opacity: 0.5 },
  headerSearchBtn: { position: 'absolute', top: 60, right: 18 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: Colors.ink,
    paddingVertical: 0,
  },
  searchClear: {
    fontSize: 20, color: Colors.inkMute, lineHeight: 22,
  },

  body: { flex: 1 },
  bodyContent: { padding: 22, paddingBottom: 120, gap: 12 },

  emptyWrap: { alignItems: 'center', paddingTop: 20 },
  emptyQuokka: { width: width * 0.55, height: 180, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.ink, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.inkSoft, textAlign: 'center', marginBottom: 24 },
  scanBtn: {
    backgroundColor: Colors.forest, borderRadius: 18,
    paddingHorizontal: 28, paddingVertical: 14, ...shadow.sm,
  },
  scanBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  card: {
    backgroundColor: Colors.white, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
    overflow: 'hidden',
  },
  cardMain: { flexDirection: 'row', padding: 12, gap: 12, alignItems: 'center' },

  thumb: {
    width: 80, height: 80, borderRadius: 14, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 38 },

  cardInfo: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  recipeName: { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.ink, letterSpacing: -0.3 },
  deleteBtn: { marginLeft: 8, marginTop: 2 },

  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: Colors.inkSoft, fontWeight: '600' },

  tagRow: { flexDirection: 'row', gap: 4, alignItems: 'center', flexWrap: 'wrap' },
  tag: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    backgroundColor: Colors.creamSoft, borderWidth: 1, borderColor: Colors.line,
  },
  tagText: { fontSize: 11, fontWeight: '600', color: Colors.inkSoft },
  expandToggle: { marginLeft: 'auto' as any },

  detail: { paddingHorizontal: 14, paddingBottom: 14 },
  detailDivider: { height: 1, backgroundColor: Colors.line, opacity: 0.4, marginBottom: 14 },
  detailHead: { fontSize: 13, fontWeight: '800', color: Colors.ink, marginBottom: 10 },

  nutritionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.creamSoft, borderRadius: 14, padding: 14, marginBottom: 14,
  },
  nutritionItem: { alignItems: 'center', flex: 1 },
  nutritionVal: { fontSize: 14, fontWeight: '900', marginBottom: 3 },
  nutritionLabel: { fontSize: 11, color: Colors.inkSoft, fontWeight: '600' },

  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  ingredientChip: {
    backgroundColor: Colors.creamSoft, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.line,
  },
  ingredientChipText: { fontSize: 12, fontWeight: '600', color: Colors.inkSoft },

  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumText: { fontSize: 12, fontWeight: '900', color: Colors.ink },
  stepText: { fontSize: 13, color: Colors.ink, lineHeight: 20, flex: 1 },
});
