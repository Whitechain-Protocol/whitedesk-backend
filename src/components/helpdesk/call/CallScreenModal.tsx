import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Paperclip,
  MessageSquare,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { VoiceCallSession } from '../../../services/voiceCallService';
import { useTranslation } from '../../../services/i18nService';

export interface CallScreenModalProps {
  session: VoiceCallSession | null;
  isAdmin?: boolean;
  onAnswer: () => void;
  onReject: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onAttachFile?: () => void;
  /** Controls visibility of the modal. Optional; defaults to false. */
  visible?: boolean;
}

export const CallScreenModal: React.FC<CallScreenModalProps> = ({
  session,
  isAdmin,
  onAnswer,
  onReject,
  onEndCall,
  onToggleMute,
  onToggleSpeaker,
  onAttachFile,
  visible = false,
}) => {
  const { t } = useTranslation();
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Canlı ses spektrumu animasyonu (bağlantı kurulduğunda)
  const wave1 = useRef(new Animated.Value(0.4)).current;
  const wave2 = useRef(new Animated.Value(0.8)).current;
  const wave3 = useRef(new Animated.Value(0.3)).current;
  const wave4 = useRef(new Animated.Value(0.9)).current;
  const wave5 = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!session) return;

    if (session.state === 'connected') {
      const animateWave = (anim: Animated.Value, min: number, max: number, duration: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: max, duration, useNativeDriver: true }),
            Animated.timing(anim, { toValue: min, duration, useNativeDriver: true }),
          ])
        );

      const w1 = animateWave(wave1, 0.2, 1, 450);
      const w2 = animateWave(wave2, 0.3, 0.9, 380);
      const w3 = animateWave(wave3, 0.1, 0.8, 520);
      const w4 = animateWave(wave4, 0.4, 1, 410);
      const w5 = animateWave(wave5, 0.2, 0.85, 490);

      w1.start();
      w2.start();
      w3.start();
      w4.start();
      w5.start();

      return () => {
        w1.stop();
        w2.stop();
        w3.stop();
        w4.stop();
        w5.stop();
      };
    }
  }, [session?.state]);

  // Early exits when session is not ready
  if (!session || session.state === 'idle' || session.state === 'ended' || session.callType === 'ptt') {
    return null;
  }

  // Modal visibility guard – render nothing when hidden
  if (!visible) {
    return null;
  }

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isOutgoing = session.state === 'outgoing_ringing' || session.state === 'request_sent';
  const isIncoming = session.state === 'incoming_ringing' || session.state === 'request_received';
  const isConnecting = session.state === 'connecting' || session.state === 'request_accepted';
  const isConnected = session.state === 'connected';

  /**
   * KULLANICI / ADMİN GÖRÜNÜM ADI:
   * - Kullanıcı ekranında karşı taraf: "Admin"
   * - Admin ekranında: İsim yazılmışsa o isim, yazılmamışsa kör ID (33543...454535 formatında)
   */
  const getDisplayName = (): string => {
    const isCurrentDeviceAdmin = !!isAdmin;

    // Kullanıcı ekranında karşı taraf her zaman 'Admin'
    if (!isCurrentDeviceAdmin) {
      return t('helpdesk.admin_role_short');
    }

    // Admin ekranında kullanıcı bilgisi:
    const otherAlias = session.role === 'caller' ? session.calleeAlias : session.callerAlias;
    const otherId = session.role === 'caller' ? session.calleeWhiteId : session.callerWhiteId;

    if (
      otherAlias &&
      otherAlias !== t('helpdesk.call.role_user') &&
      otherAlias !== 'User' &&
      otherAlias !== t('helpdesk.call.you') &&
      !otherAlias.toLowerCase().includes('admin') &&
      !otherAlias.toLowerCase().includes(t('helpdesk.call.operator_keyword')) &&
      !otherAlias.startsWith('wh_') &&
      !otherAlias.startsWith('usr_')
    ) {
      return otherAlias;
    }

    if (otherId) {
      if (otherId.length > 12) {
        return `${otherId.slice(0, 5)}...${otherId.slice(-5)}`;
      }
      return otherId;
    }

    return '33543...454535';
  };

  // Minimized view (PIP)
  if (isMinimized) {
    return (
      <View style={styles.minimizedContainer}>
        <BlurView intensity={Platform.OS === 'android' ? 80 : 60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.minimizedGlassTint} />
        <TouchableOpacity style={styles.minimizedMainArea} onPress={() => setIsMinimized(false)} activeOpacity={0.8}>
          <View style={styles.minimizedLivePulse}>
            <Phone size={14} color="#22C55E" />
          </View>
          <Text style={styles.minimizedTitle} numberOfLines={1}>
            {getDisplayName()}
          </Text>
          <Text style={styles.minimizedTimer}>
            {isConnected ? formatDuration(session.durationSeconds) : t('helpdesk.call.call_in_progress')}
          </Text>
          <ChevronUp size={16} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.minimizedHangupBtn} onPress={onEndCall} activeOpacity={0.8}>
          <Phone size={14} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={isIncoming ? onReject : onEndCall}
    >
      <View style={styles.modalBackdrop}>
        {/* SAMSUNG CALL APP ESTETİĞİ: ALTTAN AÇILAN SAYDAM FROSTED GLASS CALL SHEET */}
        <View style={styles.sheetContainer}>
          {/* 1. LAYER: BLURVIEW SAYDAM BUZLU CAM */}
          <BlurView intensity={Platform.OS === 'android' ? 70 : 50} tint="dark" style={StyleSheet.absoluteFill} />

          {/* 2. LAYER: SAYDAM İCON.PNG LACİVERTİ VE IŞILTI KATMANI */}
          <View style={styles.translucentTint} />
          <View style={styles.ambientOrbLeft} />
          <View style={styles.ambientOrbRight} />

          {/* 4. SHEET İÇERİĞİ */}
          <View style={styles.sheetContent}>
            {/* DRAG HANDLE / KÜÇÜLTME TETİKLEYİCİ */}
            <TouchableOpacity onPress={() => setIsMinimized(true)} hitSlop={{ top: 12, bottom: 12, left: 30, right: 30 }} activeOpacity={0.6}>
              <View style={styles.dragHandle} />
            </TouchableOpacity>

            {/* TEPEDE: Uçtan uca şifreli - P2P */}
            <View style={styles.badgeRow}>
              <View style={styles.cryptoBadge}>
                <Lock size={12} color="#6EE7B7" style={{ marginRight: 6 }} />
                <Text style={styles.cryptoBadgeText}>
                  {session.connectionMode === 'p2p_direct' ? t('helpdesk.call.e2ee_p2p') : t('helpdesk.call.e2ee_turn')}
                </Text>
              </View>
            </View>

            {/* ORTADA: İSİM YA DA KÖR ID (33543...454535) - BİLET YAZISI YOK! */}
            <View style={styles.callerHeader}>
              <Text style={styles.callerNameTitle} numberOfLines={1}>
                {getDisplayName()}
              </Text>

              {/* ALTINDA: GELEN ARAMA / GİDEN ARAMA / SÜRE */}
              <View style={styles.statusBox}>
                {isOutgoing && (
                  <Text style={styles.statusText}>{t('helpdesk.call.outgoing_call')}</Text>
                )}
                {isIncoming && (
                  <Text style={styles.statusText}>{t('helpdesk.call.incoming_call')}</Text>
                )}
                {isConnecting && (
                  <Text style={styles.statusText}>{t('helpdesk.call.connecting')}</Text>
                )}
                {isConnected && (
                  <View style={styles.connectedBox}>
                    <Text style={styles.timerText}>{formatDuration(session.durationSeconds)}</Text>
                    {/* Minimal Waveform Visualizer */}
                    <View style={styles.waveformContainer}>
                      {[wave1, wave2, wave3, wave4, wave5].map((w, idx) => (
                        <Animated.View
                          key={idx}
                          style={[
                            styles.waveBar,
                            { transform: [{ scaleY: w }] },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* GELEN ARAMA İLE BUTONLAR ARASINDA: DOĞRUDAN ZEMİNE OTURAN, BUTONSUZ / ÇERÇEVESİZ İKON SIRASI */}
            <View style={styles.flatUtilityRow}>
              {/* 1. MİKROFON */}
              <TouchableOpacity style={styles.flatIconTouch} onPress={onToggleMute} activeOpacity={0.6}>
                {session.isMuted ? (
                  <MicOff size={24} color="#EF4444" strokeWidth={2.2} />
                ) : (
                  <Mic size={24} color="#F1F5F9" strokeWidth={2} />
                )}
              </TouchableOpacity>

              {/* 2. HOPARLÖR */}
              <TouchableOpacity style={styles.flatIconTouch} onPress={onToggleSpeaker} activeOpacity={0.6}>
                {session.isSpeaker ? (
                  <Volume2 size={24} color="#22C55E" strokeWidth={2.2} />
                ) : (
                  <VolumeX size={24} color="#F1F5F9" strokeWidth={2} />
                )}
              </TouchableOpacity>

              {/* 3. DOSYA EKLEME (BİLETİN İÇİNE) */}
              <TouchableOpacity
                style={styles.flatIconTouch}
                onPress={() => {
                  if (onAttachFile) {
                    onAttachFile();
                  }
                }}
                activeOpacity={0.6}
              >
                <Paperclip size={24} color="#F1F5F9" strokeWidth={2} />
              </TouchableOpacity>

              {/* 4. CHAT (GÖRÜŞME SÜRERKEN BİLETE YAZMA / KÜÇÜLTME) */}
              <TouchableOpacity style={styles.flatIconTouch} onPress={() => setIsMinimized(true)} activeOpacity={0.6}>
                <MessageSquare size={24} color="#38BDF8" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* ALTA BUTONLAR: SAMSUNG GİBİ BÜYÜK DÜZ YEŞİL VE KIRMIZI YUVARLAK YAZISIZ BUTONLAR */}
            <View style={styles.controlsArea}>
              <View style={styles.primaryActionsRow}>
                {isIncoming ? (
                  <>
                    {/* RED BUTTON */}
                    <TouchableOpacity style={[styles.bigSamsungCallBtn, styles.declineBtn]} onPress={onReject} activeOpacity={0.8}>
                      <Phone size={30} color="#FFFFFF" strokeWidth={2.4} style={{ transform: [{ rotate: '135deg' }] }} />
                    </TouchableOpacity>
                    {/* ANSWER BUTTON */}
                    <TouchableOpacity style={[styles.bigSamsungCallBtn, styles.answerBtn]} onPress={onAnswer} activeOpacity={0.8}>
                      <Phone size={30} color="#FFFFFF" strokeWidth={2.4} />
                    </TouchableOpacity>
                  </>
                ) : (
                  // Single end call button
                  <TouchableOpacity style={[styles.bigSamsungCallBtn, styles.declineBtn]} onPress={onEndCall} activeOpacity={0.8}>
                    <Phone size={30} color="#FFFFFF" strokeWidth={2.4} style={{ transform: [{ rotate: '135deg' }] }} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 520,
    height: 405,
    maxHeight: 405,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
    backgroundColor: 'rgba(2, 34, 73, 0.45)',
  },
  translucentTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  ambientOrbLeft: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 200,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(12, 88, 148, 0.35)',
  },
  ambientOrbRight: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    width: 180,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(29, 99, 158, 0.28)',
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 20 : 28,
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.26)',
    marginBottom: 8,
  },
  badgeRow: {
    marginBottom: 6,
  },
  cryptoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.40)',
    backgroundColor: 'rgba(6, 78, 59, 0.35)',
  },
  cryptoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ECFDF5',
    letterSpacing: 0.3,
  },
  callerHeader: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 2,
  },
  callerNameTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 0,
    paddingBottom: 0,
    lineHeight: 18,
  },
  statusBox: {
    minHeight: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.70)',
    letterSpacing: 0.2,
  },
  connectedBox: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  timerText: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#38BDF8',
    letterSpacing: 1,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 18,
  },
  waveBar: {
    width: 3,
    height: 14,
    borderRadius: 1.5,
    backgroundColor: '#34D399',
  },
  flatUtilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    marginVertical: 14,
    paddingHorizontal: 12,
  },
  flatIconTouch: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 72,
  },
  bigSamsungCallBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  declineBtn: {
    backgroundColor: '#EB5757',
    shadowColor: '#EB5757',
  },
  answerBtn: {
    backgroundColor: '#27AE60',
    shadowColor: '#27AE60',
  },
  minimizedContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 36 : 52,
    left: 16,
    right: 16,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 15,
    zIndex: 99999,
    backgroundColor: 'rgba(2, 34, 73, 0.75)',
  },
  minimizedGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  minimizedMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimizedLivePulse: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(34, 197, 94, 0.20)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  minimizedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 130,
    marginRight: 6,
  },
  minimizedTimer: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
    fontVariant: ['tabular-nums'],
  },
  minimizedHangupBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EB5757',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
