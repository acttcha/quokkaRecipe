import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const LEAF = require('../../assets/leaf.webp');

interface Props {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function LeafIcon({ size = 16, style }: Props) {
  return (
    <Image
      source={LEAF}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
