import React, { useState, useEffect, useMemo } from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, Dimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import ReactNativeBlobUtil from 'react-native-blob-util';

interface TenantLogoProps {
  uri: string | null;
  height?: number;
  maxHeight?: number;
  maxWidth?: number;
  autoSize?: boolean;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<ViewStyle>;
}

export const TenantLogo: React.FC<TenantLogoProps> = ({
  uri,
  height,
  maxHeight = 72,
  maxWidth,
  autoSize = false,
  align = 'left',
  style,
}) => {
  const [svgXml, setSvgXml] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  // Initial window width fallback to eliminate layout shift on initial render
  const screenWidth = Dimensions.get('window').width;
  const [availableWidth, setAvailableWidth] = useState<number>(screenWidth - 16);

  useEffect(() => {
    if (!uri) {
      setSvgXml(null);
      setAspectRatio(null);
      return;
    }

    const uriLower = uri.toLowerCase();
    const isSvg =
      uriLower.includes('.svg') ||
      uri.startsWith('data:image/svg+xml') ||
      uri.trim().startsWith('<svg');

    if (isSvg) {
      const loadSvg = async () => {
        try {
          let xmlContent = '';
          if (uri.trim().startsWith('<svg')) {
            xmlContent = uri;
          } else {
            const rawPath = uri.split('?')[0];
            const cleanPath = rawPath.startsWith('file://')
              ? decodeURI(rawPath.replace('file://', ''))
              : rawPath;
            xmlContent = await ReactNativeBlobUtil.fs.readFile(cleanPath, 'utf8');
          }

          if (xmlContent) {
            setSvgXml(xmlContent);

            // Extract aspect ratio from viewBox or width/height
            const vbMatch = xmlContent.match(
              /viewBox=["']\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*["']/i
            );
            let ratio = 1;
            if (vbMatch) {
              const w = parseFloat(vbMatch[3]);
              const h = parseFloat(vbMatch[4]);
              if (w > 0 && h > 0) ratio = w / h;
            } else {
              const wMatch = xmlContent.match(/width=["']([0-9.]+)/i);
              const hMatch = xmlContent.match(/height=["']([0-9.]+)/i);
              if (wMatch && hMatch) {
                const w = parseFloat(wMatch[1]);
                const h = parseFloat(hMatch[1]);
                if (w > 0 && h > 0) ratio = w / h;
              }
            }
            setAspectRatio(ratio);
          }
        } catch (err) {
          console.warn('[TenantLogo] Failed to read SVG:', err);
        }
      };
      loadSvg();
    } else {
      setSvgXml(null);
      const cleanImageUri = uri.split('?')[0];
      Image.getSize(
        cleanImageUri,
        (origW, origH) => {
          if (origW > 0 && origH > 0) {
            setAspectRatio(origW / origH);
          }
        },
        (err) => {
          console.warn('[TenantLogo] Image.getSize error:', err);
          setAspectRatio(2.5);
        }
      );
    }
  }, [uri]);

  // Compute final dimensions utilizing the entire available area when autoSize is active
  const { finalWidth, finalHeight } = useMemo(() => {
    const ratio = aspectRatio || 2.5;

    if (autoSize) {
      // Use full available container width, capped at 540pt on large tablets/displays
      const effectiveMaxWidth = Math.min(availableWidth, 540);
      const minH = 46;
      const targetMaxH = maxHeight || 72;

      let calcW: number;
      let calcH: number;

      if (ratio >= 2.2) {
        // Banner / horizontal logo: expand width across available area
        calcW = Math.min(effectiveMaxWidth, Math.round(targetMaxH * ratio));
        calcH = Math.round(calcW / ratio);
        if (calcH < minH) {
          calcH = minH;
          calcW = Math.min(effectiveMaxWidth, Math.round(calcH * ratio));
        }
      } else {
        // Square or standard rectangular logo: scale to maximum height
        calcH = targetMaxH;
        calcW = Math.min(effectiveMaxWidth, Math.round(calcH * ratio));
      }

      return { finalWidth: calcW, finalHeight: calcH };
    }

    // Fixed / modal preview mode
    const explicitH = height || 54;
    const explicitMaxW = maxWidth || 220;
    const calcW = Math.min(explicitMaxW, Math.round(explicitH * ratio));
    return { finalWidth: calcW, finalHeight: explicitH };
  }, [aspectRatio, autoSize, availableWidth, maxHeight, height, maxWidth]);

  if (!uri) return null;

  const containerAlign =
    align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  const svgPreserve =
    align === 'center' ? 'xMidYMid meet' : align === 'right' ? 'xMaxYMid meet' : 'xMinYMid meet';

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - availableWidth) > 4) {
          setAvailableWidth(w);
        }
      }}
      style={[
        styles.container,
        {
          height: finalHeight,
          width: finalWidth,
          alignSelf: containerAlign,
        },
        style,
      ]}
    >
      {svgXml ? (
        <SvgXml
          xml={svgXml}
          width={finalWidth}
          height={finalHeight}
          preserveAspectRatio={svgPreserve}
        />
      ) : (
        <Image
          source={{ uri }}
          style={{
            width: finalWidth,
            height: finalHeight,
            resizeMode: 'contain',
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});

export default TenantLogo;
