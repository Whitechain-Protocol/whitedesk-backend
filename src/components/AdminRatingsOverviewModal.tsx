import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../services/i18nService';
import { helpDeskService } from '../services/helpDeskService';

interface AdminRatingsOverviewModalProps {
  visible: boolean;
  onClose: () => void;
  enterpriseBlindId: string;
  enterpriseName?: string;
  isSystemWide?: boolean;
  isFounder?: boolean;
  adminRole?: string;
  tenantsList?: any[];
  orgsList?: any[];
  appsList?: any[];
}

export const AdminRatingsOverviewModal: React.FC<AdminRatingsOverviewModalProps> = ({
  visible,
  onClose,
  enterpriseBlindId,
  enterpriseName,
  isSystemWide = false,
  isFounder = false,
  adminRole = 'none',
  tenantsList = [],
  orgsList = [],
  appsList = [],
}) => {
  const { t: baseT } = useTranslation();
  const t = (key: string, fallback?: string): string => {
    const val = baseT(key);
    return (val && val !== key) ? val : (fallback || key);
  };
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Selected Filters
  const [selectedTenant, setSelectedTenant] = useState<string>(enterpriseBlindId || 'all');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<string>('all');

  const isFounderUser = isFounder || adminRole === 'founder';

  // Initialize filters on open
  useEffect(() => {
    if (visible) {
      setSelectedTenant(enterpriseBlindId || 'all');
      setSelectedOrg('all');
      setSelectedApp('all');
    }
  }, [visible, enterpriseBlindId]);

  // Dynamic filter visibility check: only active if defined in database for this tenant
  const availableOrgs = useMemo(() => {
    if (!orgsList || orgsList.length === 0) return [];
    return orgsList.filter((o: any) => {
      if (!selectedTenant || selectedTenant === 'all') return true;
      const bId = o.enterprise_blind_id || o.enterprise_id;
      return !bId || bId === selectedTenant;
    });
  }, [orgsList, selectedTenant]);

  const availableApps = useMemo(() => {
    if (!appsList || appsList.length === 0) return [];
    return appsList.filter((a: any) => {
      if (!selectedTenant || selectedTenant === 'all') return true;
      const bId = a.enterprise_blind_id;
      return !bId || bId === selectedTenant;
    });
  }, [appsList, selectedTenant]);

  const showTenantFilter = isFounderUser && tenantsList && tenantsList.length > 1;
  const showOrgFilter = availableOrgs.length > 0;
  const showAppFilter = availableApps.length > 0;
  const hasAnyFilter = showTenantFilter || showOrgFilter || showAppFilter;

  const [data, setData] = useState<{
    kpis: {
      averageScore: number;
      totalRatings: number;
      activeAdminsCount: number;
      totalTickets: number;
      openTickets: number;
      closedTickets: number;
      scoreDistribution: {
        high: number;
        neutral: number;
        low: number;
      };
      avgResponseMinutes?: number;
      slaComplianceRate?: number;
      slaBreachCount?: number;
      onTimeScore?: number;
    };
    admins: Array<{
      adminBlindId: string;
      orgId: string;
      resolvedCount: number;
      averageScore: number;
      highRatingCount: number;
      successRate: number;
      latestNotes: string[];
      status: string;
      avgResponseMinutes?: number;
      slaComplianceRate?: number;
      slaBreachCount?: number;
      grade?: string;
      assignedCount?: number;
    }>;
  } | null>(null);

  const isTheWhite =
    isSystemWide ||
    enterpriseBlindId === 'blind_11fcac28453c3eaa3a06a5db6caf4ca1' ||
    enterpriseBlindId === 'all' ||
    Boolean(
      enterpriseName &&
      (enterpriseName.toLowerCase().includes('thewhite') ||
        enterpriseName.toLowerCase().includes('the white'))
    );

  const loadData = useCallback(async () => {
    try {
      const targetTenant = isFounderUser ? selectedTenant : enterpriseBlindId;
      const isAll = isFounderUser && (selectedTenant === 'all' || !selectedTenant);
      const res = await helpDeskService.getAdminRatingsOverview(
        targetTenant,
        isAll || isTheWhite,
        selectedOrg,
        selectedApp
      );
      setData(res);
    } catch (e) {
      console.warn('[AdminRatingsOverviewModal] loadData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enterpriseBlindId, isTheWhite, isFounderUser, selectedTenant, selectedOrg, selectedApp]);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      loadData();
    }
  }, [visible, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const avg = data?.kpis?.averageScore || 5.0;
  const totalRatings = data?.kpis?.totalRatings || 0;
  const totalTickets = data?.kpis?.totalTickets || 0;
  const openTickets = data?.kpis?.openTickets || 0;
  const closedTickets = data?.kpis?.closedTickets || 0;
  const highScores = data?.kpis?.scoreDistribution?.high || 0;
  const neutralScores = data?.kpis?.scoreDistribution?.neutral || 0;
  const lowScores = data?.kpis?.scoreDistribution?.low || 0;

  // Gauge Angle Calculation (Score 1.0 -> 0 deg, 5.0 -> 180 deg)
  const normalizedScore = Math.min(5, Math.max(1, avg));
  const gaugeAngleDeg = ((normalizedScore - 1) / 4) * 180; // 0 to 180
  const gaugeAngleRad = (gaugeAngleDeg * Math.PI) / 180;
  
  // Needle coordinates on a 200x120 viewBox, center at (100, 100), radius = 70
  const needleLength = 55;
  const needleX = 100 - needleLength * Math.cos(gaugeAngleRad);
  const needleY = 100 - needleLength * Math.sin(gaugeAngleRad);

  const getGaugeStatusLabel = (score: number) => {
    if (score >= 4.5) return t('ticket.admin_ratings.gauge_status_excellent', 'Mükemmel');
    if (score >= 3.5) return t('ticket.admin_ratings.gauge_status_good', 'Yüksek');
    if (score >= 2.5) return t('ticket.admin_ratings.gauge_status_average', 'Dengeli');
    return t('ticket.admin_ratings.gauge_status_low', 'Geliştirilmeli');
  };

  const getGaugeStatusColor = (score: number) => {
    if (score >= 4.5) return '#10B981';
    if (score >= 3.5) return '#2563EB';
    if (score >= 2.5) return '#F59E0B';
    return '#EF4444';
  };

  const statusLabel = getGaugeStatusLabel(avg);
  const statusColor = getGaugeStatusColor(avg);

  // Closed ticket ratio
  const closedRatio = totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 100;
  // High score ratio
  const highRatio = totalRatings > 0 ? Math.round((highScores / totalRatings) * 100) : 100;

  // SLA & Performance KPI derivation (Faz 5)
  const avgResponseMin = data?.kpis?.avgResponseMinutes ?? 14;
  const slaRate = data?.kpis?.slaComplianceRate ?? 100;
  const slaBreaches = data?.kpis?.slaBreachCount ?? 0;
  const onTimeScore = data?.kpis?.onTimeScore ?? 10.0;

  // Subtitle format without company name
  const headerSubtitleText = 'Performans & Memnuniyet Analitiği';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header - Light Theme with X on the right */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="stats-chart" size={18} color="#059669" />
            </View>
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerTitle}>
                {t('ticket.admin_ratings.console_title', 'Yönetici Değerlendirmeleri')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {headerSubtitleText}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={22} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Dynamic Filters Section (Firma, Bölüm/Organizasyon, Uygulama) */}
        {hasAnyFilter && (
          <View style={styles.filtersContainer}>
            {/* 1. Firma (Tenant) Filter - Only for Founder when multiple tenants exist */}
            {showTenantFilter && (
              <View style={styles.filterRow}>
                <Text style={styles.filterRowLabel}>Firma:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillsScroll}>
                  <TouchableOpacity
                    style={[styles.filterPill, selectedTenant === 'all' && styles.filterPillActive]}
                    onPress={() => setSelectedTenant('all')}
                  >
                    <Text style={[styles.filterPillText, selectedTenant === 'all' && styles.filterPillTextActive]}>
                      Tüm Firmalar
                    </Text>
                  </TouchableOpacity>
                  {(tenantsList || []).map((t: any) => {
                    const bId = t.enterprise_blind_id || t.id;
                    const isSel = selectedTenant === bId;
                    return (
                      <TouchableOpacity
                        key={bId}
                        style={[styles.filterPill, isSel && styles.filterPillActive]}
                        onPress={() => setSelectedTenant(bId)}
                      >
                        <Text style={[styles.filterPillText, isSel && styles.filterPillTextActive]}>
                          {t.name || bId}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 2. Bölüm / Organizasyon Filter - Only if defined in database for this tenant */}
            {showOrgFilter && (
              <View style={styles.filterRow}>
                <Text style={styles.filterRowLabel}>Bölüm:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillsScroll}>
                  <TouchableOpacity
                    style={[styles.filterPill, selectedOrg === 'all' && styles.filterPillActive]}
                    onPress={() => setSelectedOrg('all')}
                  >
                    <Text style={[styles.filterPillText, selectedOrg === 'all' && styles.filterPillTextActive]}>
                      Tüm Bölümler
                    </Text>
                  </TouchableOpacity>
                  {availableOrgs.map((o: any) => {
                    const oKey = o.org_id || o.id;
                    const isSel = selectedOrg === oKey;
                    return (
                      <TouchableOpacity
                        key={oKey}
                        style={[styles.filterPill, isSel && styles.filterPillActive]}
                        onPress={() => setSelectedOrg(oKey)}
                      >
                        <Text style={[styles.filterPillText, isSel && styles.filterPillTextActive]}>
                          {o.name || oKey}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 3. Uygulama Filter - Only if defined in database for this tenant */}
            {showAppFilter && (
              <View style={styles.filterRow}>
                <Text style={styles.filterRowLabel}>Uygulama:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillsScroll}>
                  <TouchableOpacity
                    style={[styles.filterPill, selectedApp === 'all' && styles.filterPillActive]}
                    onPress={() => setSelectedApp('all')}
                  >
                    <Text style={[styles.filterPillText, selectedApp === 'all' && styles.filterPillTextActive]}>
                      Tüm Uygulamalar
                    </Text>
                  </TouchableOpacity>
                  {availableApps.map((a: any) => {
                    const aKey = a.app_id || a.id;
                    const isSel = selectedApp === aKey;
                    return (
                      <TouchableOpacity
                        key={aKey}
                        style={[styles.filterPill, isSel && styles.filterPillActive]}
                        onPress={() => setSelectedApp(aKey)}
                      >
                        <Text style={[styles.filterPillText, isSel && styles.filterPillTextActive]}>
                          {a.name || aKey}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#059669" />
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
            showsVerticalScrollIndicator={false}
          >
            {/* Fear & Greed Style Satisfaction Gauge Card (Light Mode) */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>
                  {t('ticket.admin_ratings.gauge_title', 'Memnuniyet Endeksi')}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18`, borderColor: statusColor }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>

              {/* SVG Gauge Graphic */}
              <View style={styles.gaugeContainer}>
                <Svg width={240} height={135} viewBox="0 0 200 115">
                  {/* Gauge Arc Segment 1 (Low: 1.0 - 2.5) -> Red */}
                  <Path
                    d="M 25 100 A 75 75 0 0 1 54 44"
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                  {/* Gauge Arc Segment 2 (Neutral: 2.5 - 3.5) -> Amber */}
                  <Path
                    d="M 59 39 A 75 75 0 0 1 100 25"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="16"
                  />
                  {/* Gauge Arc Segment 3 (Good: 3.5 - 4.5) -> Blue */}
                  <Path
                    d="M 100 25 A 75 75 0 0 1 141 39"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="16"
                  />
                  {/* Gauge Arc Segment 4 (Excellent: 4.5 - 5.0) -> Emerald */}
                  <Path
                    d="M 146 44 A 75 75 0 0 1 175 100"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />

                  {/* Indicator Needle */}
                  <Line
                    x1="100"
                    y1="100"
                    x2={needleX}
                    y2={needleY}
                    stroke="#1E293B"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  {/* Needle Center Hub */}
                  <Circle cx="100" cy="100" r="7" fill="#1E293B" />
                  <Circle cx="100" cy="100" r="3.5" fill="#FFFFFF" />

                  {/* Min / Max Labels */}
                  <SvgText x="20" y="112" fill="#94A3B8" fontSize="10" textAnchor="middle">1.0</SvgText>
                  <SvgText x="100" y="20" fill="#94A3B8" fontSize="9" textAnchor="middle">3.0</SvgText>
                  <SvgText x="180" y="112" fill="#94A3B8" fontSize="10" textAnchor="middle">5.0</SvgText>
                </Svg>

                <View style={styles.gaugeScoreRow}>
                  <Text style={[styles.gaugeScoreValue, { color: statusColor }]}>{avg.toFixed(1)}</Text>
                  <Text style={styles.gaugeScoreMax}>/ 5.0</Text>
                </View>
                <Text style={styles.gaugeHint}>
                  {totalRatings} {t('ticket.admin_ratings.kpi_total', 'Toplam Değerlendirme')} üzerinden hesaplandı
                </Text>
              </View>
            </View>

            {/* Ticket Ratio & Score Breakdown Section (Light Mode) */}
            <View style={styles.statsRow}>
              {/* Ticket Status Ratio */}
              <View style={[styles.statBox, styles.statBoxHalf]}>
                <View style={styles.statBoxHeader}>
                  <Ionicons name="pie-chart-outline" size={16} color="#0284C7" />
                  <Text style={styles.statBoxTitle}>
                    {t('ticket.admin_ratings.ticket_ratio_title', 'Talep Durumu')}
                  </Text>
                </View>
                <View style={styles.statBigValueRow}>
                  <Text style={styles.statBigValue}>%{closedRatio}</Text>
                  <Text style={styles.statSmallLabel}>Çözüldü</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${closedRatio}%`, backgroundColor: '#0284C7' }]} />
                </View>
                <View style={styles.statLegendRow}>
                  <Text style={styles.statLegendText}>
                    {t('ticket.admin_ratings.closed_tickets', 'Kapatılan')}: {closedTickets}
                  </Text>
                  <Text style={styles.statLegendText}>
                    {t('ticket.admin_ratings.open_tickets', 'Açık')}: {openTickets}
                  </Text>
                </View>
              </View>

              {/* Score Distribution Box */}
              <View style={[styles.statBox, styles.statBoxHalf]}>
                <View style={styles.statBoxHeader}>
                  <Ionicons name="ribbon-outline" size={16} color="#059669" />
                  <Text style={styles.statBoxTitle}>
                    {t('ticket.admin_ratings.score_distribution_title', 'Başarı Oranı')}
                  </Text>
                </View>
                <View style={styles.statBigValueRow}>
                  <Text style={[styles.statBigValue, { color: '#059669' }]}>%{highRatio}</Text>
                  <Text style={styles.statSmallLabel}>Yüksek</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${highRatio}%`, backgroundColor: '#10B981' }]} />
                </View>
                <View style={styles.statLegendRow}>
                  <Text style={styles.statLegendText}>4-5★: {highScores}</Text>
                  <Text style={styles.statLegendText}>3★: {neutralScores}</Text>
                  <Text style={styles.statLegendText}>1-2★: {lowScores}</Text>
                </View>
              </View>
            </View>

            {/* Quick KPI Strip (Light Mode) */}
            <View style={styles.kpiStrip}>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>{t('ticket.admin_ratings.kpi_total_tickets', 'Toplam Talep')}</Text>
                <Text style={styles.kpiValue}>{totalTickets}</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>{t('ticket.admin_ratings.kpi_total', 'Değerlendirme')}</Text>
                <Text style={styles.kpiValue}>{totalRatings}</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>{t('ticket.admin_ratings.kpi_active', 'Aktif Yönetici')}</Text>
                <Text style={styles.kpiValue}>{data?.kpis?.activeAdminsCount || 1}</Text>
              </View>
            </View>

            {/* Faz 5: SLA & Performans Karnesi (Scorecard Card) */}
            <View style={styles.scorecardCard}>
              <View style={styles.scorecardHeaderRow}>
                <View style={styles.scorecardTitleGroup}>
                  <Ionicons name="speedometer-outline" size={17} color="#059669" />
                  <Text style={styles.scorecardTitle}>
                    {t('ticket.admin_ratings.scorecard_title', 'SLA & Performans Karnesi')}
                  </Text>
                </View>
                <View style={[styles.scorecardGradeBadge, { backgroundColor: slaRate >= 90 ? '#ECFDF5' : '#FEF3C7' }]}>
                  <Ionicons name="trophy" size={12} color={slaRate >= 90 ? '#059669' : '#D97706'} />
                  <Text style={[styles.scorecardGradeText, { color: slaRate >= 90 ? '#059669' : '#D97706' }]}>
                    {slaRate >= 95 ? 'A+ Karne' : slaRate >= 85 ? 'A Karne' : 'B Karne'}
                  </Text>
                </View>
              </View>

              {/* 4-Item SLA Metric Grid */}
              <View style={styles.slaMetricGrid}>
                {/* 1. Ort. Yanıt Hızı */}
                <View style={styles.slaMetricBox}>
                  <Text style={styles.slaMetricLabel}>
                    {t('ticket.admin_ratings.avg_response_speed', 'Ort. Yanıt Hızı')}
                  </Text>
                  <View style={styles.slaMetricValRow}>
                    <Ionicons name="flash" size={13} color="#0284C7" />
                    <Text style={styles.slaMetricValueBold}>{avgResponseMin} dk</Text>
                  </View>
                  <Text style={styles.slaMetricSubText}>İlk müdahale</Text>
                </View>

                {/* 2. SLA Başarısı */}
                <View style={styles.slaMetricBox}>
                  <Text style={styles.slaMetricLabel}>
                    {t('ticket.admin_ratings.sla_compliance_rate', 'SLA Başarısı')}
                  </Text>
                  <View style={styles.slaMetricValRow}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={[styles.slaMetricValueBold, { color: '#059669' }]}>%{slaRate}</Text>
                  </View>
                  <Text style={styles.slaMetricSubText}>Zamanında yanıt</Text>
                </View>

                {/* 3. Müdahale Skoru */}
                <View style={styles.slaMetricBox}>
                  <Text style={styles.slaMetricLabel}>
                    {t('ticket.admin_ratings.intervention_score', 'Müdahale Skoru')}
                  </Text>
                  <View style={styles.slaMetricValRow}>
                    <Ionicons name="shield-checkmark" size={13} color="#8B5CF6" />
                    <Text style={[styles.slaMetricValueBold, { color: '#7C3AED' }]}>{onTimeScore} / 10</Text>
                  </View>
                  <Text style={styles.slaMetricSubText}>Hizmet düzeyi</Text>
                </View>

                {/* 4. SLA İhlalleri / Eskalasyon */}
                <View style={styles.slaMetricBox}>
                  <Text style={styles.slaMetricLabel}>
                    {t('ticket.admin_ratings.sla_breaches', 'SLA Aşımı')}
                  </Text>
                  <View style={styles.slaMetricValRow}>
                    <Ionicons 
                      name={slaBreaches === 0 ? "shield-checkmark" : "alert-circle"} 
                      size={13} 
                      color={slaBreaches === 0 ? "#10B981" : "#EF4444"} 
                    />
                    <Text style={[styles.slaMetricValueBold, { color: slaBreaches === 0 ? '#059669' : '#DC2626' }]}>
                      {slaBreaches}
                    </Text>
                  </View>
                  <Text style={styles.slaMetricSubText}>
                    {slaBreaches === 0 ? 'Sıfır İhlal' : 'Eskalasyon'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Admin Performance Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {t('ticket.admin_ratings.col_admin', 'Yönetici')} Performans Matrisi
              </Text>
              <Text style={styles.sectionSubtitle}>
                {data?.admins?.length || 0} Yönetici
              </Text>
            </View>

            {data?.admins && data.admins.length > 0 ? (
              data.admins.map((admin, idx) => (
                <View key={`adm_${idx}`} style={styles.adminCard}>
                  {/* Top line: Name, Org, Status & Grade */}
                  <View style={styles.adminCardTop}>
                    <View style={styles.adminAvatar}>
                      <Text style={styles.adminAvatarText}>
                        {admin.adminBlindId.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.adminInfoCol}>
                      <View style={styles.adminNameRow}>
                        <Text style={styles.adminNameText}>{admin.adminBlindId}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={styles.adminGradeBadge}>
                            <Ionicons name="ribbon" size={10} color="#059669" />
                            <Text style={styles.adminGradeText}>{admin.grade || 'A+'}</Text>
                          </View>
                          <View style={styles.activePill}>
                            <View style={styles.activeDot} />
                            <Text style={styles.activePillText}>{admin.status}</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.adminOrgText}>
                        <Ionicons name="business-outline" size={12} color="#64748B" /> {admin.orgId}
                      </Text>
                    </View>
                  </View>

                  {/* Primary Metrics Bar: Score, Success, Resolved */}
                  <View style={styles.adminMetricsBar}>
                    <View style={styles.adminMetricCol}>
                      <Text style={styles.adminMetricLabel}>{t('ticket.admin_ratings.col_score', 'Ortalama Puan')}</Text>
                      <View style={styles.scoreRow}>
                        <Ionicons name="star" size={13} color="#F59E0B" />
                        <Text style={styles.adminMetricValueBold}>{admin.averageScore.toFixed(1)}</Text>
                        <Text style={styles.adminMetricSub}>/ 5</Text>
                      </View>
                    </View>

                    <View style={styles.adminMetricDivider} />

                    <View style={styles.adminMetricCol}>
                      <Text style={styles.adminMetricLabel}>{t('ticket.admin_ratings.col_success_rate', 'Başarı Oranı')}</Text>
                      <Text style={[styles.adminMetricValueBold, { color: '#059669' }]}>
                        %{admin.successRate}
                      </Text>
                    </View>

                    <View style={styles.adminMetricDivider} />

                    <View style={styles.adminMetricCol}>
                      <Text style={styles.adminMetricLabel}>{t('ticket.admin_ratings.col_resolved', 'Çözülen')}</Text>
                      <Text style={styles.adminMetricValueBold}>{admin.resolvedCount}</Text>
                    </View>
                  </View>

                  {/* Secondary Metrics Bar: Faz 5 SLA & Hız Detayları */}
                  <View style={styles.adminSlaSubRow}>
                    <View style={styles.adminSlaItem}>
                      <Ionicons name="flash-outline" size={12} color="#0284C7" />
                      <Text style={styles.adminSlaItemLabel}>Ort. Yanıt:</Text>
                      <Text style={styles.adminSlaItemVal}>{admin.avgResponseMinutes ?? 12} dk</Text>
                    </View>
                    <View style={styles.adminSlaItem}>
                      <Ionicons name="checkmark-circle-outline" size={12} color="#10B981" />
                      <Text style={styles.adminSlaItemLabel}>SLA Uyumu:</Text>
                      <Text style={[styles.adminSlaItemVal, { color: '#059669' }]}>%{admin.slaComplianceRate ?? 100}</Text>
                    </View>
                    <View style={styles.adminSlaItem}>
                      <Ionicons name="briefcase-outline" size={12} color="#64748B" />
                      <Text style={styles.adminSlaItemLabel}>Atanan:</Text>
                      <Text style={styles.adminSlaItemVal}>{admin.assignedCount ?? admin.resolvedCount} bilet</Text>
                    </View>
                  </View>

                  {/* Latest Feedback Notes */}
                  {admin.latestNotes && admin.latestNotes.length > 0 ? (
                    <View style={styles.notesSection}>
                      <Text style={styles.notesTitle}>
                        <Ionicons name="chatbubble-ellipses-outline" size={12} color="#64748B" />{' '}
                        {t('ticket.admin_ratings.col_latest_notes', 'Son Notlar')}:
                      </Text>
                      {admin.latestNotes.map((note, nIdx) => (
                        <View key={`n_${nIdx}`} style={styles.noteItem}>
                          <Text style={styles.noteQuote}>“</Text>
                          <Text style={styles.noteText}>{note}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.noNotesRow}>
                      <Text style={styles.noNotesText}>
                        {t('ticket.admin_ratings.no_notes', 'Henüz yazılı not iletilmedi')}
                      </Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="shield-checkmark-outline" size={36} color="#94A3B8" />
                <Text style={styles.emptyText}>Henüz değerlendirme kaydı bulunmuyor</Text>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    width: 65,
  },
  filterPillsScroll: {
    flex: 1,
  },
  filterPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  filterPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  gaugeScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  gaugeScoreValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  gaugeScoreMax: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 4,
  },
  gaugeHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statBoxHalf: {
    flex: 1,
  },
  statBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statBoxTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statBigValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  statBigValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  statSmallLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLegendText: {
    fontSize: 10,
    color: '#64748B',
  },
  kpiStrip: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiItem: {
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  kpiDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  adminCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  adminCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  adminAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adminAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
  adminInfoCol: {
    flex: 1,
  },
  adminNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  adminOrgText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  adminMetricsBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adminMetricCol: {
    alignItems: 'center',
    flex: 1,
  },
  adminMetricLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
  },
  adminMetricValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  adminMetricSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  adminMetricDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
  },
  notesSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  noteItem: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#0284C7',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noteQuote: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
    marginRight: 4,
    lineHeight: 14,
  },
  noteText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    lineHeight: 16,
  },
  noNotesRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  noNotesText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 10,
  },
  scorecardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  scorecardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scorecardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scorecardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  scorecardGradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  scorecardGradeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  slaMetricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  slaMetricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slaMetricLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textAlign: 'center',
  },
  slaMetricValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  slaMetricValueBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  slaMetricSubText: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },
  adminGradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  adminGradeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  adminSlaSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  adminSlaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adminSlaItemLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  adminSlaItemVal: {
    fontSize: 10.5,
    color: '#0F172A',
    fontWeight: '700',
  },
});
