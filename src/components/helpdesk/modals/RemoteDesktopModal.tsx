import React, { useState, useRef, useEffect } from 'react';
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
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  ArrowLeft,
  Home,
  LayoutGrid,
  Maximize2,
  Minimize2,
} from 'lucide-react-native';
import {
  RemoteDesktopSession,
  remoteDesktopService,
} from '../../../services/remoteDesktopService';
import { useTranslation } from '../../../services/i18nService';

interface RemoteDesktopModalProps {
  session: RemoteDesktopSession | null;
  language?: string;
  onAcceptOffer: () => void;
  onRejectOffer: () => void;
  onEndSession: () => void;
}

export const RemoteDesktopModal: React.FC<RemoteDesktopModalProps> = ({
  session,
  onAcceptOffer,
  onRejectOffer,
  onEndSession,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 320,
    height: 480,
  });

  // Çift Katmanlı Akıcı Ekran Mimarisi (Titreme ve Donmayı Önler)
  const [currentFrame, setCurrentFrame] = useState<string | null>(session?.liveFrameUri || null);
  const [prevFrame, setPrevFrame] = useState<string | null>(null);

  // Ölçekleme Durumu: 'fit' (orijinal oran / contain) veya 'cover' (ekranı doldur / cover)
  const [scaleMode, setScaleMode] = useState<'fit' | 'cover'>('fit');

  const toggleScaleMode = () => {
    setScaleMode((prev) => (prev === 'fit' ? 'cover' : 'fit'));
  };

  // Çıkış Tehir Modalı
  const [confirmExitVisible, setConfirmExitVisible] = useState<boolean>(false);

  useEffect(() => {
    if (session?.liveFrameUri) {
      setCurrentFrame(session.liveFrameUri);
    }
    const unsub = remoteDesktopService.onFrame((frameUri) => {
      if (!frameUri) return;
      setCurrentFrame((prev) => {
        if (prev && prev !== frameUri) {
          setPrevFrame(prev);
        }
        return frameUri;
      });
    });
    return () => unsub();
  }, [session?.ticketId]);

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
              {t('helpdesk.remote_desktop.connected')}
            </Text>
            <View style={styles.bannerSeparator} />
            <TouchableOpacity onPress={onEndSession} activeOpacity={0.7}>
              <Text style={styles.stopTextBtn}>
                {t('helpdesk.remote_desktop.stop')}
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
              {t('helpdesk.remote_desktop.request_title')}
            </Text>

            <Text style={styles.bottomSheetDesc}>
              {t('helpdesk.remote_desktop.request_desc', {
                peer: session.peerAlias || t('helpdesk.remote_desktop.support_specialist'),
              })}
            </Text>

            <View style={styles.bottomSheetBtnRow}>
              <TouchableOpacity
                style={styles.textBtn}
                onPress={onRejectOffer}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>
                  {t('helpdesk.remote_desktop.decline')}
                </Text>
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity
                style={styles.textBtn}
                onPress={onAcceptOffer}
                activeOpacity={0.7}
              >
                <Text style={styles.approveText}>
                  {t('helpdesk.remote_desktop.approve')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. YÖNETİCİ (ADMIN) TARAFI: MİNİMALİST, GLASSMORPHISM RUSTED GLASS UZAK MASAÜSTÜ
  // ─────────────────────────────────────────────────────────────────────────────
  const handleClosePress = () => {
    if (session.status === 'active') {
      setConfirmExitVisible(true);
    } else {
      onEndSession();
    }
  };

  const handleCanvasTap = (normX: number, normY: number) => {
    void remoteDesktopService.sendRemoteTap(normX, normY);
  };

  return (
    <Modal
      visible={true}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClosePress}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View
        style={[
          styles.adminFullScreenRoot,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 8 : 14),
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        {/* ── ÜST BAŞLIK: LOGO, ALTINDA BİLET NO, SAĞDA 2 AYRI SIĞDIR BUTONU VE ÇARPI ── */}
        <View style={styles.adminHeaderRow}>
            <View style={styles.adminHeaderLeft}>
              <Text style={styles.headerLogoWhite}>
                White<Text style={styles.headerLogoDesk}>Desk</Text>
              </Text>
              <Text style={styles.headerTicketSub}>
                #{String(session.ticketId || '').replace(/^#/, '')}
              </Text>
            </View>

            <View style={styles.adminHeaderRight}>
              {/* Tek Sığdır Butonu (X İkonu Renginde, Borderless, 1. Basışta Sığdır, 2. Basışta Eski Haline Getir) */}
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={toggleScaleMode}
                activeOpacity={0.7}
                accessibilityLabel={t('helpdesk.remote_desktop.a11y_fit_fullscreen')}
              >
                {scaleMode === 'fit' ? (
                  <Maximize2 size={18} color="#64748B" strokeWidth={2.2} />
                ) : (
                  <Minimize2 size={18} color="#64748B" strokeWidth={2.2} />
                )}
              </TouchableOpacity>

              {/* Kapatma Butonu (X) - Görüntü ekranının sağ kenarı ile bloklu */}
              <TouchableOpacity
                onPress={handleClosePress}
                style={styles.headerCloseBtn}
                activeOpacity={0.7}
                accessibilityLabel={t('helpdesk.remote_desktop.a11y_close')}
              >
                <X size={18} color="#64748B" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── DURUM 1: ONAY BEKLENİYOR ── */}
          {(session.status === 'offering' || session.status === 'connecting') && (
            <View style={styles.centerStatusBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.centerStatusTitle}>
                {t('helpdesk.remote_desktop.waiting_approval')}
              </Text>
              <Text style={styles.centerStatusSub}>
                {t('helpdesk.remote_desktop.waiting_approval_sub')}
              </Text>
            </View>
          )}

          {/* ── DURUM 2: REDDEDİLDİ VEYA KAPALI ── */}
          {(session.status === 'disabled_by_user' || session.status === 'rejected') && (
            <View style={styles.centerStatusBox}>
              <Text style={styles.centerStatusTitle}>
                {session.status === 'disabled_by_user'
                  ? t('helpdesk.remote_desktop.disabled_title')
                  : t('helpdesk.remote_desktop.declined_title')}
              </Text>
              <Text style={styles.centerStatusSub}>
                {session.status === 'disabled_by_user'
                  ? t('helpdesk.remote_desktop.disabled_sub')
                  : t('helpdesk.remote_desktop.declined_sub')}
              </Text>
            </View>
          )}

          {/* ── DURUM 3: CANLI UZAK TUVAL (ÇİFT KATMANLI, DONMASIZ VE SİYAH KENARLIKSIZ) ── */}
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

                const normStartX = start.x / Math.max(1, canvasSize.width);
                const normStartY = start.y / Math.max(1, canvasSize.height);
                const normEndX = locationX / Math.max(1, canvasSize.width);
                const normEndY = locationY / Math.max(1, canvasSize.height);

                if (dist > 16) {
                  // Hızlı, anlık tepki veren kaydırma (140ms fling)
                  void remoteDesktopService.sendRemoteSwipe(
                    normStartX,
                    normStartY,
                    normEndX,
                    normEndY,
                    140
                  );
                } else {
                  handleCanvasTap(normEndX, normEndY);
                }
              }}
            >
              {/* Alt katman (önceki kare) - yeni kare çözülürken ekranı dolu tutar, siyahlık vermez */}
              {prevFrame ? (
                <Image
                  source={{ uri: prevFrame }}
                  style={StyleSheet.absoluteFill}
                  resizeMode={scaleMode === 'fit' ? 'contain' : 'cover'}
                  fadeDuration={0}
                />
              ) : null}

              {/* Üst katman (canlı kare) - doğrudan akıcı çizilir */}
              {currentFrame ? (
                <Image
                  source={{ uri: currentFrame }}
                  style={StyleSheet.absoluteFill}
                  resizeMode={scaleMode === 'fit' ? 'contain' : 'cover'}
                  fadeDuration={0}
                />
              ) : (
                <View style={styles.centerStatusBox}>
                  <ActivityIndicator size="large" color="#2563EB" />
                </View>
              )}
            </View>
          )}

          {/* ── ALT GEZİNME: X İLE AYNI BOYUTTA, PASTEL MAVİ, BORDERLESS 3 BUTON ── */}
          {session.status === 'active' && (
            <View style={styles.bottomNavRow}>
              {/* 1. Geri Ok */}
              <TouchableOpacity
                style={styles.pastelNavBtn}
                onPress={() => void remoteDesktopService.sendRemoteSystemKey('BACK')}
                activeOpacity={0.7}
                accessibilityLabel={t('helpdesk.remote_desktop.a11y_back')}
              >
                <ArrowLeft size={18} color="#2563EB" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* 2. Masaüstü */}
              <TouchableOpacity
                style={styles.pastelNavBtn}
                onPress={() => void remoteDesktopService.sendRemoteSystemKey('HOME')}
                activeOpacity={0.7}
                accessibilityLabel={t('helpdesk.remote_desktop.a11y_home')}
              >
                <Home size={18} color="#2563EB" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* 3. Arka Plan Uygulamalar */}
              <TouchableOpacity
                style={styles.pastelNavBtn}
                onPress={() => void remoteDesktopService.sendRemoteSystemKey('RECENTS')}
                activeOpacity={0.7}
                accessibilityLabel={t('helpdesk.remote_desktop.a11y_recents')}
              >
                <LayoutGrid size={18} color="#2563EB" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── ONAY MODALI: ÇARPIYA BASINCA ALTTAN AÇILIR ── */}
          {confirmExitVisible && (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>
                  {t('helpdesk.remote_desktop.end_conn_title')}
                </Text>
                <Text style={styles.confirmDesc}>
                  {t('helpdesk.remote_desktop.end_conn_desc')}
                </Text>

                <View style={styles.confirmBtnRow}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.confirmBtnCancel]}
                    onPress={() => setConfirmExitVisible(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmBtnCancelText}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.confirmBtnDanger]}
                    onPress={() => {
                      setConfirmExitVisible(false);
                      onEndSession();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmBtnDangerText}>
                      {t('helpdesk.remote_desktop.end_conn_confirm')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
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
    backgroundColor: 'rgba(15, 23, 42, 0.40)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 99999,
    padding: 12,
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
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'left',
  },
  bottomSheetDesc: {
    fontSize: 14,
    color: '#475569',
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
    paddingVertical: 10,
  },
  approveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
  },
  adminFullScreenRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#ffffff',
  },
  adminHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#ffffff',
  },
  adminHeaderLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    flex: 1,
  },
  headerLogoWhite: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerLogoDesk: {
    color: '#2563EB',
    fontWeight: '800',
  },
  headerTicketSub: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  adminHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
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
    color: '#0F172A',
    marginTop: 14,
    textAlign: 'center',
  },
  centerStatusSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
  remoteCanvas: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    position: 'relative',
  },
  bottomNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 16,
  },
  pastelNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
  },
  confirmBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 20,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  confirmDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginLeft: 8,
  },
  confirmBtnCancel: {
    backgroundColor: '#F1F5F9',
  },
  confirmBtnCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  confirmBtnDanger: {
    backgroundColor: '#EF4444',
  },
  confirmBtnDangerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmBtnPrimary: {
    backgroundColor: '#2563EB',
  },
  confirmBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
