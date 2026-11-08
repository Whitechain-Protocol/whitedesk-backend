import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Users,
  Check,
} from 'lucide-react-native';
import { useTranslation } from '../../../services/i18nService';

interface TenantLicenseSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  tenantStats: { adminCount: number; userCount: number };
  onGenerateOperatorAddon: () => void;
  onGenerateUserAddon: () => void;
  copiedConsoleHash: string | null;
}

export const TenantLicenseSection: React.FC<TenantLicenseSectionProps> = ({
  isExpanded,
  onToggle,
  tenantStats,
  onGenerateOperatorAddon,
  onGenerateUserAddon,
  copiedConsoleHash,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.geminiCard}>
      <TouchableOpacity
        style={styles.geminiCardHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={[styles.geminiIconCircle, { backgroundColor: '#ECFDF5' }]}>
          <Sparkles size={20} color="#059669" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.geminiCardTitle}>{t('provisioning.tenant_station.license_title')}</Text>
          <Text style={styles.geminiCardSubtitle}>{t('provisioning.tenant_station.license_subtitle')}</Text>
        </View>
        <View style={[styles.geminiStatusPill, { backgroundColor: '#DCFCE7' }]}>
          <Text style={[styles.geminiStatusPillText, { color: '#15803D' }]}>{t('provisioning.tenant_station.trial_14_days_pill')}</Text>
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color="#64748B" style={{ marginLeft: 6 }} />
        ) : (
          <ChevronDown size={20} color="#64748B" style={{ marginLeft: 6 }} />
        )}
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.geminiCardBody}>
          {/* CANLI KOTA SAYAÇLARI */}
          <View style={styles.quotaCountersRow}>
            <View style={styles.quotaBox}>
              <Text style={styles.quotaBoxNumber}>{tenantStats.adminCount} / 3</Text>
              <Text style={styles.quotaBoxLabel}>{t('provisioning.tenant_station.operator_seat_label')}</Text>
            </View>
            <View style={styles.quotaBox}>
              <Text style={styles.quotaBoxNumber}>{tenantStats.userCount} / 10</Text>
              <Text style={styles.quotaBoxLabel}>{t('provisioning.tenant_station.customer_quota_label')}</Text>
            </View>
          </View>

          {/* EK LİSANSLAR */}
          <Text style={styles.subSectionHeader}>{t('provisioning.tenant_station.extra_licenses_header')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity
              style={styles.addonActionBtn}
              onPress={onGenerateOperatorAddon}
              activeOpacity={0.7}
            >
              <UserPlus size={14} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={styles.addonActionBtnText}>{t('provisioning.tenant_station.addon_operator_btn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addonActionBtn}
              onPress={onGenerateUserAddon}
              activeOpacity={0.7}
            >
              <Users size={14} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={styles.addonActionBtnText}>{t('provisioning.tenant_station.addon_customer_btn')}</Text>
            </TouchableOpacity>
          </View>

          {copiedConsoleHash && (
            <View style={styles.copiedBanner}>
              <Check size={14} color="#16A34A" style={{ marginRight: 6 }} />
              <Text style={styles.copiedBannerText} numberOfLines={1}>
                {t('provisioning.tenant_station.new_hash_prefix', { hash: copiedConsoleHash })}
              </Text>
            </View>
          )}

          {/* LİSANS PAKETLERİ */}
          <Text style={[styles.subSectionHeader, { marginTop: 12 }]}>{t('provisioning.tenant_station.license_packages_header')}</Text>
          <View style={styles.tierPlanBox}>
            <Text style={styles.tierPlanName}>{t('provisioning.tenant_station.starter_title')}</Text>
            <Text style={styles.tierPlanPrice}>{t('provisioning.tenant_station.starter_price')}</Text>
            <Text style={styles.tierPlanDesc}>{t('provisioning.tenant_station.starter_desc')}</Text>
          </View>

          <View style={[styles.tierPlanBox, styles.tierPlanBoxPro]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.tierPlanName}>{t('provisioning.tenant_station.pro_title')}</Text>
              <Text style={styles.popularBadge}>{t('provisioning.tenant_station.recommended_badge')}</Text>
            </View>
            <Text style={styles.tierPlanPrice}>{t('provisioning.tenant_station.pro_price')}</Text>
            <Text style={styles.tierPlanDesc}>{t('provisioning.tenant_station.pro_desc')}</Text>
          </View>

          <View style={styles.tierPlanBox}>
            <Text style={styles.tierPlanName}>{t('provisioning.tenant_station.enterprise_title')}</Text>
            <Text style={styles.tierPlanPrice}>{t('provisioning.tenant_station.enterprise_price')}</Text>
            <Text style={styles.tierPlanDesc}>{t('provisioning.tenant_station.enterprise_desc')}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  geminiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  geminiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  geminiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  geminiCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  geminiCardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  geminiStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 6,
  },
  geminiStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  geminiCardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  quotaCountersRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quotaBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quotaBoxNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  quotaBoxLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  subSectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  addonActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  addonActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  copiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  copiedBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
    flex: 1,
  },
  tierPlanBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tierPlanBoxPro: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  tierPlanName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  tierPlanPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
  },
  tierPlanDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  popularBadge: {
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
