import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch } from 'react-native';
import { FileCheck2, Check } from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../../types';

interface ResolutionProofPolicyProps {
  config: AdvancedFeaturesConfig;
  onChange: (updater: (prev: AdvancedFeaturesConfig) => AdvancedFeaturesConfig) => void;
  getLabel?: (a: string, b?: string, c?: string) => string;
  language?: string;
}

export const ResolutionProofPolicy: React.FC<ResolutionProofPolicyProps> = ({
  config,
  onChange,
  language = 'tr',
}) => {
  const isEn = language === 'en';

  const handleToggleProofOfIntegrity = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      proofOfIntegrity: {
        ...prev.proofOfIntegrity,
        enabled: val,
      },
    }));
  };

  const handleToggleAutoDownload = () => {
    onChange(prev => ({
      ...prev,
      proofOfIntegrity: {
        ...prev.proofOfIntegrity,
        autoDownloadReceipt: !prev.proofOfIntegrity.autoDownloadReceipt,
      },
    }));
  };

  return (
    <View style={styles.cardItem}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBox}>
          <FileCheck2 size={18} color="#3B82F6" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle}>
            {isEn ? 'Proof of Integrity (Cryptographic Receipt)' : 'Değişmezlik İspatı (Kriptografik Makbuz)'}
          </Text>
          <Text style={styles.cardDesc}>
            {isEn
              ? 'Generate verifiable cryptographic closure receipt with Merkle root and dual signatures.'
              : 'Kapanan her talep için iki tarafın cihazında karşılıklı doğrulanabilir matematiksel kapanış özeti üretir.'}
          </Text>
        </View>
        <Switch
          value={config.proofOfIntegrity.enabled}
          onValueChange={handleToggleProofOfIntegrity}
          trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
          thumbColor={config.proofOfIntegrity.enabled ? '#3B82F6' : '#FFFFFF'}
        />
      </View>

      {config.proofOfIntegrity.enabled && (
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={handleToggleAutoDownload}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkboxBox,
              config.proofOfIntegrity.autoDownloadReceipt && styles.checkboxBoxActive,
            ]}
          >
            {config.proofOfIntegrity.autoDownloadReceipt && (
              <Check size={13} color="#FFFFFF" strokeWidth={3} />
            )}
          </View>
          <Text style={styles.checkboxText}>
            {isEn
              ? 'Auto-download receipt on ticket resolution (.json)'
              : 'Talep kapandığında Değişmezlik Makbuzunu otomatik indir (.json)'}
          </Text>
        </TouchableOpacity>
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  checkboxBoxActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkboxText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    lineHeight: 16,
  },
});
