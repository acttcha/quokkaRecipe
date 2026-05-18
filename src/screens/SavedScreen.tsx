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


const DIFF_LABEL: Record<string, string> = {
  Easy: '쉬워요', Medium: '보통이에요', Hard: '어려워요',
};

export default function SavedScreen({ navigate }: NavProps) {
  const [recipes, setRecipes]             = useState<SavedRecipe[]>([]);
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
          filtered.map((r) => {
            const diffLabel = DIFF_LABEL[r.difficulty] ?? r.difficulty;
            const d = new Date(r.savedAt);
            const savedDate = `${d.getFullYear()}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getDate().toString().padStart(2,'0')}`;

            return (
              <TouchableOpacity
                key={r.id}
                style={styles.card}
                onPress={() => navigate({ name: 'SavedRecipeDetail', recipe: r })}
                activeOpacity={0.85}
              >
                <View style={styles.cardMain}>
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
                    <Text style={styles.savedDate}>{savedDate}</Text>
                  </View>

                  <View style={styles.tagRow}>
                    {r.ingredients.slice(0, 4).map(ing => (
                      <View key={ing} style={styles.tag}>
                        <Text style={styles.tagText}>{ing}</Text>
                      </View>
                    ))}
                    {r.ingredients.length > 4 && (
                      <Text style={styles.tagMore}>+{r.ingredients.length - 4}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
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
  cardMain: { padding: 14 },

  cardInfo: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  recipeName: { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.ink, letterSpacing: -0.3 },
  deleteBtn: { marginLeft: 8, marginTop: 2 },

  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: Colors.inkSoft, fontWeight: '600' },
  savedDate: { marginLeft: 'auto' as any, fontSize: 11, color: Colors.inkMute, fontWeight: '500' },

  tagRow: { flexDirection: 'row', gap: 4, alignItems: 'center', flexWrap: 'wrap' },
  tag: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    backgroundColor: Colors.creamSoft, borderWidth: 1, borderColor: Colors.line,
  },
  tagText: { fontSize: 11, fontWeight: '600', color: Colors.inkSoft },
  tagMore: { fontSize: 11, fontWeight: '600', color: Colors.inkMute },
});
