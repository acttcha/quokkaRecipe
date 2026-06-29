import React from 'react';
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

/**
 * 앱 전역 공용 뒤로가기 버튼. RecipeScreen 에 원래 있던 텍스트형 버튼으로 통일.
 * 문구(label)는 각 화면이 쓰던 문자열을 그대로 전달한다 (예: "← 뒤로", "← 다시 찍기").
 */
export function BackButton({
  onPress, label, style,
}: {
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={style}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  text: { color: Colors.ink, fontSize: 14, fontWeight: '700' },
});
