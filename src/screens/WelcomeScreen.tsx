import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import { User, Building2, ShieldCheck, ChevronRight, Lock } from 'lucide-react-native';

export default function WelcomeScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FA" translucent />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* BRAND & LOGO HEADER */}
        <View style={styles.headerBox}>
          <View style={styles.brandBadge}>
            <Lock size={14} color="#2563EB" strokeWidth={2.4} style={{ marginRight: 6 }} />
            <Text style={styles.brandBadgeText}>Sovereign Zero-Knowledge</Text>
          </View>
          <Text style={styles.logoTitle}>WhiteDesk</Text>
          <Text style={styles.heroDescription}>
            Sunucusuz, uçtan uca lokalde şifrelenen ve hiçbir kişisel veri barındırmayan kurumsal destek masası.
          </Text>
        </View>

        {/* WARM WELCOME CARD */}
        <View style={styles.warmCard}>
          <Text style={styles.warmPromptTitle}>
            Hoş geldiniz
          </Text>
          <Text style={styles.warmPromptSubtitle}>
            Sisteminizi kurmak ve sizi doğru çalışma alanına yönlendirmek için sadece iki kısa seçeneğimiz var.
          </Text>
        </View>

        {/* ROLE SELECTION BUTTON CARDS */}
        <View style={styles.selectionSection}>
          <Text style={styles.sectionLabel}>Hangi rol ile katılıyorsunuz?</Text>

          {/* 1. KULLANICIYIM */}
          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => navigation.navigate('UserGuide')}
            activeOpacity={0.7}
          >
            <View style={[styles.roleIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <User size={24} color="#2563EB" strokeWidth={2.2} />
            </View>
            <View style={styles.roleTextContainer}>
              <Text style={styles.roleTitle}>Kullanıcıyım</Text>
              <Text style={styles.roleSubtitle}>
                Hizmet aldığınız kurumdan destek talebi açmak ve yazışmak için katılın.
              </Text>
            </View>
            <ChevronRight size={20} color="#94A3B8" strokeWidth={2.2} />
          </TouchableOpacity>

          {/* 2. SERVİS SAĞLAYICIYIM */}
          <TouchableOpacity
            style={[styles.roleCard, styles.roleCardProvider]}
            onPress={() => navigation.navigate('TenantSetup')}
            activeOpacity={0.7}
          >
            <View style={[styles.roleIconCircle, { backgroundColor: '#F0FDF4' }]}>
              <Building2 size={24} color="#16A34A" strokeWidth={2.2} />
            </View>
            <View style={styles.roleTextContainer}>
              <Text style={styles.roleTitle}>Servis sağlayıcıyım</Text>
              <Text style={styles.roleSubtitle}>
                Kendi şirketiniz için 14 günlük ücretsiz denemeyle kurumsal destek masası kurun.
              </Text>
            </View>
            <ChevronRight size={20} color="#94A3B8" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* FOOTER PILL */}
        <View style={styles.footerNote}>
          <ShieldCheck size={16} color="#475569" strokeWidth={2} style={{ marginRight: 6 }} />
          <Text style={styles.footerNoteText}>
            E2EE Cihaz Şifrelemesi • Sıfır Sunucu Masrafı • KVKK/GDPR Muaf
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 44 : 28,
    paddingBottom: 40,
    justifyContent: 'center',
    minHeight: '100%',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  brandBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    letterSpacing: 0.3,
  },
  logoTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1.2,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  warmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  warmPromptTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  warmPromptSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
    fontWeight: '400',
  },
  selectionSection: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  roleCardProvider: {
    borderColor: '#DCFCE7',
  },
  roleIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  roleSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#64748B',
    fontWeight: '400',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  footerNoteText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
});
