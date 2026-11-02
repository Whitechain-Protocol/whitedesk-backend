import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Star, Check, X, ShieldCheck, Leaf } from 'lucide-react-native';
import { useTranslation } from '../services/i18nService';

export interface TicketFeedbackDialogProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (score: number, comment: string) => Promise<void>;
}

export function TicketFeedbackDialog({
  visible,
  onClose,
  onSubmit,
}: TicketFeedbackDialogProps) {
  const { t, language } = useTranslation();
  const isTr = language === 'tr';

  const [selectedScore, setSelectedScore] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(selectedScore, comment.trim());
      setComment('');
      setSelectedScore(5);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {isTr ? 'Hizmeti Değerlendirin' : 'Rate Service'}
              </Text>
              <Text style={styles.subtitle}>
                {isTr
                  ? 'Destek kalitemizi 1-5 arasında puanlayın.'
                  : 'Rate the support quality from 1 to 5.'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* 1 - 5 Puan Ölçeği */}
          <View style={styles.scaleContainer}>
            <View style={styles.scaleButtonsRow}>
              {[1, 2, 3, 4, 5].map(score => {
                const isSelected = selectedScore === score;
                return (
                  <TouchableOpacity
                    key={`score_${score}`}
                    style={[styles.scorePill, isSelected && styles.scorePillSelected]}
                    onPress={() => setSelectedScore(score)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.scoreText, isSelected && styles.scoreTextSelected]}>
                      {score}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.scaleLabelsRow}>
              <Text style={styles.scaleSubLabel}>1: {isTr ? 'Geliştirilmeli' : 'Needs Improvement'}</Text>
              <Text style={styles.scaleSubLabel}>5: {isTr ? 'Kusursuz' : 'Exceptional'}</Text>
            </View>
          </View>

          {/* Kısa Not / Görüş (İsteğe Bağlı, Maksimum 250 Karakter) */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={isTr ? 'Görüşünüz (isteğe bağlı)...' : 'Feedback (optional)...'}
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={250}
              value={comment}
              onChangeText={setComment}
            />
            <Text style={styles.charCounter}>{comment.length} / 250</Text>
          </View>

          {/* Gizlilik & Şifreleme Notu */}
          <View style={styles.secureNotice}>
            <ShieldCheck size={14} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={styles.secureNoticeText}>
              {isTr
                ? 'Uçtan uca şifreli ve sıfır kişisel veri güvenceli.'
                : 'End-to-end encrypted with zero personal data.'}
            </Text>
          </View>

          {/* Eylem Butonu */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Star size={16} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.submitButtonText}>
                  {isTr ? 'Puanla' : 'Submit'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 17,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleContainer: {
    marginVertical: 12,
  },
  scaleButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  scorePill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  scorePillSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#334155',
  },
  scoreTextSelected: {
    color: '#FFFFFF',
  },
  scaleLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  scaleSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  inputContainer: {
    marginTop: 12,
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },
  secureNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  secureNoticeText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
