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
import { ChevronLeft, KeyRound, Hash, Send, ArrowRight, Shield } from 'lucide-react-native';

export default function UserGuideScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FA" translucent />
      
      {/* TOP HEADER ROW */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color="#1E293B" strokeWidth={2.4} />
          <Text style={styles.backText}>Geri</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TITLE SECTION */}
        <View style={styles.headerSection}>
          <View style={styles.iconCircle}>
            <KeyRound size={28} color="#2563EB" strokeWidth={2.2} />
          </View>
          <Text style={styles.pageTitle}>Kullanıcı Katılım Rehberi</Text>
          <Text style={styles.pageSubtitle}>
            Hizmet aldığınız kuruma sıfır kişisel veri ve tam gizlilikle bağlanmak çok kolay.
          </Text>
        </View>

        {/* 3 STEP CARDS */}
        <View style={styles.stepsContainer}>
          {/* STEP 1 */}
          <View style={styles.stepCard}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>12 Kelimelik Güvenlik Anahtarı</Text>
              <Text style={styles.stepDesc}>
                Bir sonraki ekranda cihazınızda sadece size özel 12 kelimelik kriptografik passkey üretilecektir. Bu anahtarı kimseyle paylaşmayın.
              </Text>
            </View>
          </View>

          {/* STEP 2 */}
          <View style={styles.stepCard}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Kullanıcı Hash'inizi Alın</Text>
              <Text style={styles.stepDesc}>
                Hizmet aldığınız kurumdan veya şirket yöneticinizden size iletilen <Text style={styles.codeSnippet}>usr_div_...</Text> kullanıcı kodunuzu temin edin.
              </Text>
            </View>
          </View>

          {/* STEP 3 */}
          <View style={[styles.stepCard, styles.stepCardHighlight]}>
            <View style={[styles.stepBadge, { backgroundColor: '#3B82F6' }]}>
              <Text style={[styles.stepBadgeText, { color: '#FFFFFF' }]}>3</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Bilet Kutusuna 'user [hash]' Yazın</Text>
              <Text style={styles.stepDesc}>
                Masaya girdiğinizde bilet mesaj kutusuna sadece <Text style={styles.boldText}>user [hash]</Text> yazıp gönderdiğiniz anda sistem sizi ilgili kuruma bağlar.
              </Text>
              <View style={styles.cmdExampleBox}>
                <Send size={14} color="#2563EB" style={{ marginRight: 6 }} />
                <Text style={styles.cmdExampleText}>user usr_div_9a8f4c...</Text>
              </View>
            </View>
          </View>
        </View>

        {/* PRIVACY PILL */}
        <View style={styles.privacyNote}>
          <Shield size={16} color="#059669" style={{ marginRight: 6 }} />
          <Text style={styles.privacyNoteText}>
            Ad, soyad, telefon veya e-posta gerekmez. Kör kimlik (Blind ID) ile bağlanırsınız.
          </Text>
        </View>

        {/* ACTION BUTTON */}
        <TouchableOpacity
          style={styles.primaryActionBtn}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryActionBtnText}>Güvenlik Anahtarımı Oluştur</Text>
          <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 12,
    paddingBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '400',
  },
  stepsContainer: {
    marginBottom: 20,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  stepCardHighlight: {
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  stepBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#64748B',
  },
  codeSnippet: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  cmdExampleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  cmdExampleText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#065F46',
    fontWeight: '600',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryActionBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
