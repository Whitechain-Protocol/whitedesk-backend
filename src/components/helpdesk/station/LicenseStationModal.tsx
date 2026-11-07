import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Star,
  X,
  Users,
  Headphones,
  CheckCircle2,
  Zap,
  CreditCard,
  Building2,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Award,
  Crown,
  Lock,
} from 'lucide-react-native';
import { helpDeskService } from '../../../services/helpDeskService';

export interface LicenseStationModalProps {
  visible: boolean;
  onClose: () => void;
  adminModalHeight: number;
  currentEnterpriseName: string;
  activeEnterpriseBlindId?: string;
  adminsList?: any[];
  tenantStats?: { userCount?: number; adminCount?: number } | null;
  licensePlans?: any[];
  licenseUpgradeHashInput?: string;
  onChangeLicenseUpgradeHash?: (text: string) => void;
  onGenerateOperatorAddonFile?: () => void;
  onGenerateCustomerAddonFile?: () => void;
  onUpgradeLicenseWithHash?: () => void;
}

export const LicenseStationModal: React.FC<LicenseStationModalProps> = ({
  visible,
  onClose,
  adminModalHeight,
  currentEnterpriseName,
  activeEnterpriseBlindId = 'default',
  adminsList = [],
  tenantStats,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [upgrading, setUpgrading] = useState<boolean>(false);
  const [activeLicense, setActiveLicense] = useState<any | null>(null);

  // Upgrade Selection Modal / Sheet State
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [upgradePlans, setUpgradePlans] = useState<any[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  // Checkout (Ödeme Sayfası) State
  const [checkoutStep, setCheckoutStep] = useState<boolean>(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'invoice'>('card');
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);

  // Card Form State
  const [cardHolder, setCardHolder] = useState<string>('');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');

  // Load Active License
  const loadLicense = useCallback(async () => {
    try {
      setLoading(true);
      const lic = await helpDeskService.getTenantActiveLicense(activeEnterpriseBlindId);
      setActiveLicense(lic);
    } catch (e) {
      console.warn('[LicenseStationModal] loadLicense error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeEnterpriseBlindId]);

  useEffect(() => {
    if (visible) {
      loadLicense();
      setShowUpgradeModal(false);
      setCheckoutStep(false);
      setSelectedPlanForCheckout(null);
    }
  }, [visible, loadLicense]);

  // Open Upgrade Selection
  const handleOpenUpgrade = async () => {
    try {
      setUpgrading(true);
      const tier = activeLicense?.tierLevel ?? 0;
      const plans = await helpDeskService.getUpgradePlans(tier);
      setUpgradePlans(plans);
      setCheckoutStep(false);
      setSelectedPlanForCheckout(null);
      setShowUpgradeModal(true);
    } catch (e) {
      console.warn('[LicenseStationModal] handleOpenUpgrade error:', e);
      Alert.alert('Hata', 'Yükseltme seçenekleri yüklenirken bir problem oluştu.');
    } finally {
      setUpgrading(false);
    }
  };

  // Proceed to Checkout Screen
  const handleGoToCheckout = (plan: any) => {
    setSelectedPlanForCheckout(plan);
    setCheckoutStep(true);
  };

  // Complete Payment & Activate License
  const handleCompletePayment = async () => {
    if (!selectedPlanForCheckout) return;

    try {
      setProcessingPayment(true);
      const res = await helpDeskService.upgradeTenantLicense(
        activeEnterpriseBlindId,
        selectedPlanForCheckout.id,
        billingCycle
      );

      if (res.success && res.license) {
        setActiveLicense(res.license);
        setCheckoutStep(false);
        setShowUpgradeModal(false);
        Alert.alert('Ödeme Başarılı', `${selectedPlanForCheckout.name} aboneliğiniz başarıyla başlatıldı.`);
      } else {
        Alert.alert('Ödeme Başarısız', res.message || 'İşlem tamamlanamadı.');
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Ödeme tamamlanırken hata oluştu.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const isTrial = activeLicense?.planId === 'trial' || activeLicense?.tierLevel === 0;
  const isCore = activeLicense?.planId === 'core' || activeLicense?.tierLevel === 1;
  const isLive = activeLicense?.planId === 'live' || activeLicense?.tierLevel === 2;
  const canUpgrade = !isLive; // Trial ve Core için yükseltme var, Live zirvede

  // Checkout Calculations
  const checkoutPricePerMonth = selectedPlanForCheckout
    ? (billingCycle === 'annual' ? selectedPlanForCheckout.annualMonthlyPrice : selectedPlanForCheckout.monthlyPrice)
    : 0;
  const checkoutTotal = selectedPlanForCheckout
    ? (billingCycle === 'annual' ? checkoutPricePerMonth * 12 : checkoutPricePerMonth)
    : 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.fullScreenOverlay}>
        <View style={[styles.cardContainer, { height: adminModalHeight }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.iconBox}>
                <Star size={20} color="#2563EB" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.titleText}>Lisans & Abonelik</Text>
                <Text style={styles.subtitleText} numberOfLines={1}>
                  {currentEnterpriseName} • Aktif Yetki & Plan
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Lisans durumu sorgulanıyor...</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1, width: '100%' }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* TEKİL AKTİF LİSANS BİLGİ KARTI */}
              <View style={[
                styles.activeLicenseCard,
                isTrial ? styles.trialBorder : isLive ? styles.liveBorder : styles.coreBorder
              ]}>
                {/* Top Badge & Header */}
                <View style={styles.activeCardHeaderRow}>
                  <View style={styles.planIdentityGroup}>
                    {isLive ? (
                      <Crown size={20} color="#7C3AED" strokeWidth={2.2} />
                    ) : isCore ? (
                      <ShieldCheck size={20} color="#2563EB" strokeWidth={2.2} />
                    ) : (
                      <Sparkles size={20} color="#D97706" strokeWidth={2.2} />
                    )}
                    <Text style={styles.activePlanTitle}>
                      {activeLicense?.planName || '14 Günlük Deneme'}
                    </Text>
                  </View>

                  <View style={[
                    styles.activeStatusBadge,
                    isTrial ? styles.trialStatusBadge : isLive ? styles.liveStatusBadge : styles.coreStatusBadge
                  ]}>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: isTrial ? '#D97706' : isLive ? '#7C3AED' : '#2563EB' }
                    ]} />
                    <Text style={[
                      styles.statusBadgeText,
                      { color: isTrial ? '#B45309' : isLive ? '#6D28D9' : '#1D4ED8' }
                    ]}>
                      {isTrial ? 'Ücretsiz Deneme' : isLive ? 'Zirve Paket' : 'Aktif Plan'}
                    </Text>
                  </View>
                </View>

                {/* Trial Countdown or Pricing Details */}
                {isTrial ? (
                  <View style={styles.trialInfoBox}>
                    <View style={styles.trialRow}>
                      <Text style={styles.trialRemainingDaysText}>
                        {isNaN(Number(activeLicense?.trialDaysRemaining)) ? 14 : (activeLicense?.trialDaysRemaining ?? 14)} Gün Kaldı
                      </Text>
                      <Text style={styles.trialValidText}>
                        Sovereign WhiteChain ağı üzerinde tam yetkili değerlendirme lisansı devrede.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.priceContainer}>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceAmount}>
                        ${activeLicense?.billingCycle === 'annual'
                          ? activeLicense?.annualMonthlyPrice
                          : activeLicense?.monthlyPrice}
                      </Text>
                      <Text style={styles.pricePeriod}>/ ay</Text>
                      {activeLicense?.billingCycle === 'annual' && (
                        <View style={styles.annualSavingBadge}>
                          <Text style={styles.annualSavingText}>Yıllık Taahhüt</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.subDetailText}>
                      Dönem Sonu: {activeLicense?.subscriptionEndAt
                        ? new Date(activeLicense.subscriptionEndAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : '1 Yıl Geçerli'}
                    </Text>
                  </View>
                )}

                {/* Features Checklist */}
                <View style={styles.featuresSection}>
                  <Text style={styles.featuresHeaderLabel}>Paket Kapsamı & Yetkiler:</Text>
                  {(activeLicense?.features || []).map((feat: string, idx: number) => (
                    <View key={`feat_${idx}`} style={styles.featureItemRow}>
                      <CheckCircle2 size={15} color="#10B981" strokeWidth={2.2} style={{ marginTop: 1 }} />
                      <Text style={styles.featureItemText}>{feat}</Text>
                    </View>
                  ))}
                </View>

                {/* Resource Counters (Only for Trial) */}
                {isTrial && (
                  <View style={styles.trialCountersRow}>
                    <View style={styles.trialCounterCol}>
                      <Users size={16} color="#2563EB" />
                      <Text style={styles.counterValText}>{adminsList.length} / 1 İmi</Text>
                      <Text style={styles.counterSubText}>Yönetici Kurtarma</Text>
                    </View>
                    <View style={styles.counterDivider} />
                    <View style={styles.trialCounterCol}>
                      <Headphones size={16} color="#2563EB" />
                      <Text style={styles.counterValText}>{tenantStats?.userCount || 1} / 10 İmi</Text>
                      <Text style={styles.counterSubText}>Kör Erişim İmi</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* LİSANS YÜKSELT SEÇENEĞİ (Core ve Deneme Durumunda Görünür) */}
              {canUpgrade ? (
                <View style={styles.upgradeSection}>
                  <TouchableOpacity
                    style={styles.upgradeBtn}
                    onPress={handleOpenUpgrade}
                    activeOpacity={0.8}
                    disabled={upgrading}
                  >
                    <Zap size={18} color="#FFFFFF" strokeWidth={2.4} />
                    <Text style={styles.upgradeBtnText}>
                      {isTrial ? 'Lisansı Yükselt (Paketleri Gör)' : 'LIVE Pakete Yükselt'}
                    </Text>
                    {upgrading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 6 }} />
                    ) : (
                      <ChevronRight size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.upgradeHintText}>
                    {isTrial
                      ? 'Ücretsiz denemeden CORE veya LIVE paketine anında geçiş yapın.'
                      : 'Canlı müdahale ve uzak masaüstü desteği için LIVE pakete geçin.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.topTierBadgeBox}>
                  <Award size={18} color="#7C3AED" strokeWidth={2.2} />
                  <Text style={styles.topTierBadgeText}>
                    Tebrikler! Kurumunuz en üst seviye LIVE paket ayrıcalıklarından yararlanıyor.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* YÜKSELTME & ÖDEME MODAL DIALOG */}
      <Modal
        visible={showUpgradeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (checkoutStep) setCheckoutStep(false);
          else setShowUpgradeModal(false);
        }}
      >
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalCard}>
            {/* ADIM 1: PAKET & PERİYOT SEÇİMİ */}
            {!checkoutStep ? (
              <>
                <View style={styles.subModalHeader}>
                  <View>
                    <Text style={styles.subModalTitle}>Lisans Paketini Yükselt</Text>
                    <Text style={styles.subModalSub}>
                      {upgradePlans.length === 2 ? 'CORE veya LIVE paketini seçin' : 'LIVE paketine geçiş yapın'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.subModalCloseBtn}
                    onPress={() => setShowUpgradeModal(false)}
                  >
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Periyot Seçimi: Aylık / Yıllık */}
                <View style={styles.cycleToggleContainer}>
                  <TouchableOpacity
                    style={[styles.cycleBtn, billingCycle === 'monthly' && styles.cycleBtnActive]}
                    onPress={() => setBillingCycle('monthly')}
                  >
                    <Text style={[styles.cycleBtnText, billingCycle === 'monthly' && styles.cycleBtnTextActive]}>
                      Aylık Faturalama
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cycleBtn, billingCycle === 'annual' && styles.cycleBtnActive]}
                    onPress={() => setBillingCycle('annual')}
                  >
                    <Text style={[styles.cycleBtnText, billingCycle === 'annual' && styles.cycleBtnTextActive]}>
                      Yıllık Taahhüt (%20 Tasarruf)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Upgrade Options List */}
                <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                  {upgradePlans.map((plan) => {
                    const isPlanLive = plan.id === 'live';
                    const displayPrice = billingCycle === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;

                    return (
                      <View
                        key={`up_${plan.id}`}
                        style={[styles.upgradeOptionCard, isPlanLive && styles.upgradeOptionCardLive]}
                      >
                        <View style={styles.optionHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {isPlanLive ? (
                              <Crown size={18} color="#7C3AED" strokeWidth={2.4} />
                            ) : (
                              <ShieldCheck size={18} color="#2563EB" strokeWidth={2.4} />
                            )}
                            <Text style={[styles.optionTitle, isPlanLive && { color: '#6D28D9' }]}>
                              {plan.name}
                            </Text>
                            {isPlanLive && (
                              <View style={styles.recommendedPill}>
                                <Text style={styles.recommendedPillText}>Önerilen</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.optionPrice, isPlanLive && { color: '#7C3AED' }]}>
                              ${displayPrice}
                              <Text style={styles.optionPriceSub}> / ay</Text>
                            </Text>
                            {billingCycle === 'annual' && (
                              <Text style={styles.optionPriceAnnualNote}>
                                Yıllık taahhüt
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Features list */}
                        <View style={{ marginTop: 8, marginBottom: 12 }}>
                          {(plan.features || []).map((feat: string, fIdx: number) => (
                            <View key={`of_${fIdx}`} style={styles.optionFeatureRow}>
                              <CheckCircle2 size={13} color="#10B981" strokeWidth={2.2} />
                              <Text style={styles.optionFeatureText}>{feat}</Text>
                            </View>
                          ))}
                        </View>

                        {/* Ödeme Sayfasına Git Butonu */}
                        <TouchableOpacity
                          style={[styles.selectPlanBtn, isPlanLive && styles.selectPlanBtnLive]}
                          onPress={() => handleGoToCheckout(plan)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.selectPlanBtnText}>
                            Ödeme Sayfasına Git (${displayPrice}/ay)
                          </Text>
                          <ChevronRight size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              /* ADIM 2: ÖDEME SAYFASI (CHECKOUT) */
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Checkout Header */}
                <View style={styles.subModalHeader}>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => setCheckoutStep(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <ArrowLeft size={18} color="#0F172A" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.subModalTitle}>Ödeme & Onay</Text>
                    <Text style={styles.subModalSub}>{selectedPlanForCheckout?.name}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.subModalCloseBtn}
                    onPress={() => setShowUpgradeModal(false)}
                  >
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Sipariş Özeti Kartı */}
                <View style={styles.orderSummaryCard}>
                  <Text style={styles.orderSummaryTitle}>Sipariş Özeti</Text>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Kuruluş:</Text>
                    <Text style={styles.summaryVal}>{currentEnterpriseName}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Paket:</Text>
                    <Text style={[styles.summaryVal, { fontWeight: '800' }]}>
                      {selectedPlanForCheckout?.name}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Faturalama:</Text>
                    <Text style={styles.summaryVal}>
                      {billingCycle === 'annual' ? 'Yıllık Taahhüt (%20 İndirimli)' : 'Aylık'}
                    </Text>
                  </View>

                  <View style={styles.summaryDivider} />

                  <View style={styles.summaryTotalRow}>
                    <Text style={styles.summaryTotalLabel}>Tahsil Edilecek Tutar:</Text>
                    <Text style={styles.summaryTotalVal}>${checkoutTotal}.00</Text>
                  </View>
                  {billingCycle === 'annual' && (
                    <Text style={styles.annualSavingNote}>
                      12 aylık toplam: $39 x 12 yerine aylık $49'a göre yılda $120 tasarruf sağlandı.
                    </Text>
                  )}
                </View>

                {/* Ödeme Yöntemi Seçimi */}
                <Text style={styles.paymentMethodTitle}>Ödeme Yöntemi</Text>
                <View style={styles.paymentMethodTabsRow}>
                  <TouchableOpacity
                    style={[styles.paymentMethodTab, paymentMethod === 'card' && styles.paymentMethodTabActive]}
                    onPress={() => setPaymentMethod('card')}
                  >
                    <CreditCard size={16} color={paymentMethod === 'card' ? '#2563EB' : '#64748B'} />
                    <Text style={[styles.paymentMethodTabText, paymentMethod === 'card' && styles.paymentMethodTabTextActive]}>
                      Kredi / Banka Kartı
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.paymentMethodTab, paymentMethod === 'invoice' && styles.paymentMethodTabActive]}
                    onPress={() => setPaymentMethod('invoice')}
                  >
                    <Building2 size={16} color={paymentMethod === 'invoice' ? '#2563EB' : '#64748B'} />
                    <Text style={[styles.paymentMethodTabText, paymentMethod === 'invoice' && styles.paymentMethodTabTextActive]}>
                      Kurumsal Fatura / EFT
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Kart Bilgileri Formu */}
                {paymentMethod === 'card' ? (
                  <View style={styles.cardForm}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Kart Sahibi</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Ad Soyad"
                        placeholderTextColor="#94A3B8"
                        value={cardHolder}
                        onChangeText={setCardHolder}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Kart Numarası</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="•••• •••• •••• ••••"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={19}
                        value={cardNumber}
                        onChangeText={setCardNumber}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>Son Kullanma</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="AA/YY"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={5}
                          value={cardExpiry}
                          onChangeText={setCardExpiry}
                        />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>CVC / CVV</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="•••"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={4}
                          secureTextEntry
                          value={cardCvv}
                          onChangeText={setCardCvv}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.invoiceInfoBox}>
                    <Building2 size={24} color="#2563EB" style={{ marginBottom: 6 }} />
                    <Text style={styles.invoiceInfoTitle}>Kurumsal Cari / Fatura ile Ödeme</Text>
                    <Text style={styles.invoiceInfoSub}>
                      '{currentEnterpriseName}' kurumsal vergi kayıtlarınıza uygun e-fatura düzenlenir ve aboneliğiniz anında aktif edilir.
                    </Text>
                  </View>
                )}

                {/* Ödeme Onay Butonu */}
                <TouchableOpacity
                  style={[styles.completePaymentBtn, processingPayment && { opacity: 0.7 }]}
                  onPress={handleCompletePayment}
                  disabled={processingPayment}
                  activeOpacity={0.8}
                >
                  <Lock size={16} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={styles.completePaymentBtnText}>
                    {processingPayment
                      ? 'Ödeme İşleniyor...'
                      : `$${checkoutTotal}.00 Öde & Lisansı Başlat`}
                  </Text>
                  {processingPayment && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  cardContainer: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
  },
  activeLicenseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  trialBorder: {
    borderColor: '#FDE68A',
  },
  coreBorder: {
    borderColor: '#93C5FD',
  },
  liveBorder: {
    borderColor: '#C4B5FD',
  },
  activeCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  planIdentityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activePlanTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  trialStatusBadge: {
    backgroundColor: '#FEF3C7',
  },
  coreStatusBadge: {
    backgroundColor: '#EFF6FF',
  },
  liveStatusBadge: {
    backgroundColor: '#F5F3FF',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trialInfoBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
  },
  trialRow: {
    gap: 4,
  },
  trialRemainingDaysText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#B45309',
  },
  trialValidText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  priceContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  pricePeriod: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  annualSavingBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  annualSavingText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  subDetailText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  featuresSection: {
    marginBottom: 12,
  },
  featuresHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  featureItemText: {
    fontSize: 12.5,
    color: '#334155',
    flex: 1,
    lineHeight: 17,
  },
  trialCountersRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  trialCounterCol: {
    alignItems: 'center',
    flex: 1,
  },
  counterValText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  counterSubText: {
    fontSize: 10,
    color: '#64748B',
  },
  counterDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  upgradeSection: {
    marginBottom: 16,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  upgradeBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  upgradeHintText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  topTierBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 16,
  },
  topTierBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
    flex: 1,
    lineHeight: 16,
  },

  // Sub-modal Styles
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  subModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    maxHeight: '88%',
  },
  subModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  subModalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  subModalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  cycleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  cycleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  cycleBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  cycleBtnTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  upgradeOptionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  upgradeOptionCardLive: {
    borderColor: '#C4B5FD',
    backgroundColor: '#FAF5FF',
  },
  optionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  recommendedPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recommendedPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  optionPrice: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  optionPriceSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  optionPriceAnnualNote: {
    fontSize: 9.5,
    color: '#059669',
    fontWeight: '600',
  },
  optionFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  optionFeatureText: {
    fontSize: 11.5,
    color: '#334155',
    flex: 1,
  },
  selectPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  selectPlanBtnLive: {
    backgroundColor: '#7C3AED',
  },
  selectPlanBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Checkout (Ödeme Sayfası) Styles
  orderSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  orderSummaryTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11.5,
    color: '#64748B',
  },
  summaryVal: {
    fontSize: 11.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2563EB',
  },
  annualSavingNote: {
    fontSize: 10,
    color: '#059669',
    marginTop: 4,
    fontWeight: '600',
  },
  paymentMethodTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  paymentMethodTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  paymentMethodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  paymentMethodTabActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  paymentMethodTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  paymentMethodTabTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  cardForm: {
    gap: 10,
    marginBottom: 14,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  textInput: {
    height: 40,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    fontSize: 12.5,
    color: '#0F172A',
  },
  invoiceInfoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 14,
  },
  invoiceInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
    marginBottom: 4,
    textAlign: 'center',
  },
  invoiceInfoSub: {
    fontSize: 11,
    color: '#3B82F6',
    textAlign: 'center',
    lineHeight: 15,
  },
  completePaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  completePaymentBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
