import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Image, ImageBackground, TextInput,
  Animated, Alert,
} from 'react-native';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { getFridgeIngredients, addIngredient, removeIngredient, clearFridge } from '../services/fridge';

export default function FridgeScreen({ navigate }: NavProps) {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setIngredients(await getFridgeIngredients());
  }, []);

  useEffect(() => {
    load();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay: 60,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAdd = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    await addIngredient(trimmed);
    setInput('');
    await load();
  };

  const handleRemove = async (item: string) => {
    await removeIngredient(item);
    await load();
  };

  const handleClear = () => {
    Alert.alert('냉장고 비우기', '모든 재료를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '비우기', style: 'destructive',
        onPress: async () => { await clearFridge(); await load(); },
      },
    ]);
  };

  const handleMakeRecipe = () => {
    if (ingredients.length === 0) {
      Alert.alert('재료가 없어요', '재료를 먼저 추가해주세요 🥺');
      return;
    }
    navigate({ name: 'FridgeRecipes', ingredients });
  };

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground source={require('../../assets/background.png')} style={styles.hero} resizeMode="cover">
        <View style={styles.heroOverlay}>
          <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.heroSub}>내 냉장고 🧊</Text>
        </View>
      </ImageBackground>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHead}>재료 목록 {ingredients.length > 0 ? `(${ingredients.length}개)` : ''}</Text>
          {ingredients.length > 0 && (
            <TouchableOpacity onPress={handleClear}>
              <Text style={styles.clearText}>전체 삭제</Text>
            </TouchableOpacity>
          )}
        </View>

        {ingredients.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🧊</Text>
            <Text style={styles.emptyText}>냉장고가 비어있어요</Text>
            <Text style={styles.emptySub}>재료를 스캔하거나 아래에서 직접 추가해보세요</Text>
          </View>
        ) : (
          <View style={styles.chipGrid}>
            {ingredients.map(item => (
              <View key={item} style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
                <TouchableOpacity
                  onPress={() => handleRemove(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                >
                  <Text style={styles.chipX}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.scanRow}>
          <TouchableOpacity
            style={[styles.scanIngBtn, { flex: 1 }]}
            onPress={() => navigate({ name: 'Camera', fridgeMode: true })}
            activeOpacity={0.85}
          >
            <Text style={styles.scanIngBtnText}>📸  재료 스캔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanIngBtn, styles.receiptBtn]}
            onPress={() => navigate({ name: 'Camera', receiptMode: true })}
            activeOpacity={0.85}
          >
            <Text style={styles.scanIngBtnText}>🧾  영수증 스캔</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHead, { marginTop: 24 }]}>직접 추가</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="예: 두부, 파, 된장..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Text style={styles.addBtnText}>추가</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.recipeBtn, ingredients.length === 0 && styles.recipeBtnDisabled]}
          onPress={handleMakeRecipe}
          activeOpacity={0.85}
        >
          <Text style={styles.recipeBtnText}>🍳  이 재료로 레시피 만들기</Text>
        </TouchableOpacity>
      </View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  hero: { minHeight: 170 },
  heroOverlay: {
    flex: 1, paddingTop: 52, paddingHorizontal: 24, paddingBottom: 28,
    backgroundColor: 'rgba(255,255,255,0.45)', justifyContent: 'flex-end',
  },

  heroLogo: { width: '100%', height: 52, marginBottom: 6 },
  heroSub: { fontSize: 13, color: Colors.textMid, textAlign: 'center' },

  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 20 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionHead: { fontSize: 15, fontWeight: '800', color: Colors.text },
  clearText: { fontSize: 13, fontWeight: '600', color: Colors.coral },

  emptyBox: {
    alignItems: 'center', paddingVertical: 44,
    backgroundColor: Colors.card, borderRadius: 20, ...shadow.sm,
  },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 20 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.cardGreen, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  chipText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  chipX: { fontSize: 18, color: Colors.primaryMid, fontWeight: '800', lineHeight: 20 },

  scanRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  scanIngBtn: {
    backgroundColor: Colors.cardGreen, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center', ...shadow.sm,
    borderWidth: 1.5, borderColor: Colors.accentLight,
  },
  receiptBtn: { backgroundColor: '#FFF8EE', borderColor: '#E8D0A0' },
  scanIngBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 14 },

  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: Colors.text, ...shadow.sm,
  },
  addBtn: {
    backgroundColor: Colors.accent, borderRadius: 14,
    paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  footer: { padding: 20, paddingBottom: 36, backgroundColor: Colors.bg },
  recipeBtn: {
    backgroundColor: Colors.accent, borderRadius: 20,
    paddingVertical: 18, alignItems: 'center', ...shadow.md,
  },
  recipeBtnDisabled: { backgroundColor: Colors.textMuted },
  recipeBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16 },

});
