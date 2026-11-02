import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Camera, Image as ImageIcon, FileText } from 'lucide-react-native';

export interface AttachMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onPickDocument: () => void;
  getLabel: (key: string, tr: string, en: string) => string;
}

export const AttachMenuModal: React.FC<AttachMenuModalProps> = ({
  visible,
  onClose,
  onPickCamera,
  onPickGallery,
  onPickDocument,
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
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <Text style={styles.title}>
            {getLabel('helpdesk.attachTitle', 'Dosya Ekle', 'Attach File')}
          </Text>
          <Text style={styles.subtitle}>
            {getLabel(
              'helpdesk.attachSubtitle',
              'Talebinize görsel veya belge ekleyin',
              'Attach image or document to your ticket'
            )}
          </Text>

          <View style={styles.optionsRow}>
            <TouchableOpacity style={styles.optionBtn} onPress={onPickCamera} activeOpacity={0.7}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                <Camera size={22} color="#3B82F6" />
              </View>
              <Text style={styles.optionLabel}>
                {getLabel('helpdesk.camera', 'Kamera', 'Camera')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionBtn} onPress={onPickGallery} activeOpacity={0.7}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                <ImageIcon size={22} color="#10B981" />
              </View>
              <Text style={styles.optionLabel}>
                {getLabel('helpdesk.gallery', 'Galeri', 'Gallery')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionBtn} onPress={onPickDocument} activeOpacity={0.7}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
                <FileText size={22} color="#D97706" />
              </View>
              <Text style={styles.optionLabel}>
                {getLabel('helpdesk.document', 'Belge', 'Document')}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>
              {getLabel('helpdesk.cancel', 'Vazgeç', 'Cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
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
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  optionBtn: {
    alignItems: 'center',
    padding: 8,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  cancelBtn: {
    width: '100%',
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
});
