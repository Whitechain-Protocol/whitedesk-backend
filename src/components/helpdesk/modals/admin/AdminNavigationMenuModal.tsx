import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  User,
  Users,
  Settings,
  Sliders,
  Layers,
  Sparkles,
  ShieldCheck,
  BookOpen,
  UserCheck,
  LogOut,
  Database,
  SearchCheck,
  CreditCard,
  Clock,
} from 'lucide-react-native';

export interface AdminNavigationMenuModalProps {
  visible: boolean;
  onClose: () => void;
  safeTop: number;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  isFounder?: boolean;
  adminRole?: string;
  language?: string;
  onOpenProfile: () => void;
  onOpenWorkStatus?: () => void;
  onOpenProvisioning: () => void;
  onOpenLicense?: () => void;
  onOpenSettings: () => void;
  onOpenAdvancedFeatures: () => void;
  onOpenSdkIntegration: () => void;
  onOpenHarvestModal?: () => void;
  onOpenAuditModal?: () => void;
  onOpenAdminRatings: () => void;
  onOpenSecurityPrivacy: () => void;
  onOpenAdminGuide: () => void;
  onOpenUserGuide: () => void;
  onOpenUserPrefs: () => void;
  onOpenIdentityModal: () => void;
  onSignOut: () => void;
}

export const AdminNavigationMenuModal: React.FC<AdminNavigationMenuModalProps> = ({
  visible,
  onClose,
  safeTop,
  isAdmin,
  isMasterAdmin,
  isFounder = false,
  adminRole = 'none',
  language = 'tr',
  onOpenProfile,
  onOpenWorkStatus,
  onOpenProvisioning,
  onOpenLicense,
  onOpenSettings,
  onOpenAdvancedFeatures,
  onOpenSdkIntegration,
  onOpenHarvestModal,
  onOpenAuditModal,
  onOpenAdminRatings,
  onOpenSecurityPrivacy,
  onOpenAdminGuide,
  onOpenUserGuide,
  onOpenUserPrefs,
  onOpenIdentityModal,
  onSignOut,
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
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.popupContainer, { top: safeTop + 54 }]}>
          {/* 1. Profil (Kullanıcı & Yönetici Ortak İlk Sıra) */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onOpenProfile();
            }}
            activeOpacity={0.65}
          >
            <User size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
            <Text style={styles.menuText}>{language === 'tr' ? 'Profil' : 'Profile'}</Text>
          </TouchableOpacity>

          {/* 1.1 Çalışma Durumu (Profil adımının hemen altında yeni bir modal) */}
          {isAdmin && onOpenWorkStatus && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onOpenWorkStatus();
              }}
              activeOpacity={0.65}
            >
              <Clock size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
              <Text style={styles.menuText}>
                {language === 'tr' ? 'Çalışma Durumu' : 'Working Status'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 1.2 Lisans & Abonelik (Çalışma Durumu bölümünün hemen altında ayrı bir modal) */}
          {(isMasterAdmin || isFounder || adminRole === 'global_admin' || adminRole === 'founder' || isAdmin) && onOpenLicense && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onOpenLicense();
              }}
              activeOpacity={0.65}
            >
              <CreditCard size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
              <Text style={styles.menuText}>
                {language === 'tr' ? 'Lisans & Abonelik' : 'License & Subscription'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Profil / Statü Ayracı */}
          <View style={styles.divider} />

          {isAdmin ? (
            <>
              {/* 2. Provizyon Masası (ShieldCheck Secure Badge İkonlu) */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenProvisioning();
                }}
                activeOpacity={0.65}
              >
                <ShieldCheck size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>Provizyon Masası</Text>
              </TouchableOpacity>

              {/* 3. Kuruluş Ayarları */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenSettings();
                }}
                activeOpacity={0.65}
              >
                <Settings size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>Kuruluş Ayarları</Text>
              </TouchableOpacity>

              {/* 4. Gelişmiş Özellikler */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenAdvancedFeatures();
                }}
                activeOpacity={0.65}
              >
                <Sliders size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Gelişmiş Özellikler' : 'Advanced Features'}
                </Text>
              </TouchableOpacity>

              {/* 5. SDK Entegrasyonları */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenSdkIntegration();
                }}
                activeOpacity={0.65}
              >
                <Layers size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>SDK Entegrasyonları</Text>
              </TouchableOpacity>

              {/* 5.1 Federal Veri Hasadı (Global Admin & Kurucu) */}
              {(isMasterAdmin || isFounder || adminRole === 'global_admin' || adminRole === 'founder') && onOpenHarvestModal && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onOpenHarvestModal();
                  }}
                  activeOpacity={0.65}
                >
                  <Database size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                  <Text style={styles.menuText}>
                    {language === 'tr' ? 'Federal Veri Hasadı' : 'Federal Data Harvesting'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 5.2 FDH Sorgulama (Global Admin & Kurucu) */}
              {(isMasterAdmin || isFounder || adminRole === 'global_admin' || adminRole === 'founder') && onOpenAuditModal && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onOpenAuditModal();
                  }}
                  activeOpacity={0.65}
                >
                  <SearchCheck size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                  <Text style={styles.menuText}>FDH Sorgulama</Text>
                </TouchableOpacity>
              )}

              {/* 6. Yönetici Değerlendirmeleri */}
              {isMasterAdmin && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onOpenAdminRatings();
                  }}
                  activeOpacity={0.65}
                >
                  <Sparkles size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                  <Text style={styles.menuText}>Yönetici Değerlendirmeleri</Text>
                </TouchableOpacity>
              )}


              {/* 7. Gizlilik & Güvenlik */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenSecurityPrivacy();
                }}
                activeOpacity={0.65}
              >
                <ShieldCheck size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Gizlilik & Güvenlik' : 'Security & Privacy'}
                </Text>
              </TouchableOpacity>

              {/* 8. Yönetici Kılavuzu */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenAdminGuide();
                }}
                activeOpacity={0.65}
              >
                <BookOpen size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Yönetici Kılavuzu' : 'Admin Guide'}
                </Text>
              </TouchableOpacity>

              {/* 9. Kullanım Kılavuzu */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenUserGuide();
                }}
                activeOpacity={0.65}
              >
                <BookOpen size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Kullanım Kılavuzu' : 'User Manual'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* 1. Gelişmiş Tercihler */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenUserPrefs();
                }}
                activeOpacity={0.65}
              >
                <Sliders size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Gelişmiş Tercihler' : 'Advanced Preferences'}
                </Text>
              </TouchableOpacity>

              {/* 2. Kendinizi Tanımlayın */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenIdentityModal();
                }}
                activeOpacity={0.65}
              >
                <UserCheck size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Kendinizi Tanımlayın' : 'Identity & Alias'}
                </Text>
              </TouchableOpacity>

              {/* 3. Gizlilik & Güvenlik */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenSecurityPrivacy();
                }}
                activeOpacity={0.65}
              >
                <ShieldCheck size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Gizlilik & Güvenlik' : 'Security & Privacy'}
                </Text>
              </TouchableOpacity>

              {/* 4. Kullanım Kılavuzu */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenUserGuide();
                }}
                activeOpacity={0.65}
              >
                <BookOpen size={16} color="#4A5568" strokeWidth={2} style={styles.menuIcon} />
                <Text style={styles.menuText}>
                  {language === 'tr' ? 'Kullanım Kılavuzu' : 'User Manual'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Sign Out */}
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemWipe]}
            onPress={() => {
              onClose();
              onSignOut();
            }}
            activeOpacity={0.65}
          >
            <LogOut size={16} color="#EF4444" strokeWidth={2} style={styles.menuIcon} />
            <Text style={[styles.menuText, styles.menuTextWipe]}>
              {language === 'tr' ? 'Oturumu Kapat' : 'Sign Out'}
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
