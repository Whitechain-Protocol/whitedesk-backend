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
import { ShieldCheck, Clock, X } from 'lucide-react-native';
import { AppRegStatus } from '../../../../services/helpDeskService';
import { useTranslation } from '../../../../services/i18nService';

export interface AppRegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  appRegStatus: AppRegStatus | null;
  currentAppId: string;
  appRegNameInput: string;
  onChangeAppRegName: (text: string) => void;
  appRegDescInput: string;
  onChangeAppRegDesc: (text: string) => void;
  onSubmit: () => void;
  language?: string;
  t?: (key: string, options?: any) => string;
}

export const AppRegistrationModal: React.FC<AppRegistrationModalProps> = ({
  visible,
  onClose,
  appRegStatus,
  currentAppId,
  appRegNameInput,
  onChangeAppRegName,
  appRegDescInput,
  onChangeAppRegDesc,
  onSubmit,
  language = 'tr',
  t: tProp,
}) => {
  const { t: i18nT } = useTranslation();
  const t = tProp || i18nT;

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
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%', alignItems: 'center' }}>
          <View style={styles.container}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <ShieldCheck size={20} color="#3B82F6" style={{ marginRight: 8 }} />
              <Text style={styles.title}>
                {t('admin.app_reg.title')}
              </Text>
            </View>

            {/* Status: unregistered → show form */}
            {(appRegStatus === 'unregistered' || appRegStatus === null) && (
              <>
                <Text style={styles.desc}>
                  {t('helpdesk.appNotRegisteredDesc', { appId: currentAppId })}
                </Text>
                <TextInput
                  style={[styles.input, { marginBottom: 10 }]}
                  placeholder={t('admin.app_reg.name_placeholder')}
                  placeholderTextColor="#94a3b8"
                  value={appRegNameInput}
                  onChangeText={onChangeAppRegName}
                  autoFocus={true}
                />
                <TextInput
                  style={[styles.input, { marginBottom: 16 }]}
                  placeholder={t('admin.app_reg.desc_placeholder')}
                  placeholderTextColor="#94a3b8"
                  value={appRegDescInput}
                  onChangeText={onChangeAppRegDesc}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                    <Text style={styles.cancelBtnText}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, styles.submitBtnActive]}
                    onPress={onSubmit}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.submitBtnText}>
                      {t('admin.app_reg.send_request')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Status: pending */}
            {appRegStatus === 'pending' && (
              <>
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <View style={styles.iconCircleWarning}>
                    <Clock size={26} color="#F59E0B" />
                  </View>
                  <Text style={[styles.title, { textAlign: 'center', marginBottom: 8 }]}>
                    {t('admin.app_reg.pending_title')}
                  </Text>
                  <Text style={[styles.desc, { textAlign: 'center' }]}>
                    {t('admin.app_reg.pending_desc')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.fullCloseBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Status: rejected */}
            {appRegStatus === 'rejected' && (
              <>
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <View style={styles.iconCircleDanger}>
                    <X size={26} color="#DC2626" />
                  </View>
                  <Text style={[styles.title, { textAlign: 'center', marginBottom: 8, color: '#DC2626' }]}>
                    {t('admin.app_reg.rejected_title')}
                  </Text>
                  <Text style={[styles.desc, { textAlign: 'center' }]}>
                    {t('admin.app_reg.rejected_desc')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.fullCloseBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </>
            )}
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
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 440,
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
  desc: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
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
  iconCircleWarning: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircleDanger: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  fullCloseBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
