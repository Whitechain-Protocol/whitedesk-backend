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
          <Text style={styles.geminiCardTitle}>Lisans & Kotalar</Text>
          <Text style={styles.geminiCardSubtitle}>14 gün deneme, koltuklar ve paketler</Text>
        </View>
        <View style={[styles.geminiStatusPill, { backgroundColor: '#DCFCE7' }]}>
          <Text style={[styles.geminiStatusPillText, { color: '#15803D' }]}>14 Gün Deneme</Text>
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
              <Text style={styles.quotaBoxLabel}>Operatör Koltuğu</Text>
            </View>
            <View style={styles.quotaBox}>
              <Text style={styles.quotaBoxNumber}>{tenantStats.userCount} / 10</Text>
              <Text style={styles.quotaBoxLabel}>Müşteri Kotası</Text>
            </View>
          </View>

          {/* EK LİSANSLAR */}
          <Text style={styles.subSectionHeader}>Ek Lisanslar</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity
              style={styles.addonActionBtn}
              onPress={onGenerateOperatorAddon}
              activeOpacity={0.7}
            >
              <UserPlus size={14} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={styles.addonActionBtnText}>+1 Operatör ($9)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addonActionBtn}
              onPress={onGenerateUserAddon}
              activeOpacity={0.7}
            >
              <Users size={14} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={styles.addonActionBtnText}>+25 Müşteri ($9)</Text>
            </TouchableOpacity>
          </View>

          {copiedConsoleHash && (
            <View style={styles.copiedBanner}>
              <Check size={14} color="#16A34A" style={{ marginRight: 6 }} />
              <Text style={styles.copiedBannerText} numberOfLines={1}>
                Yeni Hash: {copiedConsoleHash}
              </Text>
            </View>
          )}

          {/* LİSANS PAKETLERİ */}
          <Text style={[styles.subSectionHeader, { marginTop: 12 }]}>Lisans Paketleri</Text>
          <View style={styles.tierPlanBox}>
            <Text style={styles.tierPlanName}>Starter Plan</Text>
            <Text style={styles.tierPlanPrice}>$19 / ay</Text>
            <Text style={styles.tierPlanDesc}>3 Operatör • 50 Müşteri</Text>
          </View>

          <View style={[styles.tierPlanBox, styles.tierPlanBoxPro]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.tierPlanName}>Pro Plan ⭐</Text>
              <Text style={styles.popularBadge}>Önerilen</Text>
            </View>
            <Text style={styles.tierPlanPrice}>$49 / ay</Text>
            <Text style={styles.tierPlanDesc}>10 Operatör • 250 Müşteri</Text>
          </View>

          <View style={styles.tierPlanBox}>
            <Text style={styles.tierPlanName}>Enterprise Plan</Text>
            <Text style={styles.tierPlanPrice}>$149 / ay</Text>
            <Text style={styles.tierPlanDesc}>Sınırsız Operatör • Sınırsız Müşteri</Text>
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
