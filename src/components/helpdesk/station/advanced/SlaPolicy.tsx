import React from 'react';
import { StyleSheet, View, Text, Switch, TouchableOpacity } from 'react-native';
import { TrendingUp, Clock } from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../../types';

interface SlaPolicyProps {
  config: AdvancedFeaturesConfig;
  onChange: (updater: (prev: AdvancedFeaturesConfig) => AdvancedFeaturesConfig) => void;
  getLabel?: (a: string, b?: string, c?: string) => string;
  language?: string;
}

const SLA_PRESETS = [
  { label: '15 dk', mins: 15, hours: 0.25 },
  { label: '30 dk', mins: 30, hours: 0.5 },
  { label: '1 sa', mins: 60, hours: 1 },
  { label: '2 sa', mins: 120, hours: 2 },
  { label: '4 sa', mins: 240, hours: 4 },
  { label: '24 sa', mins: 1440, hours: 24 },
];

export const SlaPolicy: React.FC<SlaPolicyProps> = ({
  config,
  onChange,
  language = 'tr',
}) => {
  const isEn = language === 'en';

  const currentMins = config.escalation?.slaMinutes || (config.escalation?.slaHours ? config.escalation.slaHours * 60 : 120);

  const handleToggleEscalation = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      escalation: {
        ...(prev.escalation || { slaHours: 2, slaMinutes: 120 }),
        enabled: val,
      },
      selfDestruct: {
        ...prev.selfDestruct,
        escalationSlaHours: prev.escalation?.slaHours || 2,
      },
    }));
  };

  const handleSelectPreset = (preset: typeof SLA_PRESETS[0]) => {
    onChange(prev => ({
      ...prev,
      escalation: {
        ...(prev.escalation || { enabled: true }),
        enabled: true,
        slaHours: preset.hours,
        slaMinutes: preset.mins,
      },
      selfDestruct: {
        ...prev.selfDestruct,
        escalationSlaHours: preset.hours,
      },
    }));
  };

  return (
    <View style={styles.cardItem}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBox}>
          <TrendingUp size={18} color="#3B82F6" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle}>
            {isEn ? 'Escalation & SLA Policy' : 'Tırmanma & Yanıt Süresi (SLA)'}
          </Text>
          <Text style={styles.cardDesc}>
            {isEn
              ? 'Automatically re-allocate and twin re-key unaddressed tickets upon SLA breach.'
              : 'Süresi içinde yanıtlanmayan talepleri otomatik olarak yeni bir temsilciye aktarır.'}
          </Text>
        </View>
        <Switch
          value={Boolean(config.escalation?.enabled)}
          onValueChange={handleToggleEscalation}
          trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
          thumbColor={config.escalation?.enabled ? '#3B82F6' : '#FFFFFF'}
        />
      </View>

      {Boolean(config.escalation?.enabled) && (
        <View style={styles.subOptionBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Clock size={13} color="#64748B" style={{ marginRight: 5 }} />
            <Text style={styles.subOptionLabel}>
              {isEn ? 'Maximum Response Time (SLA)' : 'Maksimum Temsilci Yanıt Süresi (SLA)'}
            </Text>
          </View>

          <View style={styles.presetGrid}>
            {SLA_PRESETS.map(p => {
              const isSelected = currentMins === p.mins;
              return (
                <TouchableOpacity
                  key={p.mins}
                  style={[
                    styles.presetChip,
                    isSelected && styles.presetChipActive
                  ]}
                  onPress={() => handleSelectPreset(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  subOptionBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  subOptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  presetChipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
});
