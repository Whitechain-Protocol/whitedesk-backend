import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {
  Sliders,
  Phone,
  Mic,
  Monitor,
  FileCheck2,
  ShieldCheck,
  X,
  CheckCircle2,
} from 'lucide-react-native';
import { UserAdvancedPreferences, RemoteDesktopScope } from '../types';

interface UserPreferencesModalProps {
  visible: boolean;
  onClose: () => void;
  preferences: UserAdvancedPreferences;
  onSave: (newPrefs: UserAdvancedPreferences) => Promise<void>;
  language: string;
  getLabel: (key: string, tr: string, en: string) => string;
}

export const UserPreferencesModal: React.FC<UserPreferencesModalProps> = ({
  visible,
  onClose,
  preferences: initialPrefs,
  onSave,
  language,
  getLabel,
}) => {
  const [prefs, setPrefs] = useState<UserAdvancedPreferences>(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setPrefs(initialPrefs);
  }, [initialPrefs, visible]);

  const handleToggle = (key: keyof UserAdvancedPreferences, val: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(prefs);
    setSaving(false);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 1200);
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
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.iconBox}>
                <Sliders size={18} color="#3B82F6" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.title}>Gelişmiş Tercihler</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  Sesli arama, canlı telsiz ve makbuz indirme tercihleri
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Success Toast */}
          {savedToast && (
            <View style={styles.toast}>
              <CheckCircle2 size={15} color="#2563EB" style={{ marginRight: 6 }} />
              <Text style={styles.toastText}>Tercihler başarıyla kaydedildi.</Text>
            </View>
          )}

          {/* Option 1: Sesli Arama */}
          <View style={styles.itemRow}>
            <View style={styles.itemIcon}>
              <Phone size={16} color="#3B82F6" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.itemTitle}>
                {getLabel(
                  'settings.advanced_features.user_preferences.voice_label',
                  'Sesli Aramaları Etkinleştir',
                  'Enable Voice Calls'
                )}
              </Text>
              <Text style={styles.itemDesc}>
                {getLabel(
                  'settings.advanced_features.user_preferences.voice_desc',
                  'Gelen sesli görüşme el sıkışma bildirimlerini kabul et',
                  'Accept incoming voice call handshake requests'
                )}
              </Text>
            </View>
            <Switch
              value={prefs.voiceCallEnabled}
              onValueChange={v => handleToggle('voiceCallEnabled', v)}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={prefs.voiceCallEnabled ? '#3B82F6' : '#FFFFFF'}
            />
          </View>

          {/* Option 2: Canlı Telsiz (PTT) */}
          <View style={styles.itemRow}>
            <View style={styles.itemIcon}>
              <Mic size={16} color="#3B82F6" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.itemTitle}>
                {getLabel(
                  'settings.advanced_features.user_preferences.ptt_label',
                  'Canlı Telsiz (Bas-Konuş) Etkin',
                  'Push-to-Talk (PTT) Enabled'
                )}
              </Text>
              <Text style={styles.itemDesc}>
                {getLabel(
                  'settings.advanced_features.user_preferences.ptt_desc',
                  'Bilet içi hızlı sesli telsiz özelliğini kullan',
                  'Use instant voice radio inside tickets'
                )}
              </Text>
            </View>
            <Switch
              value={prefs.pushToTalkEnabled}
              onValueChange={v => handleToggle('pushToTalkEnabled', v)}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={prefs.pushToTalkEnabled ? '#3B82F6' : '#FFFFFF'}
            />
          </View>

          {/* Option 2.5: Uzak Masaüstü */}
          <View style={styles.itemRow}>
            <View style={styles.itemIcon}>
              <Monitor size={16} color="#3B82F6" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.itemTitle}>
                {getLabel(
                  'settings.advanced_features.user_preferences.rd_label',
                  'Uzak Masaüstü Etkin',
                  'Remote Desktop Enabled'
                )}
              </Text>
              <Text style={styles.itemDesc}>
                {getLabel(
                  'settings.advanced_features.user_preferences.rd_desc',
                  'Onayınızla destek uzmanının uzak masaüstü bağlantısı kurmasına izin ver',
                  'Allow support agent to connect via remote desktop upon your approval'
                )}
              </Text>
            </View>
            <Switch
              value={prefs.remoteDesktopEnabled !== false}
              onValueChange={v => handleToggle('remoteDesktopEnabled', v)}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={prefs.remoteDesktopEnabled !== false ? '#3B82F6' : '#FFFFFF'}
            />
          </View>

          {/* Option 3: Makbuz Otomatik İndir */}
          <View style={styles.itemRow}>
            <View style={styles.itemIcon}>
              <FileCheck2 size={16} color="#3B82F6" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.itemTitle}>
                {getLabel(
                  'settings.advanced_features.user_preferences.receipt_label',
                  'Makbuzu Otomatik İndir',
                  'Auto-Download Receipt'
                )}
              </Text>
              <Text style={styles.itemDesc}>
                {getLabel(
                  'settings.advanced_features.user_preferences.receipt_desc',
                  'Kapanan talepler için değişmezlik makbuzunu cihaza kaydet',
                  'Save cryptographic receipt on ticket resolution'
                )}
              </Text>
            </View>
            <Switch
              value={prefs.autoDownloadReceipt}
              onValueChange={v => handleToggle('autoDownloadReceipt', v)}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={prefs.autoDownloadReceipt ? '#3B82F6' : '#FFFFFF'}
            />
          </View>

          {/* Option 4: Cihazda Otomatik Hassas Veri Maskeleme (KVKK/GDPR) */}
          <View style={[styles.itemRow, { borderBottomWidth: 0 }]}>
            <View style={styles.itemIcon}>
              <ShieldCheck size={16} color="#3B82F6" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.itemTitle}>
                {getLabel(
                  'settings.advanced_features.user_preferences.pii_label',
                  'Cihazda Otomatik Hassas Veri Maskeleme',
                  'Client-Side PII Redaction'
                )}
              </Text>
              <Text style={styles.itemDesc}>
                {getLabel(
                  'settings.advanced_features.user_preferences.pii_desc',
                  'Kart, T.C. kimlik, IBAN ve gizli anahtarlarınız cihazınızdan çıkmadan önce otomatik maskelenir (KVKK/GDPR Uyumlu).',
                  'Cards, IDs, IBANs and secret keys are automatically masked on-device before transmission (KVKK/GDPR Compliant).'
                )}
              </Text>
            </View>
            <Switch
              value={prefs.piiRedactionEnabled !== false}
              onValueChange={v => handleToggle('piiRedactionEnabled', v)}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={prefs.piiRedactionEnabled !== false ? '#3B82F6' : '#FFFFFF'}
            />
          </View>

          {/* Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>
                {getLabel('common.cancel', 'Vazgeç', 'Cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {getLabel('common.save', 'Kaydet', 'Save')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  scopeContainer: {
    marginTop: 10,
    marginLeft: 42,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scopeHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  scopePillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  scopePill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopePillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  scopePillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  scopePillTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
