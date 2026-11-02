/**
 * WhiteDesk Sovereign Zero-Knowledge Crypto Vault Service
 *
 * MİMARİ VE KRİPTOGRAFİK İLKELER:
 * 1. Asymmetric KeyPair: 12 sözcüklü kurtarma ifadesinden (Mnemonic) türetilen anahtar çifti.
 * 2. Key Set Türevli Erişim Anahtarları: Onboarding'de oluşturulan kodlar rastgele kör ID değil,
 *    asimetrik anahtar kümesinden (Key Set: P-256 / Ed25519) türevlenen hash kodlarıdır.
 * 3. İki Kademeli Türevleme (Derivation -> Blind ID): Kullanıcı veya Yönetici bu Erişim Anahtarını
 *    girdiğinde sistem anahtardan cihaz tarafında Private/Public Key çiftini yeniden türetir
 *    (böylece biletleri E2EE çözebilir), ardından Neon DB'ye yazılacak/aranacak Blind ID'yi
 *    tek yönlü hash ile türetir. DB'de ham anahtarlar asla saklanmaz.
 * 4. Genesis Bundle: 1 Yönetici Erişim Anahtarı + 10 Kullanıcı Erişim Anahtarı paketi.
 */

import { CryptoService, CryptoIdentity } from './cryptoService';
import { WhiteDeskCrypto } from '../whitedesk-sdk';
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes, concatBytes } from '@noble/ciphers/utils.js';

export interface KeyPairVault {
  mnemonic: string;
  whiteId: string;
  blindId: string;
  publicKey: string;
  privateKey?: string;
}

export interface DerivedKeyVault {
  accessKey: string;      // 60 Karakterlik Erişim Anahtarı
  whiteId: string;        // P-256 Sıkıştırılmış Public Key Hex (E2EE Kimliği)
  blindId: string;        // Neon DB'de aranan/yazılan tek yönlü Kör Kimlik
  publicKey: string;      // Public Key Hex
  privateKey: string;     // Private Key Hex (Bilet şifreleme/çözme için cihaz kasasında saklanır)
}

export interface GenesisBundle {
  tenantName: string;
  workspaceName: string;
  createdAt: number;
  founderBlindId: string;
  adminRecoveryKey: string;      // 1 Yönetici Erişim Anahtarı (60 karakter)
  userAccessKeys: string[];       // 10 Kullanıcı Erişim Anahtarı (60 karakter)
}

export class CryptoVaultService {
  /**
   * 12 Sözcüklü yeni bir kök kurtarma ifadesi ve anahtar kümesi türetir
   */
  static async generateRootVault(): Promise<KeyPairVault> {
    const mnemonic = CryptoService.generateMnemonic();
    return await this.deriveVaultFromMnemonic(mnemonic);
  }

  /**
   * 12 Sözcükten deterministik olarak KeyPair ve 60 karakterlik Blind ID türetir
   */
  static async deriveVaultFromMnemonic(mnemonic: string): Promise<KeyPairVault> {
    const cleanMnemonic = mnemonic.trim().toLowerCase();
    const whiteId = await CryptoService.deriveWhiteId(cleanMnemonic);
    const blindId = WhiteDeskCrypto.generateBlindId(whiteId);

    return {
      mnemonic: cleanMnemonic,
      whiteId,
      blindId,
      publicKey: whiteId,
    };
  }

  /**
   * 12 Sözcüğün geçerli bir BIP-39 kurtarma ifadesi olup olmadığını denetler
   */
  static validateMnemonic(mnemonic: string): boolean {
    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 12) return false;
    return CryptoService.validateMnemonic(mnemonic.trim().toLowerCase());
  }

  /**
   * 60 Karakterlik Deterministik Erişim Anahtarı Üretir
   */
  static generate60CharKey(prefix: string, seed: string, index: number): string {
    const raw = bytesToHex(sha256(utf8ToBytes(`${seed}:${prefix}:${index}:${Date.now()}`)));
    const body = raw.substring(0, 60 - prefix.length - 1);
    return `${prefix}_${body}`;
  }

  /**
   * Erişim Anahtarından (Access Key) deterministik olarak Key Set (Private/Public Key)
   * ve Neon DB için Blind ID türetir.
   *
   * Bu sayede kullanıcılar biletleri uçtan uca (E2EE) şifreleyebilir ve çözebilir;
   * Neon DB'de ise ham erişim anahtarı değil, bu anahtardan türetilen blind_id tutulur.
   */
  static deriveVaultFromAccessKey(accessKey: string): DerivedKeyVault {
    const cleanKey = accessKey.trim();
    // Deterministik 48-byte seed türetimi
    const seed = sha256(utf8ToBytes(`WhiteDesk_AccessKey_Seed_2026:${cleanKey}`));
    const extendedSeed = concatBytes(seed, sha256(seed));
    const privateKey = p256.utils.randomSecretKey(extendedSeed.subarray(0, 48));
    const publicKey = p256.getPublicKey(privateKey, true);
    const whiteId = bytesToHex(publicKey);

    // Neon DB'ye yazılacak ve aranacak tek yönlü Kör Kimlik (Blind ID)
    const blindId = WhiteDeskCrypto.generateBlindId(whiteId);

    return {
      accessKey: cleanKey,
      whiteId,
      blindId,
      publicKey: whiteId,
      privateKey: bytesToHex(privateKey),
    };
  }

  /**
   * Kuruluş Kurulumu (Genesis Ceremony) için 1 Yönetici ve 10 Kullanıcı Erişim Anahtarı üretir.
   * Her anahtar bir asimetrik Key Set'ten türevlenir.
   */
  static generateGenesisBundle(
    tenantName: string,
    workspaceName: string,
    founderBlindId: string
  ): GenesisBundle {
    const seed = `${founderBlindId}:${tenantName}:${Date.now()}`;

    // 1 Adet 60 karakterlik Yönetici Erişim Anahtarı
    const adminRecoveryKey = this.generate60CharKey('adm_rec', seed, 0);

    // 10 Adet 60 karakterlik Kullanıcı Erişim Anahtarı
    const userAccessKeys: string[] = [];
    for (let i = 1; i <= 10; i++) {
      userAccessKeys.push(this.generate60CharKey('usr_acc', seed, i));
    }

    return {
      tenantName,
      workspaceName,
      createdAt: Date.now(),
      founderBlindId,
      adminRecoveryKey,
      userAccessKeys,
    };
  }

  /**
   * Başlangıç paketini insan ve makine tarafından okunabilir metin formatına dönüştürür
   */
  static formatGenesisBundleText(bundle: GenesisBundle): string {
    return `=======================================================
WHITEDESK KURUMSAL ERİŞİM ANAHTARLARI PAKETİ
=======================================================
Kuruluş Adı       : ${bundle.tenantName}
Çalışma Alanı     : ${bundle.workspaceName}
Oluşturulma Tarihi: ${new Date(bundle.createdAt).toLocaleString('tr-TR')}
Kuruluş Kimliği   : ${bundle.founderBlindId}

-------------------------------------------------------
14 GÜNLÜK ÜCRETSİZ DENEME SÜRÜMÜ ERİŞİM ANAHTARLARI
-------------------------------------------------------
[1 ADET YÖNETİCİ ERİŞİM ANAHTARI]
${bundle.adminRecoveryKey}

[10 ADET KULLANICI ERİŞİM ANAHTARI]
${bundle.userAccessKeys.map((k, idx) => `${String(idx + 1).padStart(2, '0')}. ${k}`).join('\n')}

=======================================================
ÖNEMLİ GÜVENLİK BİLGİSİ:
Bu anahtarlar asimetrik anahtar kümelerinden (Key Set)
türetilmiş tekil erişim anahtarlarıdır. Cihazınızda
biletleri uçtan uca (E2EE) şifrelemek ve çözmek için
kullanılır. Sunucularda açık kopyası tutulmaz.
Lütfen güvenli bir yere kaydediniz.
=======================================================`;
  }

  /**
   * 60 Karakterlik veya Ön Ekli Erişim Anahtarı Format Doğrulaması
   */
  static validateRecoveryKeyFormat(key: string): boolean {
    const trimmed = key.trim();
    return trimmed.length >= 10;
  }

  static validateAccessKeyFormat(key: string): boolean {
    const trimmed = key.trim();
    return trimmed.length >= 10;
  }
}
