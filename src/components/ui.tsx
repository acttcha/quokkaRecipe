import React from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export function SearchIcon({ size = 22, color = '#3A2810' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="m16 16 4 4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ size = 22, color = '#3A2810' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

export function SettingsIcon({ size = 22, color = '#3A2810' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke={color} strokeWidth={1.6} />
      <Path d="M19.4 13.6a7.6 7.6 0 0 0 0-3.2l1.8-1.4-1.8-3.1-2.1.7a7.6 7.6 0 0 0-2.8-1.6L14 2.5h-3.6l-.5 2.5a7.6 7.6 0 0 0-2.8 1.6l-2.1-.7L3.2 9l1.8 1.4a7.6 7.6 0 0 0 0 3.2L3.2 15l1.8 3.1 2.1-.7a7.6 7.6 0 0 0 2.8 1.6l.5 2.5h3.6l.5-2.5a7.6 7.6 0 0 0 2.8-1.6l2.1.7 1.8-3.1-1.8-1.4Z"
        stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function CircleIconButton({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#EAD5AC',
    backgroundColor: 'rgba(255,250,238,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#785014',
        shadowOpacity: 0.10,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
    }),
  },
  btnPressed: { opacity: 0.7 },
});
