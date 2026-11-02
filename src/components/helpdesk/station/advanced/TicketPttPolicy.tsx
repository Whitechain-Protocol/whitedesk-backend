import React from 'react';
import { StyleSheet, View, Text, Switch } from 'react-native';
import { Mic } from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../../types';

interface TicketPttPolicyProps {
  config: AdvancedFeaturesConfig;
  onChange: (updater: (prev: AdvancedFeaturesConfig) => AdvancedFeaturesConfig) => void;
  getLabel?: (a: string, b?: string, c?: string) => string;
  language?: string;
}

export const TicketPttPolicy: React.FC<TicketPttPolicyProps> = ({
  config,
  onChange,
  language = 'tr',
}) => {
  const isEn = language === 'en';
  const pttEnabled = Boolean(config.pushToTalk.enabled);
  const allowUserPtt = config.pushToTalk.allowUserPtt ?? true;

  const handleTogglePtt = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      pushToTalk: {
        ...prev.pushToTalk,
        enabled: val,
      },
    }));
  };

  const handleToggleUserPtt = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      pushToTalk: {
        ...prev.pushToTalk,
        allowUserPtt: val,
      },
    }));
  };

  return (
    <View style={styles.cardItem}>
      {/* Ana Başlık ve Toggle: Bilet İçi Bas-Konuş */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBox}>
          <Mic size={18} color="#3B82F6" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle}>
            {isEn ? 'In-Ticket Push-to-Talk' : 'Bilet İçi Bas-Konuş'}
          </Text>
          <Text style={styles.cardDesc}>
            {isEn
              ? 'Instant voice messaging inside tickets.'
              : 'Bilet mesajlaşması sırasında anlık bas-konuş ses iletişimi sağlar.'}
          </Text>
        </View>
        <Switch
          value={pttEnabled}
          onValueChange={handleTogglePtt}
          trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
          thumbColor={pttEnabled ? '#3B82F6' : '#FFFFFF'}
        />
      </View>

      {/* Alt Toggle: Kullanıcı bas konuş başlatabilir (Yalnızca ilki açıkken görünür) */}
      {pttEnabled && (
        <View style={styles.subRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.subRowTitle}>
              {isEn ? 'User can initiate push-to-talk' : 'Kullanıcı bas konuş başlatabilir'}
            </Text>
            <Text style={styles.subRowDesc}>
              {isEn
                ? 'Allow ticket creators to send instant push-to-talk voice messages.'
                : 'Kullanıcının bilet üzerinden operatöre bas-konuş mesajı göndermesine izin verir.'}
            </Text>
          </View>
          <Switch
            value={allowUserPtt}
            onValueChange={handleToggleUserPtt}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={allowUserPtt ? '#3B82F6' : '#FFFFFF'}
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
