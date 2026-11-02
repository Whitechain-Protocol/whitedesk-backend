import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { UserCheck, X } from 'lucide-react-native';

export interface PendingApprovalItem {
  id: string;
  type: string;
  candidate_white_id?: string;
  candidate_blind_id?: string;
  candidate_alias?: string;
  tenant_name?: string;
  tenant_blind_id?: string;
  target_app_id?: string;
  target_org_id?: string;
  requested_at: string;
  [key: string]: any;
}

export interface ApprovalsModalProps {
  visible: boolean;
  onClose: () => void;
  pendingApprovals: PendingApprovalItem[];
  language?: string;
  formatAppId?: (id: string) => string;
  formatWhiteId?: (id?: string) => string;
  getLabel: (key: string, tr: string, en: string) => string;
  onReviewApproval: (id: string, action: 'approved' | 'rejected') => Promise<void>;
  onRequestConfirm: (config: {
    visible: boolean;
    title: string;
    description: string;
    actionText: string;
    actionColor: string;
    cancelText?: string;
    onCancel: () => void;
    onAction: () => Promise<void> | void;
  }) => void;
}

export const ApprovalsModal: React.FC<ApprovalsModalProps> = ({
  visible,
  onClose,
  pendingApprovals,
  language = 'tr',
  formatAppId = (id: string) => id,
  formatWhiteId = (id?: string) => (id ? `${id.slice(0, 8)}...` : ''),
  getLabel,
  onReviewApproval,
  onRequestConfirm,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <UserCheck size={18} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.title}>
                {language === 'tr' ? 'Bekleyen Yetki Onayları' : 'Pending Approvals'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {pendingApprovals.length === 0 ? (
              <Text style={styles.emptyText}>
                {language === 'tr' ? 'Bekleyen onay talebi bulunmuyor.' : 'No pending approval requests.'}
              </Text>
            ) : (
              pendingApprovals.map((appr) => {
                const isDeleteReq = appr.type === 'delete_app' || appr.type === 'delete_org';
                const roleTitle =
                  appr.type === 'global_admin'
                    ? 'WhiteCosmos (Global Admin *)'
                    : appr.type === 'admin'
                    ? language === 'tr'
                      ? 'Yönetici (Admin)'
                      : 'Admin'
                    : appr.type === 'delete_app'
                    ? language === 'tr'
                      ? 'Uygulama Silme Talebi'
                      : 'App Deletion Request'
                    : appr.type === 'delete_org'
                    ? language === 'tr'
                      ? 'Organizasyon Silme Talebi'
                      : 'Org Deletion Request'
                    : language === 'tr'
                    ? 'Bölüm Kullanıcısı'
                    : 'Divisional User Binding';

                const candidateId = appr.candidate_white_id || appr.candidate_blind_id;
                const tenantDisplay = appr.tenant_name || appr.tenant_blind_id;

                const handleApproveWithConfirm = () => {
                  if (isDeleteReq) {
                    const targetName =
                      appr.type === 'delete_app'
                        ? formatAppId(appr.target_app_id || '')
                        : appr.target_org_id || '';
                    onRequestConfirm({
                      visible: true,
                      title: getLabel(
                        'helpdesk.confirmDeleteApprovalTitle',
                        'Silme İşlemini Onayla',
                        'Confirm Deletion'
                      ),
                      description: `"${targetName}" ${getLabel(
                        'helpdesk.confirmDeleteApprovalDesc',
                        'öğesini sistemden kalıcı olarak silmeyi onaylıyor musunuz?',
                        'will be permanently removed. Do you confirm?'
                      )}`,
                      actionText: getLabel('common.delete', 'Sil', 'Delete'),
                      actionColor: '#EF4444',
                      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
                      onCancel: () => {},
                      onAction: async () => {
                        await onReviewApproval(appr.id, 'approved');
                      },
                    });
                  } else {
                    onReviewApproval(appr.id, 'approved');
                  }
                };

                return (
                  <View key={appr.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.typeBadge,
                          isDeleteReq && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeBadgeText,
                            isDeleteReq && { color: '#DC2626' },
                          ]}
                        >
                          {roleTitle}
                        </Text>
                      </View>
                      <Text style={styles.dateText}>
                        {new Date(appr.requested_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    {isDeleteReq ? (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={[styles.candidateText, { fontWeight: '700', color: '#DC2626' }]}>
                          {appr.type === 'delete_app'
                            ? `${language === 'tr' ? 'Silinecek Uygulama' : 'Target App'}: ${formatAppId(
                                appr.target_app_id || ''
                              )}`
                            : `${language === 'tr' ? 'Silinecek Organizasyon' : 'Target Org'}: ${
                                appr.target_org_id || ''
                              }`}
                        </Text>
                        <Text style={[styles.enterpriseText, { color: '#64748B' }]}>
                          {language === 'tr' ? 'Talep Eden Admin:' : 'Requester Admin:'}{' '}
                          {appr.candidate_alias || formatWhiteId(candidateId)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.candidateText}>
                        ID: {formatWhiteId(candidateId)}
                      </Text>
                    )}

                    {tenantDisplay && (
                      <Text style={styles.enterpriseText}>
                        {language === 'tr' ? 'Kiracı/Şirket:' : 'Tenant/Enterprise:'} {tenantDisplay}
                      </Text>
                    )}

                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => onReviewApproval(appr.id, 'rejected')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.rejectText}>
                          {language === 'tr' ? 'Reddet' : 'Reject'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={handleApproveWithConfirm}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.acceptText}>
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
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeBtnText}>
              {getLabel('common.close', 'Kapat', 'Close')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    paddingVertical: 20,
    fontSize: 13,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  candidateText: {
    fontSize: 12,
    color: '#1E293B',
    marginBottom: 2,
  },
  enterpriseText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  rejectText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
  },
  acceptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    marginTop: 12,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
});
