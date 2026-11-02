import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  X,
  Crown,
  Users,
  User,
  Building2,
  Layers,
  Grid,
  Check,
  Copy,
  Share2,
  ShieldCheck,
} from 'lucide-react-native';
import { helpDeskService } from '../services/helpDeskService';
import QRCode from 'react-native-qrcode-svg';

export type ProvisionRoleType = 'global_admin' | 'admin' | 'user';

export interface ProvisioningHashModalProps {
  visible: boolean;
  onClose: () => void;
  isFounder: boolean;
  enterpriseBlindId: string;
  enterpriseName: string;
  ownWhiteId?: string;
  currentAdminAlias?: string;
  tenants?: Array<{ enterprise_blind_id: string; name: string }>;
  orgs?: Array<{ org_id: string; name: string }>;
  apps?: Array<{ app_id: string; name: string; org_id?: string }>;
  onHashCreated?: (role: ProvisionRoleType, hash: string) => void;
}

export function ProvisioningHashModal({
  visible,
  onClose,
  isFounder,
  enterpriseBlindId,
  enterpriseName,
  ownWhiteId = '',
  currentAdminAlias = 'Siz (Yönetici)',
  tenants = [],
  orgs = [],
  apps = [],
  onHashCreated,
}: ProvisioningHashModalProps) {
  const [selectedRole, setSelectedRole] = useState<ProvisionRoleType>('admin');
  const [selectedTenantBlindId, setSelectedTenantBlindId] = useState<string>(enterpriseBlindId);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('default');
  const [selectedAppId, setSelectedAppId] = useState<string>('inwhite');

  const [availableTenants, setAvailableTenants] = useState<Array<{ enterprise_blind_id: string; name: string }>>(tenants);
  const [availableOrgs, setAvailableOrgs] = useState<Array<{ org_id: string; name: string }>>(orgs);
  const [availableApps, setAvailableApps] = useState<Array<{ app_id: string; name: string }>>(apps);

  const [generatedHash, setGeneratedHash] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Sync inputs on open
  useEffect(() => {
    if (visible) {
      setSelectedRole('admin');
      setSelectedTenantBlindId(enterpriseBlindId);
      setSelectedOrgId('default');
      setSelectedAppId('inwhite');
      setGeneratedHash('');
      setCopied(false);

      void loadContextData();
    }
  }, [visible, enterpriseBlindId]);

  const loadContextData = async () => {
    try {
      if (isFounder && (!tenants || tenants.length === 0)) {
        const fetchedTenants = await helpDeskService.getAllTenants();
        if (fetchedTenants && fetchedTenants.length > 0) {
          setAvailableTenants(fetchedTenants.map((t: any) => ({
            enterprise_blind_id: t.enterprise_blind_id,
            name: t.name,
          })));
        }
      } else if (tenants && tenants.length > 0) {
        setAvailableTenants(tenants);
      }

      if (orgs && orgs.length > 0) {
        setAvailableOrgs(orgs);
      } else if (enterpriseBlindId) {
        const fetchedOrgs = await helpDeskService.getOrgsList(enterpriseBlindId);
        if (fetchedOrgs) {
          setAvailableOrgs(fetchedOrgs.map((o: any) => ({ org_id: o.org_id, name: o.name })));
        }
      }

      if (apps && apps.length > 0) {
        setAvailableApps(apps);
      } else if (enterpriseBlindId) {
        const fetchedApps = await helpDeskService.getAppCatList(enterpriseBlindId);
        if (fetchedApps) {
          setAvailableApps(fetchedApps.map((a: any) => ({ app_id: a.app_id, name: a.name || a.app_id })));
        }
      }
    } catch (e) {
      console.warn('[ProvisioningHashModal] loadContextData error:', e);
    }
  };

  // Rol veya seçim değiştiğinde hash üret
  useEffect(() => {
    if (!visible) return;
    void handleGenerateHashForRole(selectedRole);
  }, [selectedRole, selectedTenantBlindId, selectedOrgId, selectedAppId, visible]);

  const handleGenerateHashForRole = async (role: ProvisionRoleType) => {
    setLoading(true);
    setCopied(false);
    try {
      const targetTenant = selectedTenantBlindId || enterpriseBlindId || 'default';

      if (role === 'global_admin') {
        const res = await helpDeskService.generateNewGlobalAdminHash(targetTenant);
        if (res.success && res.hash) {
          setGeneratedHash(res.hash);
          if (onHashCreated) onHashCreated('global_admin', res.hash);
        }
      } else if (role === 'admin') {
        const res = await helpDeskService.generateNewAdminHash(
          targetTenant,
          1,
          selectedOrgId === 'default' ? 'default' : selectedOrgId,
          selectedAppId === 'inwhite' ? 'inwhite' : selectedAppId
        );
        if (res.success && res.hash) {
          setGeneratedHash(res.hash);
          if (onHashCreated) onHashCreated('admin', res.hash);
        }
      } else if (role === 'user') {
        const res = await helpDeskService.generateNewUserHash(
          targetTenant,
          25,
          selectedOrgId === 'default' ? 'default' : selectedOrgId,
          selectedAppId === 'inwhite' ? 'inwhite' : selectedAppId
        );
        if (res.success && res.hash) {
          setGeneratedHash(res.hash);
          if (onHashCreated) onHashCreated('user', res.hash);
        }
      }
    } catch (e) {
      console.warn('[ProvisioningHashModal] Hash generation failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const getTargetTenantName = () => {
    const t = availableTenants.find(item => item.enterprise_blind_id === selectedTenantBlindId);
    return t?.name || enterpriseName || 'Kuruluş';
  };

  const handleCopy = async () => {
    if (!generatedHash) return;
    await Clipboard.setStringAsync(generatedHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleShare = async () => {
    if (!generatedHash) return;

    const tenantNameStr = getTargetTenantName();
    let roleLabel = 'Yönetici Yetki Anahtarı';
    let instruction = `Bilet arama kutusuna 'admin ${generatedHash}' yazarak yetkinizi tanımlayabilirsiniz.`;

    if (selectedRole === 'global_admin') {
      roleLabel = 'Küresel Yönetici Yetki Anahtarı';
      instruction = `Bilet arama kutusuna 'admin ${generatedHash}' yazarak Küresel Yönetici yetkisini üstlenebilirsiniz.`;
    } else if (selectedRole === 'user') {
      roleLabel = 'Kullanıcı Erişim Anahtarı';
      instruction = `Bilet kutusuna 'user ${generatedHash}' yazarak kuruluşa dahil olabilirsiniz.`;
    }

    const orgNameStr = selectedOrgId !== 'default'
      ? (availableOrgs.find(o => o.org_id === selectedOrgId)?.name || selectedOrgId)
      : 'Tüm Birimler';

    const appNameStr = selectedAppId !== 'inwhite'
      ? (availableApps.find(a => a.app_id === selectedAppId)?.name || selectedAppId)
      : 'Tüm Uygulamalar';

    const message = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'WHITEDESK YETKİ ANAHTARI',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `Kuruluş      : ${tenantNameStr}`,
      `Yetki Rolü   : ${roleLabel}`,
      selectedRole === 'admin' || selectedRole === 'user' ? `Organizasyon : ${orgNameStr}` : null,
      selectedRole === 'admin' || selectedRole === 'user' ? `Uygulama     : ${appNameStr}` : null,
      `Tarih        : ${new Date().toLocaleString('tr-TR')}`,
      '',
      'LİSANS ANAHTARI (HASH):',
      generatedHash,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'TALİMAT:',
      instruction,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].filter(Boolean).join('\n');

    try {
      await Share.share({
        title: `WhiteDesk Yetki Kodu - ${tenantNameStr}`,
        message,
      });
    } catch (e) {
      console.warn('[ProvisioningHashModal] Share error:', e);
    }
  };

  const { height: windowHeight } = Dimensions.get('window');
  const modalHeight = Math.min(windowHeight * 0.90, 840);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { height: modalHeight }]}>
          {/* Sürükleme Tutamağı */}
          <View style={styles.dragHandleBox}>
            <View style={styles.dragHandle} />
          </View>

          {/* Modal Başlık Çubuğu: Yetki Yönetimi */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titleText}>Yetki Yönetimi</Text>
              <Text style={styles.subtitleText}>
                Masa operatörü, kiracı veya kullanıcı yetki anahtarı üretin
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color="#475569" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60, paddingTop: 10 }}
          >
            {/* 1. KİRACI SEÇİMİ (YALNIZCA THEWHITE FOUNDER İÇİN) */}
            {isFounder && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Building2 size={15} color="#3B82F6" style={{ marginRight: 6 }} />
                  <Text style={styles.sectionLabel}>Kiracı</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  {availableTenants.map(t => {
                    const isSelected = selectedTenantBlindId === t.enterprise_blind_id;
                    return (
                      <TouchableOpacity
                        key={`tenant_opt_${t.enterprise_blind_id}`}
                        style={[styles.chipPill, isSelected && styles.chipPillActive]}
                        onPress={() => setSelectedTenantBlindId(t.enterprise_blind_id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipPillText, isSelected && styles.chipPillTextActive]}>
                          {t.name}
                        </Text>
                        {isSelected && <Check size={13} color="#FFFFFF" style={{ marginLeft: 5 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 2. ROL SEÇENEKLERİ */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <ShieldCheck size={15} color="#3B82F6" style={{ marginRight: 6 }} />
                <Text style={styles.sectionLabel}>Roller</Text>
              </View>
              <View style={styles.roleToggleContainer}>
                {/* Küresel Yönetici (TheWhite / Founder ise) */}
                {isFounder && (
                  <TouchableOpacity
                    style={[styles.roleToggleTab, selectedRole === 'global_admin' && styles.roleToggleTabActive]}
                    onPress={() => setSelectedRole('global_admin')}
                    activeOpacity={0.8}
                  >
                    <Crown size={14} color={selectedRole === 'global_admin' ? '#FFFFFF' : '#D97706'} style={{ marginRight: 5 }} />
                    <Text style={[styles.roleToggleTabText, selectedRole === 'global_admin' && styles.roleToggleTabTextActive]}>
                      Küresel Yönetici
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Yönetici */}
                <TouchableOpacity
                  style={[styles.roleToggleTab, selectedRole === 'admin' && styles.roleToggleTabActive]}
                  onPress={() => setSelectedRole('admin')}
                  activeOpacity={0.8}
                >
                  <Users size={14} color={selectedRole === 'admin' ? '#FFFFFF' : '#16A34A'} style={{ marginRight: 5 }} />
                  <Text style={[styles.roleToggleTabText, selectedRole === 'admin' && styles.roleToggleTabTextActive]}>
                    Yönetici
                  </Text>
                </TouchableOpacity>

                {/* Kullanıcı */}
                <TouchableOpacity
                  style={[styles.roleToggleTab, selectedRole === 'user' && styles.roleToggleTabActive]}
                  onPress={() => setSelectedRole('user')}
                  activeOpacity={0.8}
                >
                  <User size={14} color={selectedRole === 'user' ? '#FFFFFF' : '#7C3AED'} style={{ marginRight: 5 }} />
                  <Text style={[styles.roleToggleTabText, selectedRole === 'user' && styles.roleToggleTabTextActive]}>
                    Kullanıcı
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. ORGANİZASYON & UYGULAMA SEÇİMİ */}
            {(selectedRole === 'admin' || selectedRole === 'user') && (
              <View style={styles.subOptionsCard}>
                {/* Organizasyon */}
                <View style={{ marginBottom: 14 }}>
                  <View style={styles.subOptionHeaderRow}>
                    <Layers size={14} color="#64748B" style={{ marginRight: 6 }} />
                    <Text style={styles.subOptionLabel}>Organizasyon</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    <TouchableOpacity
                      style={[styles.subChipPill, selectedOrgId === 'default' && styles.subChipPillActive]}
                      onPress={() => setSelectedOrgId('default')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.subChipPillText, selectedOrgId === 'default' && styles.subChipPillTextActive]}>
                        Tüm Birimler
                      </Text>
                    </TouchableOpacity>
                    {availableOrgs.map(org => {
                      const isSel = selectedOrgId === org.org_id;
                      return (
                        <TouchableOpacity
                          key={`org_pick_${org.org_id}`}
                          style={[styles.subChipPill, isSel && styles.subChipPillActive]}
                          onPress={() => setSelectedOrgId(org.org_id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.subChipPillText, isSel && styles.subChipPillTextActive]}>
                            {org.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Uygulama */}
                <View>
                  <View style={styles.subOptionHeaderRow}>
                    <Grid size={14} color="#64748B" style={{ marginRight: 6 }} />
                    <Text style={styles.subOptionLabel}>Uygulama</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    <TouchableOpacity
                      style={[styles.subChipPill, selectedAppId === 'inwhite' && styles.subChipPillActive]}
                      onPress={() => setSelectedAppId('inwhite')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.subChipPillText, selectedAppId === 'inwhite' && styles.subChipPillTextActive]}>
                        Tüm Uygulamalar
                      </Text>
                    </TouchableOpacity>
                    {availableApps.map(ap => {
                      const isSel = selectedAppId === ap.app_id;
                      return (
                        <TouchableOpacity
                          key={`app_pick_${ap.app_id}`}
                          style={[styles.subChipPill, isSel && styles.subChipPillActive]}
                          onPress={() => setSelectedAppId(ap.app_id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.subChipPillText, isSel && styles.subChipPillTextActive]}>
                            {ap.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            )}

            {/* 4. ÜRETİLEN YETKİ ANAHTARI */}
            <View style={styles.resultCard}>
              <View style={styles.resultCardHeader}>
                <Text style={styles.resultCardLabel}>Üretilen Yetki Anahtarı</Text>
                {loading && <ActivityIndicator size="small" color="#3B82F6" />}
              </View>

              {/* QR Kod Görünümü */}
              {generatedHash ? (
                <View style={styles.qrContainer}>
                  <View style={styles.qrInnerBox}>
                    <QRCode
                      value={generatedHash}
                      size={140}
                      color="#0F172A"
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                </View>
              ) : null}

              <View style={styles.hashBox}>
                <Text style={styles.hashText} numberOfLines={2} selectable>
                  {generatedHash || (loading ? 'Anahtar türetiliyor...' : 'Anahtar hazır değil')}
                </Text>
              </View>

              {/* Çift Buton Bandı */}
              <View style={styles.actionRow}>
                {/* Kopyala Butonu */}
                <TouchableOpacity
                  style={[styles.copyButton, copied && styles.copyButtonSuccess]}
                  onPress={handleCopy}
                  activeOpacity={0.8}
                  disabled={!generatedHash || loading}
                >
                  {copied ? (
                    <Check size={16} color="#16A34A" strokeWidth={2.4} style={{ marginRight: 6 }} />
                  ) : (
                    <Copy size={16} color="#334155" strokeWidth={2} style={{ marginRight: 6 }} />
                  )}
                  <Text style={[styles.copyButtonText, copied && { color: '#16A34A', fontWeight: '800' }]}>
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </Text>
                </TouchableOpacity>

                {/* Paylaş Butonu */}
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShare}
                  activeOpacity={0.8}
                  disabled={!generatedHash || loading}
                >
                  <Share2 size={16} color="#FFFFFF" strokeWidth={2.3} style={{ marginRight: 7 }} />
                  <Text style={styles.shareButtonText}>Paylaş</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 10,
    overflow: 'hidden',
  },
  dragHandleBox: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
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
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  sectionContainer: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipPillActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  chipPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  chipPillTextActive: {
    color: '#FFFFFF',
  },
  roleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  roleToggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  roleToggleTabActive: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  roleToggleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  roleToggleTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  subOptionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subOptionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subOptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  subChipPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  subChipPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  subChipPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  subChipPillTextActive: {
    color: '#3B82F6',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  resultCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultCardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.4,
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  qrInnerBox: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  hashBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hashText: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  copyButtonSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  shareButton: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 999,
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
