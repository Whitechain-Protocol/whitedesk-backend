import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Share,
  Alert,
  TextInput,
} from 'react-native';
import {
  X,
  User,
  Camera,
  Eye,
  EyeOff,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  Crown,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Sharing from 'expo-sharing';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { SafeSecureStore } from '../../../../services/storageService';
import { helpDeskService } from '../../../../services/helpDeskService';

export interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  ownWhiteId: string;
  customAlias: string | null;
  onSaveCustomAlias?: (newAlias: string) => void;
  isAdmin: boolean;
  adminRole: 'founder' | 'global_admin' | 'admin' | 'none';
  isMasterAdmin: boolean;
  isFounder: boolean;
  tenantStats?: { adminCount: number; userCount: number };
  currentEnterpriseName?: string;
  language?: 'tr' | 'en';
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
  ownWhiteId,
  customAlias,
  onSaveCustomAlias,
  isAdmin,
  adminRole,
  isMasterAdmin,
  isFounder,
  currentEnterpriseName,
  language = 'tr',
}) => {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [identityCode, setIdentityCode] = useState<string>(ownWhiteId);
  const [isHashRevealed, setIsHashRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isQrShareModalVisible, setIsQrShareModalVisible] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState<string>(customAlias || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const shareQrRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setProfileNameInput(customAlias || '');
    }
  }, [visible, customAlias]);

  const isValidTwoWordName = (name: string): boolean => {
    if (!name) return false;
    const cleaned = name.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()0-9]/g, '');
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2);
    return words.length >= 2;
  };

  const handleSaveProfileName = async () => {
    const trimmed = profileNameInput.trim();
    if (!isValidTwoWordName(trimmed)) {
      Alert.alert(
        language === 'tr' ? 'Geçersiz İsim' : 'Invalid Name',
        language === 'tr'
          ? 'Lütfen en az iki kelimeden oluşan geçerli bir ad ve soyad giriniz (Örn: Ahmet Yılmaz).'
          : 'Please enter at least two words.'
      );
      return;
    }
    setIsSavingName(true);
    try {
      await helpDeskService.setCustomAlias(ownWhiteId, trimmed, isAdmin);
      onSaveCustomAlias?.(trimmed);
      Alert.alert(
        language === 'tr' ? 'Başarılı' : 'Success',
        language === 'tr' ? 'Adınız ve soyadınız başarıyla kaydedildi.' : 'Your name has been updated.'
      );
    } catch (err: any) {
      Alert.alert(language === 'tr' ? 'Hata' : 'Error', err?.message || 'Kaydedilemedi');
    } finally {
      setIsSavingName(false);
    }
  };

  const effectiveRole: 'founder' | 'global_admin' | 'admin' | 'user' =
    isFounder || adminRole === 'founder'
      ? 'founder'
      : isMasterAdmin || adminRole === 'global_admin'
      ? 'global_admin'
      : isAdmin || adminRole === 'admin'
      ? 'admin'
      : 'user';

  // Load avatar and identity code from local storage
  useEffect(() => {
    if (visible) {
      setIsHashRevealed(false);
      setIsQrShareModalVisible(false);
      void (async () => {
        try {
          const savedAvatar = await SafeSecureStore.getItemAsync('whitedesk_profile_avatar');
          if (savedAvatar) {
            setAvatarUri(savedAvatar);
          }

          // 1. Fetch or create Sovereign Profile Passkey (wd_prof_...)
          const passkey = await helpDeskService.getOrCreateProfilePasskey({
            ownWhiteId,
            role: effectiveRole,
            tenantName: currentEnterpriseName,
          });

          if (passkey) {
            setIdentityCode(passkey);
          } else {
            const savedCode = await SafeSecureStore.getItemAsync('whitedesk_identity_code');
            if (savedCode) {
              setIdentityCode(savedCode);
            } else if (ownWhiteId) {
              setIdentityCode(ownWhiteId);
            }
          }
        } catch (e) {
          console.warn('[ProfileModal] init passkey error:', e);
          if (ownWhiteId) setIdentityCode(ownWhiteId);
        }
      })();
    }
  }, [visible, ownWhiteId, effectiveRole, currentEnterpriseName]);

  // Handle pick avatar
  const handlePickAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const uri = res.assets[0].uri;
        setAvatarUri(uri);
        await SafeSecureStore.setItemAsync('whitedesk_profile_avatar', uri);
      }
    } catch (e) {
      console.warn('[ProfileModal] Pick avatar error:', e);
    }
  };

  // Determine Role Title and Badge Style
  const getRoleInfo = () => {
    if (isFounder || adminRole === 'founder') {
      return {
        title: language === 'tr' ? 'Kurucu' : 'Founder',
        badgeBg: '#FEF3C7',
        badgeBorder: '#FDE68A',
        badgeColor: '#B45309',
        icon: Crown,
      };
    }
    if (isMasterAdmin || adminRole === 'global_admin') {
      return {
        title: language === 'tr' ? 'Küresel Yönetici' : 'Global Admin',
        badgeBg: '#EEF2FF',
        badgeBorder: '#C7D2FE',
        badgeColor: '#4338CA',
        icon: ShieldCheck,
      };
    }
    if (isAdmin || adminRole === 'admin') {
      return {
        title: language === 'tr' ? 'Yönetici' : 'Admin',
        badgeBg: '#EFF6FF',
        badgeBorder: '#BFDBFE',
        badgeColor: '#1D4ED8',
        icon: ShieldCheck,
      };
    }
    return {
      title: language === 'tr' ? 'Kullanıcı' : 'User',
      badgeBg: '#F1F5F9',
      badgeBorder: '#E2E8F0',
      badgeColor: '#475569',
      icon: User,
    };
  };

  const roleInfo = getRoleInfo();
  const RoleIcon = roleInfo.icon;

  // Toggle Hash Reveal with Biometric Authentication
  const handleToggleHashReveal = async () => {
    if (isHashRevealed) {
      setIsHashRevealed(false);
      return;
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage:
            language === 'tr'
              ? 'Bağlantı Hash Kodunu Görüntüleyin'
              : 'Authenticate to View Connection Hash',
          cancelLabel: language === 'tr' ? 'Vazgeç' : 'Cancel',
          fallbackLabel: language === 'tr' ? 'PIN Kullan' : 'Use PIN',
        });

        if (result.success) {
          setIsHashRevealed(true);
        } else {
          Alert.alert(
            language === 'tr' ? 'Doğrulama Başarısız' : 'Authentication Failed',
            language === 'tr'
              ? 'Kimlik doğrulanamadığı için hash kodu gizli tutuldu.'
              : 'Identity could not be verified; hash remains hidden.'
          );
        }
      } else {
        // Fallback for devices without biometric enrollment
        setIsHashRevealed(true);
      }
    } catch (e) {
      console.warn('[ProfileModal] Biometric auth error:', e);
      setIsHashRevealed(true);
    }
  };

  // Export / Share Connection Hash as PNG Image or Document
  const handleExportShare = async () => {
    const codeToExport = identityCode || ownWhiteId;
    if (!codeToExport) return;

    try {
      if (shareQrRef.current && typeof shareQrRef.current.toDataURL === 'function') {
        shareQrRef.current.toDataURL(async (base64Data: string) => {
          try {
            const cleanTenant = (currentEnterpriseName || 'Kurum').replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `WhiteDesk_${cleanTenant}_${effectiveRole}_QR.png`;
            const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;

            // Clean any data: prefix if present
            const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
            await ReactNativeBlobUtil.fs.writeFile(filePath, cleanBase64, 'base64');

            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(filePath, {
                mimeType: 'image/png',
                dialogTitle: `WhiteDesk ${currentEnterpriseName || ''} QR Kimlik Kartı`,
                UTI: 'public.png',
              });
              return;
            }
          } catch (fileErr) {
            console.warn('[ProfileModal] File share error, fallback to text:', fileErr);
          }

          // Fallback if file share is unavailable
          await Share.share({
            title: `WhiteDesk ${currentEnterpriseName || ''} Kimlik Kodu`,
            message: `admin ${codeToExport}`,
          });
        });
      } else {
        // Fallback to text share
        await Share.share({
          title: `WhiteDesk ${currentEnterpriseName || ''} Kimlik Kodu`,
          message: `admin ${codeToExport}`,
        });
      }
    } catch {
      await Clipboard.setStringAsync(codeToExport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Copy revealed hash
  const handleCopyHash = async () => {
    const codeToCopy = identityCode || ownWhiteId;
    if (!codeToCopy) return;
    await Clipboard.setStringAsync(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeToShow = identityCode || ownWhiteId;
  const maskedHash = codeToShow
    ? `${codeToShow.slice(0, 4)}-${'•'.repeat(Math.max(12, Math.min(24, codeToShow.length - 8)))}-${codeToShow.slice(-4)}`
    : 'wh-••••••••••••••••';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {language === 'tr' ? 'Profil' : 'Profile'}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* 1. PROFİL RESMİ ALANI */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <User size={46} color="#94A3B8" strokeWidth={1.8} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.avatarEditBadge}
                  onPress={handlePickAvatar}
                  activeOpacity={0.8}
                >
                  <Camera size={13} color="#FFFFFF" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              {/* Kullanıcı İsmi / Rumuz */}
              <Text style={styles.displayNameText}>
                {customAlias || (language === 'tr' ? 'Anonim Kullanıcı' : 'Anonymous User')}
              </Text>

              {/* 2. ÜNVAN / ROL ROZETİ */}
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: roleInfo.badgeBg, borderColor: roleInfo.badgeBorder },
                ]}
              >
                <RoleIcon size={13} color={roleInfo.badgeColor} strokeWidth={2.2} style={{ marginRight: 5 }} />
                <Text style={[styles.roleBadgeText, { color: roleInfo.badgeColor }]}>
                  {roleInfo.title}
                </Text>
              </View>

              {currentEnterpriseName ? (
                <Text style={styles.enterpriseSubText}>{currentEnterpriseName}</Text>
              ) : null}

              {/* Ad Soyad Girişi (Tenant Adının Altında) */}
              <View style={styles.nameEditBox}>
                <View style={styles.nameInputWrapper}>
                  <TextInput
                    style={styles.nameInputField}
                    value={profileNameInput}
                    onChangeText={setProfileNameInput}
                    placeholder={language === 'tr' ? 'Ad Soyad (En az 2 kelime)' : 'Full Name (Min 2 words)'}
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                  />
                  {profileNameInput.trim() !== (customAlias || '').trim() && (
                    <TouchableOpacity
                      style={[
                        styles.nameSaveBtn,
                        !isValidTwoWordName(profileNameInput) && { backgroundColor: '#CBD5E1' },
                      ]}
                      onPress={handleSaveProfileName}
                      disabled={!isValidTwoWordName(profileNameInput) || isSavingName}
                      activeOpacity={0.7}
                    >
                      <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  )}
                </View>
                {!isValidTwoWordName(profileNameInput) && profileNameInput.trim().length > 0 && (
                  <Text style={styles.nameValidationHint}>
                    {language === 'tr' ? 'En az iki kelime ad ve soyad giriniz.' : 'Please enter at least two words.'}
                  </Text>
                )}
              </View>
            </View>

            {/* 3. BAĞLANTI HASH KODUNA AİT QR KODU */}
            <View style={styles.qrCardContainer}>
              <View style={styles.qrWrapper}>
                {codeToShow ? (
                  <QRCode
                    value={codeToShow}
                    size={144}
                    color="#0F172A"
                    backgroundColor="#FFFFFF"
                  />
                ) : (
                  <View style={{ width: 144, height: 144, backgroundColor: '#F8FAFC' }} />
                )}
              </View>

              {/* Maskelenmiş Hash Kodu & Göz Butonu */}
              <View style={styles.hashRow}>
                <Text style={styles.hashText} numberOfLines={1}>
                  {isHashRevealed ? codeToShow : maskedHash}
                </Text>
                <TouchableOpacity
                  style={styles.hashActionBtn}
                  onPress={handleToggleHashReveal}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {isHashRevealed ? (
                    <EyeOff size={16} color="#2563EB" strokeWidth={2} />
                  ) : (
                    <Eye size={16} color="#64748B" strokeWidth={2} />
                  )}
                </TouchableOpacity>
                {isHashRevealed && (
                  <TouchableOpacity
                    style={[styles.hashActionBtn, { marginLeft: 4 }]}
                    onPress={handleCopyHash}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {copied ? (
                      <Check size={16} color="#16A34A" strokeWidth={2.2} />
                    ) : (
                      <Copy size={16} color="#64748B" strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* 4. DIŞA AKTARMA LİNKİ */}
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => setIsQrShareModalVisible(true)}
                activeOpacity={0.7}
              >
                <Share2 size={14} color="#2563EB" strokeWidth={2} style={{ marginRight: 6 }} />
                <Text style={styles.exportButtonText}>
                  {language === 'tr' ? 'Kimliği dışarı aktar' : 'Export ID'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* QR & HASH PAYLAŞIM / DIŞA AKTARMA MODALI */}
      <Modal
        visible={isQrShareModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsQrShareModalVisible(false)}
      >
        <View style={styles.shareOverlay}>
          <View style={styles.shareCard}>
            <View style={styles.shareHeader}>
              <Text style={styles.shareTitle}>
                {language === 'tr' ? 'Giriş Kimliği QR Kodu' : 'Login Identity QR'}
              </Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setIsQrShareModalVisible(false)}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.shareQrContainer}>
              {codeToShow ? (
                <QRCode
                  getRef={(ref) => (shareQrRef.current = ref)}
                  value={codeToShow}
                  size={210}
                  color="#0F172A"
                  backgroundColor="#FFFFFF"
                />
              ) : null}
            </View>

            {/* Kod Metin Kutusu (QR Altında) */}
            <View style={styles.shareCodeBox}>
              <Text style={styles.shareCodeLabel}>
                {effectiveRole === 'user' ? 'Kullanıcı Kodu:' : 'Bilet Kutusu Komutu:'}
              </Text>
              <Text style={styles.shareCodeText} numberOfLines={2} selectable>
                {effectiveRole === 'global_admin' || effectiveRole === 'admin' || effectiveRole === 'founder'
                  ? `admin ${codeToShow}`
                  : `user ${codeToShow}`}
              </Text>
            </View>

            <Text style={styles.shareNotice}>
              {language === 'tr'
                ? 'Bu QR görselini veya bilet komutunu diğer cihazınıza aktararak tek tıkla oturum açabilirsiniz.'
                : 'Scan this QR code image or use the command string to quickly sign in on another device.'}
            </Text>

            <View style={styles.shareActionRow}>
              <TouchableOpacity
                style={styles.shareCopyBtn}
                onPress={handleCopyHash}
                activeOpacity={0.7}
              >
                {copied ? (
                  <>
                    <Check size={16} color="#16A34A" strokeWidth={2.2} style={{ marginRight: 6 }} />
                    <Text style={[styles.shareCopyText, { color: '#16A34A' }]}>
                      {language === 'tr' ? 'Kopyalandı' : 'Copied'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Copy size={16} color="#2563EB" strokeWidth={2} style={{ marginRight: 6 }} />
                    <Text style={styles.shareCopyText}>
                      {language === 'tr' ? 'Kopyala' : 'Copy'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareExportBtn}
                onPress={handleExportShare}
                activeOpacity={0.7}
              >
                <Share2 size={16} color="#FFFFFF" strokeWidth={2} style={{ marginRight: 6 }} />
                <Text style={styles.shareExportText}>
                  {language === 'tr' ? 'Paylaş' : 'Share'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563EB',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  displayNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  enterpriseSubText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  nameEditBox: {
    width: '100%',
    maxWidth: 240,
    marginTop: 8,
    marginBottom: 4,
    alignItems: 'center',
  },
  nameInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
    width: '100%',
  },
  nameInputField: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 5,
  },
  nameSaveBtn: {
    backgroundColor: '#2563EB',
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  nameValidationHint: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  qrCardContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
  },
  qrWrapper: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  hashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    width: '100%',
  },
  hashText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#334155',
  },
  hashActionBtn: {
    padding: 4,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  shareCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  shareHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  shareQrContainer: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  shareCodeBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  shareCodeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  shareCodeText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#0F172A',
    lineHeight: 15,
  },
  shareNotice: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
  },
  shareActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  shareCopyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  shareCopyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  shareExportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  shareExportText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
