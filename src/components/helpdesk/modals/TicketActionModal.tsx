import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import {
  Trash2,
  Activity,
  LogOut,
  UserPlus,
  Sparkles,
  ShieldCheck,
  Leaf,
  RotateCcw,
  Star,
  Layers,
  Cpu,
  ArrowRight,
  X,
  Database,
} from 'lucide-react-native';
import { HelpDeskTicket, helpDeskService } from '../../../services/helpDeskService';
import { checkTicketHasDiagnostics } from '../utils/helpdeskFormatters';

export interface TicketActionModalProps {
  visible: boolean;
  onClose: () => void;
  ticket: HelpDeskTicket | null;
  ownWhiteId: string;
  adminRole: 'founder' | 'global_admin' | 'admin' | 'none';
  isAdmin?: boolean;
  isMasterAdmin: boolean;
  isFounder: boolean;
  targetActionRole: 'founder' | 'global_admin' | 'admin' | 'none';
  getRank: (role: any) => number;
  language: string;
  getLabel: (key: string, tr: string, en: string) => string;
  formatWhiteId: (id: string) => string;
  onDeleteSingleTicket: () => void;
  onRevokeUserAdmin: () => void;
  onPromoteTicketUserToAdmin: () => void;
  onPromoteTicketUserToCosmos: () => void;
  onBlockTicketUser: () => void;
  onDeleteTicketAndUser: () => void;
  onStartSelfDestruct?: (ticket?: any) => void;
  onCancelSelfDestruct?: (ticket?: any) => void;
  onOpenRating?: () => void;
  onOpenOrgAssign?: () => void;
  onInspectDiagnostics?: (ticket?: any) => void;
  onAttachDiagnostics?: (ticket?: any) => void;
  onDeleteDiagnostics?: (ticket?: any) => void;
  onStartTransfer?: (ticket?: any) => void;
  onCancelTransfer?: (ticket?: any) => void;
  onTakeOverTicket?: (ticket: HelpDeskTicket) => void;
  messages?: any[] | null;
  safeTop?: number;
  anchorY?: number | null;
}

export const TicketActionModal: React.FC<TicketActionModalProps> = ({
  visible,
  onClose,
  ticket,
  ownWhiteId,
  adminRole,
  isAdmin = false,
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
  onStartSelfDestruct,
  onCancelSelfDestruct,
  onOpenRating,
  onOpenOrgAssign,
  onInspectDiagnostics,
  onAttachDiagnostics,
  onDeleteDiagnostics,
  onStartTransfer,
  onCancelTransfer,
  onTakeOverTicket,
  messages = null,
  safeTop = 44,
  anchorY = null,
}) => {
  if (!ticket) return null;

  const targetId = ticket.user_white_id || ticket.user_blind_id || '';
  const isNotMe = targetId !== ownWhiteId;
  const selfDestructInfo = helpDeskService.getTicketSelfDestructInfo(ticket);
  const lifecycle = helpDeskService.getTicketLifecycleStatus(ticket);
  const hasDiag = checkTicketHasDiagnostics(ticket, messages);

  const { height: screenHeight } = Dimensions.get('window');
  const shouldOpenUpwards = anchorY !== null && anchorY !== undefined && anchorY > screenHeight * 0.58;

  const dynamicPopupStyle = (anchorY !== null && anchorY !== undefined)
    ? (shouldOpenUpwards
        ? { bottom: Math.max(20, screenHeight - anchorY + 4), right: 16 }
        : { top: Math.max(safeTop + 8, anchorY + 4), right: 16 }
      )
    : { top: safeTop + 54, right: 16 };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.popupContainer, dynamicPopupStyle]}>
          {/* 1. Sistem Tanısı Aksiyonları */}
          {hasDiag ? (
            <>
              {onInspectDiagnostics && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onInspectDiagnostics(ticket);
                  }}
                  activeOpacity={0.65}
                >
                  <Activity size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                  <Text style={styles.menuText}>
                    {language === 'tr' ? 'Sistem Tanısını İncele' : 'Inspect Diagnostic'}
                  </Text>
                </TouchableOpacity>
              )}
              {onDeleteDiagnostics && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onDeleteDiagnostics(ticket);
                  }}
                  activeOpacity={0.65}
                >
                  <Trash2 size={16} color="#DC2626" strokeWidth={2} style={styles.menuIcon} />
                  <Text style={[styles.menuText, { color: '#DC2626' }]}>
                    {language === 'tr' ? 'Sistem Tanısını Sil' : 'Delete Diagnostic'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            onAttachDiagnostics && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onAttachDiagnostics(ticket);
                }}
                activeOpacity={0.65}
              >
                <Cpu size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Sistem Tanısı Ekle' : 'Add Diagnostic'}
                </Text>
              </TouchableOpacity>
            )
          )}

          {/* 2. Hizmet Kalitesini Değerlendir */}
          {!isAdmin && onOpenRating && (lifecycle.stage === 'closed_cooling' || lifecycle.stage === 'rating_pending') && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onOpenRating();
              }}
              activeOpacity={0.65}
            >
              <Star size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
              <Text style={styles.menuText}>
                {language === 'tr' ? 'Hizmeti Değerlendir' : 'Rate Support'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3. Birim / Uygulama Düzenle */}
          {(isAdmin || getRank(adminRole) >= 1) && onOpenOrgAssign && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onOpenOrgAssign();
              }}
              activeOpacity={0.65}
            >
              <Layers size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
              <Text style={styles.menuText}>
                {language === 'tr' ? 'Birim Düzenle' : 'Assign Unit'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3.0 Bileti Devral (Take Over) - Yalnızca Kurucu ve Global Admin için sunucuda henüz buharlaşmamış biletlerde */}
          {(isFounder || isMasterAdmin || adminRole === 'founder' || adminRole === 'global_admin') && ticket.is_relay_pending && onTakeOverTicket && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onTakeOverTicket(ticket);
              }}
              activeOpacity={0.65}
            >
              <Database size={16} color="#DC2626" strokeWidth={2} style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: '#DC2626', fontWeight: '700' }]}>
                {language === 'tr' ? 'Bileti Devral' : 'Take Over'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3.1 Bileti Devret */}
          {(isAdmin || getRank(adminRole) >= 1) && ticket.transfer_status !== 'pending' && onStartTransfer && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onStartTransfer(ticket);
              }}
              activeOpacity={0.65}
            >
              <ArrowRight size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
              <Text style={styles.menuText}>
                {language === 'tr' ? 'Bileti Devret' : 'Hand Over'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3.2 Devri İptal Et */}
          {(isAdmin || getRank(adminRole) >= 1) && ticket.transfer_status === 'pending' && onCancelTransfer && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onCancelTransfer(ticket);
              }}
              activeOpacity={0.65}
            >
              <X size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
              <Text style={styles.menuText}>
                {language === 'tr' ? 'Devri İptal Et' : 'Cancel Hand Over'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 4. Dijital Temizlik (Self-Destruct) */}
          {Boolean(selfDestructInfo.inDestruction || (ticket.auto_delete_at && Number(ticket.auto_delete_at) > 0)) ? (
            onCancelSelfDestruct && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onCancelSelfDestruct(ticket);
                }}
                activeOpacity={0.65}
              >
                <RotateCcw size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Silme Sürecini Durdur' : 'Stop Deletion Process'}
                </Text>
              </TouchableOpacity>
            )
          ) : (
            onStartSelfDestruct && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onStartSelfDestruct(ticket);
                }}
                activeOpacity={0.65}
              >
                <Leaf size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Silme Sürecini Başlat' : 'Start Deletion Process'}
                </Text>
              </TouchableOpacity>
            )
          )}

          {/* 5. Yönetici Yetkisi Ver */}
          {getRank(adminRole) >= 1 && targetActionRole === 'none' && isNotMe && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onPromoteTicketUserToAdmin();
              }}
              activeOpacity={0.65}
            >
              <UserPlus size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
              <Text style={styles.menuText}>
                {language === 'tr' ? 'Yönetici Yetkisi Ver' : 'Grant Admin Privileges'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 6. Kiracı Global Yöneticisi Ata */}
          {(isFounder || (adminRole === 'global_admin' && targetActionRole === 'admin')) && targetActionRole !== 'founder' && targetActionRole !== 'global_admin' && isNotMe && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onPromoteTicketUserToCosmos();
              }}
              activeOpacity={0.65}
            >
              <Sparkles size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
              <Text style={styles.menuText}>
                {language === 'tr' ? 'Kiracı Global Yöneticisi Ata' : 'Assign Global Admin'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Divider Before Danger Actions */}
          <View style={styles.divider} />

          {/* 7. Yöneticilik Yetkisini İptal Et */}
          {isNotMe && targetActionRole !== 'none' && getRank(adminRole) > getRank(targetActionRole) && (
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemWipe]}
              onPress={() => {
                onClose();
                onRevokeUserAdmin();
              }}
              activeOpacity={0.65}
            >
              <LogOut size={16} color="#EF4444" strokeWidth={2} style={styles.menuIcon} />
              <Text style={[styles.menuText, styles.menuTextWipe]}>
                {language === 'tr' ? 'Yöneticilik Yetkisini İptal Et' : 'Revoke Admin Authority'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 8. Kullanıcıyı Engelle */}
          {isNotMe && (targetActionRole === 'none' || getRank(adminRole) > getRank(targetActionRole)) && (
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemWipe]}
              onPress={() => {
                onClose();
                onBlockTicketUser();
              }}
              activeOpacity={0.65}
            >
              <ShieldCheck size={16} color="#EF4444" strokeWidth={2} style={styles.menuIcon} />
              <Text style={[styles.menuText, styles.menuTextWipe]}>
                {language === 'tr' ? 'Kullanıcıyı Engelle' : 'Block User'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 9. Bileti Sil */}
          {(isAdmin || !isNotMe) && (
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemWipe]}
              onPress={() => {
                onClose();
                onDeleteSingleTicket();
              }}
              activeOpacity={0.65}
            >
              <Trash2 size={16} color="#EF4444" strokeWidth={2} style={styles.menuIcon} />
              <Text style={[styles.menuText, styles.menuTextWipe]}>
                {language === 'tr' ? 'Bileti Sil' : 'Delete Ticket'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 10. Bileti ve Kullanıcıyı Sil (Master Admin) */}
          {isMasterAdmin && isNotMe && (targetActionRole === 'none' || getRank(adminRole) > getRank(targetActionRole)) && (
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemWipe]}
              onPress={() => {
                onClose();
                onDeleteTicketAndUser();
              }}
              activeOpacity={0.65}
            >
              <Trash2 size={16} color="#EF4444" strokeWidth={2} style={styles.menuIcon} />
              <Text style={[styles.menuText, styles.menuTextWipe]}>
                {language === 'tr' ? 'Bileti ve Kullanıcıyı Sil' : 'Delete User & Ticket'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  popupContainer: {
    position: 'absolute',
    right: 16,
    width: 252,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10.5,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    marginVertical: 1.5,
    borderRadius: 14,
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 14.5,
    color: '#1E293B',
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 12,
    marginVertical: 5,
  },
  menuItemWipe: {
    backgroundColor: '#FEF2F2',
  },
  menuTextWipe: {
    color: '#EF4444',
    fontWeight: '600',
  },
});
