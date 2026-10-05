import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Platform,
  Modal
} from 'react-native';
import { useTranslation } from '../services/i18nService';

interface BottomConfirmationSheetProps {
  visible: boolean;
  title: string;
  description: string;
  actionText: string;
  actionColor?: string;
  onAction: () => void;
  onCancel?: () => void;
  cancelText?: string;
}

export function BottomConfirmationSheet({
  visible,
  title,
  description,
  actionText,
  actionColor = '#EF4444',
  onAction,
  onCancel,
  cancelText
}: BottomConfirmationSheetProps) {
  const { t } = useTranslation();
  const resolvedCancelText = cancelText || t('common.cancel');
  return (
    <Modal visible={visible} transparent={true} animationType="fade" statusBarTranslucent>
      <View style={styles.bottomSheetOverlay}>
        <View style={styles.bottomSheetContainer}>
          <Text style={styles.bottomSheetTitle}>{title}</Text>
          
          <Text style={styles.bottomSheetDesc}>
            {description}
          </Text>
          
          <View style={styles.bottomSheetBtnRow}>
            {onCancel && (
              <>
                <TouchableOpacity 
                  style={styles.textBtn}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>{resolvedCancelText}</Text>
                </TouchableOpacity>
                
                <View style={styles.separator} />
              </>
            )}

            <TouchableOpacity 
              style={styles.textBtn} 
              onPress={onAction}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionText, { color: actionColor }]}>{actionText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bottomSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'flex-end', // Float at the bottom
    alignItems: 'center',
    zIndex: 99999,
    padding: 16, // Side spacing
  },
  bottomSheetContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    marginBottom: Platform.OS === 'ios' ? 24 : 16, // Reduced to match side padding (16px) balance
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 25,
    alignItems: 'stretch', // Stretch to allow left alignment
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 10,
    textAlign: 'left',
  },
  bottomSheetDesc: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'left',
  },
  bottomSheetBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 16,
  },
  textBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
  },
});
