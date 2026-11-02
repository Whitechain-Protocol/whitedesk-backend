import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform, 
  ActivityIndicator, 
  StatusBar,
  TextInput,
  Modal
} from 'react-native';
import { RotateCw, X, Keyboard, ScanLine, ShieldCheck } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BottomConfirmationSheet } from '../components/BottomConfirmationSheet';
import { useTranslation } from '../services/i18nService';
import { helpDeskService } from '../services/helpDeskService';

export default function WhiteDeskScannerScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [isScanning, setIsScanning] = useState(true);
  const [ownWhiteId, setOwnWhiteId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    description: string;
    actionText: string;
    actionColor?: string;
    onDismiss?: () => void;
  }>({
    visible: false,
    title: '',
    description: '',
    actionText: '',
  });

  useEffect(() => {
    (async () => {
      const id = await helpDeskService.getOwnWhiteId();
      setOwnWhiteId(id);
    })();
  }, []);

  const showAlert = (
    title: string, 
    description: string, 
    actionText: string = 'Tamam', 
    actionColor: string = '#2563EB',
    onDismiss?: () => void
  ) => {
    setAlertConfig({
      visible: true,
      title,
      description,
      actionText,
      actionColor,
      onDismiss,
    });
  };

  const processQrData = async (rawContent: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setIsScanning(false);

    try {
      const res = await helpDeskService.verifyAndConsumeWhiteDeskQr(rawContent, ownWhiteId);

      if (res.success) {
        if (res.type === 'founder') {
          showAlert(
            '👑 Kurucu Kimliği Doğrulandı',
            res.message || 'TheWhite the Founder (**) olarak sistem ve tüm kiracı denetim yetkileriniz anında aktif edildi.',
            'Destek Masasına Geç',
            '#2563EB',
            () => navigation.goBack()
          );
        } else if (res.type === 'global_admin') {
          const isActive = (res.message || '').includes('aktif') || (res.message || '').includes('hazır') || (res.message || '').includes('yüklendi');
          showAlert(
            isActive ? '⭐ Global Admin Yetkisi Aktif' : '⭐ Global Admin Talebi Alındı',
            res.message || 'Global Admin adaylığınız kurucu TheWhite onayına iletildi. Onaylandıktan sonra WhiteCosmos yetkiniz aktifleşecektir.',
            isActive ? 'Destek Masasına Geç' : 'Anladım',
            isActive ? '#2563EB' : '#D97706',
            () => navigation.goBack()
          );
        } else if (res.type === 'admin') {
          showAlert(
            '🛡️ Yönetici Yetkisi Aktif',
            res.message || 'Yönetici yetkiniz başarıyla etkinleştirildi.',
            'Destek Masasına Geç',
            '#2563EB',
            () => navigation.goBack()
          );
        } else if (res.type === 'desktop_pair') {
          showAlert(
            '🖥️ Masaüstü Yetkilendirildi',
            res.message || 'Yıllık lisansınız doğrulandı. WhiteDesk Masaüstü uygulaması aktif hale getirildi.',
            'Masaüstüne Geç',
            '#16A34A',
            () => navigation.goBack()
          );
        } else if (res.type === 'user') {
          showAlert(
            '✓ Destek Masasına Bağlandınız',
            res.message || 'Kurumsal destek masasına başarıyla bağlandınız. Biletlerinizi anında oluşturabilirsiniz.',
            'Destek Masasını Aç',
            '#10B981',
            () => navigation.goBack()
          );
        } else {
          showAlert(
            'İşlem Başarılı',
            res.message,
            'Tamam',
            '#2563EB',
            () => navigation.goBack()
          );
        }
      } else {
        if (res.type === 'desktop_pair') {
          showAlert(
            'Masaüstü Eşleştirme Hatası',
            res.message || 'Masaüstü uygulaması eşleştirilemedi.',
            'Tekrar Dene',
            '#EF4444',
            () => setIsScanning(true)
          );
        } else {
          showAlert(
            'Geçersiz WhiteDesk Kodu',
            res.message || 'Taratılan QR kod geçerli bir WhiteDesk yetkilendirme veya katılım anahtarı içermiyor.',
            'Tekrar Dene',
            '#EF4444',
            () => setIsScanning(true)
          );
        }
      }
    } catch (err: any) {
      showAlert(
        'Bağlantı Hatası',
        err?.message || 'QR kod doğrulanırken beklenmeyen bir hata oluştu.',
        'Kapat',
        '#EF4444',
        () => setIsScanning(true)
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBarcodeScanned = ({ data }: any) => {
    if (!isScanning || isProcessing) return;
    processQrData(String(data || ''));
  };

  const handleManualSubmit = () => {
    const val = manualInput.trim();
    if (!val) return;
    setManualModalVisible(false);
    setManualInput('');
    processQrData(val);
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.permissionContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#F0F7FF' }]}>
            <ScanLine size={48} color="#2563EB" />
          </View>
          <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
          <Text style={styles.permissionDesc}>
            WhiteDesk Kurucu, Global Admin veya Personel katılım QR kodlarını taramak için kamera erişimine izin vermeniz gerekmektedir.
          </Text>
          <TouchableOpacity onPress={requestPermission} style={styles.primaryAuthButton}>
            <Text style={styles.primaryAuthButtonText}>İzin Ver</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
            <Text style={{ color: '#2563EB', fontWeight: '600' }}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />
      
      {isScanning ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000' }]}>
          {isProcessing && (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={{ color: '#FFFFFF', marginTop: 12, fontSize: 13, fontWeight: '600' }}>
                Yetkilendirme anahtarı doğrulanıyor...
              </Text>
            </View>
          )}
        </View>
      )}

      {/* HUD Overlay */}
      <SafeAreaView style={styles.hudOverlay}>
        <View style={styles.hudHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.glassCircleButton}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.hudHeaderTitle}>WHITEDESK QR TARAYICI</Text>
            <Text style={styles.hudHeaderSubtitle}>Sovereign Access & Onboarding</Text>
          </View>
          <TouchableOpacity 
            onPress={() => setFacing(prev => prev === 'back' ? 'front' : 'back')} 
            style={styles.glassCircleButton}
          >
            <RotateCw size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.scanTargetContainer}>
          <View style={styles.neonScanBox}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={styles.laserLine} />
          </View>
          <Text style={styles.hudHelperText}>
            Kurucu (Founder), Global Admin veya Personel katılım QR kodunu kareye hizalayın
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.manualEntryFloatingBtn} 
          onPress={() => setManualModalVisible(true)}
          activeOpacity={0.8}
        >
          <Keyboard size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.manualEntryBtnText}>Anahtarı Manuel Gir</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Manual Entry Modal */}
      <Modal
        visible={manualModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setManualModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>WhiteDesk Anahtarı Girin</Text>
            <Text style={styles.modalDesc}>
              Kurucu hash'i (tw_founder_...), Global Admin hash'i (ga_cosmos_...) veya Personel hash'i (usr_div_...) yapıştırın:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Hash kodunu buraya yapıştırın"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]} 
                onPress={() => { setManualModalVisible(false); setManualInput(''); }}
              >
                <Text style={{ color: '#475569', fontWeight: '600', fontSize: 13 }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#2563EB', flex: 1 }]} 
                onPress={handleManualSubmit}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Onayla & Aktif Et</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomConfirmationSheet
        visible={alertConfig.visible}
        title={alertConfig.title}
        description={alertConfig.description}
        actionText={alertConfig.actionText}
        actionColor={alertConfig.actionColor}
        onAction={() => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          if (alertConfig.onDismiss) {
            alertConfig.onDismiss();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    backgroundColor: '#FFFFFF',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 32,
  },
  primaryAuthButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
  },
  primaryAuthButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hudOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  hudHeader: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
  hudHeaderTitle: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  hudHeaderSubtitle: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginTop: 2,
  },
  glassCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTargetContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  neonScanBox: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#3B82F6',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#60A5FA',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  hudHelperText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  manualEntryFloatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
    marginBottom: Platform.OS === 'ios' ? 24 : 36,
  },
  manualEntryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
