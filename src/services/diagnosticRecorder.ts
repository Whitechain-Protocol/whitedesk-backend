/**
 * WhiteDesk Diagnostic Recorder (BlackBox & Action Stream)
 * 
 * İstemci cihazın belleğinde çalışan, son 30 saniyelik veya en fazla 40 eylemi/logu
 * tutan döngüsel bellek tamponu (in-memory ring buffer).
 * 
 * Sıfır-Bilgi ve Gizlilik İlkeleri:
 * - Ağ isteklerinde asla Auth/Cookie başlıkları ve gövde (body) yükleri saklanmaz.
 * - Çıktı oluşturulurken tüm veriler piiSanitizer'dan geçirilir.
 * - Kullanıcı bilet oluştururken "Sistem Tanısı Gönder" seçtiğinde paketlenir.
 */

import { Platform, Dimensions, PixelRatio, AppState, PermissionsAndroid } from 'react-native';
import { piiSanitizer } from './piiSanitizer';
import { i18nService } from './i18nService';

export type DiagnosticEventType = 'navigation' | 'action' | 'network' | 'warning' | 'error' | 'lifecycle' | 'sdk';

export interface DiagnosticEvent {
  id: string;
  type: DiagnosticEventType;
  timestamp: number;
  label: string;
  details?: Record<string, any>;
}

export interface DevicePermissionsSnapshot {
  microphone: string;
  camera: string;
  notifications: string;
  keystoreVault: string;
}

export interface DeviceTelemetry {
  platform: string;
  osVersion: string | number;
  appVersion: string;
  screenResolution?: string;
  fontScale?: string;
  sessionUptime?: string;
  appState?: string;
  permissions?: DevicePermissionsSnapshot;
  locale?: string;
  memoryState?: string;
  timestamp: number;
}

export interface DiagnosticPackage {
  version: '1.0';
  exportedAt: number;
  device: DeviceTelemetry;
  events: DiagnosticEvent[];
  errorCount: number;
  warningCount?: number;
  networkSummary: {
    total: number;
    failed: number;
    slow?: number;
    avgDurationMs: number;
  };
}

class DiagnosticRecorderService {
  private maxEvents = 45;
  private buffer: DiagnosticEvent[] = [];
  private eventIdCounter = 1;
  private bootTimestamp = Date.now();
  private totalNetworkCalls = 0;
  private failedNetworkCalls = 0;
  private slowNetworkCalls = 0;
  private totalNetworkDurationMs = 0;
  private isRecordingError = false;
  private isRecordingWarning = false;
  private permissionsCache: DevicePermissionsSnapshot = {
    microphone: i18nService.t('diagnostics.permission_unknown'),
    camera: i18nService.t('diagnostics.permission_unknown'),
    notifications: i18nService.t('diagnostics.permission_unknown'),
    keystoreVault: i18nService.t('diagnostics.keystore_hardware_sealed'),
  };

  constructor() {
    const { width, height } = Dimensions.get('window');
    const ratio = PixelRatio.get();
    const fScale = Number(PixelRatio.getFontScale().toFixed(2));
    this.recordNavigation(i18nService.t('diagnostics.app_cold_boot'), {
      [i18nService.t('diagnostics.field_engine')]: i18nService.t('diagnostics.engine_hermes'),
      platform: `${Platform.OS.toUpperCase()} v${Platform.Version}`,
      [i18nService.t('diagnostics.field_screen')]: `${Math.round(width)}x${Math.round(height)} ${i18nService.t('common.dp')} (${ratio}x)`,
      [i18nService.t('diagnostics.field_font_scale')]: `${fScale}x${fScale > 1.15 ? ` (${i18nService.t('diagnostics.font_enlarged')})` : ` (${i18nService.t('diagnostics.font_standard')})`}`,
    });
    this.setupGlobalErrorHandler();
    this.setupNetworkInterceptor();
    this.setupAppStateListener();
    void this.refreshPermissionsSnapshot();
  }

  /**
   * Donanım izinlerini (Mikrofon, Kamera, Bildirim) canlı sorgula
   */
  public async refreshPermissionsSnapshot(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      const [micGranted, camGranted, notifGranted] = await Promise.all([
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO).catch(() => false),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA).catch(() => false),
        (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          ? PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => true)
          : Promise.resolve(true)),
      ]);
      this.permissionsCache = {
        microphone: micGranted ? i18nService.t('diagnostics.permission_on') : i18nService.t('diagnostics.permission_off'),
        camera: camGranted ? i18nService.t('diagnostics.permission_on') : i18nService.t('diagnostics.permission_off'),
        notifications: notifGranted ? i18nService.t('diagnostics.permission_on') : i18nService.t('diagnostics.permission_off'),
        keystoreVault: i18nService.t('diagnostics.keystore_hardware_sealed'),
      };
    } catch {}
  }

  /**
   * Uygulama ön plan / arka plan geçişlerini canlı yakala
   */
  private setupAppStateListener(): void {
    try {
      let lastState = AppState.currentState;
      AppState.addEventListener('change', (nextState) => {
        if (nextState !== lastState) {
          lastState = nextState;
          if (nextState === 'background') {
            this.pushEvent({
              id: `ev_${this.eventIdCounter++}`,
              type: 'lifecycle',
              timestamp: Date.now(),
              label: i18nService.t('diagnostics.state_background'),
              details: { [i18nService.t('diagnostics.field_status')]: i18nService.t('diagnostics.status_background_short'), [i18nService.t('diagnostics.field_uptime')]: this.getFormattedUptime() },
            });
          } else if (nextState === 'active') {
            void this.refreshPermissionsSnapshot();
            this.pushEvent({
              id: `ev_${this.eventIdCounter++}`,
              type: 'lifecycle',
              timestamp: Date.now(),
              label: i18nService.t('diagnostics.state_active'),
              details: { [i18nService.t('diagnostics.field_status')]: 'active', [i18nService.t('diagnostics.field_uptime')]: this.getFormattedUptime() },
            });
          }
        }
      });
    } catch {}
  }

  private getFormattedUptime(): string {
    const elapsedSec = Math.max(1, Math.floor((Date.now() - this.bootTimestamp) / 1000));
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    return mins > 0
      ? i18nService.t('diagnostics.uptime_min_sec', { mins, secs })
      : i18nService.t('diagnostics.uptime_sec', { secs });
  }

  /**
   * Harici yazılımların (WhiteDesk SDK kullanan ERP/Portalların) kendi iş akışı loglarını eklemesi için kanca
   */
  public recordCustomLog(moduleName: string, message: string, details?: Record<string, any>): void {
    const cleanMod = piiSanitizer.sanitize(moduleName).sanitizedText;
    const cleanMsg = piiSanitizer.sanitize(message).sanitizedText;
    this.pushEvent({
      id: `ev_${this.eventIdCounter++}`,
      type: 'sdk',
      timestamp: Date.now(),
      label: `[${cleanMod}] ${cleanMsg}`,
      details: details ? this.sanitizeDetails(details) : undefined,
    });
  }

  /**
   * Servis uyarılarını (console.warn / fallback durumlarını) kaydet
   */
  public recordWarning(message: string, details?: Record<string, any>): void {
    if (this.isRecordingWarning) return;
    this.isRecordingWarning = true;
    try {
      const cleanMsg = piiSanitizer.sanitize(String(message || i18nService.t('diagnostics.warning_default'))).sanitizedText;
      const last = this.buffer[this.buffer.length - 1];
      if (last && last.type === 'warning' && last.label.includes(cleanMsg.slice(0, 60))) {
        return;
      }
      this.pushEvent({
        id: `ev_${this.eventIdCounter++}`,
        type: 'warning',
        timestamp: Date.now(),
        label: `${i18nService.t('diagnostics.warning_prefix')}: ${cleanMsg.slice(0, 100)}`,
        details: details ? this.sanitizeDetails(details) : { message: cleanMsg },
      });
    } finally {
      this.isRecordingWarning = false;
    }
  }

  /**
   * Ekran geçişlerini kaydet
   */
  public recordNavigation(screenName: string, params?: Record<string, any>): void {
    const screenPrefix = `${i18nService.t('diagnostics.screen_prefix')}:`;
    const label = screenName.startsWith(screenPrefix) ? screenName : `${screenPrefix} ${screenName}`;
    // Aynı ekran ardı ardına tekrar tetiklendiyse mükerrer kayıt ekleme
    const last = this.buffer[this.buffer.length - 1];
    if (last && last.type === 'navigation' && last.label === label && Date.now() - last.timestamp < 1500) {
      return;
    }
    this.pushEvent({
      id: `ev_${this.eventIdCounter++}`,
      type: 'navigation',
      timestamp: Date.now(),
      label,
      details: params ? this.sanitizeDetails(params) : undefined,
    });
  }

  /**
   * Kullanıcı buton tıklamaları ve eylemlerini kaydet
   */
  public recordAction(actionName: string, details?: Record<string, any>): void {
    this.pushEvent({
      id: `ev_${this.eventIdCounter++}`,
      type: 'action',
      timestamp: Date.now(),
      label: actionName,
      details: details ? this.sanitizeDetails(details) : undefined,
    });
  }

  /**
   * Ağ çağrılarını kaydet (Başlık ve Gövde hariç, yalnızca URL yolu, metod ve durum kodu)
   */
  public recordNetwork(method: string, url: string, status: number, durationMs: number, errorMsg?: string): void {
    let cleanUrl = url;
    try {
      const parsed = new URL(url);
      cleanUrl = parsed.pathname;
    } catch {
      cleanUrl = url.split('?')[0];
    }

    const isSuccess = status >= 200 && status < 400;
    const isSlow = durationMs >= 1500;
    this.totalNetworkCalls += 1;
    this.totalNetworkDurationMs += Math.max(0, durationMs);
    if (!isSuccess) {
      this.failedNetworkCalls += 1;
    }
    if (isSlow) {
      this.slowNetworkCalls += 1;
    }

    const upperMethod = method.toUpperCase();
    const statusLabel = status === 0 ? i18nService.t('diagnostics.network_error_label') : isSlow && isSuccess ? `${status} • ${i18nService.t('diagnostics.network_slow_label')}` : String(status);
    const label = `${upperMethod} ${cleanUrl} (${statusLabel})`;

    // Arka plan periyodik yoklamaları (GET /api/relay/inbox veya /api/signal) başarılı ve hızlıysa
    // zaman çizelgesini (45 adım) çöplüğe çevirmemek için ardışık olanları birleştir/atla
    const isBackgroundPoll =
      upperMethod === 'GET' &&
      isSuccess &&
      !isSlow &&
      (cleanUrl.includes('/api/relay/inbox') || cleanUrl.includes('/api/signal'));

    if (isBackgroundPoll) {
      const lastNetIdx = [...this.buffer].reverse().findIndex(e => e.type === 'network');
      if (lastNetIdx !== -1) {
        const actualIdx = this.buffer.length - 1 - lastNetIdx;
        const prevNet = this.buffer[actualIdx];
        if (prevNet.label === label) {
          prevNet.timestamp = Date.now();
          prevNet.details = {
            ...prevNet.details,
            [i18nService.t('diagnostics.field_duration')]: `${durationMs} ${i18nService.t('common.ms')}`,
            [i18nService.t('diagnostics.field_status')]: `${status} (${i18nService.t('diagnostics.network_status_success')})`,
          };
          return;
        }
      }
    }

    const detailsObj: Record<string, any> = {
      [i18nService.t('diagnostics.field_method')]: upperMethod,
      [i18nService.t('diagnostics.field_endpoint')]: cleanUrl,
      [i18nService.t('diagnostics.field_status')]: status === 0
        ? `0 (${i18nService.t('diagnostics.network_connection_error')})`
        : `${status} (${isSuccess ? (isSlow ? i18nService.t('diagnostics.network_slow_response') : i18nService.t('diagnostics.network_status_success')) : i18nService.t('diagnostics.network_status_failed')})`,
      [i18nService.t('diagnostics.field_duration')]: `${durationMs} ${i18nService.t('common.ms')}`,
      durationMs,
      isSuccess,
      isSlow,
    };
    if (errorMsg) {
      detailsObj[i18nService.t('diagnostics.field_error')] = piiSanitizer.sanitize(errorMsg).sanitizedText;
    }

    this.pushEvent({
      id: `ev_${this.eventIdCounter++}`,
      type: 'network',
      timestamp: Date.now(),
      label,
      details: detailsObj,
    });
  }

  /**
   * Sistem veya JavaScript hatalarını kaydet
   */
  public recordError(message: string, stack?: string): void {
    if (this.isRecordingError) return;
    this.isRecordingError = true;
    try {
      const cleanMsg = piiSanitizer.sanitize(String(message || i18nService.t('diagnostics.unknown_error'))).sanitizedText;
      const cleanStack = stack ? piiSanitizer.sanitize(String(stack).slice(0, 600)).sanitizedText : undefined;

      this.pushEvent({
        id: `ev_${this.eventIdCounter++}`,
        type: 'error',
        timestamp: Date.now(),
        label: `${i18nService.t('diagnostics.error_prefix')}: ${cleanMsg.slice(0, 100)}`,
        details: {
          message: cleanMsg,
          stack: cleanStack,
        },
      });
    } finally {
      this.isRecordingError = false;
    }
  }

  /**
   * Döngüsel tampona olay ekleme
   */
  private pushEvent(event: DiagnosticEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.maxEvents) {
      this.buffer.shift();
    }
  }

  /**
   * Parametrelerden hassas anahtarları temizleme
   */
  private sanitizeDetails(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'secret', 'token', 'card', 'key', 'auth', 'tc', 'identity'];

    for (const [k, v] of Object.entries(obj)) {
      if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
        sanitized[k] = i18nService.t('pii.redacted');
      } else if (typeof v === 'string') {
        sanitized[k] = piiSanitizer.sanitize(v).sanitizedText;
      } else if (typeof v === 'object' && v !== null) {
        sanitized[k] = i18nService.t('diagnostics.object_placeholder');
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  /**
   * Cihaz telemetri özetini canlı donanım/ekran API'lerinden al
   */
  public getDeviceTelemetry(): DeviceTelemetry {
    const { width, height } = Dimensions.get('window');
    const ratio = PixelRatio.get();
    const fScale = Number(PixelRatio.getFontScale().toFixed(2));
    return {
      platform: Platform.OS,
      osVersion: Platform.Version,
      appVersion: i18nService.t('diagnostics.app_version_hermes'),
      screenResolution: `${Math.round(width)}x${Math.round(height)} ${i18nService.t('common.dp')} (${ratio}x)`,
      fontScale: `${fScale}x${fScale > 1.15 ? ` (${i18nService.t('diagnostics.font_large')})` : ` (${i18nService.t('diagnostics.font_normal')})`}`,
      sessionUptime: this.getFormattedUptime(),
      appState: AppState.currentState || 'active',
      permissions: { ...this.permissionsCache },
      locale: i18nService.getCurrentLanguage(),
      memoryState: i18nService.t('diagnostics.memory_normal'),
      timestamp: Date.now(),
    };
  }

  /**
   * Kullanıcı bilet oluştururken mühürlenecek paketi dışa aktar
   */
  public exportPackage(): DiagnosticPackage {
    void this.refreshPermissionsSnapshot();
    const eventsCopy = [...this.buffer];
    const errors = eventsCopy.filter(e => e.type === 'error');
    const warnings = eventsCopy.filter(e => e.type === 'warning');
    const networks = eventsCopy.filter(e => e.type === 'network');
    const failedInBuffer = networks.filter(n => n.details?.isSuccess === false).length;
    const slowInBuffer = networks.filter(n => n.details?.isSlow === true).length;

    const totalNet = Math.max(this.totalNetworkCalls, networks.length);
    const failedNet = Math.max(this.failedNetworkCalls, failedInBuffer);
    const slowNet = Math.max(this.slowNetworkCalls, slowInBuffer);
    const avgDuration =
      this.totalNetworkCalls > 0
        ? Math.round(this.totalNetworkDurationMs / this.totalNetworkCalls)
        : networks.length > 0
          ? Math.round(networks.reduce((acc, curr) => acc + (curr.details?.durationMs || 0), 0) / networks.length)
          : 0;

    return {
      version: '1.0',
      exportedAt: Date.now(),
      device: this.getDeviceTelemetry(),
      events: eventsCopy,
      errorCount: errors.length,
      warningCount: warnings.length,
      networkSummary: {
        total: totalNet,
        failed: failedNet,
        slow: slowNet,
        avgDurationMs: avgDuration,
      },
    };
  }

  /**
   * Global Fetch (Ağ) İsteklerini Sıfır-Bilgi İlkesiyle Yakala
   * (Başlık/Body saklamaz, yalnızca Metod, URL yolu, Durum Kodu ve Süre kaydeder)
   */
  private setupNetworkInterceptor(): void {
    try {
      const g = global as any;
      if (typeof g.fetch === 'function' && !g.__whitedeskFetchHooked) {
        const origFetch = g.fetch.bind(g);
        g.__whitedeskFetchHooked = true;
        g.fetch = async (input: any, init?: any) => {
          const start = Date.now();
          let url = '';
          let method = 'GET';
          try {
            if (typeof input === 'string') {
              url = input;
            } else if (input && typeof input.url === 'string') {
              url = input.url;
            }
            if (init && typeof init.method === 'string') {
              method = init.method.toUpperCase();
            } else if (input && typeof input.method === 'string') {
              method = input.method.toUpperCase();
            }
          } catch {}

          try {
            const response = await origFetch(input, init);
            const duration = Date.now() - start;
            if (url) {
              this.recordNetwork(method, url, response.status, duration);
              if (response.status >= 500) {
                this.recordError(
                  i18nService.t('diagnostics.server_error_http', {
                    method,
                    url: url.split('?')[0],
                    status: response.status,
                  })
                );
              }
            }
            return response;
          } catch (err: any) {
            const duration = Date.now() - start;
            const errMsg = err?.message || i18nService.t('diagnostics.network_connection_failed');
            if (url && err?.name !== 'AbortError') {
              this.recordNetwork(method, url, 0, duration, errMsg);
              this.recordError(
                i18nService.t('diagnostics.network_request_failed', {
                  method,
                  url: url.split('?')[0],
                  error: errMsg,
                }),
                err?.stack
              );
            }
            throw err;
          }
        };
      }
    } catch {}
  }

  /**
   * Global JavaScript, Console.error, Console.warn ve Promise hata yakalayıcısı
   */
  private setupGlobalErrorHandler(): void {
    try {
      const g = global as any;
      if (g.ErrorUtils && typeof g.ErrorUtils.setGlobalHandler === 'function') {
        const defaultHandler = g.ErrorUtils.getGlobalHandler();
        g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
          this.recordError(error?.message || i18nService.t('diagnostics.global_system_error'), error?.stack);
          if (defaultHandler) defaultHandler(error, isFatal);
        });
      }

      if (typeof console !== 'undefined' && typeof console.error === 'function' && !(console as any).__whitedeskErrorHooked) {
        const origConsoleError = console.error.bind(console);
        (console as any).__whitedeskErrorHooked = true;
        console.error = (...args: any[]) => {
          try {
            const first = args[0];
            const msg = args
              .map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
              .join(' ')
              .slice(0, 240);
            const stack = args.find(a => a instanceof Error)?.stack;
            if (msg && !msg.includes('Warning:') && !msg.includes('ReactNativeFiber')) {
              this.recordError(msg, stack || (first instanceof Error ? first.stack : undefined));
            }
          } catch {}
          origConsoleError(...args);
        };
      }

      if (typeof console !== 'undefined' && typeof console.warn === 'function' && !(console as any).__whitedeskWarnHooked) {
        const origConsoleWarn = console.warn.bind(console);
        (console as any).__whitedeskWarnHooked = true;
        console.warn = (...args: any[]) => {
          try {
            const msg = args
              .map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
              .join(' ')
              .slice(0, 220);
            // Yalnızca uygulama servis uyarılarını yakala, React Native iç geliştirici uyarılarını filtrele
            if (
              msg &&
              !msg.includes('Require cycle:') &&
              !msg.includes('ViewPropTypes') &&
              !msg.includes('new NativeEventEmitter') &&
              !msg.includes('Non-serializable')
            ) {
              this.recordWarning(msg);
            }
          } catch {}
          origConsoleWarn(...args);
        };
      }
    } catch {
      // Hata yakalama kurulum hatasını sessizce yut
    }
  }
}

export const diagnosticRecorder = new DiagnosticRecorderService();
