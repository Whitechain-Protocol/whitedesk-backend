import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import {
  X,
  Building2,
  LayoutGrid,
  Tag,
  Plus,
  Check,
  ShieldCheck,
  Layers,
  Users,
  Crown,
} from 'lucide-react-native';
import { ProvisioningHashModal } from '../../ProvisioningHashModal';

export interface AdminItem {
  white_id: string;
  alias?: string;
  role?: string;
  org_id?: string;
  enterprise_blind_id?: string;
}

export interface OrgItem {
  org_id: string;
  name?: string;
  enterprise_blind_id?: string;
}

export interface AppItem {
  app_id: string;
  name?: string;
  enterprise_blind_id?: string;
}

export interface CategoryItem {
  id: string;
  key?: string;
  labelTr?: string;
  labelEn?: string;
  org_id?: string;
  app_id?: string;
  enterprise_blind_id?: string;
}

export interface TenantItem {
  enterprise_blind_id: string;
  name?: string;
}

export interface ProvisioningStationModalProps {
  visible: boolean;
  onClose: () => void;
  adminModalHeight: number;
  currentEnterpriseName: string;
  activeEnterpriseBlindId: string | null;
  isFounder?: boolean;
  tenantsList?: TenantItem[];
  selectedTenantBlindId?: string;
  onSelectTenant?: (blindId: string) => void;
  adminsList?: AdminItem[];
  ownWhiteId?: string | null;
  formatWhiteId?: (id: string) => string;
  onGenerateOperatorInviteHash?: () => void;
  onRemoveAdmin?: (whiteId: string) => void;
  orgsList: OrgItem[];
  onRemoveOrg: (orgId: string) => void;
  newOrgInput: string;
  onChangeNewOrgInput: (text: string) => void;
  onCreateOrg: (customName?: string, targetTenantBlindId?: string) => void;
  appsList: AppItem[];
  onRemoveApp: (appId: string) => void;
  newAppInput: string;
  onChangeNewAppInput: (text: string) => void;
  onCreateApp: () => void;
  availableCategories: CategoryItem[];
  onDeleteCategory: (catId: string) => void;
  newCatNameInput: string;
  onChangeNewCatNameInput: (text: string) => void;
  onCreateCategory: (params?: { name?: string; targetTenantBlindId?: string; targetOrgId?: string; targetAppId?: string }) => void;
  onOpenSdkIntegration?: () => void;
}

export const ProvisioningStationModal: React.FC<ProvisioningStationModalProps> = ({
  visible,
  onClose,
  adminModalHeight,
  currentEnterpriseName,
  activeEnterpriseBlindId,
  isFounder = false,
  tenantsList = [],
  selectedTenantBlindId,
  onSelectTenant,
  adminsList = [],
  ownWhiteId,
  formatWhiteId = (id: string) => id,
  onRemoveAdmin,
  orgsList,
  onRemoveOrg,
  newOrgInput,
  onChangeNewOrgInput,
  onCreateOrg,
  appsList,
  onRemoveApp,
  availableCategories,
  onDeleteCategory,
  newCatNameInput,
  onChangeNewCatNameInput,
  onCreateCategory,
  onOpenSdkIntegration,
}) => {
  // Hash & QR Yetki Yönetimi Modalı
  const [hashModalVisible, setHashModalVisible] = useState<boolean>(false);

  // Zengin Giriş Modalları (Organizasyon ve Kategori)
  const [addOrgModalOpen, setAddOrgModalOpen] = useState<boolean>(false);
  const [addCatModalOpen, setAddCatModalOpen] = useState<boolean>(false);

  // Silme Onay Kartı Durumu
  const [deleteConfirm, setDeleteConfirm] = useState<{
    visible: boolean;
    type: 'admin' | 'org' | 'app' | 'category';
    id: string;
    name: string;
  } | null>(null);

  // Aktif kiracı adı: TheWhite olsa bile TheWhite Enterprises yazmaz; seçilen veya çalışılan tenant adını gösterir
  const activeTenantObj = tenantsList.find(
    (t) =>
      (selectedTenantBlindId && t.enterprise_blind_id === selectedTenantBlindId) ||
      (!selectedTenantBlindId && t.enterprise_blind_id === activeEnterpriseBlindId)
  );

  const displayTenantName = activeTenantObj?.name
    ? activeTenantObj.name
    : currentEnterpriseName && !currentEnterpriseName.toLowerCase().includes('thewhite')
    ? currentEnterpriseName
    : 'Whitechain';

  const defaultTenantId =
    selectedTenantBlindId ||
    activeEnterpriseBlindId ||
    (tenantsList.length > 0 ? tenantsList[0].enterprise_blind_id : 'default');

  // Provizyon Masası içi seçili birim filtresi ('all' = tümü)
  const [selectedStationOrg, setSelectedStationOrg] = useState<string>('all');

  // Organizasyon Modalı Seçimleri
  const [selectedOrgTenant, setSelectedOrgTenant] = useState<string>(defaultTenantId);

  // Kategori Modalı Seçimleri (Firma, Organizasyon, Uygulama bağlama)
  const [selectedCatTenant, setSelectedCatTenant] = useState<string>(defaultTenantId);
  const [selectedCatOrg, setSelectedCatOrg] = useState<string>(''); // Boş ise "Tüm Birimler"
  const [selectedCatApp, setSelectedCatApp] = useState<string>(''); // Boş ise "Tüm Uygulamalar"

  useEffect(() => {
    const curTenant = selectedTenantBlindId || activeEnterpriseBlindId;
    if (curTenant) {
      setSelectedOrgTenant(curTenant);
      setSelectedCatTenant(curTenant);
    }
    setSelectedStationOrg('all');
  }, [selectedTenantBlindId, activeEnterpriseBlindId]);

  // Hiyerarşik Filtreler:
  // 1. Yöneticiler: Yalnızca mevcut kiracıya ait olanlar + Küresel Yönetici/Founder
  const filteredAdmins = adminsList.filter((adm) => {
    if (!defaultTenantId || defaultTenantId === 'all') return true;
    if (adm.role === 'founder' || adm.role === 'global_admin') return true;
    if (adm.enterprise_blind_id && adm.enterprise_blind_id !== defaultTenantId) return false;
    return true;
  });

  // 2. Organizasyonlar: Yalnızca mevcut kiracıya bağlı birimler
  const filteredOrgs = orgsList.filter((org) => {
    if (!defaultTenantId || defaultTenantId === 'all') return true;
    if (org.org_id === 'default' || org.org_id === '*' || org.org_id === 'thewhite') return true;
    if (org.enterprise_blind_id && org.enterprise_blind_id !== defaultTenantId) return false;
    return true;
  });

  // 3. Kategoriler: Katı Hiyerarşi!
  // - Kategori başka bir kiracıya aitse ASLA görünmez.
  // - Seçili bir organizasyon varsa, yalnızca o organizasyona bağlı olanlar (veya genel 'all' olanlar) görünür.
  const filteredCategories = availableCategories.filter((cat) => {
    if (
      defaultTenantId &&
      defaultTenantId !== 'all' &&
      cat.enterprise_blind_id &&
      cat.enterprise_blind_id !== 'all' &&
      cat.enterprise_blind_id !== defaultTenantId
    ) {
      return false;
    }
    if (selectedStationOrg !== 'all') {
      if (
        cat.org_id &&
        cat.org_id !== 'all' &&
        cat.org_id !== 'default' &&
        cat.org_id !== '*' &&
        cat.org_id !== selectedStationOrg
      ) {
        return false;
      }
    }
    return true;
  });

  // Seçili aktif yönetici pili
  const defaultSelectedAdmin = filteredAdmins.find(
    (a) => a.role === 'global_admin' || (ownWhiteId && a.white_id.toLowerCase() === ownWhiteId.toLowerCase())
  )?.white_id || (filteredAdmins.length > 0 ? filteredAdmins[0].white_id : '');

  const [selectedAdminId, setSelectedAdminId] = useState<string>(defaultSelectedAdmin);

  // Adminler: 10 taneye kadar tek satırda yatay kaydırılır; 10'dan fazla ise flexWrap ile 2.-3. satırlara geçer
  const isMoreThanTenAdmins = filteredAdmins.length > 10;

  const handleConfirmAddOrg = () => {
    if (newOrgInput.trim()) {
      onCreateOrg(newOrgInput.trim(), selectedOrgTenant);
      setAddOrgModalOpen(false);
    }
  };

  const handleConfirmAddCat = () => {
    if (newCatNameInput.trim()) {
      onCreateCategory({
        name: newCatNameInput.trim(),
        targetTenantBlindId: selectedCatTenant,
        targetOrgId: selectedCatOrg || undefined,
        targetAppId: selectedCatApp || undefined,
      });
      setAddCatModalOpen(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={onClose}
      >
        <View style={styles.fullScreenOverlay}>
          <View style={[styles.cardContainer, { height: adminModalHeight }]}>
            {/* Header: Provizyon Masası + [Mevcut Çalışılan Tenantın Adı] */}
            <View style={styles.consoleHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={[styles.consoleIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <ShieldCheck size={20} color="#3B82F6" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.consoleTitleText}>Provizyon Masası</Text>
                  <Text style={styles.consoleSubtitleText} numberOfLines={1}>
                    {displayTenantName}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.consoleCloseBtn}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1, width: '100%' }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 60, paddingTop: 10 }}
            >
              {/* 1. YATAY TENANT LİSTESİ (YALNIZCA THEWHITE EKRANINDA) */}
              {isFounder && tenantsList && tenantsList.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionTitleRow}>
                    <Building2 size={16} color="#3B82F6" strokeWidth={2.2} style={{ marginRight: 6 }} />
                    <Text style={styles.sectionTitleText}>
                      Kuruluşlar ({tenantsList.length})
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScrollContent}
                  >
                    {tenantsList.map((tenant) => {
                      const isSelected =
                        (selectedTenantBlindId && selectedTenantBlindId === tenant.enterprise_blind_id) ||
                        (!selectedTenantBlindId && activeEnterpriseBlindId === tenant.enterprise_blind_id);
                      return (
                        <TouchableOpacity
                          key={tenant.enterprise_blind_id}
                          style={[styles.chipItem, isSelected && styles.chipItemActive]}
                          onPress={() => onSelectTenant && onSelectTenant(tenant.enterprise_blind_id)}
                          activeOpacity={0.75}
                        >
                          <Building2 size={13} color={isSelected ? '#FFFFFF' : '#3B82F6'} style={{ marginRight: 5 }} />
                          <Text
                            style={[styles.chipItemText, isSelected && styles.chipItemTextActive]}
                            numberOfLines={1}
                          >
                            {tenant.name || tenant.enterprise_blind_id}
                          </Text>
                          {isSelected && (
                            <Check size={13} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 5 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 2. YÖNETİCİLER */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <Users size={16} color="#3B82F6" strokeWidth={2.2} style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitleText}>
                    Yöneticiler ({filteredAdmins.length})
                  </Text>
                </View>

                {/* 10 taneye kadar yatay kaydırılır; 10'dan fazla ise çok satıra sarılır */}
                {!isMoreThanTenAdmins ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScrollContent}
                  >
                    {filteredAdmins.map((adm) => {
                      const isSelected = (selectedAdminId || defaultSelectedAdmin) === adm.white_id;
                      const isGlobal = adm.role === 'global_admin';
                      const isFounderRole = adm.role === 'founder' || adm.role === 'master';
                      const canDelete = onRemoveAdmin && !isGlobal && !isFounderRole && (!ownWhiteId || adm.white_id.toLowerCase() !== ownWhiteId.toLowerCase());
                      return (
                        <TouchableOpacity
                          key={`admin_pill_${adm.white_id}`}
                          style={[styles.chipItem, isSelected && styles.chipItemActive]}
                          onPress={() => setSelectedAdminId(adm.white_id)}
                          activeOpacity={0.75}
                        >
                          {isGlobal ? (
                            <ShieldCheck size={13} color={isSelected ? '#FFFFFF' : '#3B82F6'} style={{ marginRight: 5 }} />
                          ) : isFounderRole ? (
                            <Crown size={13} color={isSelected ? '#FFFFFF' : '#D97706'} style={{ marginRight: 5 }} />
                          ) : (
                            <Users size={13} color={isSelected ? '#FFFFFF' : '#16A34A'} style={{ marginRight: 5 }} />
                          )}
                          <Text
                            style={[styles.chipItemText, isSelected && styles.chipItemTextActive]}
                            numberOfLines={1}
                          >
                            {adm.alias ? adm.alias : formatWhiteId(adm.white_id)}
                          </Text>
                          {isSelected && !canDelete && (
                            <Check size={13} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 5 }} />
                          )}
                          {canDelete && (
                            <TouchableOpacity
                              onPress={() => setDeleteConfirm({
                                visible: true,
                                type: 'admin',
                                id: adm.white_id,
                                name: adm.alias || formatWhiteId(adm.white_id),
                              })}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              style={styles.chipDeleteBtn}
                            >
                              <X size={12} color={isSelected ? '#FFFFFF' : '#EF4444'} strokeWidth={2.5} />
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                      );
                    })}

                    {/* Son yöneticinin sağında yuvarlak + butonu (Yetki Yönetimi Modalı Açar) */}
                    <TouchableOpacity
                      style={styles.roundAddButton}
                      onPress={() => setHashModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Plus size={16} color="#FFFFFF" strokeWidth={2.8} />
                    </TouchableOpacity>
                  </ScrollView>
                ) : (
                  <View style={styles.wrapGridContainer}>
                    {filteredAdmins.map((adm) => {
                      const isSelected = (selectedAdminId || defaultSelectedAdmin) === adm.white_id;
                      const isGlobal = adm.role === 'global_admin';
                      const isFounderRole = adm.role === 'founder' || adm.role === 'master';
                      const canDelete = onRemoveAdmin && !isGlobal && !isFounderRole && (!ownWhiteId || adm.white_id.toLowerCase() !== ownWhiteId.toLowerCase());
                      return (
                        <TouchableOpacity
                          key={`admin_pill_${adm.white_id}`}
                          style={[styles.chipItem, isSelected && styles.chipItemActive]}
                          onPress={() => setSelectedAdminId(adm.white_id)}
                          activeOpacity={0.75}
                        >
                          {isGlobal ? (
                            <ShieldCheck size={13} color={isSelected ? '#FFFFFF' : '#3B82F6'} style={{ marginRight: 5 }} />
                          ) : isFounderRole ? (
                            <Crown size={13} color={isSelected ? '#FFFFFF' : '#D97706'} style={{ marginRight: 5 }} />
                          ) : (
                            <Users size={13} color={isSelected ? '#FFFFFF' : '#16A34A'} style={{ marginRight: 5 }} />
                          )}
                          <Text
                            style={[styles.chipItemText, isSelected && styles.chipItemTextActive]}
                            numberOfLines={1}
                          >
                            {adm.alias ? adm.alias : formatWhiteId(adm.white_id)}
                          </Text>
                          {isSelected && !canDelete && (
                            <Check size={13} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 5 }} />
                          )}
                          {canDelete && (
                            <TouchableOpacity
                              onPress={() => setDeleteConfirm({
                                visible: true,
                                type: 'admin',
                                id: adm.white_id,
                                name: adm.alias || formatWhiteId(adm.white_id),
                              })}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              style={styles.chipDeleteBtn}
                            >
                              <X size={12} color={isSelected ? '#FFFFFF' : '#EF4444'} strokeWidth={2.5} />
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={styles.roundAddButton}
                      onPress={() => setHashModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Plus size={16} color="#FFFFFF" strokeWidth={2.8} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* 3. ORGANİZASYONLAR */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <Layers size={16} color="#3B82F6" strokeWidth={2.2} style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitleText}>
                    Organizasyonlar ({filteredOrgs.length})
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                >
                  {/* Tümü Filtresi */}
                  <TouchableOpacity
                    style={[styles.chipItem, selectedStationOrg === 'all' && styles.chipItemActive]}
                    onPress={() => setSelectedStationOrg('all')}
                    activeOpacity={0.75}
                  >
                    <Layers size={12} color={selectedStationOrg === 'all' ? '#FFFFFF' : '#3B82F6'} style={{ marginRight: 5 }} />
                    <Text style={[styles.chipItemText, selectedStationOrg === 'all' && styles.chipItemTextActive]}>
                      Tümü
                    </Text>
                    {selectedStationOrg === 'all' && (
                      <Check size={13} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 5 }} />
                    )}
                  </TouchableOpacity>

                  {filteredOrgs.map((org) => {
                    const isSelected = selectedStationOrg === org.org_id;
                    const isProtected = org.org_id === 'default' || org.org_id === 'thewhite' || org.org_id === '*';
                    return (
                      <TouchableOpacity
                        key={`org_${org.org_id}`}
                        style={[styles.chipItem, isSelected && styles.chipItemActive]}
                        onPress={() => setSelectedStationOrg(isSelected ? 'all' : org.org_id)}
                        activeOpacity={0.75}
                      >
                        <Layers size={12} color={isSelected ? '#FFFFFF' : '#3B82F6'} style={{ marginRight: 5 }} />
                        <Text style={[styles.chipItemText, isSelected && styles.chipItemTextActive]}>
                          {org.name || org.org_id}
                        </Text>
                        {isSelected && (
                          <Check size={13} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 5 }} />
                        )}
                        {!isProtected && (
                          <TouchableOpacity
                            onPress={() => setDeleteConfirm({
                              visible: true,
                              type: 'org',
                              id: org.org_id,
                              name: org.name || org.org_id,
                            })}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={styles.chipDeleteBtn}
                          >
                            <X size={12} color={isSelected ? '#FFFFFF' : '#EF4444'} strokeWidth={2.5} />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* En sonuncunun sağında yuvarlak + butonu */}
                  <TouchableOpacity
                    style={styles.roundAddButton}
                    onPress={() => setAddOrgModalOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Plus size={16} color="#FFFFFF" strokeWidth={2.8} />
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* 4. UYGULAMALAR */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <LayoutGrid size={16} color="#3B82F6" strokeWidth={2.2} style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitleText}>
                    Uygulamalar ({appsList.length})
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                >
                  {appsList.map((app) => {
                    const isProtected = app.app_id === 'inwhite';
                    return (
                      <View key={`app_${app.app_id}`} style={styles.chipItem}>
                        <LayoutGrid size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                        <Text style={styles.chipItemText}>{app.name || app.app_id}</Text>
                        {!isProtected && (
                          <TouchableOpacity
                            onPress={() => setDeleteConfirm({
                              visible: true,
                              type: 'app',
                              id: app.app_id,
                              name: app.name || app.app_id,
                            })}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={styles.chipDeleteBtn}
                          >
                            <X size={12} color="#EF4444" strokeWidth={2.5} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                  {/* En sonuncunun sağında yuvarlak + butonu */}
                  {onOpenSdkIntegration && (
                    <TouchableOpacity
                      style={styles.roundAddButton}
                      onPress={onOpenSdkIntegration}
                      activeOpacity={0.8}
                    >
                      <Plus size={16} color="#FFFFFF" strokeWidth={2.8} />
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>

              {/* 5. KATEGORİLER (Katı Hiyerarşi) */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <Tag size={16} color="#3B82F6" strokeWidth={2.2} style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitleText}>
                    Kategoriler ({filteredCategories.length})
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                >
                  {filteredCategories.map((cat) => {
                    const isProtected = cat.id === 'all';
                    return (
                      <View key={`cat_${cat.id}`} style={styles.chipItem}>
                        <Tag size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                        <Text style={styles.chipItemText}>{cat.labelTr || cat.id}</Text>
                        {!isProtected && (
                          <TouchableOpacity
                            onPress={() => setDeleteConfirm({
                              visible: true,
                              type: 'category',
                              id: cat.id,
                              name: cat.labelTr || cat.id,
                            })}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={styles.chipDeleteBtn}
                          >
                            <X size={12} color="#EF4444" strokeWidth={2.5} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                  {/* En sonuncunun sağında yuvarlak + butonu */}
                  <TouchableOpacity
                    style={styles.roundAddButton}
                    onPress={() => {
                      setSelectedCatOrg(selectedStationOrg !== 'all' ? selectedStationOrg : '');
                      setAddCatModalOpen(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Plus size={16} color="#FFFFFF" strokeWidth={2.8} />
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </ScrollView>

            {/* SİLME ONAY MODALI (KART İÇİ ENTEGRE OVERLAY) */}
            {deleteConfirm && deleteConfirm.visible && (
              <View style={styles.confirmOverlay}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => setDeleteConfirm(null)}
                />
                <View style={styles.confirmCard}>
                  <Text style={styles.confirmTitle}>
                    {deleteConfirm.type === 'org'
                      ? 'Organizasyonu Sil'
                      : deleteConfirm.type === 'app'
                      ? 'Uygulamayı Sil'
                      : deleteConfirm.type === 'category'
                      ? 'Kategoriyi Sil'
                      : 'Yöneticiyi Kaldır'}
                  </Text>
                  <Text style={styles.confirmDesc}>
                    "{deleteConfirm.name}" kaydını sistemden silmek istediğinize emin misiniz?
                  </Text>
                  <View style={styles.confirmActionRow}>
                    <TouchableOpacity
                      style={styles.confirmCancelBtn}
                      onPress={() => setDeleteConfirm(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.confirmCancelText}>Vazgeç</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmDeleteBtn}
                      onPress={() => {
                        const target = deleteConfirm;
                        setDeleteConfirm(null);
                        if (target.type === 'category') {
                          onDeleteCategory(target.id);
                        } else if (target.type === 'org') {
                          onRemoveOrg(target.id);
                        } else if (target.type === 'app') {
                          onRemoveApp(target.id);
                        } else if (target.type === 'admin') {
                          onRemoveAdmin && onRemoveAdmin(target.id);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.confirmDeleteText}>Sil</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* YETKİ & LİSANS HASH + QR KOD MODALI */}
      {hashModalVisible && (
        <ProvisioningHashModal
          visible={hashModalVisible}
          onClose={() => setHashModalVisible(false)}
          isFounder={isFounder}
          enterpriseBlindId={activeEnterpriseBlindId || 'default'}
          enterpriseName={displayTenantName}
          ownWhiteId={ownWhiteId || ''}
          tenants={tenantsList.map((t) => ({ enterprise_blind_id: t.enterprise_blind_id, name: t.name || t.enterprise_blind_id }))}
          orgs={orgsList.map((o) => ({ org_id: o.org_id, name: o.name || o.org_id }))}
          apps={appsList.map((a) => ({ app_id: a.app_id, name: a.name || a.app_id }))}
        />
      )}

      {/* ZENGİN ORGANİZASYON GİRİŞ MODALI */}
      <Modal
        visible={addOrgModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAddOrgModalOpen(false)}
      >
        <View style={styles.entryModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setAddOrgModalOpen(false)}
          />
          <View style={styles.entryModalCard}>
            <View style={styles.entryModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.entryIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Layers size={18} color="#3B82F6" strokeWidth={2.2} />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.entryModalTitle}>Yeni Organizasyon Ekle</Text>
                  <Text style={styles.entryModalSubtitle}>Bağlı departman veya şube tanımı</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.entryCloseBtn}
                onPress={() => setAddOrgModalOpen(false)}
                activeOpacity={0.7}
              >
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* 1. Firma (Bağlanacak Kuruluş) */}
            <View style={styles.entryFieldGroup}>
              <Text style={styles.entryFieldLabel}>FİRMA</Text>
              {isFounder && tenantsList && tenantsList.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.entryHorizontalChips}
                >
                  {tenantsList.map((t) => {
                    const isSelected = selectedOrgTenant === t.enterprise_blind_id;
                    return (
                      <TouchableOpacity
                        key={`org_tenant_${t.enterprise_blind_id}`}
                        style={[styles.entryChip, isSelected && styles.entryChipActive]}
                        onPress={() => setSelectedOrgTenant(t.enterprise_blind_id)}
                        activeOpacity={0.75}
                      >
                        <Building2 size={12} color={isSelected ? '#FFFFFF' : '#3B82F6'} style={{ marginRight: 5 }} />
                        <Text style={[styles.entryChipText, isSelected && styles.entryChipTextActive]}>
                          {t.name || t.enterprise_blind_id}
                        </Text>
                        {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.lockedPill}>
                  <Building2 size={13} color="#3B82F6" style={{ marginRight: 6 }} />
                  <Text style={styles.lockedPillText}>{displayTenantName}</Text>
                </View>
              )}
            </View>

            {/* 2. Organizasyon Adı */}
            <View style={styles.entryFieldGroup}>
              <Text style={styles.entryFieldLabel}>ORGANİZASYON ADI</Text>
              <TextInput
                style={styles.entryInput}
                placeholder="Örn: Saha Operasyon, Lojistik, Muhasebe"
                placeholderTextColor="#94A3B8"
                value={newOrgInput}
                onChangeText={onChangeNewOrgInput}
                autoFocus={true}
              />
            </View>

            {/* Aksiyon Butonları */}
            <View style={styles.entryActionRow}>
              <TouchableOpacity
                style={styles.entryCancelBtn}
                onPress={() => setAddOrgModalOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.entryCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.entrySubmitBtn, !newOrgInput.trim() && styles.entrySubmitBtnDisabled]}
                onPress={handleConfirmAddOrg}
                disabled={!newOrgInput.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.entrySubmitText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ZENGİN KATEGORİ GİRİŞ MODALI */}
      <Modal
        visible={addCatModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAddCatModalOpen(false)}
      >
        <View style={styles.entryModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setAddCatModalOpen(false)}
          />
          <View style={styles.entryModalCard}>
            <View style={styles.entryModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.entryIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Tag size={18} color="#3B82F6" strokeWidth={2.2} />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.entryModalTitle}>Yeni Destek Kategorisi Ekle</Text>
                  <Text style={styles.entryModalSubtitle}>Firma, organizasyon veya uygulama bağlama</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.entryCloseBtn}
                onPress={() => setAddCatModalOpen(false)}
                activeOpacity={0.7}
              >
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {/* 1. Firma Seçimi */}
              <View style={styles.entryFieldGroup}>
                <Text style={styles.entryFieldLabel}>FİRMA</Text>
                {isFounder && tenantsList && tenantsList.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.entryHorizontalChips}
                  >
                    {tenantsList.map((t) => {
                      const isSelected = selectedCatTenant === t.enterprise_blind_id;
                      return (
                        <TouchableOpacity
                          key={`cat_tenant_${t.enterprise_blind_id}`}
                          style={[styles.entryChip, isSelected && styles.entryChipActive]}
                          onPress={() => setSelectedCatTenant(t.enterprise_blind_id)}
                          activeOpacity={0.75}
                        >
                          <Building2 size={12} color={isSelected ? '#FFFFFF' : '#3B82F6'} style={{ marginRight: 5 }} />
                          <Text style={[styles.entryChipText, isSelected && styles.entryChipTextActive]}>
                            {t.name || t.enterprise_blind_id}
                          </Text>
                          {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 4 }} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View style={styles.lockedPill}>
                    <Building2 size={13} color="#3B82F6" style={{ marginRight: 6 }} />
                    <Text style={styles.lockedPillText}>{displayTenantName}</Text>
                  </View>
                )}
              </View>

              {/* 2. Organizasyon Seçimi (Tüm Birimler / Özel Birim) */}
              <View style={styles.entryFieldGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.entryFieldLabel}>ORGANİZASYON</Text>
                  <Text style={styles.entryFieldHint}>{selectedCatOrg ? 'Birime Özel' : 'Tüm Birimler'}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.entryHorizontalChips}
                >
                  <TouchableOpacity
                    style={[styles.entryChip, !selectedCatOrg && styles.entryChipActive]}
                    onPress={() => setSelectedCatOrg('')}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.entryChipText, !selectedCatOrg && styles.entryChipTextActive]}>
                      Tüm Birimler (Genel)
                    </Text>
                    {!selectedCatOrg && <Check size={12} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>

                  {orgsList
                    .filter((org) => {
                      if (!selectedCatTenant || selectedCatTenant === 'all') return true;
                      if (org.org_id === 'default' || org.org_id === '*' || org.org_id === 'thewhite') return true;
                      if (org.enterprise_blind_id && org.enterprise_blind_id !== selectedCatTenant) return false;
                      return true;
                    })
                    .map((org) => {
                    const isSelected = selectedCatOrg === org.org_id;
                    return (
                      <TouchableOpacity
                        key={`cat_org_${org.org_id}`}
                        style={[styles.entryChip, isSelected && styles.entryChipActive]}
                        onPress={() => setSelectedCatOrg(org.org_id)}
                        activeOpacity={0.75}
                      >
                        <Layers size={12} color={isSelected ? '#FFFFFF' : '#3B82F6'} style={{ marginRight: 5 }} />
                        <Text style={[styles.entryChipText, isSelected && styles.entryChipTextActive]}>
                          {org.name || org.org_id}
                        </Text>
                        {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 3. Uygulama Seçimi (Tüm Uygulamalar / Özel Uygulama) */}
              <View style={styles.entryFieldGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.entryFieldLabel}>UYGULAMA</Text>
                  <Text style={styles.entryFieldHint}>{selectedCatApp ? 'Uygulamaya Özel' : 'Tüm Uygulamalar'}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.entryHorizontalChips}
                >
                  <TouchableOpacity
                    style={[styles.entryChip, !selectedCatApp && styles.entryChipActive]}
                    onPress={() => setSelectedCatApp('')}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.entryChipText, !selectedCatApp && styles.entryChipTextActive]}>
                      Tüm Uygulamalar (Genel)
                    </Text>
                    {!selectedCatApp && <Check size={12} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>

                  {appsList.map((app) => {
                    const isSelected = selectedCatApp === app.app_id;
                    return (
                      <TouchableOpacity
                        key={`cat_app_${app.app_id}`}
                        style={[styles.entryChip, isSelected && styles.entryChipActive]}
                        onPress={() => setSelectedCatApp(app.app_id)}
                        activeOpacity={0.75}
                      >
                        <LayoutGrid size={12} color={isSelected ? '#FFFFFF' : '#3B82F6'} style={{ marginRight: 5 }} />
                        <Text style={[styles.entryChipText, isSelected && styles.entryChipTextActive]}>
                          {app.name || app.app_id}
                        </Text>
                        {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 4. Kategori Adı */}
              <View style={styles.entryFieldGroup}>
                <Text style={styles.entryFieldLabel}>KATEGORİ ADI</Text>
                <TextInput
                  style={styles.entryInput}
                  placeholder="Örn: Donanım Arızası, Fatura Talebi, Hesap Erişimi"
                  placeholderTextColor="#94A3B8"
                  value={newCatNameInput}
                  onChangeText={onChangeNewCatNameInput}
                  autoFocus={true}
                />
              </View>
            </ScrollView>

            {/* Aksiyon Butonları */}
            <View style={styles.entryActionRow}>
              <TouchableOpacity
                style={styles.entryCancelBtn}
                onPress={() => setAddCatModalOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.entryCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.entrySubmitBtn, !newCatNameInput.trim() && styles.entrySubmitBtnDisabled]}
                onPress={handleConfirmAddCat}
                disabled={!newCatNameInput.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.entrySubmitText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  consoleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consoleTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  consoleSubtitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  consoleCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBlock: {
    marginTop: 18,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  horizontalScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 10,
  },
  wrapGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipItemActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#2563EB',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  chipItemText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '600',
  },
  chipItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chipDeleteBtn: {
    marginLeft: 6,
    padding: 2,
  },
  roundAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginLeft: 2,
  },
  // Modal Overlay & Container
  entryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  entryModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 15,
  },
  entryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  entryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  entryModalSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  entryCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryFieldGroup: {
    marginTop: 12,
  },
  entryFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  entryFieldHint: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#3B82F6',
  },
  entryHorizontalChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 2,
  },
  entryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 6.5,
  },
  entryChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#2563EB',
  },
  entryChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  entryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  lockedPillText: {
    fontSize: 12.5,
    color: '#1E40AF',
    fontWeight: '700',
  },
  entryInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  entryActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  entryCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
  },
  entryCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  entrySubmitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: '#3B82F6',
  },
  entrySubmitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  entrySubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Kart İçi Silme Onay Overlay'i
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 20,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  confirmDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 18,
  },
  confirmActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  confirmCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  confirmCancelText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmDeleteBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EF4444',
  },
  confirmDeleteText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
