import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  X,
  CheckCircle2,
  Coffee,
  Palmtree,
  HelpCircle,
  Clock,
} from 'lucide-react-native';
import { helpDeskService } from '../../../../services/helpDeskService';
import { AdminSubStatus } from '../../../../services/helpdesk/adminRosterService';

export interface WorkStatusModalProps {
  visible: boolean;
  onClose: () => void;
  language?: 'tr' | 'en';
}

export const WorkStatusModal: React.FC<WorkStatusModalProps> = ({
  visible,
  onClose,
  language = 'tr',
}) => {
  // Working Status States (Aktif / Pasif)
  const [statusActive, setStatusActive] = useState<boolean>(true);
  const [subStatus, setSubStatus] = useState<AdminSubStatus>('molada');
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [snoozeMins, setSnoozeMins] = useState<number>(30);
  const [customDaysInput, setCustomDaysInput] = useState<string>('0');
  const [customHoursInput, setCustomHoursInput] = useState<string>('0');
  const [customMinsInput, setCustomMinsInput] = useState<string>('30');
  const [remainingText, setRemainingText] = useState<string>('');

  const formatRemainingDuration = (totalMins: number, targetTimestamp?: number): string => {
    if (totalMins <= 0) return language === 'tr' ? 'Süresiz (Elle açana kadar)' : 'Indefinite';
    const d = Math.floor(totalMins / 1440);
    const h = Math.floor((totalMins % 1440) / 60);
    const m = totalMins % 60;
    const parts: string[] = [];
    if (d > 0) parts.push(`${d} gün`);
    if (h > 0) parts.push(`${h} sa`);
    if (m > 0 || parts.length === 0) parts.push(`${m} dk`);
    const durationStr = parts.join(' ');

    if (targetTimestamp) {
      const targetDate = new Date(targetTimestamp);
      const isDifferentDay = targetDate.getDate() !== new Date().getDate();
      const dateStr = isDifferentDay
        ? `${targetDate.toLocaleDateString([], { day: 'numeric', month: 'short' })} `
        : '';
      const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `Otomatik Aktif: ${dateStr}${timeStr} (${durationStr} kaldı)`;
    }
    return `${durationStr} kaldı`;
  };

  useEffect(() => {
    if (visible) {
      const updateStatus = (status: { isActive: boolean; subStatus?: AdminSubStatus; customReason?: string; snoozeUntil: number | null }) => {
        setStatusActive(status.isActive);
        if (status.subStatus) setSubStatus(status.subStatus);
        if (status.customReason) setCustomReasonText(status.customReason);
        if (status.snoozeUntil) {
          const diffMs = status.snoozeUntil - Date.now();
          if (diffMs > 0) {
            const diffMin = Math.round(diffMs / 60000);
            const d = Math.floor(diffMin / 1440);
            const h = Math.floor((diffMin % 1440) / 60);
            const m = diffMin % 60;
            setCustomDaysInput(String(d));
            setCustomHoursInput(String(h));
            setCustomMinsInput(String(m));
            setRemainingText(formatRemainingDuration(diffMin, status.snoozeUntil));
          } else {
            setRemainingText('');
          }
        } else {
          setRemainingText('');
        }
      };

      void helpDeskService.getAdminBreakStatus().then(updateStatus).catch(() => {});
      const unsub = helpDeskService.subscribeAdminBreakStatus(updateStatus);
      return () => unsub();
    }
  }, [visible]);

  const handleToggleStatus = async (active: boolean) => {
    setStatusActive(active);
    await helpDeskService.setAdminBreakStatus(
      active,
      snoozeMins,
      !active ? subStatus : undefined,
      !active && subStatus === 'diger' ? customReasonText : undefined
    );
    if (active) setRemainingText('');
  };

  const handleSelectSubStatus = async (sub: AdminSubStatus) => {
    setSubStatus(sub);
    await helpDeskService.setAdminBreakStatus(
      false,
      snoozeMins,
      sub,
      sub === 'diger' ? customReasonText : undefined
    );
  };

  const handleCustomReasonChange = async (text: string) => {
    setCustomReasonText(text);
    if (!statusActive && subStatus === 'diger') {
      await helpDeskService.setAdminBreakStatus(false, snoozeMins, 'diger', text);
    }
  };

  const handleSelectDuration = async (mins: number) => {
    setSnoozeMins(mins);
    if (mins > 0) {
      const d = Math.floor(mins / 1440);
      const h = Math.floor((mins % 1440) / 60);
      const m = mins % 60;
      setCustomDaysInput(String(d));
      setCustomHoursInput(String(h));
      setCustomMinsInput(String(m));
      await helpDeskService.setAdminBreakStatus(
        false,
        mins,
        subStatus,
        subStatus === 'diger' ? customReasonText : undefined
      );
      setRemainingText(formatRemainingDuration(mins, Date.now() + mins * 60000));
    } else {
      setCustomDaysInput('0');
      setCustomHoursInput('0');
      setCustomMinsInput('0');
      await helpDeskService.setAdminBreakStatus(
        false,
        0,
        subStatus,
        subStatus === 'diger' ? customReasonText : undefined
      );
      setRemainingText(language === 'tr' ? 'Süresiz (Elle açana kadar)' : 'Indefinite');
    }
  };

  const handleCustomTimeChange = async (type: 'day' | 'hour' | 'min', value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    let days = parseInt(type === 'day' ? cleaned : customDaysInput, 10) || 0;
    let hours = parseInt(type === 'hour' ? cleaned : customHoursInput, 10) || 0;
    let mins = parseInt(type === 'min' ? cleaned : customMinsInput, 10) || 0;

    if (type === 'day') setCustomDaysInput(cleaned);
    if (type === 'hour') setCustomHoursInput(cleaned);
    if (type === 'min') setCustomMinsInput(cleaned);

    const total = days * 1440 + hours * 60 + mins;
    setSnoozeMins(total);
    if (total > 0) {
      await helpDeskService.setAdminBreakStatus(
        false,
        total,
        subStatus,
        subStatus === 'diger' ? customReasonText : undefined
      );
      setRemainingText(formatRemainingDuration(total, Date.now() + total * 60000));
    } else {
      setRemainingText('');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Clock size={20} color="#2563EB" strokeWidth={2.2} />
              <Text style={styles.headerTitle}>
                {language === 'tr' ? 'Çalışma Durumu' : 'Working Status'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Ana Butonlar: Aktif / Pasif (Geniş Yerleşim) */}
            <View style={styles.statusToggleRow}>
              <TouchableOpacity
                style={[
                  styles.statusToggleBtn,
                  statusActive && styles.statusToggleBtnActiveGreen
                ]}
                onPress={() => handleToggleStatus(true)}
                activeOpacity={0.7}
              >
                <CheckCircle2 size={20} color={statusActive ? '#10B981' : '#64748B'} style={{ marginRight: 10 }} />
                <Text style={[styles.statusToggleText, statusActive && styles.statusToggleTextGreen]}>
                  {language === 'tr' ? 'Aktif' : 'Active'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusToggleBtn,
                  !statusActive && styles.statusToggleBtnActiveOrange
                ]}
                onPress={() => handleToggleStatus(false)}
                activeOpacity={0.7}
              >
                <Coffee size={20} color={!statusActive ? '#F59E0B' : '#64748B'} style={{ marginRight: 10 }} />
                <Text style={[styles.statusToggleText, !statusActive && styles.statusToggleTextOrange]}>
                  {language === 'tr' ? 'Pasif' : 'Passive'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Pasif Seçildiğinde Açılan Alt Nedenler: İzinde, Molada, Diğer */}
            {!statusActive && (
              <View style={styles.passiveDetailSection}>
                <Text style={styles.subSectionTitle}>
                  {language === 'tr' ? 'Pasiflik Nedeni:' : 'Reason:'}
                </Text>
                <View style={styles.subStatusRow}>
                  <TouchableOpacity
                    style={[
                      styles.subStatusChip,
                      subStatus === 'izinde' && styles.subStatusChipActive
                    ]}
                    onPress={() => handleSelectSubStatus('izinde')}
                    activeOpacity={0.7}
                  >
                    <Palmtree size={14} color={subStatus === 'izinde' ? '#D97706' : '#64748B'} style={{ marginRight: 6 }} />
                    <Text style={[styles.subStatusChipText, subStatus === 'izinde' && styles.subStatusChipTextActive]}>
                      {language === 'tr' ? 'İzinde' : 'On Leave'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.subStatusChip,
                      subStatus === 'molada' && styles.subStatusChipActive
                    ]}
                    onPress={() => handleSelectSubStatus('molada')}
                    activeOpacity={0.7}
                  >
                    <Coffee size={14} color={subStatus === 'molada' ? '#D97706' : '#64748B'} style={{ marginRight: 6 }} />
                    <Text style={[styles.subStatusChipText, subStatus === 'molada' && styles.subStatusChipTextActive]}>
                      {language === 'tr' ? 'Molada' : 'On Break'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.subStatusChip,
                      subStatus === 'diger' && styles.subStatusChipActive
                    ]}
                    onPress={() => handleSelectSubStatus('diger')}
                    activeOpacity={0.7}
                  >
                    <HelpCircle size={14} color={subStatus === 'diger' ? '#D97706' : '#64748B'} style={{ marginRight: 6 }} />
                    <Text style={[styles.subStatusChipText, subStatus === 'diger' && styles.subStatusChipTextActive]}>
                      {language === 'tr' ? 'Diğer' : 'Other'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Diğer Seçildiğinde Açılan Metin Alanı */}
                {subStatus === 'diger' && (
                  <View style={styles.customReasonContainer}>
                    <Text style={styles.customReasonLabel}>
                      {language === 'tr' ? 'Neden Açıklaması:' : 'Explanation:'}
                    </Text>
                    <TextInput
                      style={styles.customReasonInput}
                      placeholder={language === 'tr' ? 'Nedeninizi belirtin...' : 'Specify reason...'}
                      placeholderTextColor="#94A3B8"
                      value={customReasonText}
                      onChangeText={handleCustomReasonChange}
                      maxLength={120}
                    />
                  </View>
                )}

                {/* Süre Seçimi Presetleri */}
                <Text style={[styles.subSectionTitle, { marginTop: 14 }]}>
                  {language === 'tr' ? 'Pasiflik Süresi (Ön Tanımlı):' : 'Preset Duration:'}
                </Text>
                <View style={styles.durationPresetRow}>
                  {[
                    { label: '15 dk', mins: 15 },
                    { label: '30 dk', mins: 30 },
                    { label: '1 sa', mins: 60 },
                    { label: '2 sa', mins: 120 },
                    { label: '4 sa', mins: 240 },
                    { label: 'Süresiz', mins: 0 },
                  ].map((preset) => {
                    const isSelected = snoozeMins === preset.mins;
                    return (
                      <TouchableOpacity
                        key={`snooze_${preset.mins}`}
                        style={[
                          styles.durationPresetChip,
                          isSelected && styles.durationPresetChipActive
                        ]}
                        onPress={() => handleSelectDuration(preset.mins)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.durationPresetText,
                          isSelected && styles.durationPresetTextActive
                        ]}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Net Süre Girişi (Gün, Saat, Dakika) */}
                <View style={styles.customDurationSection}>
                  <Text style={styles.customDurationSectionTitle}>
                    {language === 'tr' ? 'Net Süre Girişi (Gün / Saat / Dakika):' : 'Custom Duration (Day / Hour / Min):'}
                  </Text>
                  <View style={styles.timeInputsRow}>
                    {/* Gün */}
                    <View style={styles.timeUnitBox}>
                      <TextInput
                        style={styles.timeUnitInput}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={customDaysInput}
                        onChangeText={(val) => handleCustomTimeChange('day', val)}
                        maxLength={3}
                      />
                      <Text style={styles.timeUnitLabel}>{language === 'tr' ? 'Gün' : 'Day'}</Text>
                    </View>

                    <Text style={styles.timeUnitColon}>:</Text>

                    {/* Saat */}
                    <View style={styles.timeUnitBox}>
                      <TextInput
                        style={styles.timeUnitInput}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={customHoursInput}
                        onChangeText={(val) => handleCustomTimeChange('hour', val)}
                        maxLength={2}
                      />
                      <Text style={styles.timeUnitLabel}>{language === 'tr' ? 'Saat' : 'Hour'}</Text>
                    </View>

                    <Text style={styles.timeUnitColon}>:</Text>

                    {/* Dakika */}
                    <View style={styles.timeUnitBox}>
                      <TextInput
                        style={styles.timeUnitInput}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={customMinsInput}
                        onChangeText={(val) => handleCustomTimeChange('min', val)}
                        maxLength={2}
                      />
                      <Text style={styles.timeUnitLabel}>{language === 'tr' ? 'Dakika' : 'Min'}</Text>
                    </View>
                  </View>
                  <Text style={styles.customDurationHelperText}>
                    {language === 'tr'
                      ? 'Belirlenen süre sonunda otomatik Aktif duruma geçilir.'
                      : 'Auto restores to Active after the specified duration.'}
                  </Text>
                </View>

                {remainingText ? (
                  <View style={styles.remainingBadge}>
                    <Clock size={13} color="#B45309" style={{ marginRight: 6 }} />
                    <Text style={styles.remainingText}>{remainingText}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statusToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  statusToggleBtnActiveGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  statusToggleBtnActiveOrange: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  statusToggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  statusToggleTextGreen: {
    color: '#059669',
  },
  statusToggleTextOrange: {
    color: '#D97706',
  },
  passiveDetailSection: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  subStatusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subStatusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subStatusChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  subStatusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  subStatusChipTextActive: {
    color: '#B45309',
    fontWeight: '700',
  },
  customReasonContainer: {
    marginTop: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  customReasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 6,
  },
  customReasonInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1E293B',
  },
  durationPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationPresetChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  durationPresetChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  durationPresetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  durationPresetTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  customDurationSection: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customDurationSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timeUnitBox: {
    alignItems: 'center',
    flex: 1,
  },
  timeUnitInput: {
    width: '100%',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 8,
  },
  timeUnitLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
  },
  timeUnitColon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 16,
  },
  customDurationHelperText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  remainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  remainingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
});
