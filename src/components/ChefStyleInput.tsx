import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { isPro } from '../services/subscription';
import { getCachedChefStyle, setChefStyle, CHEF_STYLE_MAX } from '../services/chefStyle';
import { NavProps } from '../types';
import { t } from '../i18n';

// 생성 화면에 얹는 "나만의 셰프 스타일" 인라인 입력.
//  - 구독자: 편집 가능 (입력 즉시 저장 → 레시피 생성에 반영)
//  - 비구독자: 회색 readonly, 탭하면 쿼카패스(LeafShop)로 유도
export function ChefStyleInput({ navigate }: { navigate: NavProps['navigate'] }) {
  const pro = isPro();
  const [text, setText] = useState(getCachedChefStyle());

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>{t('chef.styleLabel')}</Text>
        {!pro && <Text style={styles.proBadge}>{t('chef.proOnly')}</Text>}
      </View>

      {pro ? (
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(v) => { setText(v); setChefStyle(v); }}
          placeholder={t('chef.stylePlaceholder')}
          placeholderTextColor={Colors.inkMute}
          maxLength={CHEF_STYLE_MAX}
          multiline
        />
      ) : (
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigate({ name: 'LeafShop' })}>
          <View pointerEvents="none">
            <TextInput
              style={[styles.input, styles.inputLocked]}
              value=""
              editable={false}
              placeholder={t('chef.styleLocked')}
              placeholderTextColor={Colors.inkMute}
              multiline
            />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '800', color: Colors.ink },
  proBadge: {
    fontSize: 10, fontWeight: '800', color: Colors.orangeDeep,
    backgroundColor: Colors.orangeSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.lineSoft,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink,
    minHeight: 52, textAlignVertical: 'top',
  },
  inputLocked: { backgroundColor: Colors.creamSoft, borderStyle: 'dashed', borderColor: Colors.inkMute },
});
