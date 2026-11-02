import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import { Trash2, AlertTriangle, ShieldAlert } from 'lucide-react-native';

export interface TicketDestructionModalProps {
  /** Modal visibility flag – optional, defaults to false */
  visible?: boolean;
  ticketId: string | number;
  ticketSubject?: string;
  isPurgingAll?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  language?: string;
}

/**
 * TicketDestructionModal:
 * Bileti ve tüm eklerini yerel donanım Keystore'undan, Cloudflare R2'den ve D1 relay'den
 * kalıcı ve geri döndürülemez biçimde yok eden (buharlaştıran) güvenlik emniyet kilidi.
 */
export const TicketDestructionModal: React.FC<TicketDestructionModalProps> = ({
  visible = false,
  ticketId,
  ticketSubject,
  isPurgingAll = false,
  onConfirm,
  onCancel,
  language = 'tr',
}) => {
  const isTr = language === 'tr';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <ShieldAlert size={28} color="#EF4444" strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>
            {isPurgingAll
              ? (isTr ? 'Tüm Biletleri İmha Et' : 'Purge All Tickets')
              : (isTr ? 'Bileti Kalıcı Olarak Buharlaştır' : 'Permanently Vaporize Ticket')}
          </Text>

          <Text style={styles.description}>
            {isPurgingAll
              ? (isTr
                  ? 'Cihazınızdaki tüm şifreli bilet kayıtları, mesaj geçmişi ve R2 ekleri geri döndürülemez biçimde donanım Keystore\'undan silinecektir.'
                  : 'All encrypted tickets, message threads, and R2 media attachments will be permanently purged from local hardware Keystore.')
              : (isTr
                  ? `#${ticketId} numaralı ${ticketSubject ? `"${ticketSubject}" ` : ''}bilet, tüm şifreli mesajları ve medya ekleri Keystore'dan tamamen silinecektir. Bu işlem geri alınamaz!`
                  : `Ticket #${ticketId} and all encrypted messages/attachments will be permanently erased from Keystore. This action cannot be undone!`)}
          </Text>

          <View style={styles.warningBox}>
            <AlertTriangle size={14} color="#B91C1C" style={{ marginRight: 6 }} />
            <Text style={styles.warningText}>
              {isTr
                ? 'Sıfır-Bilgi Güvenliği: Silinen veriler sunucuda tutulmadığı için kurtarılamaz.'
                : 'Zero-Knowledge: Deleted data cannot be recovered from any server.'}
            </Text>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>{isTr ? 'Vazgeç' : 'Cancel'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={onConfirm} activeOpacity={0.8}>
              <Trash2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.deleteBtnText}>
                {isTr ? 'İmha Et ve Buharlaştır' : 'Vaporize Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 18,
  },
  warningText: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: '600',
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  deleteBtn: {
    flex: 1.5,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  deleteBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
