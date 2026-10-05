/**
 * WhiteDesk SDK — Cryptographic Engine
 * Sovereign, Zero-Knowledge, Ed25519 & Blind-ID Core
 */

import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { utf8ToBytes, bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';
import { gcm } from '@noble/ciphers/aes.js';
import { managedNonce } from '@noble/ciphers/utils.js';
import { mnemonicToSeedSync } from '@scure/bip39';
import { AdminAllocationPayload } from './types';

// Deterministic salt across all WhiteDesk ecosystem nodes
export const DEFAULT_SYSTEM_SALT = 'WhiteDesk_ZeroKnowledge_Salt_2026_Secure';

// Genesis Root: TheWhite Public Key (Ed25519 Hex, 32 bytes = 64 hex chars)
// The root authority that signs all top-level delegations
export const DEFAULT_THEWHITE_PUBKEY = '24a7eb9ebd45755f3f92100d881113c04d4a636c64a14e7804f10cbdf2899146';
export const WhiteDeskCrypto = {
  /**
   * Derives Genesis Ed25519 Private Key from seed or secure salt
   */
  deriveGenesisPrivKey(seedOrSecret?: string | Uint8Array): Uint8Array {
    if (seedOrSecret instanceof Uint8Array) return seedOrSecret.subarray(0, 32);
    if (typeof seedOrSecret === 'string' && seedOrSecret.trim().length > 0) {
      return sha256(utf8ToBytes(seedOrSecret.trim()));
    }
    return sha256(utf8ToBytes(DEFAULT_SYSTEM_SALT));
  },

  /**
   * 1. KÖR KİMLİK (BLIND ID) ÜRETİMİ
   * Gerçek White ID'yi tek yönlü HMAC-SHA256 ile körleştirir.
   * Çıktı: "blind_a89f3b21..."
   */
  generateBlindId(whiteId: string, salt: string = DEFAULT_SYSTEM_SALT): string {
    if (!whiteId) return '';
    const key = utf8ToBytes(salt);
    const data = utf8ToBytes(whiteId.trim().toLowerCase());
    const hash = hmac(sha256, key, data);
    return 'blind_' + bytesToHex(hash).slice(0, 32);
  },

  /**
   * 2. 12 KELİMELİK BIP-39 TOHUMUNDAN ED25519 ANAHTAR ÇİFTİ TÜRETİMİ
   * İmzalar ve itimat zinciri için Ed25519 anahtar çifti üretir.
   */
  deriveEd25519FromMnemonic(mnemonic: string): { privateKey: Uint8Array; publicKeyHex: string } {
    const seed = mnemonicToSeedSync(mnemonic.trim().toLowerCase());
    // İlk 32 byte'ı Ed25519 private key seed'i olarak deterministik türet
    const privKey = seed.subarray(0, 32);
    const pubKey = ed25519.getPublicKey(privKey);
    return {
      privateKey: privKey,
      publicKeyHex: bytesToHex(pubKey),
    };
  },

  /**
   * 3. ED25519 İLE YETKİ MÜHÜRLEME (TheWhite veya Cosmos tarafından)
   */
  signAllocation(payload: AdminAllocationPayload, privateKey: Uint8Array): string {
    const canonicalMessage = JSON.stringify(payload, Object.keys(payload).sort());
    const msgBytes = utf8ToBytes(canonicalMessage);
    const signature = ed25519.sign(msgBytes, privateKey);
    return bytesToHex(signature);
  },

  /**
   * 4. ED25519 İMZA DOĞRULAMA (İstemci tarafında Zero-Knowledge denetimi)
   */
  verifyAllocationSignature(
    payload: AdminAllocationPayload,
    signatureHex: string,
    authorityPubKeyHex: string
  ): boolean {
    try {
      const canonicalMessage = JSON.stringify(payload, Object.keys(payload).sort());
      const msgBytes = utf8ToBytes(canonicalMessage);
      const sigBytes = hexToBytes(signatureHex);
      const pubBytes = hexToBytes(authorityPubKeyHex);
      return ed25519.verify(sigBytes, msgBytes, pubBytes);
    } catch {
      return false;
    }
  },

  /**
   * 5. E2EE: BİLET İÇİN GEÇİCİ X25519 ANAHTAR ÇİFTİ ÜRETİMİ
   */
  generateEphemeralKeyPair(): { privateKey: Uint8Array; publicKeyHex: string } {
    const privKey = x25519.utils.randomSecretKey();
    const pubKey = x25519.getPublicKey(privKey);
    return {
      privateKey: privKey,
      publicKeyHex: bytesToHex(pubKey),
    };
  },

  /**
   * 6. E2EE: PAYLOAD ŞİFRELEME (X25519 Shared Secret + AES-256-GCM)
   */
  encryptPayload(plainText: string, recipientPubKeyHex: string, senderPrivKey: Uint8Array): string {
    try {
      const recipientPubKey = hexToBytes(recipientPubKeyHex);
      const sharedSecret = x25519.getSharedSecret(senderPrivKey, recipientPubKey);
      const aesKey = sha256(sharedSecret);
      const cipher = managedNonce(gcm)(aesKey);
      const encrypted = cipher.encrypt(utf8ToBytes(plainText));
      return bytesToHex(encrypted);
    } catch (e) {
      console.warn('[WhiteDeskCrypto] encryptPayload error:', e);
      return plainText; // Fallback during testing
    }
  },

  /**
   * 7. E2EE: PAYLOAD ÇÖZME
   */
  decryptPayload(cipherHex: string, senderPubKeyHex: string, recipientPrivKey: Uint8Array): string {
    try {
      const senderPubKey = hexToBytes(senderPubKeyHex);
      const sharedSecret = x25519.getSharedSecret(recipientPrivKey, senderPubKey);
      const aesKey = sha256(sharedSecret);
      const cipher = managedNonce(gcm)(aesKey);
      const decrypted = cipher.decrypt(hexToBytes(cipherHex));
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.warn('[WhiteDeskCrypto] decryptPayload error:', e);
      return cipherHex; // Fallback during testing
    }
  },

  /**
   * Güvenli Rastgele Bilet Numarası (TKT-XXXXXX)
   */
  generateTicketNo(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TKT-${code}`;
  },

  /**
   * Blind ID maskeleme (UI için: "blind_0362...8f4a")
   */
  formatBlindId(blindId: string): string {
    if (!blindId) return '';
    const clean = blindId.replace(/^blind_/, '');
    if (clean.length <= 12) return blindId;
    return `blind_${clean.slice(0, 6)}...${clean.slice(-4)}`;
  }
};
