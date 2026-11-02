import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Building2 } from 'lucide-react-native';

export interface AddOrgModalProps {
  visible: boolean;
  onClose: () => void;
  orgIdInput: string;
  onChangeOrgId: (text: string) => void;
  orgNameInput: string;
  onChangeOrgName: (text: string) => void;
  onSubmit: () => void;
  language?: string;
  getLabel: (key: string, tr: string, en: string) => string;
}

export const AddOrgModal: React.FC<AddOrgModalProps> = ({
  visible,
  onClose,
  orgIdInput,
  onChangeOrgId,
  orgNameInput,
  onChangeOrgName,
  onSubmit,
  language = 'tr',
  getLabel,
}) => {
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
        <KeyboardAvoidingView
          behavior="padding"
          pointerEvents="box-none"
          style={{ width: '100%', alignItems: 'center' }}
        >
          <View style={styles.container}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Building2 size={20} color="#3B82F6" style={{ marginRight: 8 }} />
              <Text style={styles.title}>
                {language === 'tr' ? 'Yeni Organizasyon Ekle' : 'Add New Organization'}
              </Text>
            </View>

            <Text style={styles.subtitle}>
              {language === 'tr'
                ? 'Cosmos Makamı: Yeni bir firma / holding organizasyonu tanımlayınız.'
                : 'Cosmos Authority: Define a new company / holding organization.'}
            </Text>

            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              placeholder={language === 'tr' ? 'Organizasyon Kodu (Örn: elektroser, holding_a)' : 'Org Code (e.g. elektroser)'}
              placeholderTextColor="#94a3b8"
              value={orgIdInput}
              onChangeText={onChangeOrgId}
              autoFocus={true}
              autoCapitalize="none"
            />

            <TextInput
              style={[styles.input, { marginBottom: 16 }]}
              placeholder={language === 'tr' ? 'Firma / Kurum Adı (Örn: Elektroser A.Ş.)' : 'Org Name (e.g. Elektroser Corp)'}
              placeholderTextColor="#94a3b8"
              value={orgNameInput}
              onChangeText={onChangeOrgName}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>
                  {getLabel('common.cancel', 'Vazgeç', 'Cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  orgIdInput.trim().length > 0 && styles.submitBtnActive,
                ]}
                onPress={onSubmit}
                disabled={!orgIdInput.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.submitBtnText}>
                  {getLabel('helpdesk.addBtn', 'Ekle', 'Add')}
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
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 16,
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
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#94A3B8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnActive: {
    backgroundColor: '#2563EB',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
