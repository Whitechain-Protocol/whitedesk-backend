import React from 'react';
import { StyleSheet, View, Text, Switch } from 'react-native';
import { Phone } from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../../types';
import { useTranslation } from '../../../../services/i18nService';

interface VoiceCallPolicyProps {
  config: AdvancedFeaturesConfig;
  onChange: (updater: (prev: AdvancedFeaturesConfig) => AdvancedFeaturesConfig) => void;
  getLabel?: (a: string, b?: string, c?: string) => string;
  language?: string;
}

export const VoiceCallPolicy: React.FC<VoiceCallPolicyProps> = ({
  config,
  onChange,
}) => {
  const { t } = useTranslation();
  const voiceEnabled = Boolean(config.voiceCall.enabled);
  const userInitiateEnabled = config.voiceCall.allowUserInitiate ?? true;

  const handleToggleVoice = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      voiceCall: {
        ...prev.voiceCall,
        enabled: val,
        policy: val && prev.voiceCall.policy === 'disabled' ? 'mutual_consent' : prev.voiceCall.policy,
      },
    }));
  };

  const handleToggleUserInitiate = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      voiceCall: {
        ...prev.voiceCall,
        allowUserInitiate: val,
      },
    }));
  };

  return (
    <View style={styles.cardItem}>
      {/* Ana Başlık ve Toggle */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBox}>
          <Phone size={18} color="#3B82F6" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle}>
            {t('settings.advanced_features.voice_call.title')}
          </Text>
          <Text style={styles.cardDesc}>
            {t('settings.advanced_features.voice_call.description')}
          </Text>
        </View>
        <Switch
          value={voiceEnabled}
          onValueChange={handleToggleVoice}
          trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
          thumbColor={voiceEnabled ? '#3B82F6' : '#FFFFFF'}
        />
      </View>

      {/* Alt Toggle: Kullanıcı sesli görüşme başlatabilir (Yalnızca ilki açıkken görünür, gri çizgi yok) */}
      {voiceEnabled && (
        <View style={styles.subRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.subRowTitle}>
              {t('settings.advanced_features.voice_call.user_initiate_title')}
            </Text>
            <Text style={styles.subRowDesc}>
              {t('settings.advanced_features.voice_call.user_initiate_desc')}
            </Text>
          </View>
          <Switch
            value={userInitiateEnabled}
            onValueChange={handleToggleUserInitiate}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={userInitiateEnabled ? '#3B82F6' : '#FFFFFF'}
          />
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
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
  },
  subRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  subRowDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    lineHeight: 15,
  },
});
