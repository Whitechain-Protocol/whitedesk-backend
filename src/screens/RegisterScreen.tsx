import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Platform,
} from 'react-native';
import {
  Shield,
  ShieldCheck,
  Building2,
  Hash,
  HelpCircle,
  ChevronRight,
  Lock,
  Key,
} from 'lucide-react-native';
import { CryptoService, CryptoIdentity } from '../services/cryptoService';
import { BottomConfirmationSheet } from '../components/BottomConfirmationSheet';
import { helpDeskService } from '../services/helpDeskService';

type Step = 'identity' | 'chooseNext' | 'hashEntry' | 'noCode';

export default function RegisterScreen({ navigation, route }: any) {
  // ─── State ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('identity');
  const [identity, setIdentity] = useState<CryptoIdentity | null>(null);
  const [hasBackedUp, setHasBackedUp] = useState(false);
  const [isImportMode, setIsImportMode] = useState(false);
  const [importWords, setImportWords] = useState('');
  const [hashInput, setHashInput] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    description: string;
    actionText: string;
    actionColor?: string;
    onAction?: () => void;
    onCancel?: () => void;
  }>({ visible: false, title: '', description: '', actionText: '' });

  const showAlert = (
    title: string,
    description: string,
    actionText = 'Tamam',
    actionColor = '#2563EB',
    onAction?: () => void,
    onCancel?: () => void,
  ) => setAlertConfig({ visible: true, title, description, actionText, actionColor, onAction, onCancel });

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isImportMode) initNewIdentity();
  }, [isImportMode]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const id = 'wd-no-scroll';
      if (!document.getElementById(id)) {
        const s = document.createElement('style');
        s.id = id;
        s.innerHTML = '::-webkit-scrollbar{display:none}*{scrollbar-width:none;-ms-overflow-style:none}';
        document.head.appendChild(s);
      }
    }
  }, []);

  const initNewIdentity = async () => {
    try {
      const mnemonic = CryptoService.generateMnemonic();
      const whiteId = await CryptoService.deriveWhiteId(mnemonic);
      setIdentity({ mnemonic, whiteId });
    } catch (e) {
      console.error('[RegisterScreen] identity gen failed', e);
    }
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  /** New user: save generated identity → go to chooseNext */
  const handleFinalizeNew = async () => {
    if (!hasBackedUp) {
      showAlert('Güvenlik Uyarısı', '12 güvenlik kelimenizi kaydettiğinizi onaylamadan devam edemezsiniz.');
      return;
    }
    if (!identity) return;
    setIsWorking(true);
    try {
      await CryptoService.saveIdentity(identity);

      // handle autoClaimHash from deep-link / QR params
      const autoClaimHash = route?.params?.autoClaimHash;
      if (autoClaimHash) {
        try { await helpDeskService.handleAdminClaimCommand(identity.whiteId, autoClaimHash); }
        catch (e) { console.warn('[Register] autoClaimHash error', e); }
      }

      setStep('chooseNext');
    } catch (e) {
      showAlert('Hata', 'Kimlik kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsWorking(false);
    }
  };

  /** Import: validate 12 words → save → go directly to HelpDesk (role auto-detected) */
  const handleImportIdentity = async () => {
    const words = importWords.trim().toLowerCase().split(/\s+/);
    if (words.length !== 12) {
      showAlert('Hata', 'Lütfen tam olarak 12 kelime girin.');
      return;
    }
    setIsWorking(true);
    try {
      const mnemonic = words.join(' ');
      if (!CryptoService.validateMnemonic(mnemonic)) {
        showAlert('Geçersiz Kelimeler', 'Girdiğiniz kelimeler geçerli bir kurtarma ifadesi oluşturmuyor. Lütfen kontrol edin.');
        return;
      }
      const whiteId = await CryptoService.deriveWhiteId(mnemonic);
      await CryptoService.saveIdentity({ mnemonic, whiteId });
      navigation.replace('HelpDesk');
    } catch (e) {
      showAlert('Hata', 'Geçersiz kurtarma ifadesi. Lütfen tekrar deneyin.');
    } finally {
      setIsWorking(false);
    }
  };

  /** Hash code entry: claim hash then go to HelpDesk */
  const handleHashEntry = async () => {
    const hash = hashInput.trim();
    if (!hash) {
      showAlert('Hata', 'Lütfen kurtarma kodunuzu girin.');
      return;
    }
    if (!identity) return;
    setIsWorking(true);
    try {
      await helpDeskService.handleAdminClaimCommand(identity.whiteId, hash);
      navigation.replace('HelpDesk');
    } catch (e) {
      showAlert('Geçersiz Kod', 'Bu kod tanınanamadı. Yöneticinizden yeni bir kod talep edin.');
    } finally {
      setIsWorking(false);
    }
  };

  /** No code: enter as empty/guest session */
  const handleNoCode = () => {
    navigation.replace('HelpDesk');
  };

  // ─── Shared encryption paragraph ─────────────────────────────────────────
  const EncryptionNote = () => (
    <View style={styles.encryptionNote}>
      <Lock size={13} color="#3B82F6" strokeWidth={2.5} style={{ marginRight: 6, marginTop: 1 }} />
      <Text style={styles.encryptionNoteText}>
        WhiteDesk, verilerinizi yalnızca sizin erişebileceğiniz uçtan uca şifreleme ile korur.
        Kimlik doğrulaması için merkezi sunucu ya da parola kullanılmaz; bunun yerine yalnızca
        sizde saklanan 12 güvenlik kelimesi esas alınır. Bu kelimeler kaybolduğunda oturumunuza
        erişim, yalnızca yetkili yöneticinizin sağlayacağı kurtarma koduyla mümkündür.
      </Text>
    </View>
  );

  // ─── Loading screen ───────────────────────────────────────────────────────
  if (!identity && !isImportMode) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F4F7FA" />
        <Text style={styles.logoText}>WhiteDesk</Text>
        <Text style={styles.loadingText}>Kriptografik kimlik hazırlanıyor…</Text>
      </View>
    );
  }

  // =========================================================================
  // STEP: identity
  // =========================================================================
  if (step === 'identity') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F4F7FA" />
        <View style={styles.whiteCard}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <Text style={styles.logoText}>WhiteDesk</Text>

            <Text style={styles.stepTitle}>
              {isImportMode ? 'Oturumunuzu Kurtarın' : 'Güvenli Kimliğinizi Oluşturun'}
            </Text>
            <Text style={styles.stepSubtitle}>
              {isImportMode
                ? '12 güvenlik kelimenizi sırayla girin.'
                : 'Size özel 12 güvenlik kelimesi oluşturuldu. Bu kelimeleri güvenli bir yere yazın.'}
            </Text>

            <EncryptionNote />

            {isImportMode ? (
              /* ─── Import mode ─── */
              <View style={styles.section}>
                <TextInput
                  style={styles.multilineInput}
                  placeholder="Kelimelerinizi boşlukla ayırarak girin…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={importWords}
                  onChangeText={setImportWords}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, isWorking && styles.disabledBtn]}
                  onPress={handleImportIdentity}
                  disabled={isWorking}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>
                    {isWorking ? 'Doğrulanıyor…' : 'Oturuma Gir'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={() => setIsImportMode(false)}>
                  <Text style={styles.linkBtnText}>← Yeni kimlik oluştur</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ─── New identity mode ─── */
              <>
                {/* 12-word grid OR secured box */}
                {!hasBackedUp ? (
                  <View style={styles.seedGrid}>
                    {identity?.mnemonic.split(' ').map((word, i) => (
                      <View key={i} style={styles.wordBadge}>
                        <Text style={styles.wordNumber}>{('0' + (i + 1)).slice(-2)}</Text>
                        <Text style={styles.wordText}>{word}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.securedBox}
                    onPress={() => setHasBackedUp(false)}
                    activeOpacity={0.9}
                  >
                    <Shield size={22} color="#2563EB" style={{ marginBottom: 8 }} />
                    <Text style={styles.securedTitle}>Kelimeler gizlendi</Text>
                    <Text style={styles.securedSub}>Görmek için buraya dokunun</Text>
                  </TouchableOpacity>
                )}

                {/* Confirm checkbox */}
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setHasBackedUp(v => !v)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.checkbox, hasBackedUp && styles.checkboxOn]}>
                    {hasBackedUp && <View style={styles.checkboxDot} />}
                  </View>
                  <Text style={styles.checkLabel}>
                    12 kelimeyi güvenli ve fiziksel bir yere not aldım, dijital ortamda saklamayacağım.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, (!hasBackedUp || isWorking) && styles.disabledBtn]}
                  onPress={handleFinalizeNew}
                  disabled={!hasBackedUp || isWorking}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.primaryBtnText, !hasBackedUp && styles.disabledBtnText]}>
                    {isWorking ? 'Kaydediliyor…' : 'Kimliği Kaydet ve Devam Et'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIsImportMode(true)}>
                  <Text style={styles.secondaryBtnText}>12 kelimem zaten var</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>

        <BottomConfirmationSheet
          visible={alertConfig.visible}
          title={alertConfig.title}
          description={alertConfig.description}
          actionText={alertConfig.actionText}
          actionColor={alertConfig.actionColor}
          onAction={() => {
            alertConfig.onAction?.();
            setAlertConfig(p => ({ ...p, visible: false }));
          }}
          onCancel={alertConfig.onCancel ? () => {
            alertConfig.onCancel?.();
            setAlertConfig(p => ({ ...p, visible: false }));
          } : undefined}
        />
      </View>
    );
  }

  // =========================================================================
  // STEP: chooseNext — after new identity is saved
  // =========================================================================
  if (step === 'chooseNext') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F4F7FA" />
        <View style={styles.whiteCard}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.logoText}>WhiteDesk</Text>
            <Text style={styles.stepTitle}>Kimliğiniz Hazır</Text>
            <Text style={styles.stepSubtitle}>
              Nasıl devam etmek istersiniz?
            </Text>

            <EncryptionNote />

            {/* Option 1: Firma Kaydı */}
            <TouchableOpacity
              style={styles.choiceCard}
              onPress={() => navigation.replace('TenantSetup')}
              activeOpacity={0.75}
            >
              <View style={[styles.choiceIcon, { backgroundColor: '#F0FDF4' }]}>
                <Building2 size={22} color="#16A34A" strokeWidth={2.2} />
              </View>
              <View style={styles.choiceText}>
                <Text style={styles.choiceTitle}>Firma Kaydı ve Kurulum</Text>
                <Text style={styles.choiceSub}>
                  Yeni bir şirket hesabı açın, özel alanlarınızı ve kataloglarınızı tanımlayın.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            {/* Option 2: Hash kodum var */}
            <TouchableOpacity
              style={styles.choiceCard}
              onPress={() => setStep('hashEntry')}
              activeOpacity={0.75}
            >
              <View style={[styles.choiceIcon, { backgroundColor: '#EFF6FF' }]}>
                <Hash size={22} color="#2563EB" strokeWidth={2.2} />
              </View>
              <View style={styles.choiceText}>
                <Text style={styles.choiceTitle}>Hash / Kurtarma Kodum Var</Text>
                <Text style={styles.choiceSub}>
                  Yöneticinizden aldığınız kodu girerek doğrudan oturumunuza katılın.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            {/* Option 3: Hiçbir kodum yok */}
            <TouchableOpacity
              style={[styles.choiceCard, styles.choiceCardMuted]}
              onPress={() => setStep('noCode')}
              activeOpacity={0.75}
            >
              <View style={[styles.choiceIcon, { backgroundColor: '#F8FAFC' }]}>
                <HelpCircle size={22} color="#64748B" strokeWidth={2.2} />
              </View>
              <View style={styles.choiceText}>
                <Text style={[styles.choiceTitle, { color: '#64748B' }]}>Hiçbir Kodum Yok</Text>
                <Text style={styles.choiceSub}>
                  Servis sağlayıcınızdan giriş kodu bekliyorsanız boş oturuma geçin.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    );
  }

  // =========================================================================
  // STEP: hashEntry — enter admin/user hash code
  // =========================================================================
  if (step === 'hashEntry') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F4F7FA" />
        <View style={styles.whiteCard}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.logoText}>WhiteDesk</Text>
            <Text style={styles.stepTitle}>Kurtarma Kodunuzu Girin</Text>
            <Text style={styles.stepSubtitle}>
              Yöneticinizin size ilettiği kullanıcı, yönetici veya global admin kurtarma kodunu
              aşağıya yapıştırın. Sistem rolünüzü otomatik olarak tanıyacaktır.
            </Text>

            <EncryptionNote />

            <TextInput
              style={styles.singleLineInput}
              placeholder="Kurtarma kodunuzu buraya yapıştırın…"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              value={hashInput}
              onChangeText={setHashInput}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, isWorking && styles.disabledBtn]}
              onPress={handleHashEntry}
              disabled={isWorking}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>
                {isWorking ? 'Doğrulanıyor…' : 'Oturuma Gir'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={() => setStep('chooseNext')}>
              <Text style={styles.linkBtnText}>← Geri dön</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <BottomConfirmationSheet
          visible={alertConfig.visible}
          title={alertConfig.title}
          description={alertConfig.description}
          actionText={alertConfig.actionText}
          actionColor={alertConfig.actionColor}
          onAction={() => {
            alertConfig.onAction?.();
            setAlertConfig(p => ({ ...p, visible: false }));
          }}
          onCancel={alertConfig.onCancel ? () => {
            alertConfig.onCancel?.();
            setAlertConfig(p => ({ ...p, visible: false }));
          } : undefined}
        />
      </View>
    );
  }

  // =========================================================================
  // STEP: noCode — no code yet, informational
  // =========================================================================
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FA" />
      <View style={styles.whiteCard}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.logoText}>WhiteDesk</Text>
          <Text style={styles.stepTitle}>Giriş Yönergelerinizi Alın</Text>

          {/* 12-word safety card */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Key size={14} color="#2563EB" strokeWidth={2.4} style={{ marginRight: 6 }} />
              <Text style={styles.infoCardTitle}>12 Güvenlik Kelimenizi Koruyun</Text>
            </View>
            <Text style={styles.infoCardBody}>
              Kurulum sırasında oluşturulan 12 kelimeniz, hesabınızı geri kazanmanın tek yoludur.{'\n\n'}
              • Ekran görüntüsü almayın{'\n'}
              • Dijital ortamda saklamayın{'\n'}
              • Güvendiğiniz fiziksel bir yere yazılı olarak saklayın
            </Text>
          </View>

          {/* Provider contact card */}
          <View style={[styles.infoCard, styles.infoCardGray]}>
            <View style={styles.infoCardHeader}>
              <ShieldCheck size={14} color="#64748B" strokeWidth={2.4} style={{ marginRight: 6 }} />
              <Text style={[styles.infoCardTitle, { color: '#475569' }]}>Kurtarma Kodu Almak İçin</Text>
            </View>
            <Text style={styles.infoCardBody}>
              Hizmet aldığınız servis sağlayıcı firma yöneticisiyle iletişime geçin.{'\n\n'}
              Yöneticiniz size rolünüze uygun bir kurtarma kodu sağlayabilir:{'\n'}
              kullanıcı kodu, yönetici kodu veya global yönetici kodu.{'\n\n'}
              Kodu aldıktan sonra "Hash / Kurtarma Kodum Var" seçeneğiyle oturumunuzu açabilirsiniz.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleNoCode}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Boş Oturuma Geç</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => setStep('chooseNext')}>
            <Text style={styles.linkBtnText}>← Geri dön</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FA',
    paddingTop: Platform.OS === 'ios' ? 44 + 12 : (StatusBar.currentHeight || 24) + 12,
  },
  whiteCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 52 },

  // Brand
  logoText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.8,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1.2,
    marginTop: 12,
  },

  // Step headings
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 16,
  },

  // Encryption note
  encryptionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  encryptionNoteText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
    flex: 1,
  },

  // Seed grid
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  wordBadge: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wordNumber: { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginRight: 4 },
  wordText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },

  // Secured box
  securedBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  securedTitle: { fontSize: 14, fontWeight: '700', color: '#1E40AF', marginBottom: 4 },
  securedSub: { fontSize: 12, color: '#3B82F6' },

  // Checkbox
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 2, borderColor: '#CBD5E1',
    marginRight: 10, justifyContent: 'center', alignItems: 'center',
  },
  checkboxOn: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  checkboxDot: { width: 8, height: 8, backgroundColor: '#FFFFFF', borderRadius: 2 },
  checkLabel: { fontSize: 12, color: '#475569', flex: 1, lineHeight: 17 },

  // Buttons
  section: { marginTop: 4 },
  primaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledBtn: { backgroundColor: '#E2E8F0' },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  disabledBtnText: { color: '#94A3B8' },
  secondaryBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },

  // Inputs
  multilineInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 16,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  singleLineInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 14,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 16,
    marginTop: 4,
  },

  // Choice cards (chooseNext step)
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  choiceCardMuted: { borderColor: '#F1F5F9', backgroundColor: '#FAFAFA' },
  choiceIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  choiceText: { flex: 1, marginRight: 8 },
  choiceTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 3 },
  choiceSub: { fontSize: 12, color: '#64748B', lineHeight: 17 },

  // Info cards (noCode step)
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 14,
  },
  infoCardGray: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  infoCardHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 13, fontWeight: '700', color: '#1E40AF',
  },
  infoCardBody: {
    fontSize: 12, color: '#475569', lineHeight: 18,
  },
});
