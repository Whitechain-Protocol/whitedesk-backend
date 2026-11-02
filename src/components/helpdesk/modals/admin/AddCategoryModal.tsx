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

export interface AddCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  selectedAppId: string;
  catIdInput: string;
  onChangeCatId: (text: string) => void;
  catTrInput?: string;
  catLabelInput?: string;
  onChangeCatTr?: (text: string) => void;
  onChangeCatLabel?: (text: string) => void;
  onSubmit: () => void;
  language?: string;
  getLabel: (key: string, tr: string, en: string) => string;
  formatAppId?: (appId: string) => string;
}

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  visible,
  onClose,
  selectedAppId,
  catIdInput,
  onChangeCatId,
  catTrInput,
  catLabelInput,
  onChangeCatTr,
  onChangeCatLabel,
  onSubmit,
  language = 'tr',
  getLabel,
  formatAppId = (id) => id,
}) => {
  const effectiveLabel = catLabelInput ?? catTrInput ?? '';
  const handleLabelChange = onChangeCatLabel ?? onChangeCatTr ?? (() => {});
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
            <Text style={styles.title}>
              {getLabel('helpdesk.newCatModalTitle', 'Yeni Kategori Ekle', 'Add New Category')}
            </Text>
            <Text style={styles.subtitle}>{formatAppId(selectedAppId)}</Text>

            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              placeholder={getLabel('helpdesk.newCatIdPlaceholder', 'Kategori Kodu (Örn: billing, kargo)', 'Category Code (e.g. billing, cargo)')}
              placeholderTextColor="#94a3b8"
              value={catIdInput}
              onChangeText={onChangeCatId}
              autoFocus={true}
              autoCapitalize="none"
            />

            <TextInput
              style={[styles.input, { marginBottom: 16 }]}
              placeholder={getLabel('helpdesk.newCatTrPlaceholder', 'Kategori Adı (Örn: Fatura & Ödemeler)', 'Category Label')}
              placeholderTextColor="#94a3b8"
              value={effectiveLabel}
              onChangeText={handleLabelChange}
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
                  catIdInput.trim().length > 0 && styles.submitBtnActive,
                ]}
                onPress={onSubmit}
                disabled={!catIdInput.trim()}
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
    marginBottom: 12,
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
