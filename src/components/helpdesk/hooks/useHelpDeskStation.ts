import { useState, useCallback, useMemo, useEffect } from 'react';
import { Alert, NativeModules } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { helpDeskService, HelpDeskCategory, HelpDeskTicket, AdminEntry, AppCatEntry } from '../../../services/helpDeskService';
import { CustomFieldDef, CatalogItem } from '../types';

export const COSMIC_PREFIXES = [
  'Planet', 'WhiteCosmos', 'Orbit', 'Nebula', 'Pulsar', 'Nova', 'Comet', 'Titan',
  'Atlas', 'Kronos', 'Aurora', 'Zenith', 'Vortex', 'Quasar', 'Solaris', 'Vega'
];

export interface UseHelpDeskStationProps {
  ownWhiteId: string;
  isMasterAdmin: boolean;
  activeEnterpriseBlindId: string | null;
  selectedTenantBlindId: string;
  currentEnterpriseName: string | null;
  setCurrentEnterpriseName: (name: string) => void;
  adminsList: AdminEntry[];
  appsList?: AppCatEntry[];
  availableCategories: HelpDeskCategory[];
  setAvailableCategories: (cats: HelpDeskCategory[]) => void;
  selectedAppId: string;
  setSelectedAppId: (appId: string) => void;
  selectedOrgId: string;
  setSelectedOrgId: (orgId: string) => void;
  selectedCatIds: string[];
  setSelectedCatIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedAdminId: string;
  setSelectedAdminId: (id: string) => void;
  language: 'tr' | 'en';
  getLabel: (key: string, tr: string, en: string) => string;
  formatWhiteId: (id: string | null | undefined) => string;
  formatAppId: (appId: string | null | undefined) => string;
  getCategoryLabel: (catKey: string | null | undefined) => string;
  setConfirmSheet: (sheet: any) => void;
  loadConsoleData: () => Promise<void>;
  loadData: (params?: any) => Promise<void>;
  CURRENT_APP_ID: string;
}

export function useHelpDeskStation({
  ownWhiteId,
  isMasterAdmin,
  activeEnterpriseBlindId,
  selectedTenantBlindId,
  currentEnterpriseName,
  setCurrentEnterpriseName,
  adminsList,
  appsList,
  availableCategories,
  setAvailableCategories,
  selectedAppId,
  setSelectedAppId,
  selectedOrgId,
  setSelectedOrgId,
  selectedCatIds,
  setSelectedCatIds,
  selectedAdminId,
  setSelectedAdminId,
  language,
  getLabel,
  formatWhiteId,
  formatAppId,
  getCategoryLabel,
  setConfirmSheet,
  loadConsoleData,
  loadData,
  CURRENT_APP_ID,
}: UseHelpDeskStationProps) {
  // 1. Settings & Logo State
  const [tenantLogoUri, setTenantLogoUri] = useState<string | null>(null);
  const [tenantLogoAlign, setTenantLogoAlign] = useState<'left' | 'center' | 'right'>('left');
  const [editTenantNameInput, setEditTenantNameInput] = useState<string>('');
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [cropSourceImageUri, setCropSourceImageUri] = useState<string | null>(null);

  // 1.1 Tenant Login & Security Policy Settings
  const [allowNameEntry, setAllowNameEntry] = useState<boolean>(true);
  const [loginIssueEnabled, setLoginIssueEnabled] = useState<boolean>(false);

  // 2. Custom Fields & Dynamic Chips
  const [tenantCustomFields, setTenantCustomFields] = useState<CustomFieldDef[]>([]);
  const [tenantCatalog, setTenantCatalog] = useState<CatalogItem[]>([]);
  const [newCustomFieldName, setNewCustomFieldName] = useState('');

  // 3. Provisioning Inputs
  const [newOrgInput, setNewOrgInput] = useState('');
  const [newAppInput, setNewAppInput] = useState('');
  const [newCatNameInput, setNewCatNameInput] = useState('');
  const [licenseUpgradeHashInput, setLicenseUpgradeHashInput] = useState('');

  // Sub-modal inputs for AddAdmin, AddOrg, AddApp, AddCat
  const [addAdminModalVisible, setAddAdminModalVisible] = useState(false);
  const [newAdminIdInput, setNewAdminIdInput] = useState('');
  const [newAdminAliasInput, setNewAdminAliasInput] = useState('');
  const [assigningTicket, setAssigningTicket] = useState<HelpDeskTicket | null>(null);
  const [assignAppId, setAssignAppId] = useState<string>('*');
  const [assignCatId, setAssignCatId] = useState<string>('*');
  const [suggestPrefixIndex, setSuggestPrefixIndex] = useState(0);
  const [suggestCount, setSuggestCount] = useState(1);

  const [addOrgModalVisible, setAddOrgModalVisible] = useState(false);
  const [newOrgIdInput, setNewOrgIdInput] = useState('');
  const [newOrgNameInput, setNewOrgNameInput] = useState('');

  const [addAppModalVisible, setAddAppModalVisible] = useState(false);
  const [addCatModalVisible, setAddCatModalVisible] = useState(false);
  const [newCatIdInput, setNewCatIdInput] = useState('');
  const [newCatTrInput, setNewCatTrInput] = useState('');
  const [newCatEnInput, setNewCatEnInput] = useState('');

  // App Registration
  const [appRegModalVisible, setAppRegModalVisible] = useState(false);
  const [appRegNameInput, setAppRegNameInput] = useState('');
  const [appRegDescInput, setAppRegDescInput] = useState('');
  const [appRegStatus, setAppRegStatus] = useState<'registered' | 'pending' | 'rejected' | 'unregistered'>('unregistered');

  // --- Handlers: Logo & Settings ---
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const settings = await helpDeskService.getTenantLoginSettings(activeEnterpriseBlindId);
        if (isMounted) {
          setAllowNameEntry(settings.allowNameEntry);
          setLoginIssueEnabled(settings.loginIssueEnabled);
        }
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [activeEnterpriseBlindId]);

  const handleToggleAllowNameEntry = useCallback(async (val: boolean) => {
    setAllowNameEntry(val);
    await helpDeskService.setTenantLoginSettings(activeEnterpriseBlindId, val, loginIssueEnabled);
  }, [activeEnterpriseBlindId, loginIssueEnabled]);

  const handleToggleLoginIssue = useCallback(async (val: boolean) => {
    setLoginIssueEnabled(val);
    await helpDeskService.setTenantLoginSettings(activeEnterpriseBlindId, allowNameEntry, val);
  }, [activeEnterpriseBlindId, allowNameEntry]);

  const handleSaveLogoAlign = useCallback(async (newAlign: 'left' | 'center' | 'right') => {
    setTenantLogoAlign(newAlign);
    const blindId = activeEnterpriseBlindId || 'default';
    await helpDeskService.setTenantLogoAlign(blindId, newAlign);
  }, [activeEnterpriseBlindId]);

  const handleSaveEnterpriseName = useCallback(async () => {
    const trimmed = editTenantNameInput.trim();
    if (!trimmed) {
      setConfirmSheet({
        visible: true,
        title: 'Hata',
        description: 'Lütfen geçerli bir kurum/firma adı belirtin.',
        actionText: 'Tamam',
        onAction: () => setConfirmSheet((p: any) => ({ ...p, visible: false })),
      });
      return;
    }
    const blindId = activeEnterpriseBlindId || 'default';
    const ok = await helpDeskService.updateEnterpriseName(blindId, trimmed);
    if (ok) {
      setCurrentEnterpriseName(trimmed);
      setConfirmSheet({
        visible: true,
        title: 'Başarılı',
        description: `Firma adı '${trimmed}' olarak güncellendi.`,
        actionText: 'Tamam',
        onAction: () => setConfirmSheet((p: any) => ({ ...p, visible: false })),
      });
    }
  }, [editTenantNameInput, activeEnterpriseBlindId, setCurrentEnterpriseName, setConfirmSheet]);

  const processTransparentLogo = useCallback(async (uri: string): Promise<string> => {
    try {
      if (NativeModules.ImageTransparency && NativeModules.ImageTransparency.makeTransparent) {
        return await NativeModules.ImageTransparency.makeTransparent(uri);
      }
    } catch (err) {
      console.warn('[useHelpDeskStation] processTransparentLogo error:', err);
    }
    return uri;
  }, []);

  const handlePickLogo = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'image/svg+xml',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/*',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        const rawUri = asset.uri;
        const fileName = (asset.name || '').toLowerCase();
        const mimeType = (asset.mimeType || '').toLowerCase();

        const isSvg = fileName.endsWith('.svg') || mimeType.includes('svg');
        const isRaster =
          fileName.endsWith('.png') ||
          fileName.endsWith('.jpg') ||
          fileName.endsWith('.jpeg') ||
          mimeType.includes('png') ||
          mimeType.includes('jpeg') ||
          mimeType.includes('jpg');

        if (!isSvg && !isRaster) {
          Alert.alert('Geçersiz Format', 'Lütfen SVG, PNG veya JPG formatında bir logo dosyası seçin.');
          return;
        }

        const blindId = activeEnterpriseBlindId || 'default';
        const timestamp = Date.now();

        try {
          const files = await ReactNativeBlobUtil.fs.ls(ReactNativeBlobUtil.fs.dirs.DocumentDir);
          for (const f of files) {
            if (f.startsWith('tenant_logo_')) {
              await ReactNativeBlobUtil.fs.unlink(`${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${f}`);
            }
          }
        } catch {}

        let finalUri = '';
        if (isSvg) {
          const svgContent = await ReactNativeBlobUtil.fs.readFile(rawUri, 'utf8');
          const targetPath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/tenant_logo_${blindId}_${timestamp}.svg`;
          await ReactNativeBlobUtil.fs.writeFile(targetPath, svgContent, 'utf8');
          finalUri = `file://${targetPath}?t=${timestamp}`;
        } else {
          const transparentUri = await processTransparentLogo(rawUri);
          const base64Data = await ReactNativeBlobUtil.fs.readFile(transparentUri, 'base64');
          const targetPath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/tenant_logo_${blindId}_${timestamp}.png`;
          await ReactNativeBlobUtil.fs.writeFile(targetPath, base64Data, 'base64');
          finalUri = `file://${targetPath}?t=${timestamp}`;
        }

        setTenantLogoUri(finalUri);
        await helpDeskService.setTenantLogo(blindId, finalUri);
      }
    } catch (err) {
      console.warn('[useHelpDeskStation] Pick logo error:', err);
      Alert.alert('Hata', 'Logo yüklenirken bir sorun oluştu.');
    }
  }, [activeEnterpriseBlindId, processTransparentLogo]);

  const handleRemoveLogo = useCallback(async () => {
    const blindId = activeEnterpriseBlindId || 'default';
    setTenantLogoUri(null);
    await helpDeskService.setTenantLogo(blindId, null);
    try {
      const files = await ReactNativeBlobUtil.fs.ls(ReactNativeBlobUtil.fs.dirs.DocumentDir);
      for (const f of files) {
        if (f.startsWith('tenant_logo_')) {
          await ReactNativeBlobUtil.fs.unlink(`${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${f}`);
        }
      }
    } catch {}
  }, [activeEnterpriseBlindId]);

  const handlePickDocumentForCrop = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'image/*',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        const isPdf = (asset.name || '').toLowerCase().endsWith('.pdf') || (asset.mimeType || '').includes('pdf');
        if (isPdf) {
          Alert.alert(
            'PDF Bilgilendirmesi',
            'PDF içindeki logoyu en net şekilde alabilmek için lütfen ilgili sayfanın ekran görüntüsünü (screenshot) alıp dosyalar içerisinden seçin.'
          );
          return;
        }
        setCropSourceImageUri(asset.uri);
        setCropModalVisible(true);
      }
    } catch (err) {
      console.warn('[useHelpDeskStation] Pick document for crop error:', err);
      Alert.alert('Hata', 'Belge/dosya seçilirken bir sorun oluştu.');
    }
  }, []);

  const handleConfirmCrop = useCallback(async (cropInfo: { x: number; y: number; width: number; height: number }) => {
    try {
      if (!cropSourceImageUri) return;
      const blindId = activeEnterpriseBlindId || 'default';
      const timestamp = Date.now();

      let processedUri = cropSourceImageUri;
      if (NativeModules.ImageTransparency && NativeModules.ImageTransparency.cropAndMakeTransparent) {
        processedUri = await NativeModules.ImageTransparency.cropAndMakeTransparent(
          cropSourceImageUri,
          cropInfo.x,
          cropInfo.y,
          cropInfo.width,
          cropInfo.height
        );
      } else if (NativeModules.ImageTransparency && NativeModules.ImageTransparency.makeTransparent) {
        processedUri = await NativeModules.ImageTransparency.makeTransparent(cropSourceImageUri);
      }

      try {
        const files = await ReactNativeBlobUtil.fs.ls(ReactNativeBlobUtil.fs.dirs.DocumentDir);
        for (const f of files) {
          if (f.startsWith('tenant_logo_')) {
            await ReactNativeBlobUtil.fs.unlink(`${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${f}`);
          }
        }
      } catch {}

      const base64Data = await ReactNativeBlobUtil.fs.readFile(processedUri, 'base64');
      const targetPath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/tenant_logo_${blindId}_${timestamp}.png`;
      await ReactNativeBlobUtil.fs.writeFile(targetPath, base64Data, 'base64');
      const finalUri = `file://${targetPath}?t=${timestamp}`;

      setTenantLogoUri(finalUri);
      await helpDeskService.setTenantLogo(blindId, finalUri);
      setCropModalVisible(false);
      setCropSourceImageUri(null);
    } catch (err) {
      console.warn('[useHelpDeskStation] Crop & transparent logo error:', err);
      Alert.alert('Hata', 'Logo kırpılırken ve arka planı temizlenirken bir sorun oluştu.');
      setCropModalVisible(false);
      setCropSourceImageUri(null);
    }
  }, [cropSourceImageUri, activeEnterpriseBlindId]);

  const handleLongPressLogoToCrop = useCallback(() => {
    if (!tenantLogoUri) return;
    const cleanUri = tenantLogoUri.split('?')[0];
    if (cleanUri.toLowerCase().endsWith('.svg')) {
      Alert.alert(
        'Vektör Logo (SVG)',
        'SVG logolar vektörel olduğu için doğrudan kayıpsız ölçeklenir. Kırpma aracı raster (PNG/JPG) görseller için geçerlidir.'
      );
      return;
    }
    setCropSourceImageUri(cleanUri);
    setCropModalVisible(true);
  }, [tenantLogoUri]);

  // --- Handlers: Custom Fields ---
  const handleAddChip = useCallback(async (label: string) => {
    const key = label.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (tenantCustomFields.some(f => f.key === key || f.label.toLowerCase() === label.toLowerCase())) return;
    const newField = { key, label, required: false };
    const updated = [...tenantCustomFields, newField];
    setTenantCustomFields(updated);
    const blindId = activeEnterpriseBlindId || 'default';
    await helpDeskService.updateTenantCustomFieldsAndCatalog(blindId, updated, tenantCatalog);
  }, [tenantCustomFields, tenantCatalog, activeEnterpriseBlindId]);

  const handleAddCustomField = useCallback(async () => {
    const trimmed = newCustomFieldName.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (tenantCustomFields.some(f => f.key === key || f.label.toLowerCase() === trimmed.toLowerCase())) {
      setNewCustomFieldName('');
      return;
    }
    const newField = { key, label: trimmed, required: false };
    const updated = [...tenantCustomFields, newField];
    setTenantCustomFields(updated);
    setNewCustomFieldName('');
    const blindId = activeEnterpriseBlindId || 'default';
    await helpDeskService.updateTenantCustomFieldsAndCatalog(blindId, updated, tenantCatalog);
  }, [newCustomFieldName, tenantCustomFields, tenantCatalog, activeEnterpriseBlindId]);

  const handleRemoveCustomField = useCallback(async (keyToRemove: string) => {
    const updated = tenantCustomFields.filter(f => f.key !== keyToRemove);
    setTenantCustomFields(updated);
    const blindId = activeEnterpriseBlindId || 'default';
    await helpDeskService.updateTenantCustomFieldsAndCatalog(blindId, updated, tenantCatalog);
  }, [tenantCustomFields, tenantCatalog, activeEnterpriseBlindId]);

  // --- Handlers: License & Addon Files ---
  const handleGenerateOperatorAddonFile = useCallback(async () => {
    try {
      const blindId = activeEnterpriseBlindId || 'default';
      const res = await helpDeskService.generateNewAdminHash(blindId, 1);
      if (!res.success || !res.hash) {
        Alert.alert('Hata', 'Operatör lisans anahtarı üretilemedi.');
        return;
      }
      const filename = `whitedesk_operator_lisansi_${Date.now()}.txt`;
      const content = [
        '============================================================',
        'WHITEDESK LİSANS DOSYASI',
        '============================================================',
        `Kuruluş     : ${currentEnterpriseName}`,
        'Lisans Türü : Operatör Koltuğu (+1)',
        `Üretim Tarihi: ${new Date().toLocaleString('tr-TR')}`,
        '',
        'LİSANS ANAHTARI (HASH):',
        res.hash,
        '============================================================',
        'Bu dosyayı güvenli bir yerde saklayın.',
        'Operatör davetinde veya Lisans Yükseltme ekranında',
        'bu anahtarı kullanarak yetkilendirme sağlayabilirsiniz.',
        '============================================================',
      ].join('\n');

      const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
      await ReactNativeBlobUtil.fs.writeFile(filePath, content, 'utf8');

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/plain',
          dialogTitle: 'Operatör Lisansını Kaydet',
          UTI: 'public.plain-text',
        });
      }
      await loadConsoleData();
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Lisans dosyası oluşturulamadı.');
    }
  }, [activeEnterpriseBlindId, currentEnterpriseName, loadConsoleData]);

  const handleGenerateOperatorInviteHash = useCallback(async () => {
    await handleGenerateOperatorAddonFile();
  }, [handleGenerateOperatorAddonFile]);

  const handleGenerateCustomerAddonFile = useCallback(async () => {
    try {
      const blindId = activeEnterpriseBlindId || 'default';
      const res = await helpDeskService.generateNewUserHash(blindId, 25);
      if (!res.success || !res.hash) {
        Alert.alert('Hata', 'Müşteri kota lisansı üretilemedi.');
        return;
      }
      const filename = `whitedesk_musteri_kotasi_${Date.now()}.txt`;
      const content = [
        '============================================================',
        'WHITEDESK LİSANS DOSYASI',
        '============================================================',
        `Kuruluş     : ${currentEnterpriseName}`,
        'Lisans Türü : Müşteri Kotası (+25)',
        `Üretim Tarihi: ${new Date().toLocaleString('tr-TR')}`,
        '',
        'LİSANS ANAHTARI (HASH):',
        res.hash,
        '============================================================',
        'Bu dosyayı güvenli bir yerde saklayın.',
        'Lisans Yükseltme alanında bu anahtarı doğrulatarak',
        '25 kişilik müşteri kotanızı anında aktif edebilirsiniz.',
        '============================================================',
      ].join('\n');

      const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
      await ReactNativeBlobUtil.fs.writeFile(filePath, content, 'utf8');

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/plain',
          dialogTitle: 'Müşteri Kota Lisansını Kaydet',
          UTI: 'public.plain-text',
        });
      }
      await loadConsoleData();
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Lisans dosyası oluşturulamadı.');
    }
  }, [activeEnterpriseBlindId, currentEnterpriseName, loadConsoleData]);

  const handleUpgradeLicenseWithHash = useCallback(async () => {
    const trimmed = licenseUpgradeHashInput.trim();
    if (!trimmed) return;
    const res = await helpDeskService.claimUnifiedHash(ownWhiteId, trimmed);
    if (res.success) {
      setLicenseUpgradeHashInput('');
      setConfirmSheet({
        visible: true,
        title: 'Lisans Güncellendi',
        description: res.message,
        actionText: 'Tamam',
        onAction: () => setConfirmSheet((p: any) => ({ ...p, visible: false })),
      });
      await loadConsoleData();
      await loadData();
    } else {
      setConfirmSheet({
        visible: true,
        title: 'Geçersiz Kod',
        description: res.message,
        actionText: 'Tamam',
        onAction: () => setConfirmSheet((p: any) => ({ ...p, visible: false })),
      });
    }
  }, [licenseUpgradeHashInput, ownWhiteId, setConfirmSheet, loadConsoleData, loadData]);

  // --- Handlers: Org / App / Category / Allocation CRUD ---
  const handleCreateOrg = useCallback(async (customName?: string, targetTenantBlindId?: string) => {
    const raw = customName !== undefined ? customName : newOrgInput;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const targetTenant = targetTenantBlindId || selectedTenantBlindId || activeEnterpriseBlindId || 'default';
    await helpDeskService.addOrganization(trimmed, trimmed, targetTenant);
    setNewOrgInput('');
    await loadConsoleData();
  }, [newOrgInput, selectedTenantBlindId, activeEnterpriseBlindId, loadConsoleData]);

  const handleRemoveOrg = useCallback(async (orgId: string) => {
    if (orgId === 'default' || orgId === 'thewhite') return;
    await helpDeskService.removeOrganization(orgId);
    await loadConsoleData();
  }, [loadConsoleData]);

  const handleCreateApp = useCallback(async () => {
    const trimmed = newAppInput.trim();
    if (!trimmed) return;
    const blindId = activeEnterpriseBlindId || 'default';
    await helpDeskService.addApp(trimmed, trimmed, blindId);
    setNewAppInput('');
    await loadConsoleData();
  }, [newAppInput, activeEnterpriseBlindId, loadConsoleData]);

  const handleRemoveApp = useCallback(async (appId: string) => {
    if (appId === 'inwhite') return;
    await helpDeskService.removeApp(appId);
    await loadConsoleData();
  }, [loadConsoleData]);

  const handleCreateCategory = useCallback(async (params?: { name?: string; targetTenantBlindId?: string; targetOrgId?: string; targetAppId?: string }) => {
    const raw = params?.name !== undefined ? params.name : newCatNameInput;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const blindId = params?.targetTenantBlindId || selectedTenantBlindId || activeEnterpriseBlindId || 'default';
    const targetOrg = params?.targetOrgId || selectedOrgId || 'default';
    const targetApp = params?.targetAppId || selectedAppId || CURRENT_APP_ID;
    await helpDeskService.addCategoryToApp(
      targetApp,
      { id: trimmed.toLowerCase().replace(/\s+/g, '_'), key: trimmed.toLowerCase().replace(/\s+/g, '_'), labelTr: trimmed, labelEn: trimmed, icon: 'Tag' },
      targetOrg,
      blindId
    );
    setNewCatNameInput('');
    await loadConsoleData();
    const cats = await helpDeskService.getAppCategories(targetApp === 'all' ? CURRENT_APP_ID : targetApp, blindId, targetOrg);
    setAvailableCategories(cats);
  }, [newCatNameInput, selectedTenantBlindId, activeEnterpriseBlindId, selectedOrgId, selectedAppId, CURRENT_APP_ID, loadConsoleData, setAvailableCategories]);

  const handleDeleteCategory = useCallback((catId: string) => {
    if (catId === 'all') return;
    const cat = availableCategories.find(c => c.id === catId || c.key === catId);
    const catLabel = cat ? (language === 'tr' ? cat.labelTr : cat.labelEn) : catId;
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.deleteCatTitle', 'Kategoriyi Sil', 'Delete Category'),
      description: `"${catLabel}" ${getLabel('helpdesk.deleteCatConfirm', 'kategorisi sistemden silinecek. Onaylıyor musunuz?', 'category will be removed from the system. Do you confirm?')}`,
      actionText: getLabel('common.delete', 'Sil', 'Delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        const updatedCats = availableCategories.filter(c => c.id !== catId && c.key !== catId);
        setAvailableCategories(updatedCats);
        setSelectedCatIds(prev => prev.filter(id => id !== catId));
        await helpDeskService.deleteCategory(catId, selectedAppId);
        await loadConsoleData();
        const cats = await helpDeskService.getAppCategories(selectedAppId === 'all' ? CURRENT_APP_ID : selectedAppId);
        setAvailableCategories(cats);
      },
    });
  }, [availableCategories, language, getLabel, setConfirmSheet, selectedAppId, CURRENT_APP_ID, loadConsoleData, setAvailableCategories, setSelectedCatIds]);

  const handleDeleteApp = useCallback((appId: string) => {
    if (appId === 'all' || appId === 'inwhite') return;
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.deleteAppTitle', 'Uygulamayı Sil', 'Delete Application'),
      description: `"${formatAppId(appId)}" ${getLabel('helpdesk.deleteAppConfirm', 'uygulaması sistemden ve tüm yetkilendirmelerden silinecektir. Onaylıyor musunuz?', 'application and all allocations will be removed. Do you confirm?')}`,
      actionText: getLabel('common.delete', 'Sil', 'Delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.removeApp(appId);
        await loadConsoleData();
        if (selectedAppId === appId) {
          setSelectedAppId('all');
          setSelectedCatIds(['all']);
        }
      },
    });
  }, [getLabel, formatAppId, setConfirmSheet, loadConsoleData, selectedAppId, setSelectedAppId, setSelectedCatIds]);

  const handleDeleteOrg = useCallback((orgId: string) => {
    if (orgId === 'default' || orgId === '*') return;
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.deleteOrgTitle', 'Organizasyonu Sil', 'Delete Organization'),
      description: `"${orgId}" ${getLabel('helpdesk.deleteOrgConfirm', 'organizasyonu ve bağlı yetkilendirmeler sistemden silinecektir. Onaylıyor musunuz?', 'organization and all allocations will be removed. Do you confirm?')}`,
      actionText: getLabel('common.delete', 'Sil', 'Delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.removeOrganization(orgId);
        await loadConsoleData();
        if (selectedOrgId === orgId) {
          setSelectedOrgId('*');
        }
      },
    });
  }, [getLabel, setConfirmSheet, loadConsoleData, selectedOrgId, setSelectedOrgId]);

  const handleToggleCategory = useCallback((catId: string) => {
    if (catId === 'all') {
      setSelectedCatIds(['all']);
      return;
    }
    setSelectedCatIds(prev => {
      let next = prev.filter(c => c !== 'all');
      if (next.includes(catId)) {
        next = next.filter(c => c !== catId);
        if (next.length === 0) next = ['all'];
      } else {
        next.push(catId);
      }
      return next;
    });
  }, [setSelectedCatIds]);

  const handleAddCustomOrgSubmit = useCallback(async () => {
    const cleanOrg = newOrgIdInput.trim().toLowerCase();
    if (!cleanOrg) return;
    const cleanName = newOrgNameInput.trim() || cleanOrg;
    await helpDeskService.addOrganization(cleanOrg, cleanName);
    setAddOrgModalVisible(false);
    setNewOrgIdInput('');
    setNewOrgNameInput('');
    await loadConsoleData();
    setSelectedOrgId(cleanOrg);
  }, [newOrgIdInput, newOrgNameInput, loadConsoleData, setSelectedOrgId]);

  const handleAddCustomAppSubmit = useCallback(async () => {
    const cleanApp = newAppInput.trim().toLowerCase();
    if (!cleanApp) return;
    await helpDeskService.addApp(cleanApp);
    setAddAppModalVisible(false);
    setNewAppInput('');
    await loadConsoleData();
    setSelectedAppId(cleanApp);
    setSelectedCatIds(['all']);
  }, [newAppInput, loadConsoleData, setSelectedAppId, setSelectedCatIds]);

  const handleAddCustomCategorySubmit = useCallback(async () => {
    const cleanCat = newCatIdInput.trim().toLowerCase();
    if (!cleanCat || selectedAppId === 'all') return;
    const label = newCatTrInput.trim() || cleanCat;
    const newCatObj: HelpDeskCategory = {
      id: cleanCat,
      key: cleanCat,
      icon: 'HelpCircle',
      labelTr: label,
      labelEn: label,
    };
    await helpDeskService.addCategoryToApp(selectedAppId, newCatObj);
    setAddCatModalVisible(false);
    setNewCatIdInput('');
    setNewCatTrInput('');
    setNewCatEnInput('');
    await loadConsoleData();
    if (selectedAppId === CURRENT_APP_ID) {
      const cats = await helpDeskService.getAppCategories(CURRENT_APP_ID);
      setAvailableCategories(cats);
    }
    setSelectedCatIds(prev => prev.includes('all') ? [cleanCat] : [...prev, cleanCat]);
  }, [newCatIdInput, selectedAppId, newCatTrInput, loadConsoleData, CURRENT_APP_ID, setAvailableCategories, setSelectedCatIds]);

  const handleSaveAllocationSubmit = useCallback(async () => {
    if (!selectedAdminId) return;
    const finalCats = selectedAppId === 'all' || selectedCatIds.length === 0 ? ['all'] : selectedCatIds;
    const selectedAdm = adminsList.find(a => a.white_id === selectedAdminId);
    const tenantBlind = selectedAdm?.enterprise_blind_id || (selectedTenantBlindId !== 'all' ? selectedTenantBlindId : undefined);
    await helpDeskService.saveAdminAlloc(
      selectedAdminId, 
      selectedOrgId || '*', 
      selectedAppId, 
      finalCats,
      tenantBlind,
      finalCats.length === 1 ? finalCats[0] : '*'
    );
    await loadConsoleData();
  }, [selectedAdminId, selectedAppId, selectedCatIds, adminsList, selectedTenantBlindId, selectedOrgId, loadConsoleData]);

  const handleRemoveAdmin = useCallback((adminWhiteId: string) => {
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.removeAdminTitle', 'Yöneticiyi Sil', 'Remove Admin'),
      description: `${formatWhiteId(adminWhiteId)} ${getLabel('helpdesk.removeAdminConfirm', 'yöneticisini ve tüm yetki atamalarını silmek istediğinizden emin misiniz?', 'Are you sure you want to remove this admin and all their allocations?')}`,
      actionText: getLabel('common.delete', 'Sil', 'Delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.removeAdmin(adminWhiteId);
        await loadConsoleData();
        if (selectedAdminId === adminWhiteId) {
          setSelectedAdminId('');
        }
      },
    });
  }, [getLabel, formatWhiteId, setConfirmSheet, loadConsoleData, selectedAdminId, setSelectedAdminId]);

  const handleAddCustomAdminSubmit = useCallback(async () => {
    const cleanId = newAdminIdInput.trim();
    if (!cleanId && !assigningTicket) return;

    if (assigningTicket) {
      const targetTicket = assigningTicket;
      const targetAlias = newAdminAliasInput.trim() || `${COSMIC_PREFIXES[suggestPrefixIndex % COSMIC_PREFIXES.length]}-${suggestCount}`;
      const targetApp = assignAppId;
      const targetCat = assignCatId;
      setAddAdminModalVisible(false);

      const ticketIdLabel = `#${targetTicket.id}`;
      const appLabel = targetApp === '*' ? (language === 'tr' ? 'Tüm Uygulamalar (*)' : 'All Apps (*)') : formatAppId(targetApp);
      const catLabel = targetCat === '*' ? (language === 'tr' ? 'Tüm Kategoriler (*)' : 'All Categories (*)') : getCategoryLabel(targetCat);

      const descTemplate = language === 'tr'
        ? `${ticketIdLabel} bilet sahibine (${targetAlias}) [${appLabel} • ${catLabel}] için Ed25519 kriptografik yönetici yetkisi tanımlanacak ve Neon sistemine mühürlenecektir. Onaylıyor musunuz?`
        : `${ticketIdLabel} ticket owner will be authorized as ${targetAlias} for [${appLabel} • ${catLabel}] with Ed25519 and sealed to Neon. Do you confirm?`;

      setConfirmSheet({
        visible: true,
        title: getLabel('helpdesk.assignAdminTitle', 'Admin Authorization', 'Admin Authorization'),
        description: descTemplate,
        actionText: getLabel('helpdesk.grantAuthority', 'Yetkilendir', 'Authorize'),
        actionColor: '#10B981',
        cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
        onCancel: () => {
          setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
          setAssigningTicket(null);
          setNewAdminIdInput('');
          setNewAdminAliasInput('');
        },
        onAction: async () => {
          setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
          try {
            await helpDeskService.grantAdminFromTicket(
              targetTicket,
              'admin',
              targetAlias,
              targetApp,
              targetCat,
              ownWhiteId
            );
            await loadConsoleData();
          } catch (err) {
            console.warn('[useHelpDeskStation] grantAdminFromTicket error:', err);
          } finally {
            setAssigningTicket(null);
            setNewAdminIdInput('');
            setNewAdminAliasInput('');
          }
        },
      });
      return;
    }

    await helpDeskService.addAdmin(cleanId, newAdminAliasInput.trim());
    setAddAdminModalVisible(false);
    setNewAdminIdInput('');
    setNewAdminAliasInput('');
    await loadConsoleData();
  }, [
    newAdminIdInput,
    assigningTicket,
    newAdminAliasInput,
    suggestPrefixIndex,
    suggestCount,
    assignAppId,
    assignCatId,
    language,
    formatAppId,
    getCategoryLabel,
    getLabel,
    setConfirmSheet,
    ownWhiteId,
    loadConsoleData,
  ]);

  const handleSubmitAppRegistration = useCallback(async () => {
    const appName = appRegNameInput.trim() || CURRENT_APP_ID;
    const ok = await helpDeskService.requestAppRegistration(
      CURRENT_APP_ID, appName, ownWhiteId, appRegDescInput.trim()
    );
    if (ok) {
      setAppRegStatus('pending');
    }
  }, [appRegNameInput, appRegDescInput, ownWhiteId, CURRENT_APP_ID]);

  const handleDeleteAlloc = useCallback((adminWhiteId: string, appId: string, orgId?: string) => {
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.deleteAllocTitle', 'Atamayı Sil', 'Delete Allocation'),
      description: getLabel('helpdesk.deleteAllocConfirm', 'Bu yetki ataması sistemden silinecektir.', 'This allocation will be removed from the system.'),
      actionText: getLabel('common.delete', 'Sil', 'Delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.deleteAdminAlloc(adminWhiteId, appId, orgId);
        await loadConsoleData();
      },
    });
  }, [getLabel, setConfirmSheet, loadConsoleData]);

  const handleSuggestNextCount = useCallback(() => {
    setSuggestCount(prevCount => {
      const nextCount = prevCount + 1;
      const prefix = COSMIC_PREFIXES[suggestPrefixIndex % COSMIC_PREFIXES.length];
      setNewAdminAliasInput(`${prefix}-${nextCount}`);
      return nextCount;
    });
  }, [suggestPrefixIndex]);

  const handleSuggestCyclePrefix = useCallback(() => {
    setSuggestPrefixIndex(prevIdx => {
      const nextPrefixIdx = (prevIdx + 1) % COSMIC_PREFIXES.length;
      const prefix = COSMIC_PREFIXES[nextPrefixIdx];
      setNewAdminAliasInput(`${prefix}-${suggestCount}`);
      return nextPrefixIdx;
    });
  }, [suggestCount]);

  const modalAppCategories = useMemo(() => {
    if (!assignAppId || assignAppId === '*' || assignAppId === 'all') {
      return availableCategories;
    }
    const appEntry = (appsList || []).find(a => a.app_id.toLowerCase() === assignAppId.toLowerCase());
    if (appEntry && appEntry.categories && appEntry.categories.length > 0) {
      return appEntry.categories;
    }
    return availableCategories;
  }, [assignAppId, appsList, availableCategories]);

  return {
    // Settings & Logo
    tenantLogoUri,
    setTenantLogoUri,
    tenantLogoAlign,
    setTenantLogoAlign,
    allowNameEntry,
    setAllowNameEntry,
    loginIssueEnabled,
    setLoginIssueEnabled,
    handleToggleAllowNameEntry,
    handleToggleLoginIssue,
    editTenantNameInput,
    setEditTenantNameInput,
    cropModalVisible,
    setCropModalVisible,
    cropSourceImageUri,
    setCropSourceImageUri,
    handleSaveLogoAlign,
    handleSaveEnterpriseName,
    handlePickLogo,
    handleRemoveLogo,
    handlePickDocumentForCrop,
    handleConfirmCrop,
    handleLongPressLogoToCrop,

    // Custom Fields
    tenantCustomFields,
    setTenantCustomFields,
    tenantCatalog,
    setTenantCatalog,
    newCustomFieldName,
    setNewCustomFieldName,
    handleAddChip,
    handleAddCustomField,
    handleRemoveCustomField,

    // License
    licenseUpgradeHashInput,
    setLicenseUpgradeHashInput,
    handleGenerateOperatorInviteHash,
    handleGenerateOperatorAddonFile,
    handleGenerateCustomerAddonFile,
    handleUpgradeLicenseWithHash,

    // Provisioning CRUD
    newOrgInput,
    setNewOrgInput,
    handleCreateOrg,
    handleRemoveOrg,
    newAppInput,
    setNewAppInput,
    handleCreateApp,
    handleRemoveApp,
    newCatNameInput,
    setNewCatNameInput,
    handleCreateCategory,
    handleDeleteCategory,
    handleDeleteApp,
    handleDeleteOrg,
    handleToggleCategory,
    handleAddCustomOrgSubmit,
    handleAddCustomAppSubmit,
    handleAddCustomCategorySubmit,
    handleSaveAllocationSubmit,
    handleDeleteAlloc,
    handleRemoveAdmin,
    handleAddCustomAdminSubmit,
    handleSuggestNextCount,
    handleSuggestCyclePrefix,
    modalAppCategories,

    // Sub-modal states
    addAdminModalVisible,
    setAddAdminModalVisible,
    newAdminIdInput,
    setNewAdminIdInput,
    newAdminAliasInput,
    setNewAdminAliasInput,
    assigningTicket,
    setAssigningTicket,
    assignAppId,
    setAssignAppId,
    assignCatId,
    setAssignCatId,
    suggestPrefixIndex,
    setSuggestPrefixIndex,
    suggestCount,
    setSuggestCount,
    addOrgModalVisible,
    setAddOrgModalVisible,
    newOrgIdInput,
    setNewOrgIdInput,
    newOrgNameInput,
    setNewOrgNameInput,
    addAppModalVisible,
    setAddAppModalVisible,
    addCatModalVisible,
    setAddCatModalVisible,
    newCatIdInput,
    setNewCatIdInput,
    newCatTrInput,
    setNewCatTrInput,
    newCatEnInput,
    setNewCatEnInput,

    // App Registration
    appRegModalVisible,
    setAppRegModalVisible,
    appRegNameInput,
    setAppRegNameInput,
    appRegDescInput,
    setAppRegDescInput,
    appRegStatus,
    setAppRegStatus,
    handleSubmitAppRegistration,
  };
}
