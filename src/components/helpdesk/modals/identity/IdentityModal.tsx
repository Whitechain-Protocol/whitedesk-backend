import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Edit3, Coffee, CheckCircle2, Palmtree, HelpCircle, Clock } from 'lucide-react-native';
import { helpDeskService } from '../../../../services/helpDeskService';
import { AdminSubStatus } from '../../../../services/helpdesk/adminRosterService';
import { useTranslation } from '../../../../services/i18nService';

export interface IdentityModalProps {
  visible: boolean;
  onClose: () => void;
  identityInput: string;
  onChangeIdentityInput: (text: string) => void;
  onSave: () => void;
  isAdmin: boolean;
  onSignOut?: () => void;
  language?: string;
  getLabel: (key: string, tr: string, en: string) => string;
  allowNameEntry?: boolean;
}

const DURATION_PRESETS = [
  { labelKey: 'identity.modal.preset_15m', mins: 15 },
  { labelKey: 'identity.modal.preset_30m', mins: 30 },
  { labelKey: 'identity.modal.preset_1h', mins: 60 },
  { labelKey: 'identity.modal.preset_2h', mins: 120 },
  { labelKey: 'identity.modal.preset_1d', mins: 1440 },
  { labelKey: 'identity.modal.preset_indefinite', mins: 0 },
];

export const IdentityModal: React.FC<IdentityModalProps> = ({
  visible,
  onClose,
  identityInput,
  onChangeIdentityInput,
  onSave,
  isAdmin,
  onSignOut,
  language = 'tr',
  getLabel,
  allowNameEntry: allowNameEntryProp,
}) => {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState<boolean>(true);
  const [subStatus, setSubStatus] = useState<AdminSubStatus>('molada');
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [snoozeMins, setSnoozeMins] = useState<number>(30);
  const [customDaysInput, setCustomDaysInput] = useState<string>('0');
  const [customHoursInput, setCustomHoursInput] = useState<string>('0');
  const [customMinsInput, setCustomMinsInput] = useState<string>('30');
  const [remainingText, setRemainingText] = useState<string>('');
  const [localAllowNameEntry, setLocalAllowNameEntry] = useState<boolean>(true);

  const formatRemainingDuration = (totalMins: number, targetTimestamp?: number): string => {
    if (totalMins <= 0) return t('identity.modal.indefinite_manual');
    const d = Math.floor(totalMins / 1440);
    const h = Math.floor((totalMins % 1440) / 60);
    const m = totalMins % 60;
    const parts: string[] = [];
    if (d > 0) parts.push(t('identity.modal.unit_day_short', { count: d }));
    if (h > 0) parts.push(t('identity.modal.unit_hour_short', { count: h }));
    if (m > 0 || parts.length === 0) parts.push(t('identity.modal.unit_min_short', { count: m }));
    const durationStr = parts.join(' ');

    if (targetTimestamp) {
      const targetDate = new Date(targetTimestamp);
      const isDifferentDay = targetDate.getDate() !== new Date().getDate();
      const dateStr = isDifferentDay
        ? `${targetDate.toLocaleDateString([], { day: 'numeric', month: 'short' })} `
        : '';
      const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return t('identity.modal.auto_active_at', { time: `${dateStr}${timeStr}`, duration: durationStr });
    }
    return t('identity.modal.remaining_duration', { duration: durationStr });
  };

  // If allowNameEntry is not explicitly passed, query current tenant login settings
  useEffect(() => {
    if (visible && allowNameEntryProp === undefined) {
      void (async () => {
        try {
          const settings = await helpDeskService.getTenantLoginSettings();
          setLocalAllowNameEntry(settings.allowNameEntry);
        } catch {}
      })();
    }
  }, [visible, allowNameEntryProp]);

  const effectiveAllowNameEntry = allowNameEntryProp !== undefined ? allowNameEntryProp : localAllowNameEntry;

  const isValidTwoWordName = (name: string): boolean => {
    if (!name) return false;
    const cleaned = name.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()0-9]/g, '');
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2);
    return words.length >= 2;
  };

  const isSaveEnabled = effectiveAllowNameEntry ? isValidTwoWordName(identityInput) : true;

  useEffect(() => {
    if (visible && isAdmin) {
      const updateStatus = (status: { isActive: boolean; subStatus?: AdminSubStatus; customReason?: string; snoozeUntil: number | null }) => {
        setIsActive(status.isActive);
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
  }, [visible, isAdmin]);

  const handleSelectDuration = (mins: number) => {
    setSnoozeMins(mins);
    if (mins > 0) {
      const d = Math.floor(mins / 1440);
      const h = Math.floor((mins % 1440) / 60);
      const m = mins % 60;
      setCustomDaysInput(String(d));
      setCustomHoursInput(String(h));
      setCustomMinsInput(String(m));
      setRemainingText(formatRemainingDuration(mins, Date.now() + mins * 60000));
    } else {
      setCustomDaysInput('0');
      setCustomHoursInput('0');
      setCustomMinsInput('0');
      setRemainingText(t('identity.modal.indefinite_manual'));
    }
  };

  const handleCustomTimeChange = (type: 'day' | 'hour' | 'min', value: string) => {
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
      setRemainingText(formatRemainingDuration(total, Date.now() + total * 60000));
    } else {
      setRemainingText('');
    }
  };

  const handleSavePress = async () => {
    if (isAdmin) {
      await helpDeskService.setAdminBreakStatus(
        isActive,
        snoozeMins,
        !isActive ? subStatus : undefined,
        !isActive && subStatus === 'diger' ? customReasonText : undefined
      );
    }
    onSave();
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
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior="padding" pointerEvents="box-none" style={{ width: '100%', alignItems: 'center' }}>
          <View style={styles.container}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Edit3 size={18} color="#3B82F6" style={{ marginRight: 8 }} />
              <Text style={styles.title}>
                {t('identity.modal.title')}
              </Text>
            </View>
            <Text style={styles.subtitle}>
              {effectiveAllowNameEntry
                ? t('identity.modal.subtitle_name_allowed')
                : (isAdmin
                    ? t('identity.modal.subtitle_admin_status')
                    : t('identity.modal.subtitle_name_disabled'))}
            </Text>

            {/* Kuruluş ayarlarında ad soyad girişi açık ise isim giriş alanı görünür */}
            {effectiveAllowNameEntry && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {t('identity.modal.fullname_label')}
                </Text>
                <TextInput
                  style={[styles.input, { marginBottom: 4 }]}
                  placeholder={t('identity.modal.fullname_placeholder')}
                  placeholderTextColor="#94a3b8"
                  value={identityInput}
                  onChangeText={onChangeIdentityInput}
                  autoFocus={false}
                  autoCapitalize="words"
                />
                {!isValidTwoWordName(identityInput) && identityInput.trim().length > 0 ? (
                  <Text style={{ fontSize: 11, color: '#DC2626', marginBottom: 12, fontWeight: '500' }}>
                    {t('identity.modal.fullname_validation_error')}
                  </Text>
                ) : (
                  <View style={{ marginBottom: 12 }} />
                )}
              </View>
            )}

            {/* Admin Aktif / Pasif Durum & Süre Paneli */}
            {isAdmin && (
              <View style={styles.adminStatusBox}>
                <Text style={styles.sectionTitle}>
                  {t('identity.modal.work_status_title')}
                </Text>
                
                {/* Ana Butonlar: Aktif / Pasif */}
                <View style={styles.statusToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      isActive && styles.statusToggleBtnActiveGreen
                    ]}
                    onPress={() => setIsActive(true)}
                    activeOpacity={0.7}
                  >
                    <CheckCircle2 size={18} color={isActive ? '#10B981' : '#64748B'} style={{ marginRight: 8 }} />
                    <Text style={[styles.statusToggleText, isActive && styles.statusToggleTextGreen]}>
                      {t('identity.modal.status_active')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      !isActive && styles.statusToggleBtnActiveOrange
                    ]}
                    onPress={() => setIsActive(false)}
                    activeOpacity={0.7}
                  >
                    <Coffee size={18} color={!isActive ? '#F59E0B' : '#64748B'} style={{ marginRight: 8 }} />
                    <Text style={[styles.statusToggleText, !isActive && styles.statusToggleTextOrange]}>
                      {t('identity.modal.status_passive')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Pasif Seçildiğinde Açılan Alt Nedenler: İzinde, Molada, Diğer */}
                {!isActive && (
                  <View style={styles.passiveDetailSection}>
                    <Text style={styles.subSectionTitle}>
                      {t('identity.modal.passive_reason_label')}
                    </Text>
                    <View style={styles.subStatusRow}>
                      <TouchableOpacity
                        style={[
                          styles.subStatusChip,
                          subStatus === 'izinde' && styles.subStatusChipActive
                        ]}
                        onPress={() => setSubStatus('izinde')}
                        activeOpacity={0.7}
                      >
                        <Palmtree size={13} color={subStatus === 'izinde' ? '#D97706' : '#64748B'} style={{ marginRight: 4 }} />
                        <Text style={[styles.subStatusChipText, subStatus === 'izinde' && styles.subStatusChipTextActive]}>
                          {t('identity.modal.reason_leave')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.subStatusChip,
                          subStatus === 'molada' && styles.subStatusChipActive
                        ]}
                        onPress={() => setSubStatus('molada')}
                        activeOpacity={0.7}
                      >
                        <Coffee size={13} color={subStatus === 'molada' ? '#D97706' : '#64748B'} style={{ marginRight: 4 }} />
                        <Text style={[styles.subStatusChipText, subStatus === 'molada' && styles.subStatusChipTextActive]}>
                          {t('identity.modal.reason_break')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.subStatusChip,
                          subStatus === 'diger' && styles.subStatusChipActive
                        ]}
                        onPress={() => setSubStatus('diger')}
                        activeOpacity={0.7}
                      >
                        <HelpCircle size={13} color={subStatus === 'diger' ? '#D97706' : '#64748B'} style={{ marginRight: 4 }} />
                        <Text style={[styles.subStatusChipText, subStatus === 'diger' && styles.subStatusChipTextActive]}>
                          {t('identity.modal.reason_other')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Diğer Seçildiğinde Açılan Açıklama Giriş Alanı */}
                    {subStatus === 'diger' && (
                      <View style={styles.customReasonBox}>
                        <Text style={styles.customReasonLabel}>
                          {t('identity.modal.custom_reason_label')}
                        </Text>
                        <TextInput
                          style={styles.customReasonTextInput}
                          placeholder={t('identity.modal.custom_reason_placeholder')}
                          placeholderTextColor="#94A3B8"
                          value={customReasonText}
                          onChangeText={setCustomReasonText}
                        />
                      </View>
                    )}

                    {/* Süre Seçenekleri */}
                    <Text style={[styles.subSectionTitle, { marginTop: 12 }]}>
                      {t('identity.modal.preset_durations_label')}
                    </Text>
                    <View style={styles.snoozeRow}>
                      {DURATION_PRESETS.map(opt => (
                        <TouchableOpacity
                          key={opt.mins}
                          style={[
                            styles.snoozeChip,
                            snoozeMins === opt.mins && styles.snoozeChipActive
                          ]}
                          onPress={() => handleSelectDuration(opt.mins)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.snoozeChipText, snoozeMins === opt.mins && styles.snoozeChipTextActive]}>
                            {t(opt.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Net Süre Giriş Alanı (Presetler Haricinde) */}
                    <View style={styles.customDurationSection}>
                      <Text style={styles.customDurationSectionTitle}>
                        {t('identity.modal.exact_duration_label')}
                      </Text>
                      <View style={styles.customDurationTripleRow}>
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
                          <Text style={styles.timeUnitLabel}>{t('identity.modal.unit_day')}</Text>
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
                          <Text style={styles.timeUnitLabel}>{t('identity.modal.unit_hour')}</Text>
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
                          <Text style={styles.timeUnitLabel}>{t('identity.modal.unit_minute')}</Text>
                        </View>
                      </View>
                      <Text style={styles.customDurationHelperText}>
                        {t('identity.modal.auto_restore_hint')}
                      </Text>
                    </View>

                    {remainingText ? (
                      <View style={styles.remainingBadge}>
                        <Clock size={12} color="#B45309" style={{ marginRight: 4 }} />
                        <Text style={styles.remainingText}>{remainingText}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  isSaveEnabled && styles.submitBtnActive,
                ]}
                onPress={handleSavePress}
                disabled={!isSaveEnabled}
                activeOpacity={0.7}
              >
                <Text style={styles.submitBtnText}>
                  {t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 16,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  adminStatusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: 14,
    marginVertical: 4,
  },
  statusToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  statusToggleBtnActiveGreen: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  statusToggleBtnActiveOrange: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  statusToggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  statusToggleTextGreen: {
    color: '#047857',
    fontWeight: '800',
  },
  statusToggleTextOrange: {
    color: '#B45309',
    fontWeight: '800',
  },
  passiveDetailSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  subStatusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  subStatusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  subStatusChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  subStatusChipText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  subStatusChipTextActive: {
    color: '#B45309',
    fontWeight: '800',
  },
  snoozeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  snoozeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  snoozeChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  snoozeChipText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  snoozeChipTextActive: {
    color: '#B45309',
    fontWeight: '700',
  },
  remainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  remainingText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#B45309',
  },
  customReasonBox: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 8,
  },
  customReasonLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 4,
  },
  customReasonTextInput: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11.5,
    color: '#0F172A',
  },
  customDurationSection: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
  },
  customDurationSectionTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  customDurationTripleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeUnitBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 4,
  },
  timeUnitInput: {
    width: '100%',
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    paddingVertical: 2,
  },
  timeUnitLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },
  timeUnitColon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94A3B8',
    marginHorizontal: 4,
    alignSelf: 'center',
  },
  customDurationHelperText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnActive: {
    backgroundColor: '#3B82F6',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
