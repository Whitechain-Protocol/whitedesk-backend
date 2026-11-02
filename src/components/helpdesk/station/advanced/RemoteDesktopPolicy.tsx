import React from 'react';
import { StyleSheet, View, Text, Switch } from 'react-native';
import { Monitor } from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../../types';

interface RemoteDesktopPolicyProps {
  config: AdvancedFeaturesConfig;
  onChange: (updater: (prev: AdvancedFeaturesConfig) => AdvancedFeaturesConfig) => void;
  language?: string;
}

export const RemoteDesktopPolicy: React.FC<RemoteDesktopPolicyProps> = ({
  config,
  onChange,
  language = 'tr',
}) => {
  const isEn = language === 'en';
  const rdEnabled = config.remoteDesktop?.enabled !== false;

  const handleToggleRd = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      remoteDesktop: {
        ...(prev.remoteDesktop || {}),
        enabled: val,
        allowFullScreen: true,
      },
    }));
  };

  return (
    <View style={styles.cardItem}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBox}>
          <Monitor size={18} color="#3B82F6" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle}>
            {isEn ? 'Remote Desktop' : 'Uzak Masaüstü'}
          </Text>
          <Text style={styles.cardDesc}>
            {isEn
              ? 'Full live screen streaming and remote touch/scroll control upon user approval.'
              : 'Kullanıcı onayıyla canlı ekran paylaşımı ve uzaktan tıklama/kaydırma kontrolü sağlar.'}
          </Text>
        </View>
        <Switch
          value={rdEnabled}
          onValueChange={handleToggleRd}
          trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
          thumbColor={rdEnabled ? '#3B82F6' : '#FFFFFF'}
        />
      </View>
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
});
