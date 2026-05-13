import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';

interface Props extends NavProps { fridgeMode?: boolean; }

export default function CameraScreen({ navigate, goBack, fridgeMode }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permRoot}>
        <View style={styles.permCard}>
          <View style={styles.permIconWrap}>
            <Text style={styles.permIcon}>📷</Text>
          </View>
          <Text style={styles.permTitle}>카메라 권한이{'\n'}필요해요</Text>
          <Text style={styles.permSub}>재료를 인식하려면{'\n'}카메라 접근을 허용해주세요</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>권한 허용</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goBack} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.8 });
      if (photo?.base64) {
        if (fridgeMode) {
          navigate({ name: 'FridgeScan', imageBase64: photo.base64, mimeType: 'image/jpeg' });
        } else {
          navigate({ name: 'Recipes', imageBase64: photo.base64, mimeType: 'image/jpeg' });
        }
      } else {
        Alert.alert('앗!', '사진을 가져오지 못했어요');
      }
    } catch {
      Alert.alert('앗!', '촬영에 실패했어요');
    } finally {
      setCapturing(false);
    }
  };

  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const b64 = result.assets[0].base64;
      if (fridgeMode) {
        navigate({ name: 'FridgeScan', imageBase64: b64, mimeType: 'image/jpeg' });
      } else {
        navigate({ name: 'Recipes', imageBase64: b64, mimeType: 'image/jpeg' });
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        <View style={styles.overlay}>
          {/* 상단 */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.glassBtn} onPress={goBack}>
              <Text style={styles.glassBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.hintChip}>
              <Text style={styles.hintChipText}>재료가 잘 보이게 찍어요 🌿</Text>
            </View>
            <TouchableOpacity style={styles.glassBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
              <Text style={styles.glassBtnText}>🔄</Text>
            </TouchableOpacity>
          </View>

          {/* 하단 */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.galleryBtn} onPress={handleGallery}>
              <Text style={styles.galleryIcon}>🖼️</Text>
              <Text style={styles.galleryLabel}>갤러리</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shutterOuter, capturing && { opacity: 0.6 }]}
              onPress={handleCapture}
              disabled={capturing}
            >
              {capturing
                ? <ActivityIndicator color={Colors.accent} size="large" />
                : <View style={styles.shutterInner} />
              }
            </TouchableOpacity>

            <View style={{ width: 72 }} />
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 56, paddingBottom: 12,
  },
  glassBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  glassBtnText: { fontSize: 17, color: '#FFF' },
  hintChip: {
    backgroundColor: Colors.yellow,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  hintChipText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 40, paddingBottom: 52, paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  galleryBtn: { alignItems: 'center', width: 72 },
  galleryIcon: { fontSize: 28 },
  galleryLabel: { color: '#FFF', fontSize: 11, fontWeight: '700', marginTop: 5 },

  shutterOuter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: '#FFF',
  },

  permRoot: { flex: 1, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', padding: 28 },
  permCard: {
    backgroundColor: Colors.card, borderRadius: 28, padding: 32,
    alignItems: 'center', width: '100%',
    ...shadow.md,
  },
  permIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.cardGreen,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  permIcon: { fontSize: 40 },
  permTitle: { fontSize: 24, fontWeight: '900', color: Colors.text, textAlign: 'center', marginBottom: 10 },
  permSub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 26 },
  permBtn: {
    backgroundColor: Colors.accent, borderRadius: 16,
    paddingHorizontal: 36, paddingVertical: 15, marginBottom: 12,
  },
  permBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: { padding: 10 },
  cancelText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
});
