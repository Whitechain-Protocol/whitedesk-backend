import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react-native';
import { AdvancedFeaturesConfig } from '../types';
import {
  VoiceCallPolicy,
  TicketPttPolicy,
  OrgRadioPolicy,
  RemoteDesktopPolicy,
  DestructionPolicy,
  SlaPolicy,
  ResolutionProofPolicy,
  TicketClosurePolicy,
  AdminRatingPolicy,
  PiiPolicy,
} from './advanced';

interface AdvancedFeaturesSectionProps {
  config: AdvancedFeaturesConfig;
  onSave: (newConfig: AdvancedFeaturesConfig) => Promise<void>;
  saving: boolean;
  language: string;
  getLabel?: (key: string, tr: string, en: string) => string;
  availableOrgs?: Array<{ org_id: string; name: string }>;
}

export const AdvancedFeaturesSection: React.FC<AdvancedFeaturesSectionProps> = ({
  config: initialConfig,
  onSave,
  saving,
  language = 'tr',
  availableOrgs = [],
}) => {
  const [config, setConfig] = useState<AdvancedFeaturesConfig>(initialConfig);
  const [savedBanner, setSavedBanner] = useState(false);
  const isEn = language === 'en';

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const orgList = availableOrgs.length > 0 ? availableOrgs : [
    { org_id: 'default', name: 'Genel Kurum / Merkez' },
    { org_id: 'support', name: 'Müşteri Hizmetleri & Destek' },
    { org_id: 'field', name: 'Saha & Operasyon' },
    { org_id: 'logistics', name: 'Lojistik & Dağıtım' },
    { org_id: 'it', name: 'Bilgi İşlem (IT)' },
  ];

  const handleSavePress = async () => {
    await onSave(config);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3500);
  };

  return (
    <View style={styles.container}>
      {/* BAŞARILI BİLDİRİMİ */}
      {savedBanner && (
        <View style={styles.successBanner}>
          <CheckCircle2 size={16} color="#3B82F6" style={{ marginRight: 8 }} />
          <Text style={styles.successBannerText}>
            {isEn ? 'Advanced settings updated successfully.' : 'Gelişmiş özellikler başarıyla güncellendi.'}
          </Text>
        </View>
      )}

      {/* SAYFA AÇIKLAMASI */}
      <Text style={styles.pageDescription}>
        {isEn
          ? 'Configure real-time communication channels, ticket security, SLA and cryptographic lifecycle policies for your organization.'
          : 'Kuruluşunuz için gerçek zamanlı iletişim, talep güvenliği, SLA ve kriptografik yaşam döngüsü kurallarını yapılandırın.'}
      </Text>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BÖLÜM 1: GERÇEK ZAMANLI İLETİŞİM KANALLARI                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {isEn ? 'Communication Channels' : 'İletişim Kanalları'}
        </Text>
      </View>

      {/* 1.1 BİLET İÇİ CANLI SESLİ ARAMA */}
      <VoiceCallPolicy
        config={config}
        onChange={setConfig}
        language={language}
      />

      {/* 1.2 BİLET İÇİ BAS-KONUŞ (PTT) */}
      <TicketPttPolicy
        config={config}
        onChange={setConfig}
        language={language}
      />

      {/* 1.3 KURUMSAL TELSİZ YAYINI & SAHA KANALLARI */}
      <OrgRadioPolicy
        config={config}
        onChange={setConfig}
        orgList={orgList}
        language={language}
      />

      {/* 1.4 BİLET İÇİ UZAK MASAÜSTÜ VE LAZER İŞARETÇİ */}
      <RemoteDesktopPolicy
        config={config}
        onChange={setConfig}
        language={language}
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BÖLÜM 2: TALEP GÜVENLİĞİ VE YAŞAM DÖNGÜSÜ                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
        <Text style={styles.sectionTitle}>
          {isEn ? 'Ticket Security & Lifecycle' : 'Talep Güvenliği ve Yaşam Döngüsü'}
        </Text>
      </View>

      {/* 2.1 BİLET KAPAMA & ÇÖZÜM TEYİT POLİTİKASI */}
      <TicketClosurePolicy
        config={config}
        onChange={setConfig}
        language={language}
      />

      {/* 2.2 KENDİNİ İMHA VE BUHARLAŞMA POLİTİKASI */}
      <DestructionPolicy
        config={config}
        onChange={setConfig}
        language={language}
      />

      {/* 2.3 OPERATÖR DEĞERLENDİRME & YILDIZ PUANLAMA */}
      <AdminRatingPolicy
        config={config}
        onChange={setConfig}
        language={language}
      />

      {/* 2.4 TIRMANAN TALEPLER / SLA POLİTİKASI */}
      <SlaPolicy
        config={config}
        onChange={setConfig}
        language={language}
      />

      {/* 2.5 DEĞİŞMEZLİK İSPATI (KRİPTOGRAFİK KAPANIS MAKBUZU) */}
      <ResolutionProofPolicy
        config={config}
        onChange={setConfig}
        language={language}
      />

      {/* 2.6 CİHAZDA OTOMATİK VERİ MASKELEME (PII REDACTION) */}
      <PiiPolicy
        config={config}
        onChange={setConfig}
        language={language}
      />

      {/* KAYDET BUTONU */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSavePress}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ShieldCheck size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.saveButtonText}>
              {isEn ? 'Save Settings' : 'Ayarları Kaydet'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  pageDescription: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  successBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E40AF',
    flex: 1,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
