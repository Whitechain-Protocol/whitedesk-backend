import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Building2,
  Layers,
  Grid,
  Check,
} from 'lucide-react-native';
import { HelpDeskTicket, helpDeskService } from '../../../services/helpDeskService';
import { useTranslation } from '../../../services/i18nService';

export interface TicketOrgAssignModalProps {
  visible: boolean;
  onClose: () => void;
  ticket: HelpDeskTicket | null;
  orgs: Array<{ org_id: string; name: string }>;
  apps: Array<{ app_id: string; name: string; org_id?: string }>;
  onSave: (orgId: string, appId: string) => Promise<void>;
}

export function TicketOrgAssignModal({
  visible,
  onClose,
  ticket,
  orgs = [],
  apps = [],
  onSave,
}: TicketOrgAssignModalProps) {
  const { t } = useTranslation();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('default');
  const [selectedAppId, setSelectedAppId] = useState<string>('inwhite');
  const [saving, setSaving] = useState<boolean>(false);
  const [localOrgs, setLocalOrgs] = useState<Array<{ org_id: string; name: string }>>(orgs);
  const [localApps, setLocalApps] = useState<Array<{ app_id: string; name: string; org_id?: string }>>(apps);

  useEffect(() => {
    if (orgs && orgs.length > 0) setLocalOrgs(orgs);
  }, [orgs]);

  useEffect(() => {
    if (apps && apps.length > 0) setLocalApps(apps);
  }, [apps]);

  useEffect(() => {
    if (visible && ticket) {
      setSelectedOrgId(ticket.org_id && ticket.org_id !== 'all' ? ticket.org_id : 'default');
      setSelectedAppId(ticket.app_id || 'inwhite');
      setSaving(false);

      const entId = ticket.enterprise_blind_id || 'default';
      helpDeskService.getOrgsList(entId).then(fetchedOrgs => {
        if (fetchedOrgs && fetchedOrgs.length > 0) {
          setLocalOrgs(fetchedOrgs.map((o: any) => ({ org_id: o.org_id, name: o.name })));
        }
      }).catch(() => {});

      helpDeskService.getAppCatList(entId).then(fetchedApps => {
        if (fetchedApps && fetchedApps.length > 0) {
          setLocalApps(fetchedApps.map((a: any) => ({ app_id: a.app_id, name: a.name || a.app_id, org_id: a.org_id })));
        }
      }).catch(() => {});
    }
  }, [visible, ticket]);

  if (!ticket) return null;

  // Seçilen organizasyon birimine bağlı uygulamaları filtrele
  const effectiveApps = localApps.length > 0 ? localApps : apps;
  const availableAppsForOrg = effectiveApps.filter(
    a => !a.org_id || a.org_id === 'all' || a.org_id === 'default' || a.org_id === selectedOrgId
  );

  const handleOrgChange = (newOrgId: string) => {
    setSelectedOrgId(newOrgId);
    // Org değiştiğinde seçili app o org'da yoksa inwhite'a sıfırla
    const appsInNewOrg = effectiveApps.filter(
      a => !a.org_id || a.org_id === 'all' || a.org_id === 'default' || a.org_id === newOrgId
    );
    if (appsInNewOrg.length === 0) {
      setSelectedAppId('inwhite');
    } else if (!appsInNewOrg.some(a => a.app_id === selectedAppId)) {
      setSelectedAppId(appsInNewOrg[0]?.app_id || 'inwhite');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedOrgId, selectedAppId);
      onClose();
    } catch (e) {
      console.warn('[TicketOrgAssignModal] save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const userDisplayName = t('helpdesk.user');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Standart Tutamak */}
          <View style={styles.dragHandleBox}>
            <View style={styles.dragHandle} />
          </View>

          {/* Başlık Çubuğu */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titleText}>{t('helpdesk.org_assign.title')}</Text>
              <Text style={styles.subtitleText}>{t('helpdesk.org_assign.subtitle')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color="#475569" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Kullanıcı & Bilet Bilgi Kartı */}
            <View style={styles.infoCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Building2 size={16} color="#1B64DA" style={{ marginRight: 8 }} />
                <Text style={styles.infoSubjectText} numberOfLines={1}>
                  {ticket.subject || t('helpdesk.org_assign.default_subject')}
                </Text>
              </View>
              <Text style={styles.infoUserMeta}>
                {t('helpdesk.org_assign.ticket_label')}: <Text style={{ fontWeight: '700', color: '#0F172A' }}>#{ticket.id}</Text> • {t('helpdesk.user')}:{' '}
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>{userDisplayName}</Text>
              </Text>
            </View>

            {/* 1. ORGANİZASYON SATIRI & YATAY KAYDIRILABİLİR LİSTE */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionLabelRow}>
                <Layers size={15} color="#1B64DA" style={{ marginRight: 6 }} />
                <Text style={styles.sectionLabel}>{t('helpdesk.org_assign.section_org')}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {/* Hepsi */}
                <TouchableOpacity
                  style={[styles.chipPill, selectedOrgId === 'default' && styles.chipPillActive]}
                  onPress={() => handleOrgChange('default')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipPillText, selectedOrgId === 'default' && styles.chipPillTextActive]}>
                    {t('helpdesk.org_assign.all')}
                  </Text>
                  {selectedOrgId === 'default' && <Check size={13} color="#FFFFFF" style={{ marginLeft: 5 }} />}
                </TouchableOpacity>

                {/* Kayıtlı Organizasyonlar */}
                {localOrgs.map(org => {
                  const isSel = selectedOrgId === org.org_id;
                  return (
                    <TouchableOpacity
                      key={`org_btn_${org.org_id}`}
                      style={[styles.chipPill, isSel && styles.chipPillActive]}
                      onPress={() => handleOrgChange(org.org_id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipPillText, isSel && styles.chipPillTextActive]}>
                        {org.name}
                      </Text>
                      {isSel && <Check size={13} color="#FFFFFF" style={{ marginLeft: 5 }} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 2. UYGULAMA SATIRI & YATAY KAYDIRILABİLİR LİSTE */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionLabelRow}>
                <Grid size={15} color="#1B64DA" style={{ marginRight: 6 }} />
                <Text style={styles.sectionLabel}>{t('helpdesk.org_assign.section_app')}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {/* Hepsi */}
                <TouchableOpacity
                  style={[styles.chipPill, (selectedAppId === 'inwhite' || selectedAppId === 'all') && styles.chipPillActive]}
                  onPress={() => setSelectedAppId('inwhite')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipPillText, (selectedAppId === 'inwhite' || selectedAppId === 'all') && styles.chipPillTextActive]}>
                    {t('helpdesk.org_assign.all')}
                  </Text>
                  {(selectedAppId === 'inwhite' || selectedAppId === 'all') && <Check size={13} color="#FFFFFF" style={{ marginLeft: 5 }} />}
                </TouchableOpacity>

                {/* Org'a bağlı uygulamalar */}
                {availableAppsForOrg.map(app => {
                  const isSel = selectedAppId === app.app_id;
                  return (
                    <TouchableOpacity
                      key={`app_btn_${app.app_id}`}
                      style={[styles.chipPill, isSel && styles.chipPillActive]}
                      onPress={() => setSelectedAppId(app.app_id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipPillText, isSel && styles.chipPillTextActive]}>
                        {app.name}
                      </Text>
                      {isSel && <Check size={13} color="#FFFFFF" style={{ marginLeft: 5 }} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Alt Aksiyon Butonları */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8} disabled={saving}>
              <Text style={styles.cancelBtnText}>{t('helpdesk.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={17} color="#FFFFFF" strokeWidth={2.4} style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>{t('helpdesk.save')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '75%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  dragHandleBox: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoSubjectText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  infoUserMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  horizontalScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    marginRight: 8,
  },
  chipPillActive: {
    backgroundColor: '#1B64DA',
    borderColor: '#1B64DA',
  },
  chipPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  chipPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#1B64DA',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1B64DA',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
