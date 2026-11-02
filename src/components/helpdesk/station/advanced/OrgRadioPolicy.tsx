import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch } from 'react-native';
import { Radio, Check } from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../../types';

interface OrgRadioPolicyProps {
  config: AdvancedFeaturesConfig;
  onChange: (updater: (prev: AdvancedFeaturesConfig) => AdvancedFeaturesConfig) => void;
  getLabel?: (a: string, b?: string, c?: string) => string;
  orgList: Array<{ org_id: string; name: string }>;
  language?: string;
}

export const OrgRadioPolicy: React.FC<OrgRadioPolicyProps> = ({
  config,
  onChange,
  orgList,
  language = 'tr',
}) => {
  const isEn = language === 'en';
  const radioEnabled = config.pushToTalk.radioEnabled ?? true;
  const allowGroupBroadcast = config.pushToTalk.allowGroupBroadcast ?? false;

  const handleToggleRadio = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      pushToTalk: {
        ...prev.pushToTalk,
        radioEnabled: val,
      },
    }));
  };

  const handleToggleGroupBroadcast = (val: boolean) => {
    onChange(prev => ({
      ...prev,
      pushToTalk: {
        ...prev.pushToTalk,
        allowGroupBroadcast: val,
      },
    }));
  };

  const handleToggleRadioOrg = (orgId: string) => {
    onChange(prev => {
      const current = prev.pushToTalk.allowedOrgs || [];
      const updated = current.includes(orgId)
        ? current.filter((id: string) => id !== orgId)
        : [...current, orgId];
      return {
        ...prev,
        pushToTalk: {
          ...prev.pushToTalk,
          allowedOrgs: updated,
        },
      };
    });
  };

  return (
    <View style={styles.cardItem}>
      {/* Ana Başlık ve Toggle: Telsiz Yayını */}
      <View style={styles.cardHeaderRow}>
        <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
          <Radio size={18} color="#16A34A" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle}>
            {isEn ? 'Radio Broadcast' : 'Telsiz Yayını'}
          </Text>
          <Text style={styles.cardDesc}>
            {isEn
              ? 'Organizational group radio broadcast and channel announcements.'
              : 'Kurumsal birimler ve kanallar arasında genel telsiz anons ve ses yayını.'}
          </Text>
        </View>
        <Switch
          value={radioEnabled}
          onValueChange={handleToggleRadio}
          trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
          thumbColor={radioEnabled ? '#16A34A' : '#FFFFFF'}
        />
      </View>

      {/* Alt Toggle: Grup üyeleri yayın başlatabilir */}
      {radioEnabled && (
        <>
          <View style={styles.subRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.subRowTitle}>
                {isEn ? 'Group members can initiate broadcast' : 'Grup üyeleri yayın başlatabilir'}
              </Text>
              <Text style={styles.subRowDesc}>
                {isEn
                  ? 'Allow group channel members to broadcast announcements.'
                  : 'Bağlı kanal üyelerinin genel anons ve telsiz yayını yapmasına izin ver.'}
              </Text>
            </View>
            <Switch
              value={allowGroupBroadcast}
              onValueChange={handleToggleGroupBroadcast}
              trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
              thumbColor={allowGroupBroadcast ? '#16A34A' : '#FFFFFF'}
            />
          </View>

          {/* Aktif Telsiz Kanalları */}
          {orgList && orgList.length > 0 && (
            <View style={styles.channelsBox}>
              <Text style={styles.subOptionLabel}>
                {isEn ? 'Broadcast Channels' : 'Telsiz Kanalları'}
              </Text>
              <View style={styles.pillWrap}>
                {orgList.map(org => {
                  const isSelected = (config.pushToTalk.allowedOrgs || []).includes(org.org_id);
                  const orgDisplayName = org.org_id === 'default' || org.name === 'default' 
                    ? (isEn ? 'Central / General' : 'Genel Kurum / Merkez')
                    : (org.name || (isEn ? 'Department' : 'Birim'));
                  return (
                    <TouchableOpacity
                      key={`radio_${org.org_id}`}
                      style={[styles.orgPill, isSelected && styles.orgPillActive]}
                      onPress={() => handleToggleRadioOrg(org.org_id)}
                      activeOpacity={0.7}
                    >
                      {isSelected && <Check size={12} color="#16A34A" style={{ marginRight: 4 }} />}
                      <Text style={[styles.orgPillText, isSelected && styles.orgPillTextActive]}>
                        {orgDisplayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </>
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
  channelsBox: {
    marginTop: 10,
    paddingTop: 8,
  },
  subOptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  orgPillActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  orgPillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  orgPillTextActive: {
    color: '#15803D',
    fontWeight: '700',
  },
});
