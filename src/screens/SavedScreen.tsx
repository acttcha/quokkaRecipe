import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Alert, Dimensions, Image, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { NavProps, SavedRecipe, Folder } from '../types';
import { getSavedRecipes, removeRecipe, moveRecipeToFolder } from '../services/savedRecipes';
import { getFolders, createFolder, deleteFolder } from '../services/folders';
import { getFridgeIngredients, getMissingIngredients } from '../services/fridge';
import { Colors, shadow } from '../constants/colors';
import { CircleIconButton, SearchIcon } from '../components/ui';
import { AdBanner } from '../components/AdBanner';
import { haptic } from '../services/haptics';

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
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke={Colors.inkMute} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconFolderMove({ active = false }: { active?: boolean }) {
  const color = active ? Colors.forest : Colors.inkMute;
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function IconFolderTab({ active = false }: { active?: boolean }) {
  const color = active ? '#fff' : Colors.inkSoft;
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

function IconFolderSheet({ selected = false }: { selected?: boolean }) {
  const color = selected ? Colors.forestDeep : Colors.inkSoft;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke={color} strokeWidth={1.8} strokeLinejoin="round"
        fill={selected ? Colors.forestSoft : 'none'} />
    </Svg>
  );
}

function IconAllRecipes({ active = false }: { active?: boolean }) {
  const color = active ? '#fff' : Colors.inkSoft;
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 10h16M4 14h10" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconPlusCircle() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={Colors.inkMute} strokeWidth={1.8} />
      <Path d="M12 8v8M8 12h8" stroke={Colors.inkMute} strokeWidth={1.8} strokeLinecap="round" />
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

const DIFF_LABEL: Record<string, string> = {
  Easy: '쉬워요', Medium: '보통이에요', Hard: '어려워요',
};

interface SavedScreenProps extends NavProps {
  onFolderBarScroll?: (scrolling: boolean) => void;
}

export default function SavedScreen({ navigate, onFolderBarScroll }: SavedScreenProps) {
  const [recipes, setRecipes]                   = useState<SavedRecipe[]>([]);
  const [folders, setFolders]                   = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchVisible, setSearchVisible]       = useState(false);
  const [searchQuery, setSearchQuery]           = useState('');

  const [pickerVisible, setPickerVisible]       = useState(false);
  const [pickerRecipeId, setPickerRecipeId]     = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder]       = useState(false);
  const [newFolderName, setNewFolderName]       = useState('');

  const [tabModalVisible, setTabModalVisible]   = useState(false);
  const [tabModalName, setTabModalName]         = useState('');

  const [fridgeItems, setFridgeItems] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [recipeData, folderData, fridgeData] = await Promise.all([
      getSavedRecipes(), getFolders(), getFridgeIngredients(),
    ]);
    setRecipes(recipeData);
    setFolders(folderData);
    setFridgeItems(fridgeData);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSearch = () => {
    setSearchVisible(v => !v);
    setSearchQuery('');
  };

  const filtered = (() => {
    let list = recipes;
    if (selectedFolderId !== null) list = list.filter(r => r.folderId === selectedFolderId);
    if (searchQuery.trim()) list = list.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  })();

  const handleDelete = (r: SavedRecipe) => {
    haptic.warning();
    Alert.alert('삭제할까요?', `"${r.name}"을 저장 목록에서 삭제해요.`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await removeRecipe(r.id); await load(); } },
    ]);
  };

  const handleDeleteFolder = (folder: Folder) => {
    const inFolder = recipes.filter(r => r.folderId === folder.id);
    if (inFolder.length > 0) {
      haptic.warning();
      Alert.alert(
        '폴더를 비워주세요',
        `"${folder.name}"에 레시피가 ${inFolder.length}개 있어요.\n레시피를 모두 이동하거나 삭제한 후 폴더를 삭제할 수 있어요.`,
        [{ text: '확인' }]
      );
      return;
    }
    Alert.alert(
      `"${folder.name}" 폴더 삭제`,
      '빈 폴더를 삭제할게요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive',
          onPress: async () => {
            haptic.warning();
            await deleteFolder(folder.id);
            if (selectedFolderId === folder.id) setSelectedFolderId(null);
            await load();
          },
        },
      ]
    );
  };

  const openFolderPicker = (recipeId: string) => {
    haptic.light();
    setPickerRecipeId(recipeId);
    setShowNewFolder(false);
    setNewFolderName('');
    setPickerVisible(true);
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    if (!pickerRecipeId) return;
    haptic.light();
    await moveRecipeToFolder(pickerRecipeId, folderId);
    setPickerVisible(false);
    setPickerRecipeId(null);
    await load();
  };

  const handleCreateFolderInPicker = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    haptic.success();
    const folder = await createFolder(name);
    if (pickerRecipeId) await moveRecipeToFolder(pickerRecipeId, folder.id);
    setPickerVisible(false);
    setPickerRecipeId(null);
    setNewFolderName('');
    setShowNewFolder(false);
    await load();
  };

  const handleCreateFolderFromTab = async () => {
    const name = tabModalName.trim();
    if (!name) return;
    haptic.success();
    await createFolder(name);
    setTabModalVisible(false);
    setTabModalName('');
    await load();
  };

  const pickerRecipe = pickerRecipeId ? recipes.find(r => r.id === pickerRecipeId) : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.7]} style={styles.header}>
        <View style={styles.headerSpacer} />
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>저장한 레시피</Text>
            <TouchableOpacity
              style={styles.ytAnalyzeBtn}
              onPress={() => { haptic.light(); navigate({ name: 'YoutubeRecipe' }); }}
              activeOpacity={0.8}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.45a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58Z" fill="#FF0000" />
                <Path d="m9.75 15.02 5.75-3.02-5.75-3.02v6.04Z" fill="#fff" />
              </Svg>
              <Text style={styles.ytAnalyzeBtnText}>유튜브 레시피 분석</Text>
            </TouchableOpacity>
          </View>
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

      {/* 폴더 탭 바 — 터치 시작 즉시 부모 PanResponder 차단 */}
      <View
        onTouchStart={() => onFolderBarScroll?.(true)}
        onTouchEnd={() => onFolderBarScroll?.(false)}
        onTouchCancel={() => onFolderBarScroll?.(false)}
      >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.folderBar}
        contentContainerStyle={styles.folderBarContent}
        scrollEventThrottle={16}
      >
        <TouchableOpacity
          style={[styles.folderTab, selectedFolderId === null && styles.folderTabActive]}
          onPress={() => setSelectedFolderId(null)}
          activeOpacity={0.8}
        >
          <IconAllRecipes active={selectedFolderId === null} />
          <Text style={[styles.folderTabText, selectedFolderId === null && styles.folderTabTextActive]}>전체</Text>
          <Text style={[styles.folderTabCount, selectedFolderId !== null && styles.folderTabCountInactive]}>
            {recipes.length}
          </Text>
        </TouchableOpacity>

        {folders.map(folder => {
          const count = recipes.filter(r => r.folderId === folder.id).length;
          const isActive = selectedFolderId === folder.id;
          return (
            <TouchableOpacity
              key={folder.id}
              style={[styles.folderTab, isActive && styles.folderTabActive]}
              onPress={() => setSelectedFolderId(folder.id)}
              activeOpacity={0.8}
            >
              <IconFolderTab active={isActive} />
              <Text style={[styles.folderTabText, isActive && styles.folderTabTextActive]}>
                {folder.name}
              </Text>
              <Text style={[styles.folderTabCount, !isActive && styles.folderTabCountInactive]}>
                {count}
              </Text>
              {isActive && (
                <TouchableOpacity
                  style={styles.folderTabDelete}
                  onPress={() => handleDeleteFolder(folder)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
                >
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path d="M18 6 6 18M6 6l12 12" stroke="rgba(255,255,255,0.75)" strokeWidth={2.2} strokeLinecap="round" />
                  </Svg>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.folderTabAdd}
          onPress={() => { setTabModalName(''); setTabModalVisible(true); }}
          activeOpacity={0.8}
        >
          <IconPlusCircle />
          <Text style={styles.folderTabAddText}>폴더</Text>
        </TouchableOpacity>
      </ScrollView>
      </View>

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
            <Text style={styles.emptyTitle}>
              {searchQuery ? '검색 결과가 없어요' : '이 폴더에 레시피가 없어요'}
            </Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? `"${searchQuery}"와 일치하는 레시피가 없어요`
                : '레시피 카드의 📁 버튼으로 폴더에 추가해보세요'}
            </Text>
          </View>
        ) : (
          filtered.map((r) => {
            const diffLabel = DIFF_LABEL[r.difficulty] ?? r.difficulty;
            const d = new Date(r.savedAt);
            const savedDate = `${d.getFullYear()}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getDate().toString().padStart(2,'0')}`;
            const folder = r.folderId ? folders.find(f => f.id === r.folderId) : null;

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
                    <View style={styles.cardActions}>
                      {folder && selectedFolderId === null && (
                        <View style={styles.folderBadge}>
                          <Text style={styles.folderBadgeText} numberOfLines={1}>{folder.name}</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.folderMoveBtn}
                        onPress={() => openFolderPicker(r.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <IconFolderMove active={!!folder} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(r)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <IconTrash />
                      </TouchableOpacity>
                    </View>
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
                    {fridgeItems.length > 0 && (() => {
                      const missing = getMissingIngredients(fridgeItems, r.ingredients).length;
                      return missing === 0
                        ? <Text style={styles.ingOkBadge}>재료 완비 ✓</Text>
                        : <Text style={styles.ingMissingBadge}>{missing}개 부족</Text>;
                    })()}
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

        {recipes.length > 0 && <AdBanner />}
      </ScrollView>

      {/* 폴더 이동 모달 (bottom sheet) */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={styles.pickerSheet}>
                <View style={styles.pickerHandle} />
                <Text style={styles.pickerTitle}>폴더 이동</Text>
                {pickerRecipe && (
                  <Text style={styles.pickerSub} numberOfLines={1}>{pickerRecipe.name}</Text>
                )}

                <TouchableOpacity
                  style={[styles.folderOption, !pickerRecipe?.folderId && styles.folderOptionActive]}
                  onPress={() => handleMoveToFolder(null)}
                >
                  <View style={styles.folderOptionIconWrap}>
                    <IconFolderSheet selected={!pickerRecipe?.folderId} />
                  </View>
                  <Text style={[styles.folderOptionText, !pickerRecipe?.folderId && styles.folderOptionTextActive]}>
                    분류 없음
                  </Text>
                  {!pickerRecipe?.folderId && <IconCheck />}
                </TouchableOpacity>

                {folders.map(folder => {
                  const isSelected = pickerRecipe?.folderId === folder.id;
                  return (
                    <TouchableOpacity
                      key={folder.id}
                      style={[styles.folderOption, isSelected && styles.folderOptionActive]}
                      onPress={() => handleMoveToFolder(folder.id)}
                    >
                      <View style={styles.folderOptionIconWrap}>
                        <IconFolderSheet selected={isSelected} />
                      </View>
                      <Text style={[styles.folderOptionText, isSelected && styles.folderOptionTextActive]}>
                        {folder.name}
                      </Text>
                      <Text style={styles.folderOptionCount}>
                        {recipes.filter(rx => rx.folderId === folder.id).length}개
                      </Text>
                      {isSelected && <IconCheck />}
                    </TouchableOpacity>
                  );
                })}

                <View style={styles.pickerDivider} />

                {showNewFolder ? (
                  <View style={styles.newFolderRow}>
                    <TextInput
                      style={styles.newFolderInput}
                      value={newFolderName}
                      onChangeText={setNewFolderName}
                      placeholder="새 폴더 이름"
                      placeholderTextColor={Colors.inkMute}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleCreateFolderInPicker}
                    />
                    <TouchableOpacity
                      style={[styles.newFolderBtn, !newFolderName.trim() && styles.btnDisabled]}
                      onPress={handleCreateFolderInPicker}
                    >
                      <Text style={styles.newFolderBtnText}>만들기</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.folderOptionAdd} onPress={() => setShowNewFolder(true)}>
                    <View style={styles.folderOptionIconWrap}>
                      <IconPlusCircle />
                    </View>
                    <Text style={styles.folderOptionAddText}>새 폴더 만들기</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 새 폴더 모달 (탭 바 버튼) */}
      <Modal visible={tabModalVisible} transparent animationType="fade" onRequestClose={() => setTabModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlayCenter} activeOpacity={1} onPress={() => setTabModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={styles.newFolderModal}>
                <Text style={styles.newFolderModalTitle}>새 폴더 만들기</Text>
                <TextInput
                  style={styles.newFolderModalInput}
                  value={tabModalName}
                  onChangeText={setTabModalName}
                  placeholder="폴더 이름"
                  placeholderTextColor={Colors.inkMute}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreateFolderFromTab}
                />
                <View style={styles.newFolderModalBtns}>
                  <TouchableOpacity
                    style={styles.newFolderModalCancelBtn}
                    onPress={() => setTabModalVisible(false)}
                  >
                    <Text style={styles.newFolderModalCancelText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.newFolderModalConfirmBtn, !tabModalName.trim() && styles.btnDisabled]}
                    onPress={handleCreateFolderFromTab}
                  >
                    <Text style={styles.newFolderModalConfirmText}>만들기</Text>
                  </TouchableOpacity>
                </View>
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

  header: { height: 185 },
  headerSpacer: { flex: 1 },
  headerContent: { paddingHorizontal: 22, paddingBottom: 14 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.ink, letterSpacing: -0.6 },
  headerSub: { fontSize: 13, color: Colors.inkSoft, fontWeight: '500', marginTop: 4 },
  ytAnalyzeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,0,0,0.08)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,0,0,0.15)',
  },
  ytAnalyzeBtnText: { fontSize: 12, fontWeight: '700', color: '#CC0000' },
  headerHairline: { height: 1, backgroundColor: Colors.line, opacity: 0.5 },
  headerSearchBtn: { position: 'absolute', top: 60, right: 18 },

  folderBar: {
    backgroundColor: Colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    flexGrow: 0,
  },
  folderBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  folderTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.lineSoft,
  },
  folderTabActive: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  folderTabText: { fontSize: 13, fontWeight: '600', color: Colors.inkSoft },
  folderTabTextActive: { color: '#fff' },
  folderTabCount: {
    fontSize: 11, fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 10, minWidth: 18, textAlign: 'center',
  },
  folderTabCountInactive: {
    color: Colors.inkMute,
    backgroundColor: Colors.creamSoft,
  },
  folderTabAdd: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5, borderColor: Colors.inkMute,
    borderStyle: 'dashed',
  },
  folderTabAddText: { fontSize: 12, fontWeight: '600', color: Colors.inkMute },
  folderTabDelete: { marginLeft: 2, padding: 1 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 0 },
  searchClear: { fontSize: 20, color: Colors.inkMute, lineHeight: 22 },

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
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  recipeName: { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.ink, letterSpacing: -0.3 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  folderMoveBtn: {},
  deleteBtn: {},

  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: Colors.inkSoft, fontWeight: '600' },
  folderBadge: {
    backgroundColor: Colors.forestSoft,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, maxWidth: 88,
  },
  folderBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.forestDeep },
  savedDate: { marginLeft: 'auto' as any, fontSize: 11, color: Colors.inkMute, fontWeight: '500' },

  tagRow: { flexDirection: 'row', gap: 4, alignItems: 'center', flexWrap: 'wrap' },
  tag: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    backgroundColor: Colors.creamSoft, borderWidth: 1, borderColor: Colors.line,
  },
  tagText: { fontSize: 11, fontWeight: '600', color: Colors.inkSoft },
  tagMore: { fontSize: 11, fontWeight: '600', color: Colors.inkMute },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalKAV: { width: '100%' },

  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  pickerHandle: {
    width: 40, height: 4, backgroundColor: Colors.line,
    borderRadius: 2, alignSelf: 'center', marginBottom: 18,
  },
  pickerTitle: { fontSize: 17, fontWeight: '800', color: Colors.ink, marginBottom: 4 },
  pickerSub: { fontSize: 13, color: Colors.inkSoft, marginBottom: 16 },

  folderOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 12, borderRadius: 14, marginBottom: 4,
  },
  folderOptionActive: { backgroundColor: Colors.forestSoft },
  folderOptionIcon: { fontSize: 18 },
  folderOptionIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.creamSoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.line,
  },
  folderOptionText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.ink },
  folderOptionTextActive: { color: Colors.forestDeep },
  folderOptionCount: { fontSize: 12, color: Colors.inkMute, fontWeight: '500', marginRight: 4 },
  folderOptionAdd: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  folderOptionAddText: { fontSize: 15, fontWeight: '700', color: Colors.forest },
  pickerDivider: {
    height: 1, backgroundColor: Colors.line,
    marginVertical: 8, opacity: 0.5,
  },

  newFolderRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  newFolderInput: {
    flex: 1, height: 44, backgroundColor: Colors.creamSoft,
    borderRadius: 12, paddingHorizontal: 12, fontSize: 14, color: Colors.ink,
    borderWidth: 1, borderColor: Colors.line,
  },
  newFolderBtn: {
    height: 44, backgroundColor: Colors.forest, borderRadius: 12,
    paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
  },
  newFolderBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  newFolderModal: { backgroundColor: Colors.white, borderRadius: 20, padding: 24 },
  newFolderModalTitle: { fontSize: 17, fontWeight: '800', color: Colors.ink, marginBottom: 16 },
  newFolderModalInput: {
    height: 46, backgroundColor: Colors.creamSoft,
    borderRadius: 14, paddingHorizontal: 14, fontSize: 15, color: Colors.ink,
    borderWidth: 1, borderColor: Colors.line, marginBottom: 16,
  },
  newFolderModalBtns: { flexDirection: 'row', gap: 10 },
  newFolderModalCancelBtn: {
    flex: 1, height: 46, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.line,
    justifyContent: 'center', alignItems: 'center',
  },
  newFolderModalCancelText: { fontSize: 14, fontWeight: '700', color: Colors.inkSoft },
  newFolderModalConfirmBtn: {
    flex: 1, height: 46, borderRadius: 14,
    backgroundColor: Colors.forest,
    justifyContent: 'center', alignItems: 'center',
  },
  newFolderModalConfirmText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnDisabled: { backgroundColor: Colors.inkMute },

  ingOkBadge: {
    fontSize: 10, fontWeight: '700', color: Colors.forestDeep,
    backgroundColor: Colors.forestSoft,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  ingMissingBadge: {
    fontSize: 10, fontWeight: '700', color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
});
