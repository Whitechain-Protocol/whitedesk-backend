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
import { WhiteDeskCrypto } from '../../../whitedesk-sdk';
import { useTranslation } from '../../../services/i18nService';

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
  getLabel: (key: string, tr?: string, en?: string) => string;
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
  const { t } = useTranslation();
  if (!ticket) return null;

  const targetId = ticket.user_white_id || ticket.user_blind_id || '';
  const isNotMe = targetId !== ownWhiteId;
  const selfDestructInfo = helpDeskService.getTicketSelfDestructInfo(ticket);
  const lifecycle = helpDeskService.getTicketLifecycleStatus(ticket);
  const hasDiag = checkTicketHasDiagnostics(ticket, messages);

  // Kırılmaz Sahiplik & Devralma Kontrolü (Zero-Trust Ticket Ownership)
  const assignedBlind = (ticket.assigned_admin_blind_id || '').trim().toLowerCase();
  const isPool = !assignedBlind || assignedBlind === 'unassigned';
  const myCleanWhiteId = (ownWhiteId || '').trim().toLowerCase();
  const myHashedBlindId = (myCleanWhiteId && typeof WhiteDeskCrypto?.generateBlindId === 'function')
    ? (myCleanWhiteId.startsWith('blind_') ? myCleanWhiteId : WhiteDeskCrypto.generateBlindId(myCleanWhiteId)).trim().toLowerCase()
    : myCleanWhiteId;
  const isMyTicket = Boolean(
    !isPool && (
      (myHashedBlindId && assignedBlind && myHashedBlindId === assignedBlind) ||
      (myCleanWhiteId && assignedBlind && myCleanWhiteId === assignedBlind)
    )
  );
  const canClaim = (isAdmin || isMasterAdmin || isFounder || adminRole === 'founder' || adminRole === 'global_admin') && !isMyTicket;

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
          {/* 1. Sistem Tanısı Aksiyonları - Yalnızca bilet sahibi admine ait biletlerde */}
          {isMyTicket && (hasDiag ? (
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
                    {t('helpdesk.ticket_action.inspect_diagnostic')}
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
                    {t('helpdesk.ticket_action.delete_diagnostic')}
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
                  {t('helpdesk.ticket_action.add_diagnostic')}
                </Text>
              </TouchableOpacity>
            )
          ))}

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
                {t('helpdesk.ticket_action.rate_support')}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3.0 Bileti Devral (Take Over / Claim) - Kendisine ait olmayan biletlerde görünür (Normal menü renginde) */}
          {!isMyTicket && canClaim && onTakeOverTicket && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onTakeOverTicket(ticket);
              }}
              activeOpacity={0.65}
            >
              <Database size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
              <Text style={styles.menuText}>
                {t('helpdesk.ticket_action.take_over')}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3.1 Birim / Uygulama Düzenle */}
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
                {t('helpdesk.ticket_action.change_unit')}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3.2 Bileti Devret - KESİNLİKLE YALNIZCA BİLETİN GERÇEK SAHİBİ DEVREDEBİLİR */}
          {isMyTicket && (isAdmin || getRank(adminRole) >= 1) && ticket.transfer_status !== 'pending' && onStartTransfer && (
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
                {t('helpdesk.ticket_action.hand_over')}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3.3 Devri İptal Et */}
          {isMyTicket && (isAdmin || getRank(adminRole) >= 1) && ticket.transfer_status === 'pending' && onCancelTransfer && (
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
                {t('helpdesk.ticket_action.cancel_hand_over')}
              </Text>
            </TouchableOpacity>
          )}

          {/* 4. Dijital Temizlik (Self-Destruct) - KESİNLİKLE YALNIZCA BİLET SAHİBİ BAŞLATABİLİR */}
          {isMyTicket && (Boolean(selfDestructInfo.inDestruction || (ticket.auto_delete_at && Number(ticket.auto_delete_at) > 0)) ? (
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
                  {t('helpdesk.ticket_action.stop_deletion')}
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
                  {t('helpdesk.ticket_action.start_deletion')}
                </Text>
              </TouchableOpacity>
            )
          ))}

          {/* 5. Yönetici Yetkisi Ver - Yalnızca bilet sahibi admine ait biletlerde */}
          {isMyTicket && getRank(adminRole) >= 1 && targetActionRole === 'none' && isNotMe && (
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
                {t('helpdesk.ticket_action.grant_admin')}
              </Text>
            </TouchableOpacity>
          )}

          {/* 6. Kiracı Global Yöneticisi Ata */}
          {isMyTicket && (isFounder || (adminRole === 'global_admin' && targetActionRole === 'admin')) && targetActionRole !== 'founder' && targetActionRole !== 'global_admin' && isNotMe && (
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
                {t('helpdesk.ticket_action.assign_global_admin')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Divider Before Danger Actions */}
          {isMyTicket && <View style={styles.divider} />}

          {/* 7. Yöneticilik Yetkisini İptal Et */}
          {isMyTicket && isNotMe && targetActionRole !== 'none' && getRank(adminRole) > getRank(targetActionRole) && (
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
                {t('helpdesk.ticket_action.revoke_admin')}
              </Text>
            </TouchableOpacity>
          )}

          {/* 8. Kullanıcıyı Engelle */}
          {isMyTicket && isNotMe && (targetActionRole === 'none' || getRank(adminRole) > getRank(targetActionRole)) && (
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
                {t('helpdesk.ticket_action.block_user')}
              </Text>
            </TouchableOpacity>
          )}

          {/* 9. Bileti Sil */}
          {isMyTicket && (isAdmin || !isNotMe) && (
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
                {t('helpdesk.ticket_action.delete_ticket')}
              </Text>
            </TouchableOpacity>
          )}

          {/* 10. Bileti ve Kullanıcıyı Sil (Master Admin) */}
          {isMyTicket && isMasterAdmin && isNotMe && (targetActionRole === 'none' || getRank(adminRole) > getRank(targetActionRole)) && (
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
                {t('helpdesk.ticket_action.delete_user_and_ticket')}
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
