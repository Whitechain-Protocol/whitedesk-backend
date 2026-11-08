import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch } from 'react-native';
import { Clock } from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../../types';
import { useTranslation } from '../../../../services/i18nService';

interface DestructionPolicyProps {
  config: AdvancedFeaturesConfig;
  onChange: (updater: (prev: AdvancedFeaturesConfig) => AdvancedFeaturesConfig) => void;
  getLabel?: (a: string, b?: string, c?: string) => string;
  language?: string;
}

export const DestructionPolicy: React.FC<DestructionPolicyProps> = ({
  config,
  onChange,
}) => {
  const { t } = useTranslation();

  const handleToggleSelfDestruct = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      selfDestruct: {
        ...prev.selfDestruct,
        enabled: val,
      },
    }));
  };

  const handleSetRetentionHours = (hours: 24 | 72 | 168 | 0) => {
    onChange(prev => ({
      ...prev,
      selfDestruct: {
        ...prev.selfDestruct,
        retentionAfterResolvedHours: hours,
      },
    }));
  };

  return (
    <View style={styles.cardItem}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBox}>
          <Clock size={18} color="#3B82F6" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle}>
            {t('settings.advanced_features.self_destruct.title')}
          </Text>
          <Text style={styles.cardDesc}>
            {t('settings.advanced_features.self_destruct.description')}
          </Text>
        </View>
        <Switch
          value={config.selfDestruct.enabled}
          onValueChange={handleToggleSelfDestruct}
          trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
          thumbColor={config.selfDestruct.enabled ? '#3B82F6' : '#FFFFFF'}
        />
      </View>

      {config.selfDestruct.enabled && (
        <View style={styles.subOptionBox}>
          <Text style={styles.subOptionLabel}>
            {t('settings.advanced_features.self_destruct.timer_label')}
          </Text>

          <View style={styles.radioList}>
            {[
              { h: 24, label: t('settings.advanced_features.self_destruct.opt_24h') },
              { h: 72, label: t('settings.advanced_features.self_destruct.opt_72h') },
              { h: 168, label: t('settings.advanced_features.self_destruct.opt_7d') },
            ].map(item => {
              const isSelected = config.selfDestruct.retentionAfterResolvedHours === item.h;
              return (
                <TouchableOpacity
                  key={`ret_${item.h}`}
                  style={[styles.radioItem, isSelected && styles.radioItemActive]}
                  onPress={() => handleSetRetentionHours(item.h as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.radioText, isSelected && styles.radioTextActive]}>
                    {item.label}
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
    marginBottom: 8,
  },
  radioList: {
    gap: 8,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radioItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: '#3B82F6',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#3B82F6',
  },
  radioText: {
    fontSize: 12.5,
    color: '#475569',
  },
  radioTextActive: {
    color: '#3B82F6',
    fontWeight: '700',
  },
});
