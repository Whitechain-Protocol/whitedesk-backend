import { 
  HelpDeskTicket, 
  HelpDeskMessage, 
  HelpDeskCategory, 
  AdminEntry, 
  ApprovalEntry 
} from '../../services/helpDeskService';

export interface AttachedFile {
  data: string;
  name: string;
  type: 'image' | 'document';
  mimeType: string;
  url?: string;
}

export type TicketViewType = 'list' | 'detail' | 'compose';

export type TicketFilterStatus = 'all' | 'open' | 'answered' | 'closed';

export type GeminiSectionKey = 'tenant' | 'license' | 'operators' | null;

export interface CustomFieldDef {
  key: string;
  label: string;
  required?: boolean;
}

export type CatalogItem = Record<string, string>;

export type RemoteDesktopScope = 'in_app' | 'selected_window' | 'full_screen';

export interface AdvancedFeaturesConfig {
  voiceCall: {
    enabled: boolean;              // Varsayılan: false
    policy: 'mutual_consent' | 'always_allow_vip' | 'disabled';
    allowUserInitiate?: boolean;   // Kullanıcı sesli görüşme başlatabilir
  };
  pushToTalk: {
    enabled: boolean;              // Bilet İçi Bas-Konuş
    radioEnabled?: boolean;        // Telsiz Yayını
    allowUserPtt?: boolean;        // Kullanıcı bas konuş başlatabilir
    allowGroupBroadcast?: boolean; // Grup üyeleri yayın başlatabilir
    allowedOrgs: string[];         // Yalnızca yetkilendirilmiş birim/org kimlikleri
    maxBurstSeconds: number;       // Varsayılan: 15 saniye
  };
  remoteDesktop?: {
    enabled: boolean;              // Bilet İçi Uzak Masaüstü & Lazer İşaretçi
    allowFullScreen?: boolean;     // Pencere / Sistem geneli paylaşımına izin ver
  };
  selfDestruct: {
    enabled: boolean;              // Varsayılan: false
    retentionAfterResolvedHours: 24 | 72 | 168 | 0; // 0 = yalnızca elle silme
    escalationSlaHours?: number;   // Geriye dönük uyumluluk
  };
  escalation: {
    enabled: boolean;              // Varsayılan: false
    slaHours: number;              // Yanıt gelmezse tırmanma süresi (Saat, varsayılan: 4)
    slaMinutes?: number;           // Dakika bazlı SLA süresi (örn. 15, 30, 60, 120 dk)
  };
  proofOfIntegrity: {
    enabled: boolean;              // Varsayılan: true (Doğuştan açık güvenlik)
    autoDownloadReceipt: boolean;  // Bilet kapanınca PDF/JSON makbuz üretilsin mi?
  };
  closure?: {
    requireUserConfirmation: boolean; // Kullanıcı teyidi zorunlu olsun mu?
    autoCloseHours: number;           // Çözüldükten sonra otomatik kapanma süresi (Saat)
  };
  rating?: {
    enabled: boolean;                 // Operatör yıldız puanlama aktif mi?
    allowInstantRating: boolean;      // Soğuma süresi beklemeden hemen değerlendirilsin mi?
  };
  piiRedaction?: {
    enabled: boolean;                 // Cihaz içi otomatik PII maskeleme zorunlu mu?
    maskCards: boolean;               // Kredi/Banka Kartları (Luhn)
    maskIdentity: boolean;            // T.C. Kimlik Numarası
    maskIban: boolean;                // IBAN Numaraları
    maskSecrets: boolean;             // API Anahtarı, JWT ve Gizli Tokenlar
  };
  buttonThemeId?: number;             // Kurumsal ana ekran buton teması ID'si (1 - 15)
}

export const DEFAULT_ADVANCED_FEATURES_CONFIG: AdvancedFeaturesConfig = {
  voiceCall: {
    enabled: true,
    policy: 'mutual_consent',
    allowUserInitiate: true,
  },
  pushToTalk: {
    enabled: true,
    radioEnabled: true,
    allowedOrgs: [],
    maxBurstSeconds: 15,
    allowUserPtt: true,
    allowGroupBroadcast: false,
  },
  remoteDesktop: {
    enabled: true,
    allowFullScreen: true,
  },
  selfDestruct: {
    enabled: false,
    retentionAfterResolvedHours: 72,
    escalationSlaHours: 4,
  },
  escalation: {
    enabled: false,
    slaHours: 4,
  },
  proofOfIntegrity: {
    enabled: true,
    autoDownloadReceipt: false,
  },
  piiRedaction: {
    enabled: true,
    maskCards: true,
    maskIdentity: true,
    maskIban: true,
    maskSecrets: true,
  },
  buttonThemeId: 1,
};

export interface UserAdvancedPreferences {
  voiceCallEnabled: boolean;
  pushToTalkEnabled: boolean;
  remoteDesktopEnabled?: boolean;
  remoteDesktopScope?: RemoteDesktopScope;
  autoDownloadReceipt: boolean;
  piiRedactionEnabled?: boolean;
}

export const DEFAULT_USER_ADVANCED_PREFERENCES: UserAdvancedPreferences = {
  voiceCallEnabled: true,
  pushToTalkEnabled: true,
  remoteDesktopEnabled: true,
  remoteDesktopScope: 'in_app',
  autoDownloadReceipt: false,
  piiRedactionEnabled: true,
};

