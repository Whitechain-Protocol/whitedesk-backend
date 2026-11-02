import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  PanResponder,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { X, Check, Scissors, RotateCcw } from 'lucide-react-native';

interface ImageCropModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onConfirm: (cropInfo: { x: number; y: number; width: number; height: number }) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  visible,
  imageUri,
  onClose,
  onConfirm,
}) => {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [containerLayout, setContainerLayout] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Display dimensions and offset of the image inside the container
  const [renderedImage, setRenderedImage] = useState<{
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  }>({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  // Crop box rectangle relative to container
  const [cropBox, setCropBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: 0, height: 0 });

  const cropBoxRef = useRef(cropBox);
  cropBoxRef.current = cropBox;

  const renderedImageRef = useRef(renderedImage);
  renderedImageRef.current = renderedImage;

  // Read image dimensions whenever imageUri changes
  useEffect(() => {
    if (imageUri && visible) {
      setIsProcessing(false);
      Image.getSize(
        imageUri,
        (width, height) => {
          setImageSize({ width, height });
        },
        () => {
          setImageSize({ width: 800, height: 600 });
        }
      );
    }
  }, [imageUri, visible]);

  // Compute rendered image bounds and initialize crop box
  useEffect(() => {
    if (!imageSize || containerLayout.width === 0 || containerLayout.height === 0) return;

    const contW = containerLayout.width;
    const contH = containerLayout.height;
    const imgRatio = imageSize.width / imageSize.height;
    const contRatio = contW / contH;

    let dispW = contW;
    let dispH = contH;
    let offX = 0;
    let offY = 0;

    if (imgRatio > contRatio) {
      // Fit to width
      dispW = contW;
      dispH = contW / imgRatio;
      offX = 0;
      offY = (contH - dispH) / 2;
    } else {
      // Fit to height
      dispH = contH;
      dispW = contH * imgRatio;
      offX = (contW - dispW) / 2;
      offY = 0;
    }

    setRenderedImage({ width: dispW, height: dispH, offsetX: offX, offsetY: offY });

    // Initial crop box: 80% width, 60% height centered
    const initialW = dispW * 0.82;
    const initialH = dispH * 0.65;
    setCropBox({
      x: offX + (dispW - initialW) / 2,
      y: offY + (dispH - initialH) / 2,
      width: initialW,
      height: initialH,
    });
  }, [imageSize, containerLayout]);

  const resetCrop = () => {
    if (!renderedImage.width) return;
    const initialW = renderedImage.width * 0.85;
    const initialH = renderedImage.height * 0.70;
    setCropBox({
      x: renderedImage.offsetX + (renderedImage.width - initialW) / 2,
      y: renderedImage.offsetY + (renderedImage.height - initialH) / 2,
      width: initialW,
      height: initialH,
    });
  };

  // PanResponder helper for dragging borders & corners
  const createHandleResponder = (
    type: 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'move'
  ) => {
    let startBox = { x: 0, y: 0, width: 0, height: 0 };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startBox = { ...cropBoxRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        const img = renderedImageRef.current;
        const minSize = 40;

        let newX = startBox.x;
        let newY = startBox.y;
        let newW = startBox.width;
        let newH = startBox.height;

        if (type === 'move') {
          newX = Math.max(img.offsetX, Math.min(img.offsetX + img.width - startBox.width, startBox.x + dx));
          newY = Math.max(img.offsetY, Math.min(img.offsetY + img.height - startBox.height, startBox.y + dy));
        } else {
          // Adjust top
          if (type === 'top' || type === 'topLeft' || type === 'topRight') {
            const proposedY = startBox.y + dy;
            const clampedY = Math.max(img.offsetY, Math.min(startBox.y + startBox.height - minSize, proposedY));
            newY = clampedY;
            newH = startBox.height + (startBox.y - clampedY);
          }
          // Adjust bottom
          if (type === 'bottom' || type === 'bottomLeft' || type === 'bottomRight') {
            const proposedH = startBox.height + dy;
            newH = Math.max(minSize, Math.min(img.offsetY + img.height - startBox.y, proposedH));
          }
          // Adjust left
          if (type === 'left' || type === 'topLeft' || type === 'bottomLeft') {
            const proposedX = startBox.x + dx;
            const clampedX = Math.max(img.offsetX, Math.min(startBox.x + startBox.width - minSize, proposedX));
            newX = clampedX;
            newW = startBox.width + (startBox.x - clampedX);
          }
          // Adjust right
          if (type === 'right' || type === 'topRight' || type === 'bottomRight') {
            const proposedW = startBox.width + dx;
            newW = Math.max(minSize, Math.min(img.offsetX + img.width - startBox.x, proposedW));
          }
        }

        setCropBox({
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
      },
    });
  };

  const topPan = useRef(createHandleResponder('top')).current;
  const bottomPan = useRef(createHandleResponder('bottom')).current;
  const leftPan = useRef(createHandleResponder('left')).current;
  const rightPan = useRef(createHandleResponder('right')).current;
  const movePan = useRef(createHandleResponder('move')).current;

  const topLeftPan = useRef(createHandleResponder('topLeft')).current;
  const topRightPan = useRef(createHandleResponder('topRight')).current;
  const bottomLeftPan = useRef(createHandleResponder('bottomLeft')).current;
  const bottomRightPan = useRef(createHandleResponder('bottomRight')).current;

  const handleConfirm = () => {
    if (!imageSize || !renderedImage.width || !renderedImage.height) return;

    setIsProcessing(true);

    const scaleX = imageSize.width / renderedImage.width;
    const scaleY = imageSize.height / renderedImage.height;

    const actualX = Math.max(0, Math.round((cropBox.x - renderedImage.offsetX) * scaleX));
    const actualY = Math.max(0, Math.round((cropBox.y - renderedImage.offsetY) * scaleY));
    const actualW = Math.min(imageSize.width - actualX, Math.round(cropBox.width * scaleX));
    const actualH = Math.min(imageSize.height - actualY, Math.round(cropBox.height * scaleY));

    onConfirm({
      x: actualX,
      y: actualY,
      width: actualW,
      height: actualH,
    });
  };

  if (!visible || !imageUri) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent={true}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <SafeAreaView style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn} disabled={isProcessing}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Logoyu Kırp & Çerçevele</Text>
            <Text style={styles.headerSubtitle}>4 kenardan daraltarak logoyu çevreleyin</Text>
          </View>
          <TouchableOpacity onPress={resetCrop} style={styles.headerResetBtn} disabled={isProcessing}>
            <RotateCcw size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* CROP WORKSPACE / CANVAS */}
        <View
          style={styles.canvasContainer}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContainerLayout({ width, height });
          }}
        >
          {renderedImage.width > 0 && (
            <Image
              source={{ uri: imageUri }}
              style={{
                position: 'absolute',
                left: renderedImage.offsetX,
                top: renderedImage.offsetY,
                width: renderedImage.width,
                height: renderedImage.height,
              }}
              resizeMode="contain"
            />
          )}

          {/* DARK SCRIM OVERLAYS (OUTSIDE CROP BOX) */}
          {containerLayout.width > 0 && cropBox.width > 0 && (
            <>
              {/* Top Scrim */}
              <View
                pointerEvents="none"
                style={[
                  styles.scrim,
                  {
                    top: 0,
                    left: 0,
                    right: 0,
                    height: cropBox.y,
                  },
                ]}
              />
              {/* Bottom Scrim */}
              <View
                pointerEvents="none"
                style={[
                  styles.scrim,
                  {
                    top: cropBox.y + cropBox.height,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  },
                ]}
              />
              {/* Left Scrim */}
              <View
                pointerEvents="none"
                style={[
                  styles.scrim,
                  {
                    top: cropBox.y,
                    left: 0,
                    width: cropBox.x,
                    height: cropBox.height,
                  },
                ]}
              />
              {/* Right Scrim */}
              <View
                pointerEvents="none"
                style={[
                  styles.scrim,
                  {
                    top: cropBox.y,
                    left: cropBox.x + cropBox.width,
                    right: 0,
                    height: cropBox.height,
                  },
                ]}
              />
            </>
          )}

          {/* ACTIVE CROP BOX */}
          {cropBox.width > 0 && (
            <View
              style={[
                styles.cropBox,
                {
                  left: cropBox.x,
                  top: cropBox.y,
                  width: cropBox.width,
                  height: cropBox.height,
                },
              ]}
            >
              {/* DRAGGABLE CENTER AREA */}
              <View style={StyleSheet.absoluteFill} {...movePan.panHandlers}>
                {/* 3x3 GUIDELINES */}
                <View style={[styles.gridH, { top: '33.33%' }]} />
                <View style={[styles.gridH, { top: '66.66%' }]} />
                <View style={[styles.gridV, { left: '33.33%' }]} />
                <View style={[styles.gridV, { left: '66.66%' }]} />
              </View>

              {/* 4 DRAGGABLE BORDER HANDLES */}
              {/* Top Handle */}
              <View style={styles.topHandleArea} {...topPan.panHandlers}>
                <View style={styles.handleBarH} />
              </View>

              {/* Bottom Handle */}
              <View style={styles.bottomHandleArea} {...bottomPan.panHandlers}>
                <View style={styles.handleBarH} />
              </View>

              {/* Left Handle */}
              <View style={styles.leftHandleArea} {...leftPan.panHandlers}>
                <View style={styles.handleBarV} />
              </View>

              {/* Right Handle */}
              <View style={styles.rightHandleArea} {...rightPan.panHandlers}>
                <View style={styles.handleBarV} />
              </View>

              {/* 4 CORNER HANDLES */}
              <View style={[styles.cornerHandle, styles.cornerTL]} {...topLeftPan.panHandlers} />
              <View style={[styles.cornerHandle, styles.cornerTR]} {...topRightPan.panHandlers} />
              <View style={[styles.cornerHandle, styles.cornerBL]} {...bottomLeftPan.panHandlers} />
              <View style={[styles.cornerHandle, styles.cornerBR]} {...bottomRightPan.panHandlers} />
            </View>
          )}
        </View>

        {/* FOOTER ACTIONS */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Vazgeç</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmBtn, isProcessing && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Scissors size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.confirmBtnText}>
              {isProcessing ? 'Arka Plan Temizleniyor...' : 'Tamam & Arka Planı Kaldır'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginTop: StatusBar.currentHeight ? StatusBar.currentHeight / 2 : 0,
  },
  headerCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  headerResetBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#020617',
    position: 'relative',
    overflow: 'hidden',
  },
  scrim: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  cropBox: {
    position: 'absolute',
    borderColor: '#3B82F6',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  // Border Handle Areas
  topHandleArea: {
    position: 'absolute',
    top: -15,
    left: 20,
    right: 20,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomHandleArea: {
    position: 'absolute',
    bottom: -15,
    left: 20,
    right: 20,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftHandleArea: {
    position: 'absolute',
    left: -15,
    top: 20,
    bottom: 20,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightHandleArea: {
    position: 'absolute',
    right: -15,
    top: 20,
    bottom: 20,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBarH: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
  },
  handleBarV: {
    width: 5,
    height: 44,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
  },
  // Corner Handles
  cornerHandle: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: -3,
    left: -3,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: -3,
    right: -3,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#1D4ED8',
    opacity: 0.7,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
