import React from 'react';
import { StyleSheet, View, Text, TextInput, Switch } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../../types';

interface TicketClosurePolicyProps {
  config: AdvancedFeaturesConfig;
  onChange: (updater: (prev: AdvancedFeaturesConfig) => AdvancedFeaturesConfig) => void;
  getLabel?: (a: string, b?: string, c?: string) => string;
  language?: string;
}

export const TicketClosurePolicy: React.FC<TicketClosurePolicyProps> = ({
  config,
  onChange,
  language = 'tr',
}) => {
  const isEn = language === 'en';
  const requireUserConfirmation = config.closure?.requireUserConfirmation ?? true;
  const autoCloseHours = config.closure?.autoCloseHours ?? 24;

  const handleToggleRequireUser = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      closure: {
        requireUserConfirmation: val,
        autoCloseHours: prev.closure?.autoCloseHours ?? 24,
      },
    }));
  };

  const handleChangeAutoCloseHours = (hours: number) => {
    onChange(prev => ({
      ...prev,
      closure: {
        requireUserConfirmation: prev.closure?.requireUserConfirmation ?? true,
        autoCloseHours: hours,
      },
    }));
  };

  return (
    <View style={styles.cardItem}>
      <View style={styles.cardHeaderRow}>
        <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
          <CheckCircle2 size={18} color="#16A34A" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle}>
            {isEn ? 'Ticket Closure & Resolution Confirmation' : 'Bilet Kapama & Çözüm Teyidi'}
          </Text>
          <Text style={styles.cardDesc}>
            {isEn
              ? 'Controls mandatory user resolution confirmation and automated ticket closing rules.'
              : 'Operatör bileti çözüldü olarak işaretlediğinde, kullanıcının çözümü teyit etmesini ve otomatik kapanma sürelerini denetler.'}
          </Text>
        </View>
      </View>

      <View style={styles.subOptionBox}>
        {/* Kullanıcı Teyidi Zorunluluğu */}
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.optionTitle}>
              {isEn ? 'Require User Resolution Confirmation' : 'Kullanıcı Çözüm Onayı Zorunlu'}
            </Text>
            <Text style={styles.optionDesc}>
              {isEn
                ? 'Ticket remains pending confirmation until user explicitly verifies the issue is resolved.'
                : 'Operatör çözüldü dese bile kullanıcı "Evet, çözüldü" diyene kadar bilet açık/teyit bekliyor durumunda kalır.'}
            </Text>
          </View>
          <Switch
            value={requireUserConfirmation}
            onValueChange={handleToggleRequireUser}
            trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
            thumbColor={requireUserConfirmation ? '#16A34A' : '#FFFFFF'}
          />
        </View>

        {/* Otomatik Kapanma Süresi (Saat) */}
        <View style={[styles.rowBetween, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.optionTitle}>
              {isEn ? 'Auto-Close if User Does Not Respond' : 'Kullanıcı Yanıt Vermezse Otomatik Kapanma'}
            </Text>
            <Text style={styles.optionDesc}>
              {isEn
                ? 'Hours to wait after resolution notification before closing ticket automatically.'
                : 'Çözüm bildirimi sonrası kullanıcı onay veya itiraz vermezse bilet bu sürede otomatik kapanır.'}
            </Text>
          </View>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.numericInput}
              keyboardType="numeric"
              value={String(autoCloseHours)}
              onChangeText={txt => {
                const num = parseInt(txt.replace(/[^0-9]/g, ''), 10) || 0;
                handleChangeAutoCloseHours(num);
              }}
              placeholder="24"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.inputSuffix}>{isEn ? 'Hours' : 'Saat'}</Text>
          </View>
        </View>
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  numericInput: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    width: 36,
    paddingVertical: 4,
  },
  inputSuffix: {
    fontSize: 11.5,
    color: '#64748B',
    marginLeft: 4,
  },
});
