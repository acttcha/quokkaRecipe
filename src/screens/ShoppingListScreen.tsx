import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BackButton } from '../components/BackButton';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';
import {
  getShoppingList, addShoppingItems, toggleShoppingItem,
  removeShoppingItem, clearCheckedItems, ShoppingItem,
} from '../services/shoppingList';
import { addIngredients } from '../services/fridge';
import { t } from '../i18n';

function IconCheck() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4 4L19 7" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ShoppingListScreen({ goBack }: NavProps) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [input, setInput] = useState('');

  const load = async () => setItems(await getShoppingList());
  useEffect(() => { load(); }, []);

  const done = items.filter(i => i.checked).length;

  const handleAdd = async () => {
    const name = input.trim();
    if (!name) return;
    haptic.light();
    setInput('');
    setItems(await addShoppingItems([name]));
  };

  const handleToggle = async (id: string) => {
    haptic.light();
    setItems(await toggleShoppingItem(id));
  };

  const handleRemove = async (id: string) => {
    setItems(await removeShoppingItem(id));
  };

  const handleClearChecked = async () => {
    haptic.medium();
    setItems(await clearCheckedItems());
  };

  const handleToFridge = async () => {
    const checked = items.filter(i => i.checked);
    if (checked.length === 0) return;
    haptic.success();
    await addIngredients(checked.map(i => i.name));
    setItems(await clearCheckedItems());
    Alert.alert(t('shopping.toFridgeDoneTitle'), t('shopping.toFridgeDoneMsg', { count: checked.length }), [
      { text: t('shopping.ok') },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
        <BackButton onPress={goBack} label={t('common.back')} style={styles.backBtn} />
        <Text style={styles.headerTitle}>{t('shopping.title')}</Text>
        {items.length > 0 && (
          <Text style={styles.headerSub}>{t('shopping.headerSub', { done, total: items.length })}</Text>
        )}
      </View>

      {/* 입력 */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t('shopping.inputPlaceholder')}
          placeholderTextColor={Colors.inkMute}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity style={[styles.addBtn, !input.trim() && styles.addBtnOff]} onPress={handleAdd} disabled={!input.trim()}>
          <Text style={styles.addBtnText}>{t('shopping.add')}</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>{t('shopping.emptyTitle')}</Text>
          <Text style={styles.emptySub}>{t('shopping.emptySub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {items.map(item => (
            <View key={item.id} style={styles.itemRow}>
              <TouchableOpacity style={styles.itemMain} activeOpacity={0.7} onPress={() => handleToggle(item.id)}>
                <View style={[styles.checkbox, item.checked && styles.checkboxOn]}>
                  {item.checked && <IconCheck />}
                </View>
                <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>{item.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleRemove(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.removeBtn}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* 하단 액션 */}
      {done > 0 && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.footer, { paddingBottom: 12 + Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearChecked} activeOpacity={0.85}>
              <Text style={styles.clearBtnText}>{t('shopping.clearChecked')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fridgeBtn} onPress={handleToFridge} activeOpacity={0.85}>
              <Text style={styles.fridgeBtnText}>🧊  {t('shopping.toFridge')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: Colors.ink, letterSpacing: -0.4 },
  headerSub: { fontSize: 12, fontWeight: '600', color: Colors.inkSoft, marginTop: 2 },

  inputRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 14 },
  input: {
    flex: 1, height: 48, backgroundColor: Colors.white, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 15, color: Colors.ink,
    borderWidth: 1.5, borderColor: Colors.line,
  },
  addBtn: { paddingHorizontal: 20, height: 48, borderRadius: 14, backgroundColor: Colors.forest, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  addBtnOff: { backgroundColor: Colors.inkMute },
  addBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, fontWeight: '500', color: Colors.inkSoft, textAlign: 'center' },

  listContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: Colors.inkMute,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  itemName: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.ink },
  itemNameChecked: { color: Colors.inkMute, textDecorationLine: 'line-through' },
  removeBtn: { paddingLeft: 10 },
  removeText: { fontSize: 16, fontWeight: '700', color: Colors.inkMute },

  footer: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.cream, borderTopWidth: 1, borderTopColor: Colors.line,
  },
  clearBtn: {
    paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.line, justifyContent: 'center',
  },
  clearBtnText: { fontSize: 13, fontWeight: '800', color: Colors.inkSoft },
  fridgeBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.forest, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  fridgeBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
