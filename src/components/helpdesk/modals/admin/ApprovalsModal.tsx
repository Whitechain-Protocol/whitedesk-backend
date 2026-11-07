import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { UserCheck, X } from 'lucide-react-native';
import { ApprovalEntry } from '../../../../services/helpDeskService';

interface ApprovalsModalProps {
  visible: boolean;
  onClose: () => void;
  pendingApprovals: ApprovalEntry[];
  language: string;
  getLabel: (key: string, tr: string, en: string) => string;
  formatWhiteId: (id: string) => string;
  formatAppId: (id?: string) => string;
  onReviewApproval: (id: number, decision: 'approved' | 'rejected') => void;
  onApproveWithConfirm: (appr: ApprovalEntry) => void;
}

export const ApprovalsModal: React.FC<ApprovalsModalProps> = ({
  visible,
  onClose,
  pendingApprovals,
  language,
  getLabel,
  formatWhiteId,
  formatAppId,
  onReviewApproval,
  onApproveWithConfirm,
}) => {
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
        <View style={[styles.attachModalContainer, { maxWidth: 460, maxHeight: '80%' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <UserCheck size={18} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.attachModalTitle}>
                {language === 'tr' ? 'Bekleyen Yetki Onayları' : 'Pending Approvals'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {pendingApprovals.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#94A3B8', paddingVertical: 20, fontSize: 13 }}>
                {language === 'tr' ? 'Bekleyen onay talebi bulunmuyor.' : 'No pending approval requests.'}
              </Text>
            ) : (
              pendingApprovals.map((appr) => {
                const isDeleteReq = appr.type === 'delete_app' || appr.type === 'delete_org';
                const roleTitle = appr.type === 'global_admin'
                  ? 'WhiteCosmos (Global Admin *)'
                  : appr.type === 'admin'
                  ? (language === 'tr' ? 'Yönetici (Admin)' : 'Admin')
                  : appr.type === 'delete_app'
                  ? (language === 'tr' ? 'Uygulama Silme Talebi' : 'App Deletion Request')
                  : appr.type === 'delete_org'
                  ? (language === 'tr' ? 'Organizasyon Silme Talebi' : 'Org Deletion Request')
                  : (language === 'tr' ? 'Bölüm Kullanıcısı' : 'Divisional User Binding');

                const candidateId = appr.candidate_white_id || appr.candidate_blind_id;
                const tenantDisplay = appr.tenant_name || appr.tenant_blind_id;

                return (
                  <View key={appr.id} style={styles.approvalItemCard}>
                    <View style={styles.approvalItemHeader}>
                      <View style={[styles.approvalTypeBadge, isDeleteReq && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                        <Text style={[styles.approvalTypeBadgeText, isDeleteReq && { color: '#DC2626' }]}>{roleTitle}</Text>
                      </View>
                      <Text style={styles.approvalDateText}>
                        {new Date(appr.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {isDeleteReq ? (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={[styles.approvalCandidateText, { fontWeight: '700', color: '#DC2626' }]}>
                          {appr.type === 'delete_app' 
                            ? `${language === 'tr' ? 'Silinecek Uygulama' : 'Target App'}: ${formatAppId(appr.target_app_id || '')}`
                            : `${language === 'tr' ? 'Silinecek Organizasyon' : 'Target Org'}: ${appr.target_org_id || ''}`
                          }
                        </Text>
                        <Text style={[styles.approvalEnterpriseText, { color: '#64748B' }]}>
                          {language === 'tr' ? 'Talep Eden Admin:' : 'Requester Admin:'} {appr.candidate_alias || formatWhiteId(candidateId)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.approvalCandidateText}>
                        ID: {formatWhiteId(candidateId)}
                      </Text>
                    )}
                    {tenantDisplay && (
                      <Text style={styles.approvalEnterpriseText}>
                        {language === 'tr' ? 'Kiracı/Şirket:' : 'Tenant/Enterprise:'} {tenantDisplay}
                      </Text>
                    )}
                    <View style={styles.approvalActionsRow}>
                      <TouchableOpacity
                        style={styles.approvalRejectBtn}
                        onPress={() => onReviewApproval(appr.id, 'rejected')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.approvalRejectText}>
                          {language === 'tr' ? 'Reddet' : 'Reject'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.approvalAcceptBtn}
                        onPress={() => onApproveWithConfirm(appr)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.approvalAcceptText}>
                          {language === 'tr' ? 'Onayla' : 'Approve'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.attachCancelBtn, { marginTop: 12 }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.attachCancelText}>
              {getLabel('common.close', 'Kapat', 'Close')}
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
  approvalItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  approvalItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  approvalTypeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  approvalTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  approvalDateText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  approvalCandidateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  approvalEnterpriseText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  approvalActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  approvalRejectBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  approvalRejectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  approvalAcceptBtn: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  approvalAcceptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
