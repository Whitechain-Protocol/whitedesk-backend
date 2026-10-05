import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Camera, Image as ImageIcon, FileText } from 'lucide-react-native';

interface AttachMenuModalProps {
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
        style={styles.attachModalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.attachModalContainer}>
          <Text style={styles.attachModalTitle}>
            {getLabel('helpdesk.attachTitle', 'Dosya Ekle', 'Attach File')}
          </Text>
          <Text style={styles.attachModalSubtitle}>
            {getLabel('helpdesk.attachSubtitle', 'Talebinize görsel veya belge ekleyin', 'Attach image or document to your ticket')}
          </Text>

          <View style={styles.attachOptionsRow}>
            <TouchableOpacity style={styles.attachOptionBtn} onPress={onPickCamera} activeOpacity={0.7}>
              <View style={[styles.attachOptionIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                <Camera size={22} color="#3B82F6" />
              </View>
              <Text style={styles.attachOptionLabel}>
                {getLabel('helpdesk.camera', 'Kamera', 'Camera')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachOptionBtn} onPress={onPickGallery} activeOpacity={0.7}>
              <View style={[styles.attachOptionIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                <ImageIcon size={22} color="#10b981" />
              </View>
              <Text style={styles.attachOptionLabel}>
                {getLabel('helpdesk.gallery', 'Galeri', 'Gallery')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachOptionBtn} onPress={onPickDocument} activeOpacity={0.7}>
              <View style={[styles.attachOptionIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
                <FileText size={22} color="#d97706" />
              </View>
              <Text style={styles.attachOptionLabel}>
                {getLabel('helpdesk.document', 'Belge', 'Document')}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.attachCancelBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.attachCancelText}>
              {getLabel('helpdesk.cancel', 'Vazgeç', 'Cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  attachModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  attachModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    elevation: 25,
  },
  attachModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  attachModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
  },
  attachOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  attachOptionBtn: {
    alignItems: 'center',
    flex: 1,
  },
  attachOptionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
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
});
