import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  Building2,
  KeyRound,
  ShieldAlert,
  Users,
  Copy,
  Check,
  Download,
  ArrowRight,
  Sparkles,
  Upload,
  FileSpreadsheet,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { helpDeskService } from '../services/helpDeskService';
import { CustomFieldDef, CatalogItem } from '../components/helpdesk/types';

export default function TenantSetupScreen({ navigation }: any) {
  const [tenantName, setTenantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [newFieldNameInput, setNewFieldNameInput] = useState('');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [createdKeys, setCreatedKeys] = useState<{
    enterpriseBlindId: string;
    tenantName: string;
    globalAdminHash: string;
    adminHash: string;
    userHash: string;
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const QUICK_CHIPS = ['Model', 'Seri No', 'Ürün Adı', 'Renk', 'Ölçü', 'Sayaç', 'Sipariş No'];

  const handleAddChip = (label: string) => {
    const key = label.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (customFields.some(f => f.key === key)) return;
    setCustomFields(prev => [...prev, { key, label, required: false }]);
  };

  const handleAddCustomField = () => {
    const clean = newFieldNameInput.trim();
    if (!clean) return;
    const key = clean.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (customFields.some(f => f.key === key)) return;
    setCustomFields(prev => [...prev, { key, label: clean, required: false }]);
    setNewFieldNameInput('');
  };

  const handleRemoveField = (key: string) => {
    setCustomFields(prev => prev.filter(f => f.key !== key));
  };

  const handleDownloadCsvTemplate = async () => {
    if (customFields.length === 0) {
      if (Platform.OS === 'web') window.alert('Lütfen önce en az bir özel alan ekleyiniz.');
      else Alert.alert('Uyarı', 'Lütfen önce en az bir özel alan ekleyiniz.');
      return;
    }
    try {
      const headers = customFields.map(f => f.label.replace(/\s+/g, '_')).join(',');
      const sampleRow = customFields.map(f => {
        if (f.key.includes('seri')) return 'SN-A797021';
        if (f.key.includes('model')) return 'Bizhub C360i';
        if (f.key.includes('urun')) return 'Fotokopi / Yazıcı';
        if (f.key.includes('sayac')) return '45200';
        if (f.key.includes('renk')) return 'Siyah';
        if (f.key.includes('olcu')) return 'A3/A4';
        return 'Örnek Veri';
      }).join(',');

      const csvContent = `${headers}\n${sampleRow}\n`;
      const filename = `sablon_${(tenantName || 'whitedesk').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.csv`;

      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else {
        const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
        await ReactNativeBlobUtil.fs.writeFile(filePath, csvContent, 'utf8');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'text/csv',
            dialogTitle: `${tenantName || 'WhiteDesk'} CSV Şablonu`,
            UTI: 'public.comma-separated-values-text',
          });
        }
      }
    } catch (err: any) {
      console.warn('Template export error:', err);
      if (Platform.OS === 'web') window.alert('Şablon indirilemedi: ' + err?.message);
      else Alert.alert('Hata', 'Şablon indirilemedi: ' + err?.message);
    }
  };

  const handleUploadCatalogFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'application/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const text = await fetch(asset.uri).then(r => r.text());
        
        let items: CatalogItem[] = [];
        const trimmed = text.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) items = parsed;
          } catch {}
        } else {
          // CSV Parser
          const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
            for (let i = 1; i < lines.length; i++) {
              const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
              const item: CatalogItem = {};
              headers.forEach((h, idx) => {
                item[h] = vals[idx] || '';
              });
              items.push(item);
            }
          }
        }

        if (items.length > 0) {
          setCatalogItems(items);
          setUploadStatus(`${items.length} Kalem / Ürün Yüklendi`);
        } else {
          if (Platform.OS === 'web') window.alert('Dosyada geçerli veri satırı bulunamadı.');
          else Alert.alert('Uyarı', 'Dosyada geçerli veri satırı bulunamadı.');
        }
      }
    } catch (err: any) {
      console.warn('Catalog upload error:', err);
      if (Platform.OS === 'web') window.alert('Dosya okunamadı: ' + err?.message);
      else Alert.alert('Hata', 'Dosya okunamadı: ' + err?.message);
    }
  };

  const handleCreateTenant = async () => {
    const clean = tenantName.trim();
    if (!clean) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen geçerli bir kurum / şirket adı yazınız.');
      } else {
        Alert.alert('Eksik Bilgi', 'Lütfen geçerli bir kurum / şirket adı yazınız.');
      }
      return;
    }

    setLoading(true);
    try {
      const res = await helpDeskService.createSelfServiceTenant(clean, customFields, catalogItems);
      if (res.success && res.globalAdminHash && res.adminHash && res.userHash) {
        setCreatedKeys({
          enterpriseBlindId: res.enterpriseBlindId || '',
          tenantName: res.tenantName || clean,
          globalAdminHash: res.globalAdminHash,
          adminHash: res.adminHash,
          userHash: res.userHash,
        });
      } else {
        const msg = res.message || 'Kurum masası oluşturulamadı.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Hata', msg);
      }
    } catch (e: any) {
      const msg = e?.message || 'Bir ağ hatası oluştu.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Hata', msg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, keyName: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedKey(keyName);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleExportTxt = async () => {
    if (!createdKeys) return;
    setExporting(true);
    try {
      const txtContent = `=====================================================
WHITEDESK KURUMSAL ANAHTAR BELGESİ (SOVEREIGN KEYS)
=====================================================
Kurum / Şirket Adı : ${createdKeys.tenantName}
Kör Kimlik (Blind ID): ${createdKeys.enterpriseBlindId}
Oluşturulma Tarihi : ${new Date().toLocaleString()}
Paket Türü          : 14 Günlük Ücretsiz Deneme Paketi
Özel Alanlar        : ${customFields.length > 0 ? customFields.map(f => f.label).join(', ') : 'Tanımlanmadı (Standart)'}
Katalog Kalem Sayısı: ${catalogItems.length} Adet
=====================================================

1. GLOBAL ADMIN HASH (Kurucu / Sahip Anahtarı):
${createdKeys.globalAdminHash}
* Kullanım Limiti: 1 Kez (Mülkiyet mühürlenince otomatik silinir)
* Görevi: Kurumun tam yetkili WhiteCosmos yöneticisi yapar.

2. DESTEK OPERATÖRÜ HASH'İ (Admin Hash):
${createdKeys.adminHash}
* Kullanım Limiti: 3 Operatör Koltuğu (14 Gün Geçerli)
* Görevi: Teknik destek personelinize verin. Biletleri yanıtlarlar.

3. MÜŞTERİ KATILIM HASH'İ (User Hash):
${createdKeys.userHash}
* Kullanım Limiti: 10 Kullanıcı / Müşteri (14 Gün Geçerli)
* Görevi: Müşterilerinize verin. Bilet kutusuna "user [bu_hash]" yazarak masanıza bağlanırlar.

=====================================================
ÖNEMLİ: Bu anahtarlar sıfır-bilgi (Zero-Knowledge) mimarisiyle 
korunmaktadır. Lütfen bu dosyayı güvenli bir yerde saklayınız.
=====================================================`;

      const filename = `whitedesk_${createdKeys.tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_keys.txt`;

      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else {
        const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
        await ReactNativeBlobUtil.fs.writeFile(filePath, txtContent, 'utf8');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'text/plain',
            dialogTitle: `${createdKeys.tenantName} Anahtar Dosyası`,
            UTI: 'public.plain-text',
          });
        }
      }
    } catch (err: any) {
      console.warn('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleProceedToRegister = () => {
    if (!createdKeys) return;
    navigation.navigate('Register', {
      autoClaimHash: createdKeys.globalAdminHash,
      tenantName: createdKeys.tenantName,
    });
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FA" translucent />
      
      {/* TOP HEADER */}
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
        {!createdKeys ? (
          /* FORM AŞAMASI: SADECE KURUM ADI */
          <>
            <View style={styles.headerSection}>
              <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                <Building2 size={28} color="#16A34A" strokeWidth={2.2} />
              </View>
              <Text style={styles.pageTitle}>Destek Masanızı Kurun</Text>
              <Text style={styles.pageSubtitle}>
                Hiçbir sunucu kurmadan, kredi kartı gerekmeden 14 günlük kurumsal destek masanızı saniyeler içinde başlatın.
              </Text>
            </View>

            {/* TRIAL BADGE */}
            <View style={styles.trialPill}>
              <Sparkles size={16} color="#059669" style={{ marginRight: 6 }} />
              <Text style={styles.trialPillText}>
                14 Gün Ücretsiz Deneme • 1 Admin + 3 Operatör + 10 Müşteri Dahil
              </Text>
            </View>

            {/* SINGLE INPUT CARD */}
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>Kurum / Şirket Adı</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: Elektroser veya ACME Destek"
                placeholderTextColor="#94A3B8"
                value={tenantName}
                onChangeText={setTenantName}
                autoCapitalize="words"
                editable={!loading}
              />
              <Text style={styles.inputHelperText}>
                Vergi dairesi veya açık adres gerekmez. Sistem tamamen sıfır kişisel veri ilkesiyle çalışır.
              </Text>
            </View>

            {/* ENTERPRISE ÖZEL ALANLAR VE KATALOG ŞABLONU KARTI */}
            <View style={styles.formCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <FileSpreadsheet size={18} color="#2563EB" style={{ marginRight: 8 }} />
                <Text style={styles.inputLabel}>Özel Bilet Alanları (İsteğe Bağlı)</Text>
              </View>
              <Text style={styles.inputHelperText}>
                Müşterilerinizin bilet oluştururken girmesini istediğiniz alanları belirleyin (Örn: Model, Seri No, Ürün Adı, Renk, Ölçü, Sayaç vb.).
              </Text>

              {/* HIZLI ŞABLON ÇİPLERİ */}
              <Text style={[styles.subSectionTitle, { marginTop: 12, marginBottom: 8 }]}>
                Hızlı Ekle:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {QUICK_CHIPS.map((chip) => {
                  const isAdded = customFields.some(f => f.label === chip);
                  return (
                    <TouchableOpacity
                      key={chip}
                      style={[styles.quickChip, isAdded && styles.quickChipAdded]}
                      onPress={() => !isAdded && handleAddChip(chip)}
                      activeOpacity={0.7}
                    >
                      <Plus size={12} color={isAdded ? '#16A34A' : '#2563EB'} style={{ marginRight: 4 }} />
                      <Text style={[styles.quickChipText, isAdded && styles.quickChipTextAdded]}>
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* MANUEL ALAN EKLEME INPUTU */}
              <View style={styles.fieldInputRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1, marginBottom: 0, paddingVertical: 10, fontSize: 13 }]}
                  placeholder="Başka bir alan adı yazın..."
                  placeholderTextColor="#94A3B8"
                  value={newFieldNameInput}
                  onChangeText={setNewFieldNameInput}
                  onSubmitEditing={handleAddCustomField}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.addFieldBtn, !newFieldNameInput.trim() && styles.btnDisabled]}
                  onPress={handleAddCustomField}
                  disabled={!newFieldNameInput.trim()}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.addFieldBtnText}>Ekle</Text>
                </TouchableOpacity>
              </View>

              {/* EKLENMİŞ ALANLAR LİSTESİ */}
              {customFields.length > 0 && (
                <View style={styles.addedFieldsContainer}>
                  <Text style={styles.addedFieldsTitle}>Tanımlanan Bilet Alanları ({customFields.length}):</Text>
                  <View style={styles.addedChipsWrap}>
                    {customFields.map((field) => (
                      <View key={field.key} style={styles.addedFieldBadge}>
                        <Text style={styles.addedFieldBadgeText}>{field.label}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveField(field.key)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          style={{ marginLeft: 6 }}
                        >
                          <X size={13} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  {/* ŞABLON İNDİRME & ENVENTER YÜKLEME BUTONLARI */}
                  <View style={styles.catalogActionsBox}>
                    <Text style={styles.catalogBoxTitle}>📦 Ürün & Envanter Kataloğu (Pulldown & Arama):</Text>
                    <Text style={styles.catalogBoxDesc}>
                      Kullanıcılarınızın bilet açarken bu ürünleri birkaç harf yazarak otomatik seçebilmesi için şablonu indirip verilerinizle doldurarak yükleyebilirsiniz.
                    </Text>

                    <View style={styles.catalogButtonsRow}>
                      <TouchableOpacity
                        style={styles.catalogOutlineBtn}
                        onPress={handleDownloadCsvTemplate}
                        activeOpacity={0.7}
                      >
                        <Download size={14} color="#2563EB" style={{ marginRight: 6 }} />
                        <Text style={styles.catalogOutlineBtnText}>Şablon İndir (.csv)</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.catalogOutlineBtn, styles.catalogUploadBtn]}
                        onPress={handleUploadCatalogFile}
                        activeOpacity={0.7}
                      >
                        <Upload size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.catalogOutlineBtnText, { color: '#FFFFFF' }]}>Kataloğu Yükle (.csv)</Text>
                      </TouchableOpacity>
                    </View>

                    {uploadStatus && (
                      <View style={styles.uploadSuccessBadge}>
                        <Check size={14} color="#16A34A" style={{ marginRight: 6 }} />
                        <Text style={styles.uploadSuccessBadgeText}>{uploadStatus}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              style={[styles.primarySubmitBtn, (!tenantName.trim() || loading) && styles.btnDisabled]}
              onPress={handleCreateTenant}
              disabled={!tenantName.trim() || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primarySubmitBtnText}>Masayı Kur ve Anahtarları Üret</Text>
                  <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          /* ANAHTAR TESLİM AŞAMASI: 3 KUTU + TXT İNDİRME */
          <>
            <View style={styles.headerSection}>
              <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <KeyRound size={28} color="#2563EB" strokeWidth={2.2} />
              </View>
              <Text style={styles.pageTitle}>Masanız Kuruldu!</Text>
              <Text style={styles.pageSubtitle}>
                <Text style={styles.boldText}>'{createdKeys.tenantName}'</Text> için 3 kademeli kriptografik anahtar havuzunuz üretildi.
              </Text>
            </View>

            {/* 3 HASH BOXES */}
            <View style={styles.keysContainer}>
              {/* 1. GLOBAL ADMIN HASH */}
              <View style={styles.keyBox}>
                <View style={styles.keyBoxHeader}>
                  <View style={[styles.keyTypeBadge, { backgroundColor: '#FEF3C7' }]}>
                    <ShieldAlert size={14} color="#D97706" style={{ marginRight: 4 }} />
                    <Text style={[styles.keyTypeBadgeText, { color: '#B45309' }]}>1. Global Admin Hash (Kurucu)</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyToClipboard(createdKeys.globalAdminHash, 'ga')}
                    activeOpacity={0.7}
                  >
                    {copiedKey === 'ga' ? (
                      <>
                        <Check size={14} color="#16A34A" />
                        <Text style={[styles.copyBtnText, { color: '#16A34A' }]}>Kopyalandı</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={14} color="#475569" />
                        <Text style={styles.copyBtnText}>Kopyala</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.hashCodeText} numberOfLines={1} ellipsizeMode="middle">
                  {createdKeys.globalAdminHash}
                </Text>
                <Text style={styles.keyNoteText}>
                  Tek kullanımlık mülkiyet anahtarıdır. Sistemi sahiplendiğiniz an veritabanından silinir.
                </Text>
              </View>

              {/* 2. ADMIN HASH (OPERATÖR) */}
              <View style={styles.keyBox}>
                <View style={styles.keyBoxHeader}>
                  <View style={[styles.keyTypeBadge, { backgroundColor: '#E0E7FF' }]}>
                    <Users size={14} color="#4F46E5" style={{ marginRight: 4 }} />
                    <Text style={[styles.keyTypeBadgeText, { color: '#4338CA' }]}>2. Admin Hash (Destek Ekibi)</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyToClipboard(createdKeys.adminHash, 'adm')}
                    activeOpacity={0.7}
                  >
                    {copiedKey === 'adm' ? (
                      <>
                        <Check size={14} color="#16A34A" />
                        <Text style={[styles.copyBtnText, { color: '#16A34A' }]}>Kopyalandı</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={14} color="#475569" />
                        <Text style={styles.copyBtnText}>Kopyala</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.hashCodeText} numberOfLines={1} ellipsizeMode="middle">
                  {createdKeys.adminHash}
                </Text>
                <Text style={styles.keyNoteText}>
                  3 Destek Operatörü için geçerlidir (14 gün deneme). 3 kişi bağlandığında otomatik silinir.
                </Text>
              </View>

              {/* 3. USER HASH (MÜŞTERİ) */}
              <View style={styles.keyBox}>
                <View style={styles.keyBoxHeader}>
                  <View style={[styles.keyTypeBadge, { backgroundColor: '#DCFCE7' }]}>
                    <Users size={14} color="#16A34A" style={{ marginRight: 4 }} />
                    <Text style={[styles.keyTypeBadgeText, { color: '#15803D' }]}>3. User Hash (Müşteriler)</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyToClipboard(createdKeys.userHash, 'usr')}
                    activeOpacity={0.7}
                  >
                    {copiedKey === 'usr' ? (
                      <>
                        <Check size={14} color="#16A34A" />
                        <Text style={[styles.copyBtnText, { color: '#16A34A' }]}>Kopyalandı</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={14} color="#475569" />
                        <Text style={styles.copyBtnText}>Kopyala</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.hashCodeText} numberOfLines={1} ellipsizeMode="middle">
                  {createdKeys.userHash}
                </Text>
                <Text style={styles.keyNoteText}>
                  10 Müşteri için geçerlidir (14 gün deneme). Müşteri bilet kutusuna "user [hash]" yazar.
                </Text>
              </View>
            </View>

            {/* ACTION 1: EXPORT TXT FILE */}
            <TouchableOpacity
              style={styles.exportTxtBtn}
              onPress={handleExportTxt}
              activeOpacity={0.8}
              disabled={exporting}
            >
              <Download size={18} color="#1E293B" strokeWidth={2.2} style={{ marginRight: 8 }} />
              <Text style={styles.exportTxtBtnText}>
                {exporting ? 'İndiriliyor...' : 'Anahtarları Dosya Olarak İndir (.txt)'}
              </Text>
            </TouchableOpacity>

            {/* ACTION 2: PROCEED TO REGISTER */}
            <TouchableOpacity
              style={styles.primarySubmitBtn}
              onPress={handleProceedToRegister}
              activeOpacity={0.8}
            >
              <Text style={styles.primarySubmitBtnText}>Yönetici Olarak Masaya Başla</Text>
              <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </>
        )}
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
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
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
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  trialPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginBottom: 10,
  },
  inputHelperText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
  },
  primarySubmitBtn: {
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
  btnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  primarySubmitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  keysContainer: {
    marginBottom: 18,
  },
  keyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
  keyBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  keyTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  keyTypeBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  copyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 4,
  },
  hashCodeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  keyNoteText: {
    fontSize: 11.5,
    lineHeight: 16,
    color: '#64748B',
  },
  exportTxtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  exportTxtBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickChipAdded: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  quickChipTextAdded: {
    color: '#16A34A',
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  addFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 8,
  },
  addFieldBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  addedFieldsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  addedFieldsTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  addedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  addedFieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addedFieldBadgeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  catalogActionsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catalogBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  catalogBoxDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
    marginBottom: 12,
  },
  catalogButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  catalogOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  catalogOutlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  catalogUploadBtn: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  uploadSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  uploadSuccessBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
});
