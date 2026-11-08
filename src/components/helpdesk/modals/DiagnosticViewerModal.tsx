import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  Share,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  X,
  Activity,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Compass,
  MousePointer,
  Wifi,
  Smartphone,
  Cpu,
  Clock,
  ChevronRight,
  ShieldCheck,
  Share2,
} from 'lucide-react-native';
import { DiagnosticPackage, DiagnosticEvent } from '../../../services/diagnosticRecorder';
import { HelpDeskTicket } from '../../../services/helpDeskService';
import { useTranslation } from '../../../services/i18nService';

interface DiagnosticViewerModalProps {
  visible: boolean;
  onClose: () => void;
  ticket: HelpDeskTicket | null;
  diagnosticData: DiagnosticPackage | null;
  language?: string;
}

export const DiagnosticViewerModal: React.FC<DiagnosticViewerModalProps> = ({
  visible,
  onClose,
  ticket,
  diagnosticData,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'replay' | 'blackbox'>('replay');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  const events = diagnosticData?.events || [];
  const totalSteps = events.length;
  const currentEvent: DiagnosticEvent | null = events[currentStepIndex] || null;
  const timelineScrollRef = useRef<ScrollView | null>(null);

  // Otomatik oynatma efekti
  useEffect(() => {
    if (isPlaying) {
      if (totalSteps <= 1) {
        const singleTimer = setTimeout(() => setIsPlaying(false), 800);
        return () => clearTimeout(singleTimer);
      }
      playTimerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          const nextIdx = prev + 1;
          timelineScrollRef.current?.scrollTo({ y: Math.max(0, (nextIdx - 1) * 54), animated: true });
          return nextIdx;
        });
      }, 950);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, totalSteps]);

  const handleTogglePlay = () => {
    if (totalSteps === 0) return;
    if (!isPlaying) {
      if (currentStepIndex >= totalSteps - 1) {
        setCurrentStepIndex(0);
        timelineScrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  // Modal açıldığında son adıma veya hataya odaklan
  useEffect(() => {
    if (visible && events.length > 0) {
      // Önce varsa hata indeksini bul
      const errorIdx = events.findIndex(e => e.type === 'error' || (e.type === 'network' && e.details?.isSuccess === false));
      if (errorIdx !== -1) {
        setCurrentStepIndex(errorIdx);
      } else {
        setCurrentStepIndex(events.length - 1);
      }
      setIsPlaying(false);
    }
  }, [visible, events.length]);

  const handleJumpToError = () => {
    const errorIdx = events.findIndex(e => e.type === 'error' || (e.type === 'network' && e.details?.isSuccess === false));
    if (errorIdx !== -1) {
      setCurrentStepIndex(errorIdx);
      setIsPlaying(false);
    }
  };

  const handleResetReplay = () => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  const handleExportDiagnostics = async () => {
    if (!diagnosticData) return;
    try {
      const cleanId = (ticket?.id || 'session').replace(/[^a-zA-Z0-9_-]/g, '');
      const fileName = `diagnostics_${cleanId}.txt`;
      const exportPayload = {
        schema: 'WhiteDesk-AI-Diagnostic-Package-v1',
        ticket: ticket
          ? {
              id: ticket.id,
              subject: ticket.subject,
              status: ticket.status,
              category: ticket.category,
              enterprise: ticket.enterprise_name || ticket.app_id || 'WhiteDesk',
              createdAt: new Date(ticket.created_at).toISOString(),
            }
          : null,
        exportedAtIso: new Date(diagnosticData.exportedAt || Date.now()).toISOString(),
        ...diagnosticData,
      };
      const prettyText = JSON.stringify(exportPayload, null, 2);

      if (Platform.OS === 'web') {
        const w = global as any;
        if (w.window && typeof w.window.showSaveFilePicker === 'function') {
          try {
            const handle = await w.window.showSaveFilePicker({
              suggestedName: fileName,
              types: [
                {
                  description: t('helpdesk.diagnostics.file_picker_desc'),
                  accept: { 'text/plain': ['.txt', '.json', '.whitedesk'] },
                },
              ],
            });
            const writable = await handle.createWritable();
            await writable.write(prettyText);
            await writable.close();
            return;
          } catch (pickerErr: any) {
            if (pickerErr?.name === 'AbortError') return;
          }
        }
        if (w.Blob && w.URL && w.document) {
          const blob = new w.Blob([prettyText], { type: 'text/plain;charset=utf-8' });
          const url = w.URL.createObjectURL(blob);
          const a = w.document.createElement('a');
          a.href = url;
          a.download = fileName;
          w.document.body.appendChild(a);
          a.click();
          w.document.body.removeChild(a);
          w.URL.revokeObjectURL(url);
        }
        return;
      }

      const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
      await ReactNativeBlobUtil.fs.writeFile(filePath, prettyText, 'utf8');
      const fileUri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: t('helpdesk.diagnostics.export_dialog_title'),
          UTI: 'public.plain-text',
        });
      } else {
        await Share.share({
          title: fileName,
          message: prettyText,
        });
      }
    } catch (err) {
      console.warn('[DiagnosticViewerModal] handleExportDiagnostics error:', err);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${Math.floor(d.getMilliseconds() / 100)}`;
  };

  const renderEventIcon = (type: string) => {
    switch (type) {
      case 'navigation':
        return <Compass size={14} color="#2563EB" />;
      case 'action':
        return <MousePointer size={14} color="#059669" />;
      case 'network':
        return <Wifi size={14} color="#D97706" />;
      case 'warning':
        return <AlertTriangle size={14} color="#D97706" />;
      case 'lifecycle':
        return <Smartphone size={14} color="#7C3AED" />;
      case 'sdk':
        return <Cpu size={14} color="#0D9488" />;
      case 'error':
        return <AlertTriangle size={14} color="#DC2626" />;
      default:
        return <Activity size={14} color="#64748B" />;
    }
  };

  const renderEventBadge = (type: string) => {
    switch (type) {
      case 'navigation':
        return { label: t('helpdesk.diagnostics.badge_navigation'), bg: '#EFF6FF', text: '#1D4ED8', border: '#DBEAFE' };
      case 'action':
        return { label: t('helpdesk.diagnostics.badge_action'), bg: '#F0FDF4', text: '#15803D', border: '#DCFCE7' };
      case 'network':
        return { label: t('helpdesk.diagnostics.badge_network'), bg: '#FFFBEB', text: '#B45309', border: '#FEF3C7' };
      case 'warning':
        return { label: t('helpdesk.diagnostics.badge_warning'), bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
      case 'lifecycle':
        return { label: t('helpdesk.diagnostics.badge_lifecycle'), bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' };
      case 'sdk':
        return { label: t('helpdesk.diagnostics.badge_sdk'), bg: '#F0FDFA', text: '#0F766E', border: '#CCFBF1' };
      case 'error':
        return { label: t('helpdesk.diagnostics.badge_error'), bg: '#FEF2F2', text: '#B91C1C', border: '#FEE2E2' };
      default:
        return { label: t('helpdesk.diagnostics.badge_info'), bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' };
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.iconCircle}>
                <Activity size={18} color="#2563EB" strokeWidth={2.4} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.headerTitle}>
                  {t('helpdesk.diagnostics.title')}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {ticket?.id ? `#${ticket.id}` : ''} • {t('helpdesk.diagnostics.subtitle_sealed')}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Segmented Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'replay' && styles.tabBtnActive]}
              onPress={() => setActiveTab('replay')}
            >
              <Play size={13} color={activeTab === 'replay' ? '#2563EB' : '#64748B'} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'replay' && styles.tabBtnTextActive]}>
                {t('helpdesk.diagnostics.tab_replay')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'blackbox' && styles.tabBtnActive]}
              onPress={() => setActiveTab('blackbox')}
            >
              <Cpu size={13} color={activeTab === 'blackbox' ? '#2563EB' : '#64748B'} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'blackbox' && styles.tabBtnTextActive]}>
                {t('helpdesk.diagnostics.tab_logs')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          {activeTab === 'replay' ? (
            <View style={{ flex: 1 }}>
              {/* Playback Control Bar */}
              <View style={styles.playbackBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[styles.controlCircleBtn, isPlaying && { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' }]}
                    onPress={handleTogglePlay}
                  >
                    {isPlaying ? <Pause size={16} color="#2563EB" /> : <Play size={16} color="#2563EB" style={{ marginLeft: 2 }} />}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.controlCircleBtn, { marginLeft: 8 }]} onPress={handleResetReplay}>
                    <RotateCcw size={14} color="#64748B" />
                  </TouchableOpacity>
                  <Text style={styles.stepCounterText}>
                    {totalSteps > 0 ? `${currentStepIndex + 1} / ${totalSteps}` : '0 / 0'}
                  </Text>
                  {isPlaying && (
                    <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '600', marginLeft: 8 }}>
                      {t('helpdesk.diagnostics.playing')}
                    </Text>
                  )}
                </View>

                {diagnosticData && (diagnosticData.errorCount > 0 || diagnosticData.networkSummary.failed > 0) && (
                  <TouchableOpacity style={styles.jumpErrorBtn} onPress={handleJumpToError}>
                    <AlertTriangle size={12} color="#DC2626" style={{ marginRight: 4 }} />
                    <Text style={styles.jumpErrorText}>
                      {t('helpdesk.diagnostics.jump_to_error')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Progress Bar */}
              {totalSteps > 0 && (
                <View style={{ height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round(((currentStepIndex + 1) / totalSteps) * 100))}%`,
                      backgroundColor: currentEvent?.type === 'error' ? '#DC2626' : '#2563EB',
                      borderRadius: 2,
                    }}
                  />
                </View>
              )}

              {/* Current Active Step Highlight */}
              {currentEvent ? (
                <View style={styles.activeStepCard}>
                  <View style={styles.activeStepHeader}>
                    {(() => {
                      const b = renderEventBadge(currentEvent.type);
                      return (
                        <View style={[styles.badgePill, { backgroundColor: b.bg, borderColor: b.border }]}>
                          {renderEventIcon(currentEvent.type)}
                          <Text style={[styles.badgeText, { color: b.text, marginLeft: 4 }]}>{b.label}</Text>
                        </View>
                      );
                    })()}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Clock size={12} color="#94A3B8" style={{ marginRight: 4 }} />
                      <Text style={styles.timestampText}>{formatTime(currentEvent.timestamp)}</Text>
                    </View>
                  </View>

                  <Text style={styles.activeStepLabel}>{currentEvent.label}</Text>

                  {currentEvent.details && Object.keys(currentEvent.details).length > 0 && (
                    <View style={styles.detailsBox}>
                      {Object.entries(currentEvent.details)
                        .filter(([k]) => k !== 'durationMs' && k !== 'isSuccess' && k !== 'isSlow')
                        .map(([k, v]) => (
                          <Text key={k} style={styles.detailLineText}>
                            <Text style={{ fontWeight: '700', color: '#475569' }}>{k}: </Text>
                            {String(v)}
                          </Text>
                        ))}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {t('helpdesk.diagnostics.empty_stream')}
                  </Text>
                </View>
              )}

              {/* Step Sequence List */}
              <Text style={styles.sectionHeaderTitle}>
                {t('helpdesk.diagnostics.event_timeline')}
              </Text>
              <ScrollView ref={timelineScrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {events.map((ev, idx) => {
                  const isCurrent = idx === currentStepIndex;
                  const b = renderEventBadge(ev.type);
                  return (
                    <TouchableOpacity
                      key={ev.id || idx}
                      style={[styles.timelineRow, isCurrent && styles.timelineRowActive]}
                      onPress={() => {
                        setCurrentStepIndex(idx);
                        setIsPlaying(false);
                      }}
                    >
                      <View style={[styles.timelineDot, isCurrent && { backgroundColor: '#2563EB' }]} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={[styles.smallBadge, { backgroundColor: b.bg, borderColor: b.border }]}>
                            <Text style={[styles.smallBadgeText, { color: b.text }]}>{b.label}</Text>
                          </View>
                          <Text style={styles.smallTimeText}>{formatTime(ev.timestamp)}</Text>
                        </View>
                        <Text style={[styles.timelineLabel, isCurrent && { fontWeight: '700', color: '#1E293B' }]} numberOfLines={1}>
                          {ev.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {/* Device Telemetry Card */}
              <View style={styles.telemetryCard}>
                <View style={styles.telemetryHeader}>
                  <Smartphone size={16} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={styles.telemetryTitle}>
                    {t('helpdesk.diagnostics.device_telemetry_title')}
                  </Text>
                </View>
                <View style={styles.telemetryGrid}>
                  <View style={styles.telemetryCol}>
                    <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_platform')}</Text>
                    <Text style={styles.metaValue}>
                      {diagnosticData?.device.platform?.toUpperCase() || Platform.OS.toUpperCase()} v{diagnosticData?.device.osVersion || Platform.Version}
                    </Text>
                  </View>
                  <View style={styles.telemetryCol}>
                    <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_uptime')}</Text>
                    <Text style={styles.metaValue}>{diagnosticData?.device.sessionUptime || t('helpdesk.diagnostics.status_active')}</Text>
                  </View>
                  <View style={styles.telemetryCol}>
                    <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_version')}</Text>
                    <Text style={styles.metaValue}>{diagnosticData?.device.appVersion || '1.0.0'}</Text>
                  </View>
                </View>

                <View style={[styles.telemetryGrid, { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' }]}>
                  <View style={styles.telemetryCol}>
                    <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_screen_size')}</Text>
                    <Text style={styles.metaValue}>{diagnosticData?.device.screenResolution || '-'}</Text>
                  </View>
                  <View style={styles.telemetryCol}>
                    <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_font_scale')}</Text>
                    <Text
                      style={[
                        styles.metaValue,
                        diagnosticData?.device.fontScale?.includes(t('helpdesk.diagnostics.font_scale_large')) && { color: '#D97706' },
                      ]}
                    >
                      {diagnosticData?.device.fontScale || t('common.default_speed')}
                    </Text>
                  </View>
                  <View style={styles.telemetryCol}>
                    <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_app_state')}</Text>
                    <Text style={[styles.metaValue, { color: '#059669' }]}>
                      {diagnosticData?.device.appState === 'background' ? t('helpdesk.diagnostics.app_state_background') : t('helpdesk.diagnostics.app_state_foreground')}
                    </Text>
                  </View>
                </View>

                {diagnosticData?.device.permissions && (
                  <View style={[styles.telemetryGrid, { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' }]}>
                    <View style={styles.telemetryCol}>
                      <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_mic_perm')}</Text>
                      <Text
                        style={[
                          styles.metaValue,
                          { color: diagnosticData.device.permissions.microphone === t('helpdesk.diagnostics.perm_granted') ? '#059669' : '#DC2626' },
                        ]}
                      >
                        {diagnosticData.device.permissions.microphone}
                      </Text>
                    </View>
                    <View style={styles.telemetryCol}>
                      <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_camera_perm')}</Text>
                      <Text
                        style={[
                          styles.metaValue,
                          { color: diagnosticData.device.permissions.camera === t('helpdesk.diagnostics.perm_granted') ? '#059669' : '#DC2626' },
                        ]}
                      >
                        {diagnosticData.device.permissions.camera}
                      </Text>
                    </View>
                    <View style={styles.telemetryCol}>
                      <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_notif_vault')}</Text>
                      <Text style={[styles.metaValue, { color: '#059669' }]}>
                        {diagnosticData.device.permissions.notifications} • {t('helpdesk.diagnostics.vault_sealed')}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Network Health Summary */}
              <View style={styles.telemetryCard}>
                <View style={styles.telemetryHeader}>
                  <Wifi size={16} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={styles.telemetryTitle}>
                    {t('helpdesk.diagnostics.network_summary_title')}
                  </Text>
                </View>
                <View style={styles.telemetryGrid}>
                  <View style={styles.telemetryCol}>
                    <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_total_requests')}</Text>
                    <Text style={styles.metaValue}>{diagnosticData?.networkSummary.total || 0}</Text>
                  </View>
                  <View style={styles.telemetryCol}>
                    <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_failed_slow')}</Text>
                    <Text
                      style={[
                        styles.metaValue,
                        (diagnosticData?.networkSummary.failed || 0) > 0
                          ? { color: '#DC2626' }
                          : (diagnosticData?.networkSummary.slow || 0) > 0
                            ? { color: '#D97706' }
                            : undefined,
                      ]}
                    >
                      {diagnosticData?.networkSummary.failed || 0} / {diagnosticData?.networkSummary.slow || 0}
                    </Text>
                  </View>
                  <View style={styles.telemetryCol}>
                    <Text style={styles.metaKey}>{t('helpdesk.diagnostics.meta_avg_response')}</Text>
                    <Text style={styles.metaValue}>{diagnosticData?.networkSummary.avgDurationMs || 0} {t('common.ms')}</Text>
                  </View>
                </View>

                {events.filter(e => e.type === 'network').length > 0 && (
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8 }}>
                    {events.filter(e => e.type === 'network').slice(-6).reverse().map((netEv, idx) => {
                      const isOk = netEv.details?.isSuccess !== false;
                      const isSlow = netEv.details?.isSlow === true;
                      return (
                        <View key={netEv.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                          <Text
                            style={{
                              fontSize: 11,
                              color: !isOk ? '#DC2626' : isSlow ? '#D97706' : '#334155',
                              fontWeight: !isOk || isSlow ? '700' : '500',
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {netEv.label}
                          </Text>
                          <Text style={{ fontSize: 11, color: isSlow ? '#D97706' : '#64748B', fontWeight: isSlow ? '700' : '400', marginLeft: 8 }}>
                            {netEv.details?.durationMs ? `${netEv.details.durationMs} ${t('common.ms')}` : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Error & Warning Stack Trace Section */}
              <View style={styles.telemetryCard}>
                <View style={styles.telemetryHeader}>
                  <AlertTriangle size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.telemetryTitle}>
                    {t('helpdesk.diagnostics.stack_trace_title')}
                  </Text>
                </View>

                {events.filter(e => e.type === 'error' || e.type === 'warning' || (e.type === 'network' && e.details?.isSuccess === false)).length > 0 ? (
                  events.filter(e => e.type === 'error' || e.type === 'warning' || (e.type === 'network' && e.details?.isSuccess === false)).map((err, i) => {
                    const isWarn = err.type === 'warning';
                    return (
                      <View
                        key={i}
                        style={[
                          styles.errorItem,
                          isWarn && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isWarn ? '#B45309' : '#991B1B' }}>
                            {err.type === 'network' ? t('helpdesk.diagnostics.err_network') : isWarn ? t('helpdesk.diagnostics.err_service_warn') : t('helpdesk.diagnostics.err_system')}
                          </Text>
                          <Text style={{ fontSize: 10, color: isWarn ? '#D97706' : '#B91C1C' }}>{formatTime(err.timestamp)}</Text>
                        </View>
                        <Text style={[styles.errorMessageText, isWarn && { color: '#92400E' }]}>
                          {err.details?.message || err.label}
                        </Text>
                        {err.details?.stack && (
                          <ScrollView horizontal style={styles.stackBox}>
                            <Text style={styles.stackText}>{err.details.stack}</Text>
                          </ScrollView>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <ShieldCheck size={24} color="#10B981" />
                    <Text style={{ fontSize: 12, color: '#059669', fontWeight: '600', marginTop: 4 }}>
                      {t('helpdesk.diagnostics.no_errors')}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* Footer: İncelemeyi Kapat + Dışarı Aktar */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>
                {t('helpdesk.diagnostics.close_btn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportDiagnostics} activeOpacity={0.8}>
              <Share2 size={15} color="#2563EB" style={{ marginRight: 6 }} />
              <Text style={styles.exportBtnText}>
                {t('helpdesk.diagnostics.export_btn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Dimensions.get('window').height * 0.88,
    minHeight: Dimensions.get('window').height * 0.70,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  playbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  controlCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  stepCounterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginLeft: 10,
  },
  jumpErrorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  jumpErrorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  activeStepCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  activeStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  timestampText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  activeStepLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  detailsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  detailLineText: {
    fontSize: 11,
    color: '#334155',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  timelineRowActive: {
    backgroundColor: '#EFF6FF',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  smallBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  smallBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  smallTimeText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  timelineLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  telemetryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  telemetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  telemetryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  telemetryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  telemetryCol: {
    flex: 1,
  },
  metaKey: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  errorItem: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  errorMessageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 4,
  },
  stackBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginTop: 4,
  },
  stackText: {
    fontSize: 10,
    color: '#7F1D1D',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  doneBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
});
