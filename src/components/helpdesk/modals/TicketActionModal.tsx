import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  Trash2,
  LogOut,
  UserPlus,
  Sparkles,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { HelpDeskTicket } from '../../../services/helpDeskService';

interface TicketActionModalProps {
  visible: boolean;
  onClose: () => void;
  ticket: HelpDeskTicket | null;
  ownWhiteId: string;
  adminRole: 'founder' | 'global_admin' | 'admin' | 'none';
  isMasterAdmin: boolean;
  isFounder: boolean;
  targetActionRole: 'founder' | 'global_admin' | 'admin' | 'none';
  getRank: (role: string) => number;
  language: string;
  getLabel: (key: string, tr: string, en: string) => string;
  formatWhiteId: (id: string) => string;
  onDeleteSingleTicket: () => void;
  onRevokeUserAdmin: () => void;
  onPromoteTicketUserToAdmin: () => void;
  onPromoteTicketUserToCosmos: () => void;
  onBlockTicketUser: () => void;
  onDeleteTicketAndUser: () => void;
}

export const TicketActionModal: React.FC<TicketActionModalProps> = ({
  visible,
  onClose,
  ticket,
  ownWhiteId,
  adminRole,
  isMasterAdmin,
  isFounder,
  targetActionRole,
  getRank,
  language,
  getLabel,
  formatWhiteId,
  onDeleteSingleTicket,
  onRevokeUserAdmin,
  onPromoteTicketUserToAdmin,
  onPromoteTicketUserToCosmos,
  onBlockTicketUser,
  onDeleteTicketAndUser,
}) => {
  if (!ticket) return null;

  const targetId = ticket.user_white_id || ticket.user_blind_id || '';
  const isNotMe = targetId !== ownWhiteId;

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
        <View style={[styles.attachModalContainer, { maxWidth: 440 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View>
              <Text style={styles.attachModalTitle}>
                {language === 'tr' ? 'Kullanıcı & Bilet Yönetimi' : 'User & Ticket Governance'}
              </Text>
              <Text style={styles.attachModalSubtitle}>
                #{ticket.id} · {formatWhiteId(targetId)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Option 1: Delete Ticket */}
          <TouchableOpacity
            style={styles.ticketActionOptionBtn}
            onPress={onDeleteSingleTicket}
            activeOpacity={0.7}
          >
            <Trash2 size={20} color="#DC2626" style={styles.ticketActionOptionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.ticketActionOptionTitle, { color: '#DC2626' }]}>
                {language === 'tr' ? 'Bileti Sil' : 'Delete Ticket'}
              </Text>
              <Text style={styles.ticketActionOptionDesc}>
                {language === 'tr' ? 'Bu destek biletini ve tüm mesajlarını kalıcı olarak siler.' : 'Permanently remove this support ticket and all messages.'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Option 2: Revoke Admin Privileges */}
          {isNotMe && targetActionRole !== 'none' && getRank(adminRole) > getRank(targetActionRole) && (
            <TouchableOpacity
              style={styles.ticketActionOptionBtn}
              onPress={onRevokeUserAdmin}
              activeOpacity={0.7}
            >
              <LogOut size={20} color="#EF4444" style={styles.ticketActionOptionIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ticketActionOptionTitle, { color: '#EF4444' }]}>
                  {language === 'tr' ? 'Yöneticilik Yetkisini İptal Et' : 'Revoke Admin Authority'}
                </Text>
                <Text style={styles.ticketActionOptionDesc}>
                  {language === 'tr' ? 'Kullanıcının yöneticilik yetkisini ve tüm yetkilendirmelerini iptal eder.' : 'Revoke admin privileges and all allocations.'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Option 3: Promote to Admin */}
          {isMasterAdmin && targetActionRole === 'none' && isNotMe && (
            <TouchableOpacity
              style={styles.ticketActionOptionBtn}
              onPress={onPromoteTicketUserToAdmin}
              activeOpacity={0.7}
            >
              <UserPlus size={20} color="#3B82F6" style={styles.ticketActionOptionIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ticketActionOptionTitle}>
                  {language === 'tr' ? 'Yönetici Yetkisi Ver (Admin Yap)' : 'Grant Admin Privileges'}
                </Text>
                <Text style={styles.ticketActionOptionDesc}>
                  {language === 'tr' ? 'Kullanıcıyı kategori ve uygulama destek yöneticisi yapar.' : 'Assign user to manage app/category support tickets.'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Option 4: Promote to Global Admin (Founder Only) */}
          {isFounder && targetActionRole !== 'founder' && targetActionRole !== 'global_admin' && isNotMe && (
            <TouchableOpacity
              style={styles.ticketActionOptionBtn}
              onPress={onPromoteTicketUserToCosmos}
              activeOpacity={0.7}
            >
              <Sparkles size={20} color="#7C3AED" style={styles.ticketActionOptionIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ticketActionOptionTitle, { color: '#7C3AED' }]}>
                  {language === 'tr' ? 'Kiracı Global Admini (WhiteCosmos *) Ata' : 'Assign WhiteCosmos (Global Admin *)'}
                </Text>
                <Text style={styles.ticketActionOptionDesc}>
                  {language === 'tr' ? 'Bu kiracının tek ve yetkili WhiteCosmos Global Yöneticisi yapar.' : 'Promote this user to the sole WhiteCosmos Global Admin.'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Option 5: Block User */}
          {isNotMe && (targetActionRole === 'none' || getRank(adminRole) > getRank(targetActionRole)) && (
            <TouchableOpacity
              style={styles.ticketActionOptionBtn}
              onPress={onBlockTicketUser}
              activeOpacity={0.7}
            >
              <ShieldCheck size={20} color="#D97706" style={styles.ticketActionOptionIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ticketActionOptionTitle, { color: '#D97706' }]}>
                  {language === 'tr' ? 'Kullanıcıyı Engelle' : 'Block User'}
                </Text>
                <Text style={styles.ticketActionOptionDesc}>
                  {language === 'tr' ? 'Kullanıcının sisteme bilet açmasını engeller.' : 'Prevent user from opening further support tickets.'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Option 6: Delete User & Ticket */}
          {isMasterAdmin && isNotMe && (targetActionRole === 'none' || getRank(adminRole) > getRank(targetActionRole)) && (
            <TouchableOpacity
              style={styles.ticketActionOptionBtn}
              onPress={onDeleteTicketAndUser}
              activeOpacity={0.7}
            >
              <Trash2 size={20} color="#DC2626" style={styles.ticketActionOptionIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ticketActionOptionTitle, { color: '#DC2626' }]}>
                  {language === 'tr' ? 'Bileti ve Kullanıcıyı Sil' : 'Delete User & Ticket'}
                </Text>
                <Text style={styles.ticketActionOptionDesc}>
                  {language === 'tr' ? 'Kullanıcı bağlamasını ve destek biletini kalıcı olarak siler.' : 'Permanently remove user binding and support ticket.'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.attachCancelBtn, { marginTop: 8 }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.attachCancelText}>
              {getLabel('common.cancel', 'Vazgeç', 'Cancel')}
            </Text>
          </TouchableOpacity>
        </View>
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
    padding: 20,
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
    marginTop: 2,
  },
  ticketActionOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ticketActionOptionIcon: {
    marginRight: 12,
  },
  ticketActionOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  ticketActionOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
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
