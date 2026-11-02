import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { CheckCircle2, HelpCircle, AlertCircle, Clock, Leaf } from 'lucide-react-native';
import { useTranslation } from '../services/i18nService';

export interface TicketResolutionCheckCardProps {
  isAutoClosed?: boolean;
  isSecondReminder?: boolean;
  onCloseTicket: () => void;
  onAskQuestion: () => void;
}

export function TicketResolutionCheckCard({
  isAutoClosed = false,
  isSecondReminder = false,
  onCloseTicket,
  onAskQuestion,
}: TicketResolutionCheckCardProps) {
  const { t, language } = useTranslation();
  const isTr = language === 'tr';

  // Eğer 2 günlük sürede yanıt verilmemiş ve bilet otomatik kapanmışsa
  if (isAutoClosed) {
    return (
      <View style={styles.autoClosedContainer}>
        <View style={styles.iconCircleWarning}>
          <Clock size={16} color="#D97706" />
        </View>
        <Text style={styles.autoClosedText}>
          {isTr
            ? 'Talebinize 48 saat boyunca yanıt verilmediği için otomatik kapatılmış ve 7 günlük güvenli imha süreci başlatılmıştır.'
            : 'Ticket was automatically closed due to 48h inactivity and entered 7-day secure self-destruct.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <CheckCircle2 size={16} color="#2563EB" strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.noticeText, { color: '#0F172A', fontWeight: '700', marginBottom: 2 }]}>
            {isTr ? 'Çözüm Onayı & Bilet Kapatma' : 'Resolution Confirmation'}
          </Text>
          <Text style={[styles.noticeText, { color: '#475569', fontWeight: '500', fontSize: 12 }]}>
            {isSecondReminder
              ? (isTr
                  ? 'Talebiniz yanıtlandı. Sorununuz çözüldü ise çözümü onaylayıp değerlendirme adımına geçebilirsiniz.'
                  : 'Your ticket was answered. If resolved, please confirm to proceed to evaluation.')
              : (isTr
                  ? 'Destek ekibimiz talebinizi yanıtladı. Sorununuz çözüldü mü? Onaylarsanız biletiniz kapatılacak ve yönetici değerlendirme adımına geçilecektir.'
                  : 'Support team answered. Is your issue resolved? If confirmed, ticket will be closed and proceed to rating.')}
          </Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        {/* Düğme 1: Çözümü Onayla & Kapat */}
        <TouchableOpacity style={styles.closeBtn} onPress={onCloseTicket} activeOpacity={0.8}>
          <CheckCircle2 size={15} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
          <Text style={styles.closeBtnText}>
            {isTr ? 'Çözümü Onayla & Kapat' : 'Confirm Resolution & Close'}
          </Text>
        </TouchableOpacity>

        {/* Düğme 2: Soru Sor (Nötr / Soru) */}
        <TouchableOpacity style={styles.askBtn} onPress={onAskQuestion} activeOpacity={0.8}>
          <Text style={styles.askBtnText}>
            {isTr ? 'Soru Sor' : 'Ask Question'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#1E3A8A',
    fontWeight: '600',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  closeBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  askBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  askBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  autoClosedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  iconCircleWarning: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  autoClosedText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
});
