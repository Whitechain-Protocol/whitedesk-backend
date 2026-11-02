import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch } from 'react-native';
import { ShieldAlert, Check } from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../../types';

interface PiiPolicyProps {
  config: AdvancedFeaturesConfig;
  onChange: (updater: (prev: AdvancedFeaturesConfig) => AdvancedFeaturesConfig) => void;
  getLabel?: (a: string, b?: string, c?: string) => string;
  language?: string;
}

export const PiiPolicy: React.FC<PiiPolicyProps> = ({
  config,
  onChange,
  language = 'tr',
}) => {
  const isEn = language === 'en';
  const pii = config.piiRedaction || {
    enabled: true,
    maskCards: true,
    maskIdentity: true,
    maskIban: true,
    maskSecrets: true,
  };

  const handleTogglePii = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      piiRedaction: {
        ...(prev.piiRedaction || {
          maskCards: true,
          maskIdentity: true,
          maskIban: true,
          maskSecrets: true,
        }),
        enabled: val,
      },
    }));
  };

  const handleToggleOption = (key: 'maskCards' | 'maskIdentity' | 'maskIban' | 'maskSecrets') => {
    onChange(prev => ({
      ...prev,
      piiRedaction: {
        ...(prev.piiRedaction || {
          enabled: true,
          maskCards: true,
          maskIdentity: true,
          maskIban: true,
          maskSecrets: true,
        }),
        [key]: !((prev.piiRedaction && prev.piiRedaction[key]) ?? true),
      },
    }));
  };

  return (
    <View style={styles.cardItem}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBox}>
          <ShieldAlert size={18} color="#3B82F6" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle}>
            {isEn ? 'Client-Side PII Redaction (KVKK/GDPR)' : 'Cihazda Otomatik Veri Maskeleme'}
          </Text>
          <Text style={styles.cardDesc}>
            {isEn
              ? 'Automatically mask card numbers, national IDs, IBANs and secret keys on-device before sending.'
              : 'Talepler sunucuya ulaşmadan kart, T.C. kimlik, IBAN ve API anahtarı gibi kişisel verileri cihazda maskeler.'}
          </Text>
        </View>
        <Switch
          value={pii.enabled}
          onValueChange={handleTogglePii}
          trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
          thumbColor={pii.enabled ? '#3B82F6' : '#FFFFFF'}
        />
      </View>

      {pii.enabled && (
        <View style={styles.subOptionsContainer}>
          {/* 1. Kredi Kartları */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => handleToggleOption('maskCards')}
            activeOpacity={0.7}
          >
            <View style={[styles.checkboxBox, pii.maskCards && styles.checkboxBoxActive]}>
              {pii.maskCards && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.checkboxText}>
              {isEn ? 'Credit & Debit Cards (Luhn Algorithm)' : 'Kredi ve Banka Kartları (Luhn Algoritması)'}
            </Text>
          </TouchableOpacity>

          {/* 2. TC Kimlik No */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => handleToggleOption('maskIdentity')}
            activeOpacity={0.7}
          >
            <View style={[styles.checkboxBox, pii.maskIdentity && styles.checkboxBoxActive]}>
              {pii.maskIdentity && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.checkboxText}>
              {isEn ? 'National ID Numbers (Algorithmic Check)' : 'T.C. Kimlik Numaraları (Matematiksel Doğrulama)'}
            </Text>
          </TouchableOpacity>

          {/* 3. IBAN */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => handleToggleOption('maskIban')}
            activeOpacity={0.7}
          >
            <View style={[styles.checkboxBox, pii.maskIban && styles.checkboxBoxActive]}>
              {pii.maskIban && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.checkboxText}>
              {isEn ? 'IBAN Accounts (TR & International)' : 'IBAN Numaraları (TR ve Uluslararası)'}
            </Text>
          </TouchableOpacity>

          {/* 4. Gizli Anahtar ve Tokenlar */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => handleToggleOption('maskSecrets')}
            activeOpacity={0.7}
          >
            <View style={[styles.checkboxBox, pii.maskSecrets && styles.checkboxBoxActive]}>
              {pii.maskSecrets && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.checkboxText}>
              {isEn ? 'API Keys, Passwords & JWT Tokens' : 'API Anahtarları, Parolalar ve JWT Tokenlar'}
            </Text>
          </TouchableOpacity>
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
  subOptionsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
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
