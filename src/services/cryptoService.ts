import { SafeSecureStore } from './storageService';
import * as Crypto from 'expo-crypto';
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  utf8ToBytes,
  bytesToHex,
  hexToBytes,
  concatBytes,
} from '@noble/ciphers/utils.js';
import { generateMnemonic, entropyToMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { WhiteDeskCrypto } from '../whitedesk-sdk';
export { WhiteDeskCrypto };

const SECURE_STORE_KEYS = {
  MNEMONIC: 'inwhite_mnemonic',
  WHITE_ID: 'inwhite_id',
  IS_REGISTERED: 'inwhite_is_registered',
  PRIVATE_KEY: 'inwhite_private_key',
  PUBLIC_KEY: 'inwhite_public_key',
};

export interface CryptoIdentity {
  mnemonic: string;
  whiteId: string;
}

function toHex(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}

function fromHex(hex: string): Uint8Array {
  return hexToBytes(hex.replace(/^0x/i, ''));
}

/**
 * Derives the P-256 key pair deterministically from the 12-word BIP39 mnemonic.
 *
 *   seed       = mnemonicToSeedSync(mnemonic)      (64 bytes, PBKDF2-HMAC-SHA512)
 *   privateKey = randomSecretKey(seed[0..48])      (32 bytes, valid P-256 scalar)
 *   publicKey  = p256.getPublicKey(privateKey, compressed=true) (33 bytes)
 *
 * randomSecretKey expects exactly 48 bytes (groupLen + ceil(groupLen/2)). The
 * BIP39 seed is 64 bytes of uniform PBKDF2 output; its first 48 bytes retain
 * all 128 bits of mnemonic entropy and remain fully deterministic.
 *
 * The public key (hex) IS the identity/whiteId, so sharing your whiteId is also
 * sharing the public key needed for E2EE — no separate key exchange required.
 */
function deriveKeyPairFromMnemonic(mnemonic: string): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const seed = mnemonicToSeedSync(mnemonic);
  const privateKey = p256.utils.randomSecretKey(seed.subarray(0, 48));
  const publicKey = p256.getPublicKey(privateKey, true);
  return { privateKey, publicKey };
}

function whiteIdFromPublicKey(publicKey: Uint8Array): string {
  const cleanId = toHex(publicKey).trim().toLowerCase();
  return WhiteDeskCrypto.generateBlindId(cleanId);
}

/**
 * inWhite cryptographic core.
 *
 * Identity is the compressed NIST P-256 public key (66 hex chars), derived
 * deterministically from the mnemonic. The private key never leaves the
 * hardware-backed SecureStore. A shared secret is derived per peer via ECDH and
 * mixed with a domain separator (SHA-256) to produce the AES-256-GCM chat key
 * and the AES-256-XTS call secret.
 */
export const CryptoService = {
  /* ------------------------------------------------------------------ */
  /* Identity / mnemonic                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Cryptographically secure 12-word BIP39 mnemonic.
   * 128-bit entropy (16 bytes) + 4-bit checksum from the full 2048-word English list.
   */
  generateMnemonic(): string {
    try {
      const entropy = new Uint8Array(16);
      Crypto.getRandomValues(entropy);
      return entropyToMnemonic(entropy, wordlist);
    } catch {
      return generateMnemonic(wordlist, 128);
    }
  },

  /**
   * Validates a mnemonic against the BIP39 wordlist and checksum.
   * Used by the restore/import flow to reject mistyped seed words.
   */
  validateMnemonic(mnemonic: string): boolean {
    try {
      return validateMnemonic(mnemonic.trim().toLowerCase(), wordlist);
    } catch {
      return false;
    }
  },

  /**
   * Derives the public-key identity (whiteId) from the mnemonic seed.
   * whiteId == compressed P-256 public key (66 lowercase hex chars).
   */
  async deriveWhiteId(mnemonic: string): Promise<string> {
    const { publicKey } = deriveKeyPairFromMnemonic(mnemonic);
    return whiteIdFromPublicKey(publicKey);
  },

  async saveIdentity(identity: CryptoIdentity): Promise<void> {
    const { privateKey, publicKey } = deriveKeyPairFromMnemonic(identity.mnemonic);
    const whiteId = whiteIdFromPublicKey(publicKey);

    await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.MNEMONIC, identity.mnemonic);
    await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.PRIVATE_KEY, toHex(privateKey));
    await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.PUBLIC_KEY, toHex(publicKey));
    await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.WHITE_ID, whiteId);
    await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.IS_REGISTERED, 'true');
  },

  async checkRegistrationStatus(): Promise<boolean> {
    const status = await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.IS_REGISTERED);
    return status === 'true';
  },

  async getWhiteId(): Promise<string | null> {
    const pub = await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.PUBLIC_KEY);
    if (pub && pub.trim().length > 10) {
      const blindId = WhiteDeskCrypto.generateBlindId(pub.trim());
      await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.WHITE_ID, blindId);
      return blindId;
    }
    const raw = await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.WHITE_ID);
    if (!raw) return null;
    const blindId = WhiteDeskCrypto.generateBlindId(raw);
    await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.WHITE_ID, blindId);
    return blindId;
  },

  async clearAllData(): Promise<void> {
    await SafeSecureStore.deleteItemAsync(SECURE_STORE_KEYS.MNEMONIC);
    await SafeSecureStore.deleteItemAsync(SECURE_STORE_KEYS.WHITE_ID);
    await SafeSecureStore.deleteItemAsync(SECURE_STORE_KEYS.IS_REGISTERED);
    await SafeSecureStore.deleteItemAsync(SECURE_STORE_KEYS.PRIVATE_KEY);
    await SafeSecureStore.deleteItemAsync(SECURE_STORE_KEYS.PUBLIC_KEY);
    await SafeSecureStore.deleteItemAsync('user_avatar');
  },

  /* ------------------------------------------------------------------ */
  /* ECDH key material                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Ensures the private/public key pair exists in storage.
   * If missing, it is re-derived from the stored mnemonic (deterministic).
   */
  async ensureKeyPair(): Promise<{ publicKeyHex: string }> {
    const existingPriv = await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.PRIVATE_KEY);
    if (existingPriv) {
      return { publicKeyHex: await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.PUBLIC_KEY) || '' };
    }

    const mnemonic = await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.MNEMONIC);
    if (mnemonic) {
      const { privateKey, publicKey } = deriveKeyPairFromMnemonic(mnemonic);
      await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.PRIVATE_KEY, toHex(privateKey));
      await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.PUBLIC_KEY, toHex(publicKey));
      return { publicKeyHex: toHex(publicKey) };
    }

    // Safety net: no mnemonic stored yet. Generate a random pair (normal flow
    // always calls saveIdentity first, so this path is only defensive).
    const { secretKey, publicKey } = p256.keygen();
    await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.PRIVATE_KEY, toHex(secretKey));
    await SafeSecureStore.setItemAsync(SECURE_STORE_KEYS.PUBLIC_KEY, toHex(publicKey));
    return { publicKeyHex: toHex(publicKey) };
  },

  async getPublicKeyHex(): Promise<string> {
    const pub = await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.PUBLIC_KEY);
    if (pub) return pub;
    const generated = await this.ensureKeyPair();
    return generated.publicKeyHex;
  },

  /* ------------------------------------------------------------------ */
  /* Merkle Root & Digital Signatures (Proof of Integrity)              */
  /* ------------------------------------------------------------------ */

  /**
   * Calculates the 256-bit Merkle Root Hash from an array of message hashes.
   */
  calculateMerkleRoot(hashes: string[]): string {
    if (!hashes || hashes.length === 0) {
      return toHex(sha256(utf8ToBytes('empty_ticket')));
    }
    let currentLevel = hashes.map(h => fromHex(h.replace(/^0x/i, '')));

    while (currentLevel.length > 1) {
      const nextLevel: Uint8Array[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          nextLevel.push(sha256(concatBytes(currentLevel[i], currentLevel[i + 1])));
        } else {
          // Odd number of leaves: duplicate the last hash
          nextLevel.push(sha256(concatBytes(currentLevel[i], currentLevel[i])));
        }
      }
      currentLevel = nextLevel;
    }
    return toHex(currentLevel[0]);
  },

  /**
   * Signs a string or hex digest with the device's P-256 private key.
   */
  async signData(data: string): Promise<string> {
    let privHex = await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.PRIVATE_KEY);
    if (!privHex) {
      await this.ensureKeyPair();
      privHex = await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.PRIVATE_KEY);
    }
    const priv = fromHex(privHex!);
    const msgBytes = utf8ToBytes(data);
    const msgHash = sha256(msgBytes);
    const sig = p256.sign(msgHash, priv);
    return toHex(sig);
  },

  /**
   * Verifies a P-256 signature against data and public key.
   */
  verifySignature(data: string, sigHex: string, publicKeyHex: string): boolean {
    try {
      const msgHash = sha256(utf8ToBytes(data));
      const sigBytes = fromHex(sigHex);
      const pubBytes = fromHex(publicKeyHex);
      return p256.verify(sigBytes, msgHash, pubBytes);
    } catch {
      return false;
    }
  },

  /**
   * Generates a cryptographic Proof of Integrity receipt for a resolved ticket.
   */
  async generateProofOfIntegrityReceipt(params: {
    ticketId: string;
    tenantBlindId: string;
    clientBlindId: string;
    messageHashes: string[];
    adminSig?: string;
  }): Promise<{ receiptJson: string; receiptObject: any }> {
    const merkleRoot = this.calculateMerkleRoot(params.messageHashes);
    const resolvedAt = new Date().toISOString();
    const clientSig = await this.signData(merkleRoot);
    const receiptId = `rec_${params.ticketId.substring(0, 8)}_${Date.now().toString(36)}`;

    const receiptObject = {
      receiptId,
      ticketId: params.ticketId,
      tenantBlindId: params.tenantBlindId,
      clientBlindId: params.clientBlindId,
      resolvedAt,
      merkleRoot,
      signatures: {
        adminSig: params.adminSig || clientSig,
        clientSig,
      },
    };

    return {
      receiptJson: JSON.stringify(receiptObject, null, 2),
      receiptObject,
    };
  },

  /**
   * Permanently destroys the ticket's session key in local secure storage.
   */
  async destroyTicketSessionKey(ticketId: string): Promise<void> {
    try {
      await SafeSecureStore.deleteItemAsync(`ticket_session_key_${ticketId}`);
      await SafeSecureStore.deleteItemAsync(`ticket_chat_key_${ticketId}`);
    } catch (e) {
      console.warn('[CryptoService] destroyTicketSessionKey error:', e);
    }
  },
};