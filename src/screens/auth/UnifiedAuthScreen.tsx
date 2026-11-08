import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Platform,
  Alert,
  Share,
  Image,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Shield,
  ShieldCheck,
  Building2,
  Key,
  ChevronRight,
  Lock,
  Plus,
  Trash2,
  Download,
  Copy,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  UploadCloud,
  QrCode,
  X,
  ScanLine,
} from 'lucide-react-native';
import { useTranslation } from '../../services/i18nService';
import { CryptoVaultService, KeyPairVault, GenesisBundle } from '../../services/crypto-vault.service';
import { CryptoService } from '../../services/cryptoService';
import { helpDeskService } from '../../services/helpDeskService';
import { BottomConfirmationSheet } from '../../components/BottomConfirmationSheet';

// UI State Flow Tipleri
export type AuthFlowState =
  | 'hub'                    // EKRAN 0: Birleşik Giriş Kapısı
  | 'mnemonic_login'         // EKRAN 1: 12 Sözcük ile Giriş
  | 'genesis_info'           // EKRAN 2: Kuruluş Bilgileri (Aşama 1)
  | 'genesis_customization'  // EKRAN 2B: Logo ve Özel Alanlar (İsteğe Bağlı)
  | 'genesis_ceremony'       // EKRAN 3: Kök Güvenlik Kurulumu & Sınama (Aşama 2)
  | 'genesis_success'        // EKRAN 4: Başlangıç Paketi Teslimi
  | 'emergency_recovery';    // EKRAN 5: 60 Karakterlik Kurtarma Anahtarı

interface CustomFieldItem {
  id: string;
  name: string;
  type: 'text' | 'number';
}

export default function UnifiedAuthScreen({ navigation }: any) {
  const { t } = useTranslation();

  // Durum Yönetimi
  const [currentState, setCurrentState] = useState<AuthFlowState>('hub');
  const [isProcessing, setIsProcessing] = useState(false);

  // EKRAN 1: Doğrudan Giriş
  const [loginWords, setLoginWords] = useState('');

  // EKRAN 2: Kuruluş Bilgileri
  const [tenantName, setTenantName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');

  // EKRAN 2B: Özelleştirme
  const [customFields, setCustomFields] = useState<CustomFieldItem[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [logoSelected, setLogoSelected] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);

  // EKRAN 3: Güvenlik Kurulumu
  const [vault, setVault] = useState<KeyPairVault | null>(null);
  const [challengeIndices, setChallengeIndices] = useState<[number, number]>([2, 7]); // 3. ve 8. sözcük (0-indexed: 2 ve 7)
  const [challengeInputs, setChallengeInputs] = useState<[string, string]>(['', '']);

  // EKRAN 4: Genesis Paketi
  const [genesisBundle, setGenesisBundle] = useState<GenesisBundle | null>(null);

  // EKRAN 5: Kurtarma Anahtarı
  const [recoveryHash, setRecoveryHash] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  // Bildirim Sayfası Durumu
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    description: string;
    actionText?: string;
  }>({ visible: false, title: '', description: '' });

  const showAlert = (title: string, description: string) => {
    setAlertConfig({ visible: true, title, description, actionText: t('common.ok') });
  };

  // Yeni kuruluş akışı başladığında arka planda güvenli anahtarları üret
  const prepareSecurityCeremony = async () => {
    try {
      const newVault = await CryptoVaultService.generateRootVault();
      setVault(newVault);

      // Rastgele 2 doğrulama indisi belirle (1 ile 12 arası, 0-indexed)
      const first = Math.floor(Math.random() * 6);       // 1-6 arası
      const second = Math.floor(Math.random() * 6) + 6;  // 7-12 arası
      setChallengeIndices([first, second]);
      setChallengeInputs(['', '']);
      return newVault;
    } catch (err: any) {
      console.error('[UnifiedAuth] Vault generation error:', err);
      showAlert(t('auth.ceremony.setup_error_title'), err?.message || t('auth.ceremony.setup_error_desc'));
      return null;
    }
  };

  // ---------------------------------------------------------------------------
  // EYLEM İŞLEYİCİLERİ
  // ---------------------------------------------------------------------------

  // EKRAN 1: 12 Sözcük ile Doğrudan Giriş
  const handleMnemonicLogin = async () => {
    const trimmed = loginWords.trim().toLowerCase();
    const words = trimmed.split(/\s+/);
    if (words.length !== 12) {
      showAlert(t('auth.login.title'), t('auth.login.error_word_count'));
      return;
    }
    if (!CryptoVaultService.validateMnemonic(trimmed)) {
      showAlert(t('auth.login.title'), t('auth.login.error_invalid'));
      return;
    }

    setIsProcessing(true);
    try {
      const derivedVault = await CryptoVaultService.deriveVaultFromMnemonic(trimmed);
      await CryptoService.saveIdentity({
        mnemonic: derivedVault.mnemonic,
        whiteId: derivedVault.whiteId,
      });

      // Rol ve kuruluş kontrolü
      const role = await helpDeskService.getAdminRole(derivedVault.whiteId);
      const adminEnt = await helpDeskService.getAdminEnterprise();
      const userEnt = await helpDeskService.getUserEnterprise();

      // İlgili çalışma alanına yetki parametreleri ile aktar
      navigation.replace('HelpDesk', {
        role,
        enterpriseName: adminEnt.enterpriseName || userEnt.enterpriseName || '',
        enterpriseBlindId: adminEnt.enterpriseBlindId || userEnt.enterpriseBlindId || '',
      });
    } catch (err: any) {
      showAlert(t('auth.login.title'), err?.message || t('auth.login.error_invalid'));
    } finally {
      setIsProcessing(false);
    }
  };

  // EKRAN 2: Kuruluş Bilgileri İleri
  const handleTenantGenesisStep1 = () => {
    if (!tenantName.trim() || !workspaceName.trim()) {
      showAlert(t('auth.genesis.step1_title'), t('auth.genesis.error_required'));
      return;
    }
    // EKRAN 2B'ye geç
    setCurrentState('genesis_customization');
  };

  // EKRAN 2B: Özel Alan Ekleme
  const handleAddCustomField = () => {
    if (!newFieldName.trim()) return;
    setCustomFields(prev => [
      ...prev,
      { id: `field_${Date.now()}`, name: newFieldName.trim(), type: 'text' },
    ]);
    setNewFieldName('');
  };

  // EKRAN 2B: Logo Seçme (Galeri Entegrasyonu)
  const handlePickLogo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          t('auth.customization.permission_required_title'),
          t('auth.customization.permission_required_desc')
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setLogoUri(base64Data);
        setLogoSelected(true);
      }
    } catch (err: any) {
      console.warn('ImagePicker error:', err);
      Alert.alert(t('common.error'), t('auth.customization.logo_pick_error', { error: String(err?.message || err) }));
    }
  };

  // EKRAN 2B: Kök Güvenlik Kurulumuna Geçiş (Atla veya Kaydet)
  const proceedToSecurityCeremony = async () => {
    setIsProcessing(true);
    try {
      let currentVault = vault;
      if (!currentVault) {
        currentVault = await prepareSecurityCeremony();
      }
      if (currentVault) {
        setCurrentState('genesis_ceremony');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // EKRAN 3: Doğrulama Sınaması & Çalışma Alanını Başlatma
  const handleVerifyCeremony = async () => {
    if (!vault) return;

    const words = vault.mnemonic.split(' ');
    const expectedWord1 = words[challengeIndices[0]];
    const expectedWord2 = words[challengeIndices[1]];

    const input1 = challengeInputs[0].trim().toLowerCase();
    const input2 = challengeInputs[1].trim().toLowerCase();

    if (input1 !== expectedWord1 || input2 !== expectedWord2) {
      showAlert(t('auth.ceremony.verify_title'), t('auth.ceremony.challenge_error'));
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Kimliği yerel kasaya mühürle
      await CryptoService.saveIdentity({
        mnemonic: vault.mnemonic,
        whiteId: vault.whiteId,
      });

      // 2. Neon üzerinde kuruluşu ve 14 günlük deneme anahtarlarını aç
      let entBlindId = vault.blindId;
      let tenantRes: any = null;
      try {
        tenantRes = await helpDeskService.createSelfServiceTenant(
          tenantName,
          customFields.map(f => ({ key: f.id, label: f.name, type: f.type, required: false })),
          []
        );
        if (tenantRes?.enterpriseBlindId) {
          entBlindId = tenantRes.enterpriseBlindId;
        }
      } catch (backendErr) {
        console.warn('[UnifiedAuth] Backend enterprise register warning:', backendErr);
      }

      // 3. Genesis paketini türet (1 Yönetici + 10 Kullanıcı Erişim Anahtarı)
      const bundle = CryptoVaultService.generateGenesisBundle(
        tenantName,
        workspaceName,
        entBlindId
      );
      if (tenantRes?.adminHash) {
        bundle.adminRecoveryKey = tenantRes.adminHash;
      }
      if (tenantRes?.userHash) {
        bundle.userAccessKeys = [tenantRes.userHash, ...bundle.userAccessKeys.slice(1)];
      }
      setGenesisBundle(bundle);

      // 3B. Neon DB'ye Genesis paketindeki tüm 10 kullanıcı ve 1 admin erişim anahtarlarını kaydet
      try {
        await helpDeskService.registerGenesisBundleHashes({
          enterpriseBlindId: entBlindId,
          tenantName,
          adminRecoveryKey: bundle.adminRecoveryKey,
          userAccessKeys: bundle.userAccessKeys,
        });
      } catch (dbHashErr) {
        console.warn('[UnifiedAuth] registerGenesisBundleHashes error:', dbHashErr);
      }

      // 3C. Logo seçildiyse kuruluşa kaydet
      if (logoUri) {
        try {
          await helpDeskService.setTenantLogo(entBlindId, logoUri);
        } catch (logoErr) {
          console.warn('[UnifiedAuth] setTenantLogo warning:', logoErr);
        }
      }

      // 4. Cihazı bu kuruluşun Global Yöneticisi (WhiteCosmos) olarak mühürle
      await helpDeskService.bindGlobalAdminLocally({
        ownWhiteId: vault.whiteId,
        enterpriseBlindId: entBlindId,
        enterpriseName: tenantName,
        alias: 'WhiteCosmos',
      });

      // EKRAN 4'e geç
      setCurrentState('genesis_success');
    } catch (err: any) {
      showAlert(t('common.error'), err?.message || t('auth.genesis.create_error_desc'));
    } finally {
      setIsProcessing(false);
    }
  };

  // EKRAN 4: Başlangıç Paketini İndir / Paylaş
  const handleDownloadBundle = async () => {
    if (!genesisBundle) return;
    const text = CryptoVaultService.formatGenesisBundleText(genesisBundle);
    try {
      await Share.share({
        title: t('auth.genesis_success.share_title', { tenantName: genesisBundle.tenantName }),
        message: text,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  // EKRAN 4: Anahtarları Panoya Kopyala
  const handleCopyBundleKeys = async () => {
    if (!genesisBundle) return;
    const text = CryptoVaultService.formatGenesisBundleText(genesisBundle);
    await Clipboard.setStringAsync(text);
    showAlert(t('common.success'), t('auth.genesis_success.keys_copied_desc'));
  };

  // EKRAN 5: Erişim Anahtarı ile Giriş (Otomatik Yetki Çözümleme)
  const handleEmergencyRecovery = async (overrideKey?: string) => {
    const rawKey = typeof overrideKey === 'string' ? overrideKey : recoveryHash;
    const trimmed = rawKey.trim();
    if (!CryptoVaultService.validateAccessKeyFormat(trimmed)) {
      showAlert(t('auth.recovery.invalid_key_title'), t('auth.recovery.error_invalid_key'));
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Cihazda kimlik var mı kontrol et, yoksa kök kimlik oluştur
      let currentWhiteId = await CryptoService.getWhiteId();
      if (!currentWhiteId) {
        const newVault = await CryptoVaultService.generateRootVault();
        await CryptoService.saveIdentity({
          mnemonic: newVault.mnemonic,
          whiteId: newVault.whiteId,
        });
        currentWhiteId = newVault.whiteId;
      }

      // 2. Birleşik Erişim Anahtarı Çözümleme Motorunu çağır
      const result = await helpDeskService.claimUnifiedHash(currentWhiteId, trimmed);

      if (result && result.success) {
        navigation.replace('HelpDesk', {
          role: result.role,
          enterpriseName: result.enterpriseName,
          enterpriseBlindId: result.enterpriseBlindId,
        });
      } else {
        showAlert(t('auth.recovery.login_failed_title'), result?.message || t('auth.recovery.login_failed_desc'));
      }
    } catch (err: any) {
      showAlert(t('common.error'), err?.message || t('auth.recovery.login_exception_desc'));
    } finally {
      setIsProcessing(false);
    }
  };

  // EKRAN 5: QR Tarayıcı Açma ve Barkod İşleme
  const handleOpenQrScanner = async () => {
    if (!cameraPermission?.granted) {
      const permissionResponse = await requestCameraPermission();
      if (!permissionResponse.granted) {
        showAlert(t('scanner.permission_required_title'), t('auth.recovery.camera_permission_desc'));
        return;
      }
    }
    setIsScannerModalOpen(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!data) return;
    setIsScannerModalOpen(false);
    const cleaned = data.trim();
    setRecoveryHash(cleaned);
    void handleEmergencyRecovery(cleaned);
  };

  // ---------------------------------------------------------------------------
  // GÖRÜNÜM BİLEŞENLERİ
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.cardWrapper}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ================================================================= */}
          {/* EKRAN 0: BİRLEŞİK GİRİŞ KAPISI (AuthHub)                         */}
          {/* ================================================================= */}
          {currentState === 'hub' && (
            <View style={styles.hubContainer}>
              {/* WhiteDesk: Doğrudan Zeminde, %50 Büyük (66px), Açık Gri, Leverage Gölgeli */}
              <Text style={styles.whiteOnWhiteLogoText}>WhiteDesk</Text>

              <Text style={styles.heroSubtitle}>
                {t('auth.hub.hero_subtitle')}
              </Text>

              <View style={styles.actionGroupHub}>
                {/* 1. Seçenek: Çalışma alanına giriş yap */}
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={() => setCurrentState('mnemonic_login')}
                  activeOpacity={0.8}
                >
                  <Key size={20} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 10 }} />
                  <Text style={styles.primaryActionButtonText}>
                    {t('auth.hub.login_workspace_btn')}
                  </Text>
                </TouchableOpacity>

                {/* 2. Seçenek: Yeni çalışma alanı oluştur */}
                <TouchableOpacity
                  style={styles.secondaryActionButton}
                  onPress={() => setCurrentState('genesis_info')}
                  activeOpacity={0.8}
                >
                  <Building2 size={20} color="#2563EB" strokeWidth={2.2} style={{ marginRight: 10 }} />
                  <Text style={styles.secondaryActionButtonText}>
                    {t('auth.hub.create_workspace_btn')}
                  </Text>
                </TouchableOpacity>

                {/* 3. Seçenek: Kod ile Giriş */}
                <TouchableOpacity
                  style={[styles.secondaryActionButton, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}
                  onPress={() => setCurrentState('emergency_recovery')}
                  activeOpacity={0.8}
                >
                  <ShieldCheck size={20} color="#475569" strokeWidth={2.2} style={{ marginRight: 10 }} />
                  <Text style={[styles.secondaryActionButtonText, { color: '#334155' }]}>
                    {t('auth.hub.code_login_btn')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================================================================= */}
          {/* EKRAN 1: 12 SÖZCÜK İLE DOĞRUDAN GİRİŞ (MnemonicLogin)            */}
          {/* ================================================================= */}
          {currentState === 'mnemonic_login' && (
            <View style={styles.sectionContainer}>
              <Text style={styles.screenTitle}>{t('auth.login.title')}</Text>
              <Text style={styles.screenSubtitle}>{t('auth.login.subtitle')}</Text>

              <TextInput
                style={styles.mnemonicTextArea}
                placeholder={t('auth.login.input_placeholder')}
                placeholderTextColor="#94A3B8"
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                value={loginWords}
                onChangeText={setLoginWords}
              />

              <TouchableOpacity
                style={[styles.primaryActionButton, isProcessing && styles.buttonDisabled]}
                onPress={handleMnemonicLogin}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionButtonText}>
                  {isProcessing ? t('auth.login.verifying') : t('auth.login.action_btn')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => setCurrentState('hub')}
                activeOpacity={0.7}
              >
                <Text style={styles.backLinkText}>← {t('auth.login.back_btn')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================================================================= */}
          {/* EKRAN 2: KURULUŞ BİLGİLERİ (TenantGenesis - Aşama 1)              */}
          {/* ================================================================= */}
          {currentState === 'genesis_info' && (
            <View style={styles.sectionContainer}>
              <Text style={styles.screenTitle}>{t('auth.genesis.step1_title')}</Text>
              <Text style={styles.screenSubtitle}>{t('auth.genesis.step1_subtitle')}</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('auth.genesis.tenant_name_label')}</Text>
                <TextInput
                  style={styles.singleLineInput}
                  placeholder={t('auth.genesis.tenant_name_placeholder')}
                  placeholderTextColor="#94A3B8"
                  value={tenantName}
                  onChangeText={setTenantName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('auth.genesis.workspace_name_label')}</Text>
                <TextInput
                  style={styles.singleLineInput}
                  placeholder={t('auth.genesis.workspace_name_placeholder')}
                  placeholderTextColor="#94A3B8"
                  value={workspaceName}
                  onChangeText={setWorkspaceName}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={handleTenantGenesisStep1}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionButtonText}>{t('auth.genesis.next_btn')}</Text>
                <ChevronRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => setCurrentState('hub')}
                activeOpacity={0.7}
              >
                <Text style={styles.backLinkText}>← {t('auth.genesis.back_btn')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================================================================= */}
          {/* EKRAN 2B: KURULUŞ ÖZELLEŞTİRME VE ÖZEL ALANLAR (TenantCustomization) */}
          {/* ================================================================= */}
          {currentState === 'genesis_customization' && (
            <View style={styles.sectionContainer}>
              <View style={styles.headerWithAction}>
                <Text style={[styles.screenTitle, { flex: 1 }]}>{t('auth.customization.title')}</Text>
                {/* Sağ Üst Hızlı Geçiş Bağlantısı */}
                <TouchableOpacity onPress={proceedToSecurityCeremony} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.headerSkipLink}>{t('auth.customization.skip_header_link')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.screenSubtitle}>{t('auth.customization.subtitle')}</Text>

              {/* Logo Bölümü */}
              <View style={styles.customSectionBox}>
                <Text style={styles.sectionMiniTitle}>{t('auth.customization.logo_section.title')}</Text>
                <TouchableOpacity
                  style={styles.logoDropzone}
                  onPress={handlePickLogo}
                  activeOpacity={0.8}
                >
                  {logoUri ? (
                    <View style={{ alignItems: 'center' }}>
                      <Image
                        source={{ uri: logoUri }}
                        style={{ width: 68, height: 68, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#BFDBFE' }}
                        resizeMode="cover"
                      />
                      <Text style={[styles.dropzoneText, { color: '#2563EB', fontWeight: '700' }]}>
                        {t('auth.customization.logo_section.selected_success')}
                      </Text>
                      <Text style={styles.dropzoneHint}>{t('auth.customization.logo_section.tap_to_change')}</Text>
                      <TouchableOpacity
                        style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#FEE2E2', borderRadius: 8 }}
                        onPress={(e) => {
                          e.stopPropagation();
                          setLogoUri(null);
                          setLogoSelected(false);
                        }}
                      >
                        <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '600' }}>{t('auth.customization.logo_section.remove_logo')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <UploadCloud size={28} color="#2563EB" />
                      <Text style={styles.dropzoneText}>
                        {t('auth.customization.logo_section.dropzone_text')}
                      </Text>
                      <Text style={styles.dropzoneHint}>{t('auth.customization.logo_section.format_hint')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Özel Alanlar Bölümü */}
              <View style={styles.customSectionBox}>
                <Text style={styles.sectionMiniTitle}>{t('auth.customization.fields_section.title')}</Text>
                <Text style={styles.sectionMiniDesc}>{t('auth.customization.fields_section.description')}</Text>

                <View style={styles.addFieldRow}>
                  <TextInput
                    style={[styles.singleLineInput, { flex: 1, marginBottom: 0 }]}
                    placeholder={t('auth.customization.fields_section.placeholder_example')}
                    placeholderTextColor="#94A3B8"
                    value={newFieldName}
                    onChangeText={setNewFieldName}
                  />
                  <TouchableOpacity
                    style={styles.addFieldButton}
                    onPress={handleAddCustomField}
                    activeOpacity={0.8}
                  >
                    <Plus size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Eklenen Alanların Listesi */}
                {customFields.length > 0 ? (
                  <View style={styles.fieldsList}>
                    {customFields.map((field) => (
                      <View key={field.id} style={styles.fieldBadgeRow}>
                        <Text style={styles.fieldBadgeName}>{field.name}</Text>
                        <TouchableOpacity
                          onPress={() => setCustomFields(prev => prev.filter(f => f.id !== field.id))}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyStateNotice}>
                    {t('auth.customization.fields_section.empty_state')}
                  </Text>
                )}
              </View>

              {/* Bilgi Rozeti */}
              <View style={styles.infoPillNotice}>
                <Text style={styles.infoPillNoticeText}>
                  {t('auth.customization.defer_notice')}
                </Text>
              </View>

              {/* Aksiyon Hiyerarşisi */}
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={proceedToSecurityCeremony}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionButtonText}>{t('auth.customization.save_button')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.neutralSkipButton}
                onPress={proceedToSecurityCeremony}
                activeOpacity={0.8}
              >
                <Text style={styles.neutralSkipButtonText}>{t('auth.customization.skip_button')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================================================================= */}
          {/* EKRAN 3: KÖK GÜVENLİK KURULUMU (SecurityCeremony - Aşama 2)        */}
          {/* ================================================================= */}
          {currentState === 'genesis_ceremony' && !vault && (
            <View style={[styles.sectionContainer, { alignItems: 'center', paddingVertical: 40 }]}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={[styles.screenSubtitle, { marginTop: 16, textAlign: 'center' }]}>
                {t('auth.ceremony.preparing_keys')}
              </Text>
              <TouchableOpacity
                style={[styles.primaryActionButton, { marginTop: 24, width: '100%' }]}
                onPress={prepareSecurityCeremony}
              >
                <Text style={styles.primaryActionButtonText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {currentState === 'genesis_ceremony' && vault && (
            <View style={styles.sectionContainer}>
              <Text style={styles.screenTitle}>{t('auth.ceremony.title')}</Text>
              <Text style={styles.screenSubtitle}>{t('auth.ceremony.subtitle')}</Text>

              {/* 12 Sözcük Panosu */}
              <View style={styles.seedGridContainer}>
                {vault.mnemonic.split(' ').map((word, idx) => (
                  <View key={idx} style={styles.seedWordBadge}>
                    <Text style={styles.seedWordIndex}>{String(idx + 1).padStart(2, '0')}</Text>
                    <Text style={styles.seedWordText}>{word}</Text>
                  </View>
                ))}
              </View>

              {/* Panoya Kopyala */}
              <TouchableOpacity
                style={styles.copyMnemonicButton}
                onPress={async () => {
                  await Clipboard.setStringAsync(vault.mnemonic);
                  showAlert(t('common.info'), t('auth.ceremony.copied'));
                }}
                activeOpacity={0.8}
              >
                <Copy size={16} color="#2563EB" style={{ marginRight: 6 }} />
                <Text style={styles.copyMnemonicButtonText}>{t('auth.ceremony.copy')}</Text>
              </TouchableOpacity>

              {/* Güvenlik Uyarısı */}
              <View style={styles.securityWarningCard}>
                <Shield size={18} color="#475569" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.securityWarningText}>{t('auth.ceremony.warning')}</Text>
              </View>

              {/* Doğrulama Sınaması (Challenge) */}
              <View style={styles.challengeBox}>
                <Text style={styles.challengeTitle}>{t('auth.ceremony.verify_title')}</Text>
                <Text style={styles.challengeSubtitle}>{t('auth.ceremony.verify_subtitle')}</Text>

                <View style={styles.challengeInputRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.challengeInputLabel}>
                      {challengeIndices[0] + 1}{t('auth.ceremony.verify_prompt')}
                    </Text>
                    <TextInput
                      style={styles.singleLineInput}
                      placeholder={t('auth.ceremony.word_placeholder')}
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={challengeInputs[0]}
                      onChangeText={v => setChallengeInputs([v, challengeInputs[1]])}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.challengeInputLabel}>
                      {challengeIndices[1] + 1}{t('auth.ceremony.verify_prompt')}
                    </Text>
                    <TextInput
                      style={styles.singleLineInput}
                      placeholder={t('auth.ceremony.word_placeholder')}
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={challengeInputs[1]}
                      onChangeText={v => setChallengeInputs([challengeInputs[0], v])}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionButton, isProcessing && styles.buttonDisabled]}
                onPress={handleVerifyCeremony}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionButtonText}>
                  {isProcessing ? t('auth.ceremony.setting_up') : t('auth.ceremony.verify_action')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================================================================= */}
          {/* EKRAN 4: KURULUM BİTİŞİ VE GENESIS ANAHTAR DAĞITIMI (GenesisSuccess) */}
          {/* ================================================================= */}
          {currentState === 'genesis_success' && genesisBundle && (
            <View style={styles.sectionContainer}>
              <View style={styles.successBadgeCircle}>
                <CheckCircle2 size={36} color="#2563EB" strokeWidth={2} />
              </View>

              <Text style={styles.screenTitle}>{t('auth.genesis_success.ready_title')}</Text>
              <Text style={styles.screenSubtitle}>{t('auth.genesis_success.ready_subtitle')}</Text>

              {/* Deneme Sürümü ve Anahtar Bilgi Kartı */}
              <View style={styles.trialInfoCard}>
                <View style={styles.trialBadgeHeader}>
                  <Text style={styles.trialBadgeHeaderText}>{t('auth.genesis_success.trial_badge')}</Text>
                </View>
                <Text style={styles.trialBodyText}>
                  {t('auth.genesis_success.trial_body')}
                </Text>

                <View style={styles.bundleKeySummary}>
                  <Text style={styles.bundleKeyItem}>{t('auth.genesis_success.bundle_admin_key_item', { keyPrefix: genesisBundle.adminRecoveryKey.substring(0, 16) })}</Text>
                  <Text style={styles.bundleKeyItem}>{t('auth.genesis_success.bundle_user_keys_item')}</Text>
                </View>
              </View>

              {/* Aksiyon Düğmeleri */}
              <TouchableOpacity
                style={styles.downloadActionButton}
                onPress={handleDownloadBundle}
                activeOpacity={0.8}
              >
                <Download size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.downloadActionButtonText}>{t('auth.genesis_success.download_share_btn')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.copyActionButton}
                onPress={handleCopyBundleKeys}
                activeOpacity={0.8}
              >
                <Copy size={18} color="#2563EB" style={{ marginRight: 8 }} />
                <Text style={styles.copyActionButtonText}>{t('auth.genesis_success.copy_all_keys_btn')}</Text>
              </TouchableOpacity>

              {/* Tek Seferlik Uyarı Rozeti */}
              <View style={styles.oneTimeNoticeCard}>
                <ShieldCheck size={16} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.oneTimeNoticeText}>
                  {t('auth.genesis_success.one_time_notice')}
                </Text>
              </View>

              {/* Yönetici Paneline Geçiş */}
              <TouchableOpacity
                style={[styles.primaryActionButton, { marginTop: 16 }]}
                onPress={() => navigation.replace('HelpDesk', {
                  role: 'global_admin',
                  enterpriseName: tenantName,
                  enterpriseBlindId: genesisBundle?.founderBlindId,
                })}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionButtonText}>{t('auth.genesis_success.enter_admin_desk_btn')}</Text>
                <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}

          {/* ================================================================= */}
          {/* EKRAN 5: ERİŞİM ANAHTARI İLE GİRİŞ (AccessKeyLogin)              */}
          {/* ================================================================= */}
          {currentState === 'emergency_recovery' && (
            <View style={styles.sectionContainer}>
              <Text style={styles.screenTitle}>{t('auth.recovery.code_login_title')}</Text>
              <Text style={styles.screenSubtitle}>
                {t('auth.recovery.code_login_subtitle')}
              </Text>

              <View style={styles.fieldGroup}>
                <View style={styles.inputWithScannerWrapper}>
                  <TextInput
                    style={[styles.singleLineInput, styles.monospaceInput, styles.inputWithScannerField]}
                    placeholder={t('auth.recovery.code_input_placeholder')}
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={128}
                    value={recoveryHash}
                    onChangeText={setRecoveryHash}
                  />
                  <TouchableOpacity
                    style={styles.qrScannerTriggerBtn}
                    onPress={handleOpenQrScanner}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <QrCode size={20} color="#2563EB" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.charCountText}>
                  {t('auth.recovery.char_count', { count: recoveryHash.trim().length })}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionButton, isProcessing && styles.buttonDisabled]}
                onPress={() => handleEmergencyRecovery()}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionButtonText}>
                  {isProcessing ? t('auth.recovery.verifying_auth') : t('auth.recovery.code_login_title')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => setCurrentState('hub')}
                activeOpacity={0.7}
              >
                <Text style={styles.backLinkText}>← {t('auth.recovery.back_btn')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>

      <BottomConfirmationSheet
        visible={alertConfig.visible}
        title={alertConfig.title}
        description={alertConfig.description}
        actionText={alertConfig.actionText || t('common.ok')}
        onAction={() => setAlertConfig(p => ({ ...p, visible: false }))}
      />

      {/* QR Kod Kamera Tarayıcı Modalı */}
      <Modal
        visible={isScannerModalOpen}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setIsScannerModalOpen(false)}
      >
        <View style={styles.scannerModalRoot}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />

          <SafeAreaView style={styles.scannerModalOverlay}>
            <View style={styles.scannerModalHeader}>
              <TouchableOpacity
                onPress={() => setIsScannerModalOpen(false)}
                style={styles.scannerModalCloseBtn}
                activeOpacity={0.7}
              >
                <X size={20} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>
              <Text style={styles.scannerModalTitle}>{t('auth.recovery.scanner_modal_title')}</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.scannerReticleContainer}>
              <View style={styles.scannerReticleBox}>
                <View style={[styles.scannerCorner, styles.sCornerTL]} />
                <View style={[styles.scannerCorner, styles.sCornerTR]} />
                <View style={[styles.scannerCorner, styles.sCornerBL]} />
                <View style={[styles.scannerCorner, styles.sCornerBR]} />
              </View>
              <Text style={styles.scannerHelperText}>
                {t('auth.recovery.scanner_helper_text')}
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

// -----------------------------------------------------------------------------
// STİLLER (Microsoft TR-TR Standard Kurumsal Tasarım)
// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 20),
  },
  cardWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: { flex: 1 },
  scrollContent: { 
    paddingHorizontal: 24, 
    paddingTop: 20, 
    paddingBottom: 48,
    minHeight: '100%',
    justifyContent: 'center',
  },

  sectionContainer: {
    width: '100%',
  },

  // EKRAN 0 (Hub)
  hubContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  whiteOnWhiteLogoText: {
    fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    fontSize: 66,
    fontWeight: '900',
    color: '#FFFFFF', // Saf Beyaz
    letterSpacing: -2.2,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
    // Saf beyazı beyaz zeminden havaya kaldıran güçlü leverage gölgesi
    textShadowColor: 'rgba(15, 23, 42, 0.45)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 16,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  actionGroupHub: {
    width: '100%',
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  secondaryActionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: -0.2,
  },
  safetyLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  safetyLinkText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },

  // Ortak Başlıklar
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 24,
  },
  headerWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerSkipLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    paddingLeft: 8,
  },

  // Giriş Alanları
  mnemonicTextArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  singleLineInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 16,
  },
  monospaceInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  charCountText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: -10,
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  // EKRAN 2B (Özelleştirme)
  customSectionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  sectionMiniTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionMiniDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  logoDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  dropzoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  dropzoneHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  addFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addFieldButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  fieldsList: {
    marginTop: 12,
  },
  fieldBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  fieldBadgeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  emptyStateNotice: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 8,
  },
  infoPillNotice: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  infoPillNoticeText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  neutralSkipButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  neutralSkipButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  // EKRAN 3 (Ceremony)
  seedGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  seedWordBadge: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  seedWordIndex: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginRight: 4,
  },
  seedWordText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  copyMnemonicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 12,
  },
  copyMnemonicButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  securityWarningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  securityWarningText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
  challengeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  challengeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  challengeSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  challengeInputRow: {
    flexDirection: 'row',
  },
  challengeInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },

  // EKRAN 4 (GenesisSuccess)
  successBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  trialInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  trialBadgeHeader: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  trialBadgeHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
    letterSpacing: 0.3,
  },
  trialBodyText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginBottom: 12,
  },
  bundleKeySummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bundleKeyItem: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#475569',
    marginBottom: 4,
  },
  downloadActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 15,
    marginBottom: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  downloadActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  copyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 12,
  },
  copyActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  oneTimeNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  oneTimeNoticeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    lineHeight: 16,
    flex: 1,
  },
  // QR Kod Tarayıcı Alan Stilleri
  inputWithScannerWrapper: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 16,
  },
  inputWithScannerField: {
    marginBottom: 0,
    paddingRight: 52,
  },
  qrScannerTriggerBtn: {
    position: 'absolute',
    right: 8,
    top: 7,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  scannerModalRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerModalOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scannerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 16,
  },
  scannerModalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  scannerReticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  scannerReticleBox: {
    width: 250,
    height: 250,
    position: 'relative',
    marginBottom: 24,
  },
  scannerCorner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#2563EB',
  },
  sCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  sCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  sCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  sCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  scannerHelperText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    paddingHorizontal: 36,
    lineHeight: 18,
    fontWeight: '500',
  },
});
