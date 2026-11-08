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
import { useTranslation } from '../../../../services/i18nService';

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
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'current' | 'manage'>('current');
  const [activeLicense, setActiveLicense] = useState<any | null>(null);
  const [allPlans, setAllPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'annual'>('annual');
  const [expandedPlanIds, setExpandedPlanIds] = useState<Record<string, boolean>>({});

  const togglePlanDetails = (planId: string) => {
    setExpandedPlanIds((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  const loadLicenseData = useCallback(async () => {
    try {
      setIsLoading(true);
      const lic = await helpDeskService.getTenantActiveLicense(enterpriseBlindId || 'default', true);
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
      setExpandedPlanIds({});
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
          ? t('license.modal.cycle_annual')
          : t('license.modal.cycle_monthly');

        Alert.alert(
          t('license.modal.updated_title'),
          t('license.modal.updated_desc', { planName: res.license.planName, cycle: cycleLabel })
        );
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('license.modal.update_error'));
    } finally {
      setIsUpdating(false);
    }
  };

  const tierLevel = activeLicense?.tierLevel ?? 0;
  const isLive = activeLicense?.planId === 'live' || tierLevel === 2;
  const isCore = activeLicense?.planId === 'core' || tierLevel === 1;
  const isTrial = !isLive && !isCore;

  const currentPlanName = isLive
    ? t('license.modal.plan_live')
    : isCore
    ? t('license.modal.plan_core')
    : t('license.modal.plan_trial');

  const activePlanId: 'core' | 'live' = isLive ? 'live' : 'core';

  // Bütün lisanslarda birebir aynı formatta listelenen net ve mükerrersiz özellik maddeleri
  const getPlanFeatureList = (planId: 'core' | 'live') => {
    if (planId === 'live') {
      return [
        t('license.modal.feat_live_1'),
        t('license.modal.feat_live_2'),
        t('license.modal.feat_live_3'),
        t('license.modal.feat_live_4'),
        t('license.modal.feat_live_5'),
      ];
    }
    return [
      t('license.modal.feat_core_1'),
      t('license.modal.feat_core_2'),
      t('license.modal.feat_core_3'),
      t('license.modal.feat_core_4'),
      t('license.modal.feat_core_5'),
      t('license.modal.feat_core_6'),
      t('license.modal.feat_core_7'),
      t('license.modal.feat_core_8'),
      t('license.modal.feat_core_9'),
      t('license.modal.feat_core_10'),
      t('license.modal.feat_core_11'),
      t('license.modal.feat_core_12'),
      t('license.modal.feat_core_13'),
    ];
  };

  // 2. Ekranda sadece seçilebilir olan alternatif planlar veya farklı döngü gösterilir
  const selectablePlans = allPlans.filter(
    (p) => p.id !== activeLicense?.planId || selectedCycle !== activeLicense?.billingCycle
  );
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
                    {t('license.modal.manage_title')}
                  </Text>
                  <Text style={styles.headerSubtitle}>
                    {t('license.modal.manage_subtitle')}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.headerTitle}>
                  {t('license.modal.title')}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {t('license.modal.subtitle')}
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
                {t('license.modal.loading')}
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
                    {t('license.modal.active_plan_label')}
                  </Text>
                  <Text style={styles.activePlanName}>{currentPlanName}</Text>
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>
                      {!isTrial
                        ? t('license.modal.status_active')
                        : t('license.modal.trial_days_remaining', { days: activeLicense?.trialDaysRemaining ?? 14 })}
                    </Text>
                  </View>
                </View>

                <View style={styles.activeMetaRow}>
                  <Text style={styles.activeMetaText}>
                    {!isTrial
                      ? (activeLicense?.billingCycle === 'annual' ? t('license.modal.annual_cycle') : t('license.modal.monthly_cycle'))
                      : t('license.modal.trial_period')}
                  </Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={[styles.activeMetaText, styles.desktopOn]}>
                    {t('license.modal.desktop_mobile_active')}
                  </Text>
                </View>
              </View>

              {/* Kullanımdaki Planın Lisans Detayları */}
              <View style={styles.currentDetailsBox}>
                <Text style={styles.sectionHeaderTitle}>
                  {t('license.modal.details_title')}
                </Text>

                <View style={styles.featureList}>
                  {getPlanFeatureList(activePlanId).map((feat, idx) => {
                    const [mainTitle, subTitle] = feat.split('\n');
                    return (
                      <View key={`current_feat_${idx}`} style={styles.featureRow}>
                        <Check size={14} color="#1A73E8" strokeWidth={2.4} style={styles.checkIcon} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.featureTitleText}>{mainTitle}</Text>
                          {!!subTitle && (
                            <Text style={styles.featureSubtitleText}>{subTitle}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Lisans Yönetimi Butonu */}
              <TouchableOpacity
                style={styles.manageNavBtn}
                onPress={() => setViewMode('manage')}
                activeOpacity={0.8}
              >
                <Text style={styles.manageNavBtnText}>
                  {t('license.modal.manage_title')}
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
                      {t('license.modal.cycle_monthly')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cycleBtn, selectedCycle === 'annual' && styles.cycleBtnActive]}
                    onPress={() => setSelectedCycle('annual')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cycleBtnText, selectedCycle === 'annual' && styles.cycleBtnTextActive]}>
                      {t('license.modal.cycle_annual_discount')}
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
                              ? t('license.modal.live_oneliner')
                              : t('license.modal.core_oneliner')}
                          </Text>
                        </View>

                        <View style={styles.priceContainer}>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                            <Text style={styles.priceAmount}>${price}</Text>
                            <Text style={styles.pricePeriod}>{t('license.modal.per_month')}</Text>
                          </View>
                          {selectedCycle === 'annual' && (
                            <Text style={styles.billedAnnuallyText}>
                              {t('license.modal.billed_annually')}
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
                          {t('license.modal.details_title')}
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
                          {features.map((feat, idx) => {
                            const [mainTitle, subTitle] = feat.split('\n');
                            return (
                              <View key={`feat_${plan.id}_${idx}`} style={styles.featureRow}>
                                <Check size={14} color="#1A73E8" strokeWidth={2.4} style={styles.checkIcon} />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.featureTitleText}>{mainTitle}</Text>
                                  {!!subTitle && (
                                    <Text style={styles.featureSubtitleText}>{subTitle}</Text>
                                  )}
                                </View>
                              </View>
                            );
                          })}
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
                            {t('license.modal.change_tier_btn')}
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
  featureTitleText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#3C4043',
    lineHeight: 16.5,
  },
  featureSubtitleText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#70757A',
    lineHeight: 15,
    marginTop: 1,
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
