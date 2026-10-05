import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Edit3 } from 'lucide-react-native';

interface IdentityModalProps {
  visible: boolean;
  onClose: () => void;
  identityInput: string;
  setIdentityInput: (v: string) => void;
  onSave: () => void;
  language: string;
  getLabel: (key: string, tr: string, en: string) => string;
}

export const IdentityModal: React.FC<IdentityModalProps> = ({
  visible,
  onClose,
  identityInput,
  setIdentityInput,
  onSave,
  language,
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
      <View style={styles.attachModalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior="padding"
          pointerEvents="box-none"
          style={{ width: '100%', alignItems: 'center' }}
        >
          <View style={[styles.attachModalContainer, { maxWidth: 420 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Edit3 size={18} color="#3B82F6" style={{ marginRight: 8 }} />
              <Text style={styles.attachModalTitle}>
                {language === 'tr' ? 'Kendinizi Tanımlayın' : 'Identify Yourself'}
              </Text>
            </View>
            <Text style={[styles.attachModalSubtitle, { marginBottom: 14 }]}>
              {language === 'tr' 
                ? 'Destek biletlerinde ve admin panellerinde görünecek adınızı, rumuzunuzu veya unvanınızı belirleyin.'
                : 'Set your name, nickname, or operational title visible in support tickets and admin panels.'}
            </Text>

            <TextInput
              style={[styles.composeInputField, { marginBottom: 16 }]}
              placeholder={language === 'tr' ? 'Örn: Mustafa ERYILMAZ, Tech Lead vb.' : 'e.g. John Doe, Tech Lead etc.'}
              placeholderTextColor="#94a3b8"
              value={identityInput}
              onChangeText={setIdentityInput}
              autoFocus={true}
              autoCapitalize="words"
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.attachCancelBtn, { flex: 1, marginTop: 0 }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.attachCancelText}>
                  {getLabel('common.cancel', 'Vazgeç', 'Cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.fluidSubmitBtn,
                  { flex: 1, paddingVertical: 12 },
                  identityInput.trim().length > 0 && styles.fluidSubmitBtnActive
                ]}
                onPress={onSave}
                activeOpacity={0.7}
              >
                <Text style={styles.fluidSubmitBtnText}>
                  {getLabel('common.save', 'Kaydet', 'Save')}
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
  attachModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  attachModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  attachModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  attachModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  composeInputField: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  attachCancelBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  attachCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  fluidSubmitBtn: {
    backgroundColor: '#94A3B8',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fluidSubmitBtnActive: {
    backgroundColor: '#3B82F6',
  },
  fluidSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
