import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import {
  RemoteDesktopSession,
  remoteDesktopService,
} from '../../../services/remoteDesktopService';

interface RemoteDesktopModalProps {
  session: RemoteDesktopSession | null;
  language?: string;
  onAcceptOffer: () => void;
  onRejectOffer: () => void;
  onEndSession: () => void;
}

export const RemoteDesktopModal: React.FC<RemoteDesktopModalProps> = ({
  session,
  language = 'tr',
  onAcceptOffer,
  onRejectOffer,
  onEndSession,
}) => {
  const isEn = language === 'en';
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 320,
    height: 540,
  });

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  if (!session || session.status === 'idle' || session.status === 'ended') {
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. KULLANICI TARAFI: AKTİF OTURUMDA SADE DURDURMA ÇUBUĞU
  // ─────────────────────────────────────────────────────────────────────────────
  if (session.role === 'user' && (session.status === 'active' || session.status === 'connecting')) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.userActiveBannerWrap} pointerEvents="box-none">
          <View style={styles.userActiveBanner}>
            <View style={styles.liveDot} />
            <Text style={styles.userActiveTitle} numberOfLines={1}>
              {isEn ? 'Remote desktop connected' : 'Uzak masaüstü bağlı'}
            </Text>
            <View style={styles.bannerSeparator} />
            <TouchableOpacity onPress={onEndSession} activeOpacity={0.7}>
              <Text style={styles.stopTextBtn}>
                {isEn ? 'Stop' : 'Durdur'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. KULLANICI TARAFI: SAMSUNG ONE UI ALTTAN AÇILAN ONAY EKRANI (REDDET | ONAYLA)
  // ─────────────────────────────────────────────────────────────────────────────
  if (session.role === 'user' && session.status === 'incoming_offer') {
    return (
      <Modal
        visible={true}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onRejectOffer}
      >
        <View style={styles.bottomSheetOverlay}>
          <View style={styles.bottomSheetContainer}>
            <Text style={styles.bottomSheetTitle}>
              {isEn ? 'Remote Desktop Request' : 'Uzak Masaüstü İsteği'}
            </Text>

            <Text style={styles.bottomSheetDesc}>
              {isEn
                ? `${session.peerAlias || 'Support Specialist'} wants to connect to your screen.`
                : `${session.peerAlias || 'Destek Uzmanı'} ekranınıza bağlanmak istiyor.`}
            </Text>

            <View style={styles.bottomSheetBtnRow}>
              <TouchableOpacity
                style={styles.textBtn}
                onPress={onRejectOffer}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>
                  {isEn ? 'Decline' : 'Reddet'}
                </Text>
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity
                style={styles.textBtn}
                onPress={onAcceptOffer}
                activeOpacity={0.7}
              >
                <Text style={styles.approveText}>
                  {isEn ? 'Approve' : 'Onayla'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. YÖNETİCİ (ADMIN) TARAFI: SAMSUNG ONE UI UZAK MASAÜSTÜ PENCERESİ
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onEndSession}
    >
      <View style={styles.bottomSheetOverlay}>
        <View style={styles.adminSheetContainer}>
          {/* Üst Başlık */}
          <View style={styles.adminHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminHeaderTitle}>
                {isEn ? 'Remote Desktop' : 'Uzak Masaüstü'}
              </Text>
              <Text style={styles.adminHeaderSub} numberOfLines={1}>
                {`#${session.ticketId}`}
              </Text>
            </View>
            <TouchableOpacity onPress={onEndSession} style={{ padding: 6 }} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Durum 1: Onay Bekleniyor */}
          {(session.status === 'offering' || session.status === 'connecting') && (
            <View style={styles.centerStatusBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.centerStatusTitle}>
                {isEn ? 'Waiting for approval...' : 'Kullanıcı onayı bekleniyor...'}
              </Text>
              <Text style={styles.centerStatusSub}>
                {isEn
                  ? 'The screen will open here once approved.'
                  : 'Onay verildiğinde karşı ekran bu pencerede açılacaktır.'}
              </Text>
            </View>
          )}

          {/* Durum 2: Reddedildi veya Kapalı */}
          {(session.status === 'disabled_by_user' || session.status === 'rejected') && (
            <View style={styles.centerStatusBox}>
              <Text style={styles.centerStatusTitle}>
                {session.status === 'disabled_by_user'
                  ? isEn
                    ? 'Remote Desktop Disabled'
                    : 'Uzak Masaüstü Kapalı'
                  : isEn
                    ? 'Request Declined'
                    : 'İstek Reddedildi'}
              </Text>
              <Text style={styles.centerStatusSub}>
                {session.status === 'disabled_by_user'
                  ? isEn
                    ? 'The user has disabled remote desktop access in preferences.'
                    : 'Kullanıcı ayarlarından uzak masaüstü iznini kapatmış.'
                  : isEn
                    ? 'The user declined the connection request.'
                    : 'Kullanıcı bağlantı isteğini onaylamadı.'}
              </Text>
            </View>
          )}

          {/* Durum 3: Aktif Uzak Masaüstü — Ölçeklenmiş Canlı Ekran */}
          {session.status === 'active' && (
            <View
              style={styles.remoteCanvas}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  setCanvasSize({ width, height });
                }
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                const { locationX, locationY } = e.nativeEvent;
                touchStartRef.current = {
                  x: locationX,
                  y: locationY,
                  time: Date.now(),
                };
              }}
              onResponderRelease={(e) => {
                const start = touchStartRef.current;
                touchStartRef.current = null;
                if (!start) return;

                const { locationX, locationY } = e.nativeEvent;
                const dx = locationX - start.x;
                const dy = locationY - start.y;
                const dist = Math.hypot(dx, dy);
                const elapsed = Math.max(80, Math.min(900, Date.now() - start.time));

                const normStartX = start.x / Math.max(1, canvasSize.width);
                const normStartY = start.y / Math.max(1, canvasSize.height);
                const normEndX = locationX / Math.max(1, canvasSize.width);
                const normEndY = locationY / Math.max(1, canvasSize.height);

                if (dist > 18) {
                  void remoteDesktopService.sendRemoteSwipe(
                    normStartX,
                    normStartY,
                    normEndX,
                    normEndY,
                    elapsed
                  );
                } else {
                  void remoteDesktopService.sendRemoteTap(normEndX, normEndY);
                }
              }}
            >
              {session.liveFrameUri ? (
                <Image
                  source={{ uri: session.liveFrameUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="stretch"
                  fadeDuration={0}
                />
              ) : (
                <View style={styles.centerStatusBox}>
                  <ActivityIndicator size="large" color="#2563EB" />
                </View>
              )}
            </View>
          )}

          {/* Alt Samsung One UI Kapat / Sonlandır Satırı */}
          <View style={styles.bottomSheetBtnRow}>
            <TouchableOpacity
              style={styles.textBtn}
              onPress={onEndSession}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.cancelText,
                  session.status === 'active' && { color: '#EF4444', fontWeight: '700' },
                ]}
              >
                {session.status === 'active'
                  ? isEn
                    ? 'End Session'
                    : 'Oturumu Sonlandır'
                  : isEn
                    ? 'Close'
                    : 'Kapat'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  bottomSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 99999,
    padding: 16,
  },
  bottomSheetContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 25,
    alignItems: 'stretch',
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 10,
    textAlign: 'left',
  },
  bottomSheetDesc: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'left',
  },
  bottomSheetBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 12,
  },
  textBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  approveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
  },
  adminSheetContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 420,
    height: Dimensions.get('window').height * 0.84,
    marginBottom: Platform.OS === 'ios' ? 20 : 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 25,
  },
  adminHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  adminHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  adminHeaderSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  centerStatusBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centerStatusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginTop: 14,
    textAlign: 'center',
  },
  centerStatusSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
  remoteCanvas: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  userActiveBannerWrap: {
    position: 'absolute',
    top: 44,
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 9999,
  },
  userActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginRight: 8,
  },
  userActiveTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  bannerSeparator: {
    width: 1,
    height: 14,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  stopTextBtn: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
});
