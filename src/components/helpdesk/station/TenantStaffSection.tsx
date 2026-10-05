import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Users,
  ChevronDown,
  ChevronUp,
  UserPlus,
  CheckCircle2,
} from 'lucide-react-native';
import { AdminEntry, HelpDeskCategory } from '../../../services/helpDeskService';

interface TenantStaffSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  adminsList: AdminEntry[];
  selectedAdminId: string;
  onSelectAdmin: (id: string) => void;
  onRemoveAdmin: (id: string) => void;
  onGenerateOperatorInvite: () => void;
  selectedCatIds: string[];
  currentAppCategories: HelpDeskCategory[];
  onToggleCategory: (catId: string) => void;
  onSaveAllocation: () => void;
  tAllLabel: string;
}

export const TenantStaffSection: React.FC<TenantStaffSectionProps> = ({
  isExpanded,
  onToggle,
  adminsList,
  selectedAdminId,
  onSelectAdmin,
  onRemoveAdmin,
  onGenerateOperatorInvite,
  selectedCatIds,
  currentAppCategories,
  onToggleCategory,
  onSaveAllocation,
  tAllLabel,
}) => {
  return (
    <View style={styles.geminiCard}>
      <TouchableOpacity
        style={styles.geminiCardHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={[styles.geminiIconCircle, { backgroundColor: '#EEF2FF' }]}>
          <Users size={20} color="#4F46E5" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.geminiCardTitle}>Yetkilendirme & Ekip</Text>
          <Text style={styles.geminiCardSubtitle}>Destek operatörleri ve departmanlar</Text>
        </View>
        <View style={[styles.geminiStatusPill, { backgroundColor: '#E0E7FF' }]}>
          <Text style={[styles.geminiStatusPillText, { color: '#4338CA' }]}>{adminsList.length} Personel</Text>
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color="#64748B" style={{ marginLeft: 6 }} />
        ) : (
          <ChevronDown size={20} color="#64748B" style={{ marginLeft: 6 }} />
        )}
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.geminiCardBody}>
          <Text style={styles.subSectionHeader}>Masadaki Aktif Yöneticiler</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {adminsList.map((adm) => {
              const isSelected = selectedAdminId === adm.white_id;
              return (
                <TouchableOpacity
                  key={adm.white_id}
                  style={[styles.adminPill, isSelected && styles.adminPillSelected]}
                  onPress={() => onSelectAdmin(adm.white_id)}
                  onLongPress={() => onRemoveAdmin(adm.white_id)}
                  delayLongPress={500}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.adminPillAlias, isSelected && styles.adminPillAliasSelected]}>
                    {adm.alias || 'Admin'}
                  </Text>
                  <Text style={[styles.adminPillId, isSelected && styles.adminPillIdSelected]}>
                    {adm.role === 'global_admin' ? 'WhiteCosmos' : adm.role}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.addOpBtn}
            onPress={onGenerateOperatorInvite}
            activeOpacity={0.8}
          >
            <UserPlus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.addOpBtnText}>Yeni Operatör Davet Hash'i Üret & Kopyala</Text>
          </TouchableOpacity>

          {/* Departman Yetki Matrisi */}
          <Text style={[styles.subSectionHeader, { marginTop: 14 }]}>Departman Yetki Matrisi</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <TouchableOpacity
              style={[styles.catPill, selectedCatIds.includes('all') && styles.catPillSelected]}
              onPress={() => onToggleCategory('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.catPillText, selectedCatIds.includes('all') && styles.catPillTextSelected]}>
                {tAllLabel}
              </Text>
            </TouchableOpacity>
            {currentAppCategories.map((cat) => {
              const isSelected = selectedCatIds.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPill, isSelected && styles.catPillSelected]}
                  onPress={() => onToggleCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catPillText, isSelected && styles.catPillTextSelected]}>
                    {cat.labelTr || cat.id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.fluidSubmitBtn, styles.fluidSubmitBtnActive, { paddingVertical: 12 }]}
            onPress={onSaveAllocation}
            activeOpacity={0.8}
          >
            <CheckCircle2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={[styles.fluidSubmitBtnText, { fontSize: 13 }]}>Yetkiyi Kaydet</Text>
          </TouchableOpacity>
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
  subSectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  adminPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  adminPillSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  adminPillAlias: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  adminPillAliasSelected: {
    color: '#4338CA',
  },
  adminPillId: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  adminPillIdSelected: {
    color: '#6366F1',
  },
  addOpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  addOpBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  catPillSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  catPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  catPillTextSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  fluidSubmitBtn: {
    backgroundColor: '#94A3B8',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fluidSubmitBtnActive: {
    backgroundColor: '#2563EB',
  },
  fluidSubmitBtnText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
