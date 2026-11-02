import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { CheckCircle2, Clock, Star, Leaf, RotateCcw } from 'lucide-react-native';
import { TicketLifecycleStatus } from '../services/helpDeskService';

export interface TicketLifecycleCardProps {
  lifecycle: TicketLifecycleStatus;
  language: string;
  onOpenRating: () => void;
  onStartSelfDestruct: () => void;
  onCancelSelfDestruct: () => void;
}

export const TicketLifecycleCard: React.FC<TicketLifecycleCardProps> = ({
  lifecycle,
  language,
  onOpenRating,
  onStartSelfDestruct,
  onCancelSelfDestruct,
}) => {
  const isTr = language === 'tr';

  if (lifecycle.stage === 'open') {
    return null;
  }

  // 1. Aşama: Kapatıldı, değerlendirme için birkaç saat bekleniyor
  if (lifecycle.stage === 'closed_cooling') {
    const remainingMs = Math.max(0, (lifecycle.ratingDueAt || 0) - Date.now());
    const remainingHours = Math.max(1, Math.ceil(remainingMs / (3600 * 1000)));

    return (
      <View style={[styles.container, styles.coolingContainer]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
            <CheckCircle2 size={16} color="#16A34A" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: '#166534' }]}>
              {isTr ? '1. Adım Tamamlandı: Bilet Kapatıldı' : 'Step 1 Completed: Ticket Closed'}
            </Text>
            <Text style={styles.desc}>
              {isTr
                ? `Çözüm deneyiminizden emin olabilmeniz için değerlendirme adımı ~${remainingHours} saat sonra açılacaktır.`
                : `Evaluation window will open in ~${remainingHours}h so you can verify the resolution.`}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onOpenRating} activeOpacity={0.8}>
            <Star size={14} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
            <Text style={styles.primaryBtnText}>
              {isTr ? 'Beklemeden Şimdi Değerlendir' : 'Evaluate Now Without Waiting'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 2. Aşama: Birkaç saat geçti, değerlendirme bekleniyor
  if (lifecycle.stage === 'rating_pending') {
    return (
      <View style={[styles.container, styles.ratingContainer]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#DBEAFE' }]}>
            <Star size={16} color="#2563EB" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: '#1E40AF' }]}>
              {isTr ? '2. Adım: Hizmet Kalitesini Değerlendirin' : 'Step 2: Rate Support Quality'}
            </Text>
            <Text style={styles.desc}>
              {isTr
                ? 'Talebiniz çözüldü ve kapatıldı. Aldığınız destek deneyimini puanlayabilirsiniz.'
                : 'Your ticket is resolved and closed. Please rate your support experience.'}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#2563EB' }]} onPress={onOpenRating} activeOpacity={0.8}>
            <Star size={14} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
            <Text style={styles.primaryBtnText}>
              {isTr ? 'Yöneticiyi Puanla (1 - 5)' : 'Rate Agent (1 - 5)'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 2. Aşama Tamamlandı: Puanlandı, imha süreci için birkaç saat bekleniyor
  if (lifecycle.stage === 'rated_cooling') {
    const remainingMs = Math.max(0, (lifecycle.ttlStartDueAt || 0) - Date.now());
    const remainingHours = Math.max(1, Math.ceil(remainingMs / (3600 * 1000)));

    return (
      <View style={[styles.container, styles.coolingContainer]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Star size={16} color="#D97706" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: '#92400E' }]}>
              {isTr
                ? `2. Adım Tamamlandı: Değerlendirme Alındı (${lifecycle.score || 5} ★)`
                : `Step 2 Completed: Feedback Received (${lifecycle.score || 5} ★)`}
            </Text>
            <Text style={styles.desc}>
              {isTr
                ? `Geri bildiriminiz kaydedildi. 7 günlük kendini imha süreci ~${remainingHours} saat sonra başlayacaktır.`
                : `Feedback recorded. 7-day self-destruct countdown will begin in ~${remainingHours}h.`}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#16A34A' }]} onPress={onStartSelfDestruct} activeOpacity={0.8}>
            <Leaf size={14} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
            <Text style={styles.primaryBtnText}>
              {isTr ? 'İmha Sürecini Şimdi Başlat (7 Gün)' : 'Start Self-Destruct Now (7 Days)'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 3. Aşama: 7 Günlük Kendini İmha Sayacı Devrede
  if (lifecycle.stage === 'self_destructing') {
    return (
      <View style={[styles.container, styles.destructContainer]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
            <Leaf size={16} color="#16A34A" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: '#166534' }]}>
              {isTr ? '3. Adım: Kendini İmha Süreci Devrede' : 'Step 3: Self-Destruct In Progress'}
            </Text>
            <Text style={styles.desc}>
              {isTr
                ? `Bu bilet ve mesajları ${lifecycle.remainingDays || 7} gün sonra kalıcı olarak kendini imha edecektir.`
                : `This ticket and all messages will permanently self-destruct in ${lifecycle.remainingDays || 7} days.`}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancelSelfDestruct} activeOpacity={0.8}>
            <RotateCcw size={14} color="#0D9488" strokeWidth={2.2} style={{ marginRight: 6 }} />
            <Text style={styles.cancelBtnText}>
              {isTr ? 'İmha Sürecini İptal Et / Yeniden Aç' : 'Cancel Self-Destruct / Reopen'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  coolingContainer: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  ratingContainer: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  destructContainer: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  desc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0D9488',
    borderRadius: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },
});
