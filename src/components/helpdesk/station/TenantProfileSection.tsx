import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react-native';

interface TenantProfileSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  currentEnterpriseName: string;
  activeEnterpriseBlindId: string;
  onCopyBlindId: (id: string) => void;
}

export const TenantProfileSection: React.FC<TenantProfileSectionProps> = ({
  isExpanded,
  onToggle,
  currentEnterpriseName,
  activeEnterpriseBlindId,
  onCopyBlindId,
}) => {
  return (
    <View style={styles.geminiCard}>
      <TouchableOpacity
        style={styles.geminiCardHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={[styles.geminiIconCircle, { backgroundColor: '#EFF6FF' }]}>
          <Building2 size={20} color="#2563EB" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.geminiCardTitle}>Kurum & Kiracı Bilgileri</Text>
          <Text style={styles.geminiCardSubtitle}>Sovereign mülkiyet ve bağlantı detayları</Text>
        </View>
        <View style={styles.geminiStatusPill}>
          <Text style={styles.geminiStatusPillText}>Mühürlü</Text>
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color="#64748B" style={{ marginLeft: 6 }} />
        ) : (
          <ChevronDown size={20} color="#64748B" style={{ marginLeft: 6 }} />
        )}
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.geminiCardBody}>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoRowLabel}>Kurum Adı</Text>
            <Text style={styles.infoRowValue}>{currentEnterpriseName}</Text>
          </View>

          <View style={styles.infoRowItem}>
            <Text style={styles.infoRowLabel}>Kör Kimlik (Blind ID)</Text>
            <TouchableOpacity 
              style={styles.copyChipRow}
              onPress={() => onCopyBlindId(activeEnterpriseBlindId || 'default')}
              activeOpacity={0.7}
            >
              <Text style={styles.copyChipText} numberOfLines={1} ellipsizeMode="middle">
                {activeEnterpriseBlindId || 'default'}
              </Text>
              <Copy size={13} color="#2563EB" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoRowItem}>
            <Text style={styles.infoRowLabel}>Yönetici Yetkisi</Text>
            <Text style={[styles.infoRowValue, { color: '#2563EB', fontWeight: '800' }]}>
              WhiteCosmos (*) Global Admin
            </Text>
          </View>

          <View style={styles.infoRowItem}>
            <Text style={styles.infoRowLabel}>Protokol</Text>
            <Text style={styles.infoRowValue}>Neon HTTPS • Sıfır Kişisel Veri • E2EE</Text>
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
    backgroundColor: '#EFF6FF',
    marginLeft: 6,
  },
  geminiStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  geminiCardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  infoRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoRowLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  infoRowValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  copyChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 180,
  },
  copyChipText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#1D4ED8',
    fontWeight: '600',
    flexShrink: 1,
  },
});
