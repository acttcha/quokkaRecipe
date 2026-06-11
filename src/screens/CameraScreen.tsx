import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';
import { t } from '../i18n';

interface Props extends NavProps { fridgeMode?: boolean; receiptMode?: boolean; }

export default function CameraScreen({ navigate, goBack, fridgeMode, receiptMode }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // 카메라가 fullscreen 모드라 안드로이드에서 상태바 숨겨지는 경우 있어서,
  // 화면 들어올 때 / 빠져나갈 때 명시적으로 상태바 보이게
  useEffect(() => {
    StatusBar.setHidden(false, 'fade');
    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permRoot}>
        <View style={styles.permCard}>
          <View style={styles.permIconWrap}>
            <Text style={styles.permIcon}>📷</Text>
          </View>
          <Text style={styles.permTitle}>{t('camera.permTitle')}</Text>
          <Text style={styles.permSub}>{t('camera.permSub')}</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>{t('camera.permAllow')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goBack} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{t('camera.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    haptic.medium();
    setCapturing(true);
    try {
      // base64를 직접 받지 않고 파일로 저장 후 읽음 — Android 메모리/파일시스템 호환성
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        Alert.alert(t('camera.oops'), t('camera.captureFailedGet'));
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (receiptMode) {
        navigate({ name: 'ReceiptScan', imageBase64: base64, mimeType: 'image/jpeg' });
      } else if (fridgeMode) {
        navigate({ name: 'FridgeScan', imageBase64: base64, mimeType: 'image/jpeg' });
      } else {
        navigate({ name: 'Recipes', imageBase64: base64, mimeType: 'image/jpeg' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[Camera] capture error:', msg);
      Alert.alert(t('camera.captureFailed'), msg);
    } finally {
      setCapturing(false);
    }
  };

  const handleGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.8,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      haptic.success();
      const b64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (receiptMode) {
        navigate({ name: 'ReceiptScan', imageBase64: b64, mimeType: 'image/jpeg' });
      } else if (fridgeMode) {
        navigate({ name: 'FridgeScan', imageBase64: b64, mimeType: 'image/jpeg' });
      } else {
        navigate({ name: 'Recipes', imageBase64: b64, mimeType: 'image/jpeg' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[Gallery] error:', msg);
      Alert.alert(t('camera.galleryError'), msg);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        <View style={styles.overlay}>
          {/* 상단 */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.glassBtn} onPress={goBack}>
              <Text style={styles.glassBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.hintChip}>
              <Text style={styles.hintChipText}>
                {receiptMode ? t('camera.hintReceipt') : t('camera.hintIngredients')}
              </Text>
            </View>
            <TouchableOpacity style={styles.glassBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
              <Text style={styles.glassBtnText}>🔄</Text>
            </TouchableOpacity>
          </View>

          {/* 하단 */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.galleryBtn} onPress={handleGallery}>
              <Text style={styles.galleryIcon}>🖼️</Text>
              <Text style={styles.galleryLabel}>{t('camera.gallery')}</Text>
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
