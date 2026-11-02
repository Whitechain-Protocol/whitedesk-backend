import React from 'react';
import { StyleSheet, View, Text, Switch } from 'react-native';
import { Star } from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../../types';

interface AdminRatingPolicyProps {
  config: AdvancedFeaturesConfig;
  onChange: (updater: (prev: AdvancedFeaturesConfig) => AdvancedFeaturesConfig) => void;
  getLabel?: (a: string, b?: string, c?: string) => string;
  language?: string;
}

export const AdminRatingPolicy: React.FC<AdminRatingPolicyProps> = ({
  config,
  onChange,
  language = 'tr',
}) => {
  const isEn = language === 'en';
  const ratingEnabled = config.rating?.enabled ?? true;
  const allowInstantRating = config.rating?.allowInstantRating ?? true;

  const handleToggleRating = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      rating: {
        enabled: val,
        allowInstantRating: prev.rating?.allowInstantRating ?? true,
      },
    }));
  };

  const handleToggleInstant = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      rating: {
        enabled: prev.rating?.enabled ?? true,
        allowInstantRating: val,
      },
    }));
  };

  return (
    <View style={styles.cardItem}>
      <View style={styles.cardHeaderRow}>
        <View style={[styles.iconBox, { backgroundColor: '#FEF9C3' }]}>
          <Star size={18} color="#CA8A04" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle}>
            {isEn ? 'Operator Evaluation' : 'Operatör Değerlendirme'}
          </Text>
          <Text style={styles.cardDesc}>
            {isEn
              ? 'Manage customer satisfaction reviews and 1-5 star ratings after ticket resolution.'
              : 'Bilet kapandıktan sonra kullanıcının operatör hizmetini 1-5 yıldız ve geri bildirimle değerlendirmesini sağlar.'}
          </Text>
        </View>
        <Switch
          value={ratingEnabled}
          onValueChange={handleToggleRating}
          trackColor={{ false: '#CBD5E1', true: '#FDE047' }}
          thumbColor={ratingEnabled ? '#CA8A04' : '#FFFFFF'}
        />
      </View>

      {ratingEnabled && (
        <View style={styles.subOptionBox}>
          {/* Anında Değerlendirme İzni */}
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.optionTitle}>
                {isEn ? 'Allow Immediate Evaluation Without Delay' : 'Anında Değerlendirme İzni'}
              </Text>
              <Text style={styles.optionDesc}>
                {isEn
                  ? 'Allows users to rate the operator immediately upon closure without cooling period.'
                  : 'Kullanıcının bekleme süresi olmadan kapanış anında hemen yıldız ve yorum vermesini sağlar.'}
              </Text>
            </View>
            <Switch
              value={allowInstantRating}
              onValueChange={handleToggleInstant}
              trackColor={{ false: '#CBD5E1', true: '#FDE047' }}
              thumbColor={allowInstantRating ? '#CA8A04' : '#FFFFFF'}
            />
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
});
