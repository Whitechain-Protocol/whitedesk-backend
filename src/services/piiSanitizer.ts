/**
 * WhiteDesk Global Client-Side PII (Personally Identifiable Information) Redaction Engine
 * 
 * Sunucuya veya harici bir yapay zekâ servisine gitmeden önce tamamen istemcinin 
 * kendi cihazında yerel algoritmalarla çalışan sıfır-bilgi (Zero-Knowledge) küresel veri maskeleyicisi.
 * 
 * 32 Dil ve Çok Uluslu Kurumsal Kapsam:
 * 1. Global Finansal Veriler (ISO/IEC 7812 Kredi/Banka Kartları, ISO 13616 Uluslararası IBAN, SWIFT/BIC, US Routing)
 * 2. Uluslararası Kimlik & Vergi (T.C. Kimlik, US SSN, IT Codice Fiscale, UK NINO, FR NIR, ES DNI, Global Pasaportlar)
 * 3. Küresel Bulut & DevOps Kimlik Bilgileri (Private Key, JWT, Bearer, AWS, OpenAI, Stripe, GitHub, API Keys)
 * 4. İletişim Bilgileri (E-posta, E.164 Uluslararası Telefon Numaraları - Opsiyonel)
 */

import { i18nService } from './i18nService';

export interface PiiRedactionOptions {
  maskCards?: boolean;
  maskIdentity?: boolean;
  maskIban?: boolean;
  maskSecrets?: boolean;
  maskContact?: boolean;
}

export interface PiiSanitizeResult {
  sanitizedText: string;
  hasRedactions: boolean;
  redactedCount: number;
  details: {
    cards: number;
    identity: number;
    iban: number;
    secrets: number;
    contact?: number;
  };
}

/**
 * Standart Luhn algoritması kontrolü (ISO/IEC 7812 Kredi / Banka kartı numara doğrulaması)
 */
export function isValidLuhn(digitStr: string): boolean {
  if (digitStr.length < 13 || digitStr.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digitStr.length - 1; i >= 0; i--) {
    let digit = parseInt(digitStr.charAt(i), 10);
    if (isNaN(digit)) return false;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * T.C. Kimlik Numarası Algoritması (11 hane checksum doğrulama)
 */
export function isValidTcKimlik(tcStr: string): boolean {
  if (!/^[1-9]\d{10}$/.test(tcStr)) return false;
  const d = tcStr.split('').map(x => parseInt(x, 10));

  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];

  const digit10 = ((oddSum * 7) - evenSum) % 10;
  const expected10 = digit10 < 0 ? digit10 + 10 : digit10;
  if (d[9] !== expected10) return false;

  let total10 = 0;
  for (let i = 0; i < 10; i++) {
    total10 += d[i];
  }
  if (d[10] !== (total10 % 10)) return false;

  return true;
}

class PiiSanitizerService {
  /**
   * Hızlı Ön Eleme (Fast Exit): Metinde potansiyel PII izi yoksa ağır regex'leri çalıştırmaz.
   */
  private couldContainPii(text: string): boolean {
    if (!text || text.length < 6) return false;
    // Rakam, '@' veya anahtar kelime başlangıcı içeriyor mu?
    return /[\d@]|BEGIN|eyJ|Bearer|AKIA|sk-|gh[pousr]|api|secret|token/i.test(text);
  }

  /**
   * 1. Bulut, API ve Güvenlik Sırlarını Maskeleme
   */
  private maskSecrets(text: string): { text: string; count: number } {
    let count = 0;
    let res = text;

    // Private Key blokları (RSA, EC, OPENSSH, PGP)
    res = res.replace(
      /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
      () => {
        count++;
        return i18nService.t('pii.private_key_protected');
      }
    );

    // JWT Token deseni
    res = res.replace(
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      () => {
        count++;
        return `eyJ****.****.**** ${i18nService.t('pii.jwt_masked')}`;
      }
    );

    // Bearer token deseni
    res = res.replace(
      /\bBearer\s+([A-Za-z0-9_\-\.]{16,})\b/gi,
      () => {
        count++;
        return `Bearer ${i18nService.t('pii.token_masked')}`;
      }
    );

    // AWS Access Key ID
    res = res.replace(
      /\bAKIA[0-9A-Z]{16}\b/g,
      () => {
        count++;
        return 'AKIA****************';
      }
    );

    // OpenAI API Keys (sk-proj-..., sk-...)
    res = res.replace(
      /\bsk-(?:proj-|none-)?[a-zA-Z0-9_-]{20,}\b/g,
      () => {
        count++;
        return i18nService.t('pii.openai_key_masked');
      }
    );

    // Stripe API Keys (sk_live_..., rk_live_...)
    res = res.replace(
      /\b(?:sk|rk)_(?:live|test)_[a-zA-Z0-9]{20,}\b/g,
      () => {
        count++;
        return i18nService.t('pii.stripe_key_masked');
      }
    );

    // GitHub Personal Access Tokens (ghp_..., gho_..., ghu_...)
    res = res.replace(
      /\bgh[pousr]_[a-zA-Z0-9]{36,}\b/g,
      () => {
        count++;
        return i18nService.t('pii.github_token_masked');
      }
    );

    // Genel Config Parametreleri: apiKey = "...", secret = '...'
    res = res.replace(
      /\b(api[_-]?key|secret[_-]?key|private[_-]?key|access[_-]?token|app[_-]?secret|auth[_-]?token)[\s:=]+["']?([a-zA-Z0-9_\-]{16,})["']?/gi,
      (match, label) => {
        count++;
        return `${label}: "******** ${i18nService.t('pii.redacted')}"`;
      }
    );

    return { text: res, count };
  }

  /**
   * 2. Uluslararası Banka & IBAN Numaraları (ISO 13616 ve SWIFT/BIC)
   */
  private maskIban(text: string): { text: string; count: number } {
    let count = 0;
    let res = text;

    // ISO 13616 Uluslararası IBAN Kalıbı (TR + AB/SEPA + ME + UK 80+ Ülke)
    res = res.replace(
      /\b([A-Z]{2}\d{2})[\s.-]?((?:[A-Z0-9]{4}[\s.-]?){2,7}[A-Z0-9]{1,4})\b/gi,
      (match) => {
        const raw = match.replace(/[\s.-]/g, '');
        if (raw.length >= 15 && raw.length <= 34) {
          count++;
          const prefix = raw.substring(0, 4);
          const last2 = raw.slice(-2);
          return `${prefix} **** **** **** **${last2}`;
        }
        return match;
      }
    );

    // US Routing / ABA Numaraları (etiketli)
    res = res.replace(
      /\b(?:routing|routing number|aba routing)[\s:#]+(\d{9})\b/gi,
      () => {
        count++;
        return `${i18nService.t('pii.routing_prefix')}: *****${i18nService.t('pii.redacted')}`;
      }
    );

    return { text: res, count };
  }

  /**
   * 3. Küresel Kredi & Banka Kartları (ISO/IEC 7812)
   */
  private maskCards(text: string): { text: string; count: number } {
    let count = 0;
    // Visa/Mastercard (4x4), Amex (4-6-5), Diners (4-6-4) ve 13-19 haneli kart blokları
    const res = text.replace(
      /\b(?:\d{4}[ -.]?){3}\d{1,4}\b|\b(?:\d{4}[ -.]?\d{6}[ -.]?\d{4,5})\b|\b\d{13,19}\b/g,
      (match) => {
        const digitsOnly = match.replace(/[ -.]/g, '');
        // Luhn algoritması geçerliyse VEYA standart kart hanesi aralığındaysa (14, 15, 16 hane) maskele
        if (isValidLuhn(digitsOnly) || digitsOnly.length === 16 || digitsOnly.length === 15 || digitsOnly.length === 14) {
          count++;
          const last4 = digitsOnly.slice(-4);
          return `**** **** **** ${last4}`;
        }
        return match;
      }
    );
    return { text: res, count };
  }

  /**
   * 4. Uluslararası Kimlik, Sosyal Güvenlik ve Pasaport Numaraları
   */
  private maskIdentity(text: string): { text: string; count: number } {
    let count = 0;
    let res = text;

    // US SSN (Social Security Number): 3-2-4 blokları veya etiketli
    res = res.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => {
      count++;
      return '***-**-****';
    });
    res = res.replace(/\b(?:ssn|social security)[\s:#]+(\d{3}[\s-]?\d{2}[\s-]?\d{4}|\d{9})\b/gi, () => {
      count++;
      return i18nService.t('pii.ssn_masked');
    });

    // İtalya Codice Fiscale: 16 alfanümerik (6 Harf + 2 Rakam + 1 Harf + 2 Rakam + 1 Harf + 3 Rakam + 1 Harf)
    res = res.replace(/\b([A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z])\b/gi, (match) => {
      count++;
      return `${match.substring(0, 6)}**********`;
    });

    // UK NINO (National Insurance Number): 2 Harf + 6 Rakam + 1 Harf
    res = res.replace(/\b([A-CEGHJ-PR-TW-Z]{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?[A-D])\b/gi, () => {
      count++;
      return '** ** ** ** *';
    });

    // Fransa NIR (Numéro de Sécurité Sociale): 15 haneli
    res = res.replace(/\b([12][\s-]?(?:\d{2}[\s-]?){3}(?:\d{3}[\s-]?){2}\d{2})\b/g, () => {
      count++;
      return '* ** ** ** *** *** **';
    });

    // İspanya DNI / NIE: 8 Rakam + 1 Harf veya X/Y/Z + 7 Rakam + 1 Harf
    res = res.replace(/\b(?:\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/gi, (match) => {
      count++;
      return `*******${match.slice(-2)}`;
    });

    // T.C. Kimlik Numarası (Bitişik, boşluklu, noktalı veya tireli 11 hane)
    res = res.replace(/\b[1-9](?:[\s.-]?\d){10}\b/g, (match) => {
      const digitsOnly = match.replace(/[\s.-]/g, '');
      if (digitsOnly.length === 11) {
        count++;
        return '***********';
      }
      return match;
    });

    // Uluslararası Pasaportlar (Etiketli ICAO Doc 9303: 6-10 hane alfanümerik)
    res = res.replace(
      /\b(passport|passaporto|pasaporte|reisepass|pasaport)[\s:#]+([A-Z0-9]{6,10})\b/gi,
      (match, label) => {
        count++;
        return `${label}: *********`;
      }
    );

    return { text: res, count };
  }

  /**
   * 5. İletişim Bilgileri (Opsiyonel / Konfigüre Edilebilir)
   */
  private maskContact(text: string): { text: string; count: number } {
    let count = 0;
    let res = text;

    // E-posta Adresi Maskeleme
    res = res.replace(
      /\b([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g,
      (match, user, domain) => {
        count++;
        const visibleStart = user.charAt(0);
        return `${visibleStart}***@${domain}`;
      }
    );

    return { text: res, count };
  }

  /**
   * Metni yerel algoritmalarla tara ve kişisel verileri maskele
   */
  public sanitize(
    text: string,
    options: PiiRedactionOptions = {
      maskCards: true,
      maskIdentity: true,
      maskIban: true,
      maskSecrets: true,
      maskContact: false,
    }
  ): PiiSanitizeResult {
    if (!text || typeof text !== 'string') {
      return {
        sanitizedText: text || '',
        hasRedactions: false,
        redactedCount: 0,
        details: { cards: 0, identity: 0, iban: 0, secrets: 0, contact: 0 },
      };
    }

    // Erken çıkış: Metinde PII potansiyeli yoksa O(1) hızla dön
    if (!this.couldContainPii(text)) {
      return {
        sanitizedText: text,
        hasRedactions: false,
        redactedCount: 0,
        details: { cards: 0, identity: 0, iban: 0, secrets: 0, contact: 0 },
      };
    }

    let result = text;
    let cardsCount = 0;
    let identityCount = 0;
    let ibanCount = 0;
    let secretsCount = 0;
    let contactCount = 0;

    // 1. Sırlar ve Anahtarlar
    if (options.maskSecrets !== false) {
      const sec = this.maskSecrets(result);
      result = sec.text;
      secretsCount = sec.count;
    }

    // 2. IBAN & Banka
    if (options.maskIban !== false) {
      const ib = this.maskIban(result);
      result = ib.text;
      ibanCount = ib.count;
    }

    // 3. Kredi & Banka Kartları
    if (options.maskCards !== false) {
      const cd = this.maskCards(result);
      result = cd.text;
      cardsCount = cd.count;
    }

    // 4. Kimlik & Vergi Numaraları
    if (options.maskIdentity !== false) {
      const idn = this.maskIdentity(result);
      result = idn.text;
      identityCount = idn.count;
    }

    // 5. İletişim Bilgileri (Opsiyonel)
    if (options.maskContact) {
      const cnt = this.maskContact(result);
      result = cnt.text;
      contactCount = cnt.count;
    }

    const totalRedactions = cardsCount + identityCount + ibanCount + secretsCount + contactCount;

    return {
      sanitizedText: result,
      hasRedactions: totalRedactions > 0,
      redactedCount: totalRedactions,
      details: {
        cards: cardsCount,
        identity: identityCount,
        iban: ibanCount,
        secrets: secretsCount,
        contact: contactCount,
      },
    };
  }

  /**
   * Hızlı tarama: Metinde maskelenecek herhangi bir hassas veri var mı?
   */
  public hasPii(text: string): boolean {
    if (!text || text.length < 6) return false;
    const res = this.sanitize(text);
    return res.hasRedactions;
  }
}

export const piiSanitizer = new PiiSanitizerService();
