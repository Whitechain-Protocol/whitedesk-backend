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

export interface AddAppModalProps {
  visible: boolean;
  onClose: () => void;
  appIdInput: string;
  onChangeAppId: (text: string) => void;
  onSubmit: () => void;
  language?: string;
  getLabel: (key: string, tr?: string | Record<string, string | number>, en?: string) => string;
}

export const AddAppModal: React.FC<AddAppModalProps> = ({
  visible,
  onClose,
  appIdInput,
  onChangeAppId,
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
            <Text style={styles.title}>
              {getLabel('helpdesk.newAppModalTitle')}
            </Text>

            <TextInput
              style={styles.input}
              placeholder={getLabel('helpdesk.newAppIdPlaceholder')}
              placeholderTextColor="#94a3b8"
              value={appIdInput}
              onChangeText={onChangeAppId}
              autoFocus={true}
              autoCapitalize="none"
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>
                  {getLabel('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  appIdInput.trim().length > 0 && styles.submitBtnActive,
                ]}
                onPress={onSubmit}
                disabled={!appIdInput.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.submitBtnText}>
                  {getLabel('helpdesk.addBtn')}
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
    marginBottom: 16,
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
    marginBottom: 16,
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
