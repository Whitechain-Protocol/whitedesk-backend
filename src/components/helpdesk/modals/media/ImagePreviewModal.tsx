import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { X, Download, Share2 } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { useTranslation } from '../../../../services/i18nService';

interface ImagePreviewModalProps {
  visible: boolean;
  imageUri: string | null;
  fileName?: string | null;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUri,
  fileName,
  onClose,
}) => {
  const { t } = useTranslation();
  const [windowDimensions, setWindowDimensions] = useState(Dimensions.get('window'));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowDimensions(window);
    });
    return () => sub?.remove();
  }, []);

  // Base values (persisted across gestures)
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const compositeScale = useRef(Animated.multiply(baseScale, pinchScale)).current;

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const pinchRef = useRef<any>(null);
  const panRef = useRef<any>(null);

  // JS-side accumulators to enforce limits and boundaries
  const currentScaleRef = useRef(1);
  const currentTranslateXRef = useRef(0);
  const currentTranslateYRef = useRef(0);

  const resetTransform = () => {
    currentScaleRef.current = 1;
    currentTranslateXRef.current = 0;
    currentTranslateYRef.current = 0;
    baseScale.setValue(1);
    pinchScale.setValue(1);
    translateX.flattenOffset();
    translateY.flattenOffset();
    translateX.setValue(0);
    translateY.setValue(0);
  };

  useEffect(() => {
    if (visible) {
      resetTransform();
    }
  }, [visible, imageUri]);

  // 1. PINCH GESTURE: Relative pinch scale multiplied with base scale
  const onViewerPinch = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onViewerPinchState = (e: any) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      // Gesture completed: accumulate the new base scale
      const factor = e.nativeEvent.scale || 1;
      let newScale = currentScaleRef.current * factor;
      newScale = Math.min(Math.max(newScale, 1), 8); // Limits between 1x and 8x
      currentScaleRef.current = newScale;

      baseScale.setValue(newScale);
      pinchScale.setValue(1);

      // If user zoomed out back to normal (<= 1), reset pan offsets
      if (newScale <= 1) {
        currentTranslateXRef.current = 0;
        currentTranslateYRef.current = 0;
        translateX.flattenOffset();
        translateY.flattenOffset();
        translateX.setValue(0);
        translateY.setValue(0);
      }
    }
  };

  // 2. PAN GESTURE: Only active / effective when zoomed in (WhatsApp behavior)
  const onViewerPan = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onViewerPanState = (e: any) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      if (currentScaleRef.current > 1) {
        currentTranslateXRef.current += e.nativeEvent.translationX || 0;
        currentTranslateYRef.current += e.nativeEvent.translationY || 0;
        translateX.setOffset(currentTranslateXRef.current);
        translateX.setValue(0);
        translateY.setOffset(currentTranslateYRef.current);
        translateY.setValue(0);
      } else {
        currentTranslateXRef.current = 0;
        currentTranslateYRef.current = 0;
        translateX.flattenOffset();
        translateY.flattenOffset();
        translateX.setValue(0);
        translateY.setValue(0);
      }
    }
  };

  const handleClose = () => {
    resetTransform();
    onClose();
  };

  // SHARE ACTION
  const handleShare = async () => {
    if (!imageUri) return;
    try {
      const isPdf = (fileName || imageUri).toLowerCase().endsWith('.pdf');
      const isPng = (fileName || imageUri).toLowerCase().endsWith('.png');
      const mime = isPdf ? 'application/pdf' : isPng ? 'image/png' : 'image/jpeg';

      let cleanPath = imageUri.replace(/^file:\/\//, '');
      if (isPdf && fileName) {
        const candidatePdf = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
        if (await ReactNativeBlobUtil.fs.exists(candidatePdf)) {
          cleanPath = candidatePdf;
        }
      }
      const shareUri = cleanPath.startsWith('file://') ? cleanPath : `file://${cleanPath}`;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri, {
          mimeType: mime,
          dialogTitle: fileName || (isPdf ? t('helpdesk.media_preview.share_document') : t('helpdesk.media_preview.share_image')),
        });
      } else {
        Alert.alert(t('helpdesk.media_preview.info_title'), t('helpdesk.media_preview.share_unsupported'));
      }
    } catch (e: any) {
      console.warn('[ImagePreviewModal] Share failed:', e);
      Alert.alert(
        t('common.error'),
        t('helpdesk.media_preview.share_failed', {
          error: e?.message || t('helpdesk.media_preview.unknown_error'),
        })
      );
    }
  };

  // DOWNLOAD / SAVE TO MEDIASTORE ACTION
  const handleDownload = async () => {
    if (!imageUri) return;
    try {
      setIsSaving(true);
      const defaultName = fileName || `whitedesk_${Date.now()}.jpg`;
      const isPdf = defaultName.toLowerCase().endsWith('.pdf');
      const mimeType = isPdf
        ? 'application/pdf'
        : defaultName.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';
      const mediaType = (isPdf ? t('common.download') : t('common.image')) as any;

      let cleanPath = imageUri.replace(/^file:\/\//, '');
      if (isPdf && fileName) {
        const candidatePdf = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
        if (await ReactNativeBlobUtil.fs.exists(candidatePdf)) {
          cleanPath = candidatePdf;
        }
      }

      if (Platform.OS === 'android') {
        await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
          { name: defaultName, parentFolder: 'WhiteDesk', mimeType } as any,
          mediaType,
          cleanPath
        );
        Alert.alert(
          t('common.success'),
          isPdf
            ? t('helpdesk.media_preview.saved_pdf_android')
            : t('helpdesk.media_preview.saved_image_android')
        );
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(cleanPath, {
            mimeType,
            dialogTitle: t('helpdesk.media_preview.save_file_dialog'),
          });
        }
      }
    } catch (e: any) {
      console.warn('[ImagePreviewModal] Save media failed:', e);
      Alert.alert(t('common.error'), t('helpdesk.media_preview.save_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible || !imageUri) return null;

  const { width: windowWidth, height: windowHeight } = windowDimensions;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={handleClose}
      hardwareAccelerated={true}
    >
      <GestureHandlerRootView style={styles.fullImageOverlay}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

        {/* TOP ACTIONS BAR (Download, Share, Close) */}
        <View style={styles.topActionsContainer}>
          {/* İndir Butonu */}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={handleDownload}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Download size={22} color="#ffffff" strokeWidth={2.2} />
            )}
          </TouchableOpacity>

          {/* Paylaş Butonu */}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={handleShare}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Share2 size={22} color="#ffffff" strokeWidth={2.2} />
          </TouchableOpacity>

          {/* X Kapat Butonu */}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <X size={24} color="#ffffff" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <PanGestureHandler
          ref={panRef}
          simultaneousHandlers={pinchRef}
          onGestureEvent={onViewerPan}
          onHandlerStateChange={onViewerPanState}
          minPointers={1}
          maxPointers={2}
          avgTouches={true}
        >
          <Animated.View style={StyleSheet.absoluteFill}>
            <PinchGestureHandler
              ref={pinchRef}
              simultaneousHandlers={panRef}
              onGestureEvent={onViewerPinch}
              onHandlerStateChange={onViewerPinchState}
            >
              <Animated.View
                style={[
                  styles.fullImagePinchContainer,
                  { width: windowWidth, height: windowHeight },
                ]}
              >
                <Animated.Image
                  source={{ uri: imageUri }}
                  style={[
                    styles.fullImage,
                    {
                      width: windowWidth,
                      height: windowHeight,
                      transform: [
                        { scale: compositeScale },
                        { translateX: translateX },
                        { translateY: translateY },
                      ],
                    },
                  ]}
                  resizeMode="contain"
                  onLoadStart={() => setIsLoading(true)}
                  onLoadEnd={() => setIsLoading(false)}
                  onError={(e) => {
                    setIsLoading(false);
                    console.warn('[ImagePreviewModal] Image load error:', e.nativeEvent.error);
                  }}
                />
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>

        {isLoading && (
          <View style={styles.fullImageLoadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullImageOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImagePinchContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topActionsContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 44 : 54,
    right: 16,
    zIndex: 35,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  fullImage: {
    flex: 1,
  },
  fullImageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
  },
});
