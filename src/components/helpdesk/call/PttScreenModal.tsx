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
  Mic,
  Volume2,
  Lock,
  Radio,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Building2,
  UserCheck,
  X,
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { VoiceCallSession } from '../../../services/voiceCallService';
import { apiClient } from '../../../services/apiClient';
import { useTranslation } from '../../../services/i18nService';

export interface OrgChannelItem {
  id: string;
  name: string;
}

export interface TenantItem {
  enterprise_blind_id: string;
  name: string;
}

export interface PttScreenModalProps {
  session: VoiceCallSession | null;
  isAdmin?: boolean;
  isFounder?: boolean;
  adminRole?: 'founder' | 'global_admin' | 'admin' | 'none';
  currentAdminOrgId?: string; // Alt adminin tek bir gruba bağlı olup olmadığını denetlemek için
  channelMemberCount?: number;
  language?: string;
  tenants?: TenantItem[];
  currentTenantId?: string;
  currentTenantName?: string;
  onChangeTenant?: (tenantBlindId: string, tenantName: string) => void;
  onAnswer: () => void;
  onReject: () => void;
  onEndCall: () => void;
  onLeaveChannel?: () => void;
  onToggleTalking: (isTalking: boolean) => void;
  orgChannels?: OrgChannelItem[];
  currentOrgChannelId?: string;
  onChangeOrgChannel?: (newOrgId: string) => void;
  onBroadcastChannelInvite?: (targetOrgId: string) => void;
  /**
   * Controls visibility of the modal. Optional; defaults to true (the component
   * is only mounted while a PTT session is active).
   */
  visible?: boolean;
}

export const PttScreenModal: React.FC<PttScreenModalProps> = ({
  session,
  isAdmin,
  isFounder,
  adminRole,
  currentAdminOrgId,
  channelMemberCount,
  language = 'tr',
  tenants = [],
  currentTenantId,
  currentTenantName,
  onChangeTenant,
  onAnswer,
  onReject,
  onEndCall,
  onLeaveChannel,
  onToggleTalking,
  orgChannels = [],
  currentOrgChannelId,
  onChangeOrgChannel,
  onBroadcastChannelInvite,
  visible = true,
}) => {
  const { t } = useTranslation();
  // PTT Modu: Konuşuyor mu? (isMuted false ise kullanıcı konuşuyor)
  const isTalking = session ? !session.isMuted : false;

  // Pulse (nabız) animasyonu — Konuşurken dışa doğru genişleyen zümrüt/mavi halka
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  // Ses dalgaları
  const wave1 = useRef(new Animated.Value(0.4)).current;
  const wave2 = useRef(new Animated.Value(0.8)).current;
  const wave3 = useRef(new Animated.Value(0.3)).current;
  const wave4 = useRef(new Animated.Value(0.9)).current;
  const wave5 = useRef(new Animated.Value(0.5)).current;

  // 4. Satır giren/çıkan anlık bildirimleri (...geldi, ...gitti)
  const [activeNotice, setActiveNotice] = useState<string | null>(null);

  // Yerel Telsiz Tenant seçimi (Uygulamanın genelinden tam izole)
  const [selectedPttTenantId, setSelectedPttTenantId] = useState<string>(currentTenantId || 'default');
  const [selectedPttTenantName, setSelectedPttTenantName] = useState<string>(currentTenantName || '');

  // Ağ durumu izleme (Ağ kesildiğinde veya bağlantı olmadığında yeşil buton gri olur)
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(true);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    const probe = async () => {
      try {
        const ok = await apiClient.checkBackendHealth();
        if (mounted) setIsNetworkOnline(ok);
      } catch {
        if (mounted) setIsNetworkOnline(false);
      }
    };
    void probe();
    const interval = setInterval(probe, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [visible]);

  useEffect(() => {
    if (currentTenantId) {
      setSelectedPttTenantId(currentTenantId);
    }
    if (currentTenantName && currentTenantName !== t('helpdesk.ptt.default_org')) {
      setSelectedPttTenantName(currentTenantName);
    }
  }, [currentTenantId, currentTenantName]);

  const handleStepTenant = (direction: 'prev' | 'next') => {
    if (!tenants || tenants.length <= 1) return;
    const curIdx = tenants.findIndex((t) => t.enterprise_blind_id === selectedPttTenantId);
    let targetIdx = 0;
    if (direction === 'prev') {
      targetIdx = curIdx <= 0 ? tenants.length - 1 : curIdx - 1;
    } else {
      targetIdx = curIdx >= tenants.length - 1 ? 0 : curIdx + 1;
    }
    const target = tenants[targetIdx];
    if (target) {
      setSelectedPttTenantId(target.enterprise_blind_id);
      setSelectedPttTenantName(target.name);
      if (onChangeTenant) {
        onChangeTenant(target.enterprise_blind_id, target.name);
      }
    }
  };

  useEffect(() => {
    if (session?.lastPeerEvent?.ts) {
      const elapsed = Date.now() - session.lastPeerEvent.ts;
      if (elapsed < 3500) {
        const ev = session.lastPeerEvent;
        const text = ev.alias
          ? (ev.type === 'join'
              ? t('helpdesk.ptt.peer_joined', { alias: ev.alias })
              : t('helpdesk.ptt.peer_left', { alias: ev.alias }))
          : ev.text;
        setActiveNotice(text);
        const timer = setTimeout(() => {
          setActiveNotice(null);
        }, 3500 - elapsed);
        return () => clearTimeout(timer);
      }
    }
  }, [session?.lastPeerEvent?.ts, session?.lastPeerEvent?.text, language]);

  useEffect(() => {
    if (!session || session.state !== 'connected') return;

    if (isTalking) {
      // Nabız animasyonu döngüsü
      const pulseLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseScale, { toValue: 1.25, duration: 900, useNativeDriver: true }),
            Animated.timing(pulseScale, { toValue: 1, duration: 900, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, { toValue: 0.1, duration: 900, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.6, duration: 900, useNativeDriver: true }),
          ]),
        ])
      );
      pulseLoop.start();

      // Dalga görselleştirici
      const animateWave = (anim: Animated.Value, min: number, max: number, duration: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: max, duration, useNativeDriver: true }),
            Animated.timing(anim, { toValue: min, duration, useNativeDriver: true }),
          ])
        );
      };

      const w1 = animateWave(wave1, 0.2, 1, 400);
      const w2 = animateWave(wave2, 0.3, 0.95, 340);
      const w3 = animateWave(wave3, 0.1, 0.85, 480);
      const w4 = animateWave(wave4, 0.4, 1, 370);
      const w5 = animateWave(wave5, 0.2, 0.9, 440);

      w1.start();
      w2.start();
      w3.start();
      w4.start();
      w5.start();

      return () => {
        pulseLoop.stop();
        w1.stop();
        w2.stop();
        w3.stop();
        w4.stop();
        w5.stop();
        pulseScale.setValue(1);
        pulseOpacity.setValue(0.6);
      };
    } else {
      pulseScale.setValue(1);
      pulseOpacity.setValue(0);
    }
  }, [session?.state, isTalking]);

  if (
    !session ||
    session.state === 'idle' ||
    session.state === 'ended' ||
    session.callType !== 'ptt'
  ) {
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
   * - Grup telsizinde: Mevcut grubun adı "Admin @ [grubun / orgun adı]" şeklinde çıkar.
   * - 1-e-1 Bilet telsizinde: Kullanıcıda "Admin", adminde kullanıcının tanıtılmış ismi veya kör ID'si
   */
  const getDisplayName = (): string => {
    // 1. Organizasyonel Grup Telsizi Modu
    if (session.scope === 'org_group') {
      if (isAdmin) {
        return session.callerAlias || (isFounder ? 'TheWhite' : t('helpdesk.ptt.role_admin'));
      }
      return session.activeSpeakerAlias || session.callerAlias || t('helpdesk.ptt.role_user');
    }

    // 2. Bilet İçi 1-e-1 Telsiz Modu
    const isCurrentDeviceAdmin = !!isAdmin;

    if (!isCurrentDeviceAdmin) {
      return t('helpdesk.ptt.role_admin');
    }

    const otherAlias = session.role === 'caller' ? session.calleeAlias : session.callerAlias;
    const otherId = session.role === 'caller' ? session.calleeWhiteId : session.callerWhiteId;

    if (
      otherAlias &&
      otherAlias !== t('helpdesk.ptt.role_user') &&
      otherAlias !== 'User' &&
      otherAlias !== t('helpdesk.ptt.you') &&
      !otherAlias.toLowerCase().includes('admin') &&
      !otherAlias.toLowerCase().includes(t('helpdesk.ptt.operator_keyword')) &&
      !otherAlias.startsWith('wh_') &&
      !otherAlias.startsWith('usr_')
    ) {
      return otherAlias;
    }

    if (otherId) {
      const cleanBlind = otherId.startsWith('blind_') ? otherId.substring(6) : otherId;
      if (cleanBlind.length >= 14) {
        return `${cleanBlind.substring(0, 6)}...${cleanBlind.substring(9, 14)}`;
      }
      if (cleanBlind.length >= 10) {
        return `${cleanBlind.substring(0, 6)}...${cleanBlind.substring(9)}`;
      }
      return cleanBlind;
    }

    return t('helpdesk.ptt.role_user');
  };

  /**
   * O an konuşan kişinin bilgisi ("Kendinizi tanıtın"daki isim veya kör ID)
   */
  const getSpeakerSubtext = (): string => {
    if (session.scope === 'org_group') {
      if (isTalking) {
        return t('helpdesk.ptt.you_are_speaking');
      }
      const speakerAlias = session.activeSpeakerAlias;
      const speakerId = session.activeSpeakerWhiteId;
      const myId = session.role === 'caller' ? session.callerWhiteId : session.calleeWhiteId;
      // Yalnızca karşı tarafta birisi mikrofonu açmışsa ve konuşuyorsa göster
      if (speakerAlias && speakerId && speakerId.toLowerCase() !== (myId || '').toLowerCase()) {
        return t('helpdesk.ptt.peer_is_speaking_dots', { alias: speakerAlias });
      }
      // Grupta kimse yoksa "Kimse Yok" yaz
      if (channelMemberCount === 0) {
        return t('helpdesk.ptt.no_one');
      }
      return '';
    }
    return '';
  };

  const handleTogglePttButton = () => {
    if (!isConnected) return;
    if (session.scope === 'org_group' && (session as any).isStandby && onBroadcastChannelInvite) {
      onBroadcastChannelInvite(currentOrgChannelId || session.targetOrgId || 'all');
      return;
    }
    // Bas-konuş mantığı: Tek basışta konuş moduna geçer, tekrar basınca dinle moduna geçer
    onToggleTalking(!isTalking);
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={isIncoming ? onReject : onEndCall}
    >
      <View style={styles.modalBackdrop}>
        {/* SAMSUNG ONE UI FROSTED GLASS CALL SHEET (EKRANIN YARISI) */}
        <View style={styles.sheetContainer}>
          {/* 1. LAYER: BLURVIEW BUZLU CAM */}
          <BlurView
            intensity={Platform.OS === 'android' ? 70 : 50}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />

          {/* 2. LAYER: SAYDAM LACİVERT & IŞILTI KATMANI */}
          <View style={styles.translucentTint} />
          <View style={styles.ambientOrbLeft} />
          <View style={styles.ambientOrbRight} />

          {/* 4. SHEET İÇERİĞİ */}
          <View style={styles.sheetContent}>
            {/* SAĞ ÜST: Modalı Kapat & Her Şeyi Sonlandır Çarpı Butonu */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={isIncoming ? onReject : onEndCall}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('helpdesk.ptt.close_and_end')}
            >
              <X size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>

            {/* DRAG HANDLE */}
            <View style={styles.dragHandle} />

            {/* TEPEDE: ROZET METNİ */}
            <View style={styles.badgeRow}>
              <View style={styles.cryptoBadge}>
                <Radio size={12} color="#6EE7B7" style={{ marginRight: 6 }} />
                <Text style={styles.cryptoBadgeText}>
                  {session.scope === 'org_group' ? t('helpdesk.ptt.badge_radio_broadcast') : t('helpdesk.ptt.badge_p2p_ptt')}
                </Text>
              </View>
            </View>

            {/* ORTADA: ÇOK KATMANLI BAŞLIK ALANI */}
            <View style={styles.callerHeader}>
              {/* SATIR 1: İSİM / KİMLİK (KİBAR VE NET FONT 15dp) */}
              <Text style={styles.callerNameTitle} numberOfLines={1}>
                {getDisplayName()}
              </Text>

              {/* SATIR 2: TENANT / FİRMA SATIRI */}
              {session.scope === 'org_group' ? (
                // 1. TELSİZ YAYINI MODU: TheWhite için yukarı/aşağı oklarla firma seçimi
                <View style={[styles.hierarchyRow, styles.tenantRow]}>
                  {isFounder && tenants.length > 1 ? (
                    <TouchableOpacity
                      style={styles.arrowSmallBtn}
                      onPress={() => handleStepTenant('prev')}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <ChevronUp size={24} color="#38BDF8" strokeWidth={2.6} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.arrowPlaceholder} />
                  )}

                  <View style={styles.hierarchyCenterBox}>
                    <Text style={styles.tenantTitleText} numberOfLines={1}>
                      {selectedPttTenantName || currentTenantName || session.targetOrgName || 'Whitechain'}
                    </Text>
                  </View>

                  {isFounder && tenants.length > 1 ? (
                    <TouchableOpacity
                      style={styles.arrowSmallBtn}
                      onPress={() => handleStepTenant('next')}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <ChevronDown size={24} color="#38BDF8" strokeWidth={2.6} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.arrowPlaceholder} />
                  )}
                </View>
              ) : isFounder ? (
                // 2. BİLET İÇİ P2P BAS-KONUŞ: YALNIZCA Founder ekranında tenant gösterilir, ASLA OK YOKTUR!
                <View style={[styles.hierarchyRow, styles.tenantRow]}>
                  <View style={styles.hierarchyCenterBox}>
                    <Text style={styles.tenantTitleText} numberOfLines={1}>
                      {selectedPttTenantName || currentTenantName || 'Whitechain'}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* SATIR 3: GRUP / BİRİM SATIRI */}
              {session.scope === 'org_group' ? (
                // 1. TELSİZ YAYINI MODU: Çoklu adminler için sağ/sol oklarla grup/kanal gezintisi
                (() => {
                  const isAssignedToSingleOrg = Boolean(currentAdminOrgId && currentAdminOrgId !== 'all' && currentAdminOrgId !== 'default' && currentAdminOrgId !== '*');
                  const hasSubOrgs = orgChannels.filter(c => c.id !== 'all' && c.id !== 'global').length > 0;
                  const canSwitchGroups = (isFounder || adminRole === 'global_admin' || (isAdmin && !isAssignedToSingleOrg)) && hasSubOrgs;

                  const effectiveOrgId = currentOrgChannelId || session.targetOrgId || 'all';
                  const isGlobalChannel = effectiveOrgId === 'all' || effectiveOrgId === 'global' || effectiveOrgId === 'default';
                  const currentOrgItem = orgChannels.find(c =>
                    isGlobalChannel ? (c.id === 'all' || c.id === 'global') : c.id === effectiveOrgId
                  );
                  const activeGroupName = (!isGlobalChannel && currentOrgItem)
                    ? currentOrgItem.name
                    : t('helpdesk.ptt.channel_general');

                  return (
                    <View style={[styles.hierarchyRow, styles.groupRow]}>
                      {/* Sol Ok: Önceki Grup */}
                      {canSwitchGroups ? (
                        <TouchableOpacity
                          style={styles.arrowSmallBtn}
                          onPress={() => {
                            const curIdx = orgChannels.findIndex((c) =>
                              isGlobalChannel ? (c.id === 'all' || c.id === 'global') : c.id === effectiveOrgId
                            );
                            const prevIdx = curIdx <= 0 ? orgChannels.length - 1 : curIdx - 1;
                            if (onChangeOrgChannel && orgChannels[prevIdx]) {
                              onChangeOrgChannel(orgChannels[prevIdx].id);
                            }
                          }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <ChevronLeft size={24} color="#38BDF8" strokeWidth={2.6} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.arrowPlaceholder} />
                      )}

                      {/* Ortadaki Grup Metni */}
                      <View style={styles.hierarchyCenterBox}>
                        <Text style={styles.groupTitleText} numberOfLines={1}>
                          {activeGroupName}
                        </Text>
                      </View>

                      {/* Sağ Ok: Sonraki Grup */}
                      {canSwitchGroups ? (
                        <TouchableOpacity
                          style={styles.arrowSmallBtn}
                          onPress={() => {
                            const curIdx = orgChannels.findIndex((c) =>
                              isGlobalChannel ? (c.id === 'all' || c.id === 'global') : c.id === effectiveOrgId
                            );
                            const nextIdx = curIdx >= orgChannels.length - 1 ? 0 : curIdx + 1;
                            if (onChangeOrgChannel && orgChannels[nextIdx]) {
                              onChangeOrgChannel(orgChannels[nextIdx].id);
                            }
                          }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <ChevronRight size={24} color="#38BDF8" strokeWidth={2.6} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.arrowPlaceholder} />
                      )}
                    </View>
                  );
                })()
              ) : (
                // 2. BİLET İÇİ P2P BAS-KONUŞ: Yalnızca biletin ait olduğu grup adı (OKLAR KESİNLİKLE YOK!)
                <View style={[styles.hierarchyRow, styles.groupRow]}>
                  <View style={styles.hierarchyCenterBox}>
                    <Text style={styles.groupTitleText} numberOfLines={1}>
                      {session.targetOrgName || t('helpdesk.ptt.general_support')}
                    </Text>
                  </View>
                </View>
              )}

              {/* SATIR 4: DURUM / KONUŞUYOR / GİREN-ÇIKAN / SÜRE MESAJLARI (SABİT 24dp YÜKSEKLİK) */}
              <View style={styles.statusRowContainer}>
                {!isNetworkOnline ? (
                  <Text style={[styles.statusEmptyText, { color: '#F87171' }]} numberOfLines={1}>
                    {t('helpdesk.ptt.no_network')}
                  </Text>
                ) : activeNotice ? (
                  <Text
                    style={[
                      styles.statusTextNotice,
                      activeNotice.includes(t('helpdesk.ptt.left_keyword')) || activeNotice.includes('left') || activeNotice.includes('gitti')
                        ? styles.statusTextNoticeLeave
                        : styles.statusTextNoticeJoin,
                    ]}
                    numberOfLines={1}
                  >
                    {activeNotice}
                  </Text>
                ) : isOutgoing ? (
                  <Text style={styles.statusText} numberOfLines={1}>
                    {t('helpdesk.ptt.calling_ptt')}
                  </Text>
                ) : isIncoming ? (
                  <Text style={styles.statusText} numberOfLines={1}>
                    {t('helpdesk.ptt.incoming_ptt')}
                  </Text>
                ) : isConnecting ? (
                  <Text style={styles.statusText} numberOfLines={1}>
                    {t('helpdesk.ptt.connecting_ptt')}
                  </Text>
                ) : isConnected ? (
                  (session as any).isStandby ? (
                    <Text style={styles.statusEmptyText} numberOfLines={1}>
                      {t('helpdesk.ptt.no_participant_transmission')}
                    </Text>
                  ) : session.scope === 'org_group' ? (
                    isTalking ? (
                      <View style={styles.talkingRowInline}>
                        <Text style={styles.statusTalkingText}>
                          {t('helpdesk.ptt.you_are_speaking')}
                        </Text>
                        <View style={styles.waveformContainer}>
                          {[wave1, wave2, wave3, wave4, wave5].map((w, idx) => (
                            <Animated.View
                              key={idx}
                              style={[
                                styles.waveBar,
                                {
                                  transform: [{ scaleY: w }],
                                },
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={styles.timerSmallText}>
                          {formatDuration(session.durationSeconds)}
                        </Text>
                      </View>
                    ) : (() => {
                      const speakerAlias = session.activeSpeakerAlias;
                      const speakerId = session.activeSpeakerWhiteId;
                      const myId = session.role === 'caller' ? session.callerWhiteId : session.calleeWhiteId;
                      const isOtherTalking =
                        speakerAlias &&
                        speakerId &&
                        speakerId.toLowerCase() !== (myId || '').toLowerCase();

                      if (isOtherTalking) {
                        return (
                          <View style={styles.talkingRowInline}>
                            <Text style={styles.statusOtherTalkingText} numberOfLines={1}>
                              {t('helpdesk.ptt.peer_is_speaking', { alias: speakerAlias })}
                            </Text>
                            <View style={styles.waveformContainer}>
                              {[wave1, wave2, wave3, wave4, wave5].map((w, idx) => (
                                <Animated.View
                                  key={idx}
                                  style={[
                                    styles.waveBar,
                                    {
                                      transform: [{ scaleY: w }],
                                    },
                                  ]}
                                />
                              ))}
                            </View>
                            <Text style={styles.timerSmallText}>
                              {formatDuration(session.durationSeconds)}
                            </Text>
                          </View>
                        );
                      }

                      return (
                        <View style={styles.talkingRowInline}>
                          <Text style={styles.statusEmptyText} numberOfLines={1}>
                            {t('helpdesk.ptt.no_participant_transmission')}
                          </Text>
                          <Text style={styles.timerSmallText}>
                            {formatDuration(session.durationSeconds)}
                          </Text>
                        </View>
                      );
                    })()
                  ) : (
                    // 1-e-1 Bilet Telsizi Modu
                    <View style={styles.connectedBox}>
                      <Text style={styles.timerText}>
                        {formatDuration(session.durationSeconds)}
                      </Text>
                      {isTalking && (
                        <View style={styles.waveformContainer}>
                          {[wave1, wave2, wave3, wave4, wave5].map((w, idx) => (
                            <Animated.View
                              key={idx}
                              style={[
                                styles.waveBar,
                                {
                                  transform: [{ scaleY: w }],
                                },
                              ]}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  )
                ) : null}
              </View>
            </View>

            {/* BAS-KONUŞ BUTON VE KONTROL ALANI */}
            <View style={styles.controlsArea}>
              {isConnected ? (
                /* GÖRÜŞME BAĞLANDIĞINDA: CEVAPLA BUTONUNDAN 2 KAT BÜYÜK (136dp) DEV PTT BUTONU */
                <View style={styles.pttConnectedRow}>
                  {/* DIŞA YAYILAN NABIZ HALKASI (SADECE KONUŞURKEN) */}
                  {isTalking && (
                    <Animated.View
                      style={[
                        styles.pulseRing,
                        {
                          transform: [{ scale: pulseScale }],
                          opacity: pulseOpacity,
                        },
                      ]}
                    />
                  )}

                  {/* DEVASA BAS-KONUŞ BUTONU (136dp - CEVAPLA BUTONUNUN 2 KATI) */}
                  <TouchableOpacity
                    style={[
                      styles.giantPttButton,
                      isTalking ? styles.giantPttTalking : styles.giantPttListening,
                    ]}
                    onPress={handleTogglePttButton}
                    activeOpacity={0.85}
                  >
                    <Mic
                      size={44}
                      color="#FFFFFF"
                      strokeWidth={2.4}
                      style={{ marginBottom: 4 }}
                    />
                    <Text style={styles.giantPttButtonText}>
                      {isTalking ? t('helpdesk.ptt.btn_talk') : t('helpdesk.ptt.btn_listen')}
                    </Text>
                  </TouchableOpacity>

                  {/* SAĞ ALTTAKİ KONTROL: P2P'DE SONLANDIR, TELSİZDE KANAL KONTROLÜ */}
                  {(() => {
                    if (session.scope !== 'org_group') {
                      return (
                        <View style={styles.channelActionWrapper}>
                          <TouchableOpacity
                            style={styles.channelActionBtn}
                            onPress={onEndCall}
                            activeOpacity={0.8}
                          >
                            <Phone
                              size={22}
                              color="#FFFFFF"
                              strokeWidth={2.4}
                              style={{ transform: [{ rotate: '135deg' }] }}
                            />
                          </TouchableOpacity>
                          <Text style={styles.channelActionLabel}>
                            {t('helpdesk.ptt.end_call')}
                          </Text>
                        </View>
                      );
                    }

                    const isStandby = Boolean((session as any).isStandby);
                    const isSwitchedToAnotherChannel = Boolean(currentOrgChannelId) && currentOrgChannelId !== (session.targetOrgId || 'global') && (currentOrgChannelId !== 'all' || session.targetOrgId !== 'global');

                    if (isStandby || isSwitchedToAnotherChannel) {
                      // Kanal beklemede veya başka kanala geçildi: YEŞİL BUTON (Ağ yoksa GRİ) + "Bağlan"
                      return (
                        <View style={styles.channelActionWrapper}>
                          <TouchableOpacity
                            style={[
                              styles.channelActionBtn,
                              styles.channelActionBtnGreen,
                              !isNetworkOnline && styles.channelActionBtnDisabled,
                            ]}
                            disabled={!isNetworkOnline}
                            onPress={() => {
                              if (!isNetworkOnline) return;
                              if (onBroadcastChannelInvite) {
                                onBroadcastChannelInvite(currentOrgChannelId || session.targetOrgId || 'all');
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <Radio
                              size={22}
                              color={isNetworkOnline ? '#FFFFFF' : '#94A3B8'}
                              strokeWidth={2.4}
                            />
                          </TouchableOpacity>
                          <Text style={[styles.channelActionLabel, !isNetworkOnline && styles.channelActionLabelDisabled]}>
                            {!isNetworkOnline
                              ? t('helpdesk.ptt.offline')
                              : t('helpdesk.ptt.connect')}
                          </Text>
                        </View>
                      );
                    }

                    // Aktif telsiz kanalında: KIRMIZI ÇARPI BUTONU + "Bağlantıyı Kes" (Modalı kapatmaz; kanaldan çıkar)
                    return (
                      <View style={styles.channelActionWrapper}>
                        <TouchableOpacity
                          style={styles.channelActionBtn}
                          onPress={onLeaveChannel ? onLeaveChannel : onEndCall}
                          activeOpacity={0.8}
                        >
                          <X
                            size={24}
                            color="#FFFFFF"
                            strokeWidth={2.6}
                          />
                        </TouchableOpacity>
                        <Text style={styles.channelActionLabel}>
                          {t('helpdesk.ptt.disconnect')}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              ) : isIncoming ? (
                /* GELEN ÇAĞRIDA: CEVAPLA VE REDDET BUTONLARI */
                <View style={styles.primaryActionsRow}>
                  <TouchableOpacity
                    style={[styles.bigSamsungCallBtn, styles.declineBtn]}
                    onPress={onReject}
                    activeOpacity={0.8}
                  >
                    <Phone size={30} color="#FFFFFF" strokeWidth={2.4} style={{ transform: [{ rotate: '135deg' }] }} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bigSamsungCallBtn, styles.answerBtn]}
                    onPress={onAnswer}
                    activeOpacity={0.8}
                  >
                    <Radio size={28} color="#FFFFFF" strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>
              ) : (
                /* GİDEN ÇAĞRIDA: TEK KIRMIZI VAZGEÇ/KAPAT BUTONU */
                <View style={styles.primaryActionsRow}>
                  <TouchableOpacity
                    style={[styles.bigSamsungCallBtn, styles.declineBtn]}
                    onPress={onEndCall}
                    activeOpacity={0.8}
                  >
                    <Phone size={30} color="#FFFFFF" strokeWidth={2.4} style={{ transform: [{ rotate: '135deg' }] }} />
                  </TouchableOpacity>
                </View>
              )}
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
  // Ekranın yarısını kaplayan Samsung One UI saydam buzlu cam container
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
    backgroundColor: 'rgba(2, 34, 73, 0.45)', // Saydam gece laciverti (#022249)
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
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
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
  hierarchyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    height: 46,
  },
  tenantRow: {
    marginTop: 0,
    paddingTop: 0,
    marginBottom: 4,
  },
  groupRow: {
    marginTop: 2,
    marginBottom: 4,
  },
  arrowSmallBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  arrowPlaceholder: {
    width: 44,
    height: 44,
  },
  hierarchyCenterBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tenantTitleText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#E0F2FE',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  groupTitleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  standbyStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6EE7B7',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  statusRowContainer: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  talkingRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusTalkingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 0.2,
  },
  statusOtherTalkingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.2,
  },
  statusEmptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  statusTextNotice: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusTextNoticeJoin: {
    color: '#6EE7B7',
  },
  statusTextNoticeLeave: {
    color: '#F87171',
  },
  timerSmallText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#E0F2FE',
    letterSpacing: 0.5,
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
  controlsArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  // BAĞLANTILI PTT DEV BUTON ALANI
  pttConnectedRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 8,
  },
  // CEVAPLA BUTONUNDAN (68dp) 2 KAT BÜYÜK DEVASA BAS-KONUŞ BUTONU (136dp)
  giantPttButton: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    elevation: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 14,
  },
  // KONUŞURKEN: CANLI ZÜMRÜT YEŞİLİ
  giantPttTalking: {
    backgroundColor: '#27AE60',
    shadowColor: '#27AE60',
  },
  // DİNLERKEN: DERİN GECE MAVİSİ / LACİVERT (HAZIR MOD)
  giantPttListening: {
    backgroundColor: '#0F766E',
    shadowColor: '#0F766E',
  },
  giantPttButtonText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  pulseRing: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: 'rgba(39, 174, 96, 0.35)',
  },
  // KANAL DEĞİŞTİRME OKLARI VE BAŞLIK
  channelSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  channelArrowBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  channelTitleBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  // SAĞ KÖŞEDE KANAL KONTROL BUTONU VE ETİKETİ ("Bağlan" / "Bağlantıyı Kes")
  channelActionWrapper: {
    position: 'absolute',
    right: 12,
    bottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 76,
  },
  channelActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EB5757',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#EB5757',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  channelActionBtnGreen: {
    backgroundColor: '#27AE60',
    shadowColor: '#27AE60',
  },
  channelActionBtnDisabled: {
    backgroundColor: '#64748B',
    shadowColor: '#64748B',
    elevation: 0,
  },
  channelActionLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#CBD5E1',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  channelActionLabelDisabled: {
    color: '#94A3B8',
  },
  // SAMSUNG DÜZ BUTONLAR
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
});
