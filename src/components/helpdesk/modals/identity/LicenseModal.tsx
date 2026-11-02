import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react-native';
import { helpDeskService } from '../../../../services/helpDeskService';

export interface LicenseModalProps {
  visible: boolean;
  onClose: () => void;
  enterpriseBlindId?: string;
  tenantStats?: { adminCount: number; userCount: number };
  language?: 'tr' | 'en';
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  visible,
  onClose,
  enterpriseBlindId,
  language = 'tr',
}) => {
  const [viewMode, setViewMode] = useState<'current' | 'manage'>('current');
  const [activeLicense, setActiveLicense] = useState<any | null>(null);
  const [allPlans, setAllPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'annual'>('annual');
  const [expandedPlanIds, setExpandedPlanIds] = useState<Record<string, boolean>>({
    core: true,
    live: true,
  });

  const togglePlanDetails = (planId: string) => {
    setExpandedPlanIds((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  const loadLicenseData = useCallback(async () => {
    try {
      setIsLoading(true);
      const lic = await helpDeskService.getTenantActiveLicense(enterpriseBlindId || 'default');
      setActiveLicense(lic);
      const plans = await helpDeskService.getAllPlans();
      setAllPlans(plans);

      if (lic?.billingCycle === 'monthly' || lic?.billingCycle === 'annual') {
        setSelectedCycle(lic.billingCycle);
      } else {
        setSelectedCycle('annual');
      }
    } catch (e) {
      console.warn('[LicenseModal] loadLicenseData error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [enterpriseBlindId]);

  useEffect(() => {
    if (visible) {
      setViewMode('current');
      loadLicenseData();
    }
  }, [visible, loadLicenseData]);

  const handleApplyPlanOrCycle = async (targetPlanId: 'core' | 'live', targetCycle: 'monthly' | 'annual') => {
    try {
      setIsUpdating(true);
      const res = await helpDeskService.upgradeTenantLicense(
        enterpriseBlindId || 'default',
        targetPlanId,
        targetCycle
      );
      if (res.success && res.license) {
        setActiveLicense(res.license);
        setSelectedCycle(res.license.billingCycle || targetCycle);

        // Seçim tamamlandığında doğrudan 1. ekrana geri dönülür
        setViewMode('current');

        const cycleLabel = targetCycle === 'annual'
          ? (language === 'tr' ? 'Yıllık' : 'Annual')
          : (language === 'tr' ? 'Aylık' : 'Monthly');

        Alert.alert(
          language === 'tr' ? 'Lisans Güncellendi' : 'License Updated',
          language === 'tr'
            ? `${res.license.planName} (${cycleLabel}) başarıyla tanımlandı.`
            : `${res.license.planName} (${cycleLabel}) updated successfully.`
        );
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Lisans güncellenirken bir sorun oluştu.');
    } finally {
      setIsUpdating(false);
    }
  };

  const tierLevel = activeLicense?.tierLevel ?? 0;
  const isLive = activeLicense?.planId === 'live' || tierLevel === 2;
  const isCore = activeLicense?.planId === 'core' || tierLevel === 1;
  const isTrial = !isLive && !isCore;

  const currentPlanName = isLive
    ? 'LIVE Paketi'
    : isCore
    ? 'CORE Paketi'
    : (language === 'tr' ? '14 Günlük Deneme Sürümü' : '14-Day Trial');

  const activePlanId: 'core' | 'live' = isLive ? 'live' : 'core';

  // Bütün lisanslarda birebir aynı formatta listelenen net özellik maddeleri
  const getPlanFeatureList = (planId: 'core' | 'live') => {
    if (planId === 'live') {
      return [
        'Tüm CORE özellikleri dahil',
        'WhiteDesk Masaüstü (Windows / macOS) istemcisi',
        'Uzak masaüstü canlı ekran ve müdahale',
        'Canlı sesli görüşme ve telsiz (PTT)',
        'Sınırsız operatör ve istemci cihaz',
        'Gelişmiş denetim kayıtları ve raporlar',
      ];
    }
    return [
      'Sınırsız operatör ve istemci cihaz',
      'WhiteDesk Masaüstü (Windows / macOS) istemcisi',
      'Uçtan uca şifreli (E2EE) biletleme akışı',
      'Kategori ve organizasyon yönetimi',
      'Dosya ve ekran görüntüsü ekleri',
    ];
  };

  // 2. Ekranda sadece seçilebilir olan alternatif planlar gösterilir (mevcut plan gizlenir)
  const selectablePlans = allPlans.filter((p) => p.id !== activeLicense?.planId);
  const displayPlans = selectablePlans.length > 0 ? selectablePlans : allPlans;

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
          {/* HEADER */}
          <View style={styles.headerRow}>
            {viewMode === 'manage' ? (
              <View style={styles.manageHeaderLeft}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setViewMode('current')}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={18} color="#202124" />
                </TouchableOpacity>
                <View>
                  <Text style={styles.headerTitle}>
                    {language === 'tr' ? 'Lisans Yönetimi' : 'License Management'}
                  </Text>
                  <Text style={styles.headerSubtitle}>
                    {language === 'tr' ? 'Geçiş yapılabilecek lisans seçenekleri' : 'Selectable license options'}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.headerTitle}>
                  {language === 'tr' ? 'Lisans & Abonelik' : 'License & Subscription'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {language === 'tr' ? 'Kuruluş yetki ve abonelik seviyesi' : 'Enterprise tier and subscription'}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color="#5F6368" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#1A73E8" />
              <Text style={styles.loadingText}>
                {language === 'tr' ? 'Lisans bilgisi yükleniyor...' : 'Loading license info...'}
              </Text>
            </View>
          ) : viewMode === 'current' ? (
            /* ------------------------------------------------------------- */
            /* 1. EKRAN: SADECE KULLANIMDAKİ PLAN, DETAYLARI VE YÖNETİM BUTONU */
            /* ------------------------------------------------------------- */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Aktif Plan Durumu */}
              <View style={styles.activeBanner}>
                <View style={styles.activeBannerHeader}>
                  <Text style={styles.activePlanLabel}>
                    {language === 'tr' ? 'Kullanımdaki Plan:' : 'Active Plan:'}
                  </Text>
                  <Text style={styles.activePlanName}>{currentPlanName}</Text>
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>
                      {!isTrial
                        ? (language === 'tr' ? 'Aktif' : 'Active')
                        : `${activeLicense?.trialDaysRemaining ?? 14} Gün`}
                    </Text>
                  </View>
                </View>

                <View style={styles.activeMetaRow}>
                  <Text style={styles.activeMetaText}>
                    {!isTrial
                      ? (activeLicense?.billingCycle === 'annual' ? 'Yıllık Döngü' : 'Aylık Döngü')
                      : 'Deneme Süresi'}
                  </Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={[styles.activeMetaText, styles.desktopOn]}>
                    {language === 'tr' ? 'Masaüstü & Mobil İstemci Aktif' : 'Desktop & Mobile Active'}
                  </Text>
                </View>
              </View>

              {/* Kullanımdaki Planın Lisans Detayları */}
              <View style={styles.currentDetailsBox}>
                <Text style={styles.sectionHeaderTitle}>
                  {language === 'tr' ? 'Lisans Detayları' : 'License Details'}
                </Text>

                <View style={styles.featureList}>
                  {getPlanFeatureList(activePlanId).map((feat, idx) => (
                    <View key={`current_feat_${idx}`} style={styles.featureRow}>
                      <Check size={14} color="#1A73E8" strokeWidth={2.4} style={styles.checkIcon} />
                      <Text style={styles.featureText}>{feat}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Lisans Yönetimi Butonu */}
              <TouchableOpacity
                style={styles.manageNavBtn}
                onPress={() => setViewMode('manage')}
                activeOpacity={0.8}
              >
                <Text style={styles.manageNavBtnText}>
                  {language === 'tr' ? 'Lisans Yönetimi' : 'License Management'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* ------------------------------------------------------------- */
            /* 2. EKRAN: YALNIZCA SEÇİLEBİLİR PLANLAR & SEVİYE DEĞİŞTİRME   */
            /* ------------------------------------------------------------- */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Döngü Seçici: Aylık / Yıllık */}
              <View style={styles.cycleSelectorContainer}>
                <View style={styles.cycleSegmented}>
                  <TouchableOpacity
                    style={[styles.cycleBtn, selectedCycle === 'monthly' && styles.cycleBtnActive]}
                    onPress={() => setSelectedCycle('monthly')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cycleBtnText, selectedCycle === 'monthly' && styles.cycleBtnTextActive]}>
                      {language === 'tr' ? 'Aylık' : 'Monthly'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cycleBtn, selectedCycle === 'annual' && styles.cycleBtnActive]}
                    onPress={() => setSelectedCycle('annual')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cycleBtnText, selectedCycle === 'annual' && styles.cycleBtnTextActive]}>
                      {language === 'tr' ? 'Yıllık (%20 İndirimli)' : 'Annual (20% Off)'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Yalnızca Seçilebilir Alternatif Planlar */}
              <View style={styles.plansContainer}>
                {displayPlans.map((plan) => {
                  const price = selectedCycle === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
                  const isPlanLive = plan.id === 'live';
                  const isExpanded = !!expandedPlanIds[plan.id];
                  const features = getPlanFeatureList(plan.id);

                  return (
                    <View key={`plan_${plan.id}`} style={styles.planCard}>
                      {/* Plan Başlık & Fiyat */}
                      <View style={styles.planTopRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.planTitle}>{plan.name}</Text>
                          <Text style={styles.planOneLiner}>
                            {isPlanLive
                              ? (language === 'tr'
                                  ? 'Masaüstü istemcisi, uzaktan canlı müdahale ve telsiz (PTT)'
                                  : 'Desktop client, remote intervention and PTT')
                              : (language === 'tr'
                                  ? 'Masaüstü istemcisi, sınırsız operatör ve biletleme'
                                  : 'Desktop client, unlimited operators and ticketing')}
                          </Text>
                        </View>

                        <View style={styles.priceContainer}>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                            <Text style={styles.priceAmount}>${price}</Text>
                            <Text style={styles.pricePeriod}> / ay</Text>
                          </View>
                          {selectedCycle === 'annual' && (
                            <Text style={styles.billedAnnuallyText}>
                              {language === 'tr' ? 'Yıllık faturalandırılır' : 'Billed annually'}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Akordeon: Lisans Detayları */}
                      <TouchableOpacity
                        style={styles.accordionToggleRow}
                        onPress={() => togglePlanDetails(plan.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.accordionToggleTitle}>
                          {language === 'tr' ? 'Lisans Detayları' : 'License Details'}
                        </Text>
                        {isExpanded ? (
                          <ChevronUp size={16} color="#1A73E8" />
                        ) : (
                          <ChevronDown size={16} color="#5F6368" />
                        )}
                      </TouchableOpacity>

                      {/* Özellik Listesi */}
                      {isExpanded && (
                        <View style={styles.featureList}>
                          {features.map((feat, idx) => (
                            <View key={`feat_${plan.id}_${idx}`} style={styles.featureRow}>
                              <Check size={14} color="#1A73E8" strokeWidth={2.4} style={styles.checkIcon} />
                              <Text style={styles.featureText}>{feat}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Aksiyon Butonu: Lisans Seviyesini Değiştir */}
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleApplyPlanOrCycle(plan.id, selectedCycle)}
                        activeOpacity={0.8}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.actionBtnText}>
                            {language === 'tr' ? 'Lisans Seviyesini Değiştir' : 'Change License Tier'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(32, 33, 36, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DADCE0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
  },
  manageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
    marginLeft: -4,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#5F6368',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#5F6368',
  },
  scrollContent: {
    padding: 16,
  },
  /* 1. EKRAN: Aktif Plan Başlığı (Çerçevesiz Temiz Tasarım) */
  activeBanner: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    marginBottom: 14,
  },
  activeBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activePlanLabel: {
    fontSize: 12.5,
    color: '#5F6368',
    marginRight: 6,
  },
  activePlanName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202124',
    flex: 1,
  },
  activeChip: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  activeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1967D2',
  },
  activeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  activeMetaText: {
    fontSize: 11,
    color: '#5F6368',
  },
  metaDot: {
    marginHorizontal: 6,
    color: '#DADCE0',
    fontSize: 12,
  },
  desktopOn: {
    color: '#188038',
    fontWeight: '500',
  },
  /* 1. Ekran: Detaylar Bölümü */
  currentDetailsBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
    padding: 14,
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 10,
  },
  manageNavBtn: {
    backgroundColor: '#1A73E8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageNavBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  /* 2. EKRAN: Döngü Seçici */
  cycleSelectorContainer: {
    marginBottom: 14,
  },
  cycleSegmented: {
    flexDirection: 'row',
    backgroundColor: '#F1F3F4',
    borderRadius: 8,
    padding: 3,
  },
  cycleBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  cycleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#3C4043',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cycleBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5F6368',
  },
  cycleBtnTextActive: {
    color: '#1A73E8',
    fontWeight: '600',
  },
  /* 2. EKRAN: Paket Kartları */
  plansContainer: {
    gap: 12,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DADCE0',
    padding: 14,
  },
  planTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#202124',
  },
  planOneLiner: {
    fontSize: 11.5,
    color: '#5F6368',
    marginTop: 2,
    lineHeight: 16,
  },
  priceContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
  },
  pricePeriod: {
    fontSize: 11,
    color: '#5F6368',
  },
  billedAnnuallyText: {
    fontSize: 9.5,
    color: '#188038',
    marginTop: 1,
  },
  /* Akordeon Butonu */
  accordionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
  },
  accordionToggleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A73E8',
  },
  /* Özellik Listesi */
  featureList: {
    paddingVertical: 4,
    gap: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  featureText: {
    fontSize: 11.5,
    color: '#3C4043',
    flex: 1,
    lineHeight: 16,
  },
  /* Aksiyon Butonu */
  actionBtn: {
    backgroundColor: '#1A73E8',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
