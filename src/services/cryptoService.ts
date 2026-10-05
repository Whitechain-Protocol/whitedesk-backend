import { SafeSecureStore } from './storageService';
import * as Crypto from 'expo-crypto';
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';
import {
  managedNonce,
  utf8ToBytes,
  bytesToUtf8,
  bytesToHex,
  hexToBytes,
  concatBytes,
} from '@noble/ciphers/utils.js';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

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

export interface EncryptedPayload {
  v: 2;
  enc: 'aes-256-gcm';
  ct: string; // managedNonce(gcm) output: nonce (12) || ciphertext || tag (16)
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
  return toHex(publicKey);
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
   * 128-bit entropy + 4-bit checksum from the full 2048-word English list.
   */
  generateMnemonic(): string {
    return generateMnemonic(wordlist, 128);
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
    return await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.WHITE_ID);
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
  /* Shared secret + key derivation                                      */
  /* ------------------------------------------------------------------ */

  /**
   * ECDH shared secret between our private key and the peer's public key.
   * Since identity == public key, `peerWhiteId` is passed directly.
   */
  async deriveBaseKey(peerPublicKeyHex: string): Promise<Uint8Array> {
    let privHex = await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.PRIVATE_KEY);
    if (!privHex) {
      await this.ensureKeyPair();
      privHex = await SafeSecureStore.getItemAsync(SECURE_STORE_KEYS.PRIVATE_KEY);
    }

    const priv = fromHex(privHex!);
    const peerPub = fromHex(peerPublicKeyHex);
    const shared = p256.getSharedSecret(priv, peerPub);
    return sha256(shared);
  },

  /**
   * AES-256-GCM chat key for a peer:
   *   sha256( baseKey || "chat" || conversationId )
   * where conversationId = sorted(myPublicKey, peerPublicKey) so both sides match.
   */
  async deriveChatKeyHex(peerWhiteId: string): Promise<string> {
    const myWhiteId = (await this.getWhiteId()) || '';
    const baseKey = await this.deriveBaseKey(peerWhiteId);
    const conversationId = [myWhiteId, peerWhiteId].sort().join('|');
    const digest = sha256(
      concatBytes(baseKey, utf8ToBytes('chat'), utf8ToBytes(conversationId))
    );
    return toHex(digest);
  },

  /**
   * Short, deterministic Agora channel name derived from both identities.
   * Agora channel names must stay well under 64 bytes, so we hash the sorted
   * public keys rather than concatenating the 66-char keys directly.
   */
  async deriveRoomName(peerWhiteId: string): Promise<string> {
    const myWhiteId = (await this.getWhiteId()) || '';
    const conversationId = [myWhiteId, peerWhiteId].sort().join('|');
    const digest = sha256(utf8ToBytes(conversationId));
    return 'room_' + toHex(digest).substring(0, 20);
  },

  /**
   * AES-256-XTS call secret for a peer + room:
   *   sha256( baseKey || "call" || conversationId || roomName )
   */
  async deriveCallSecretHex(peerWhiteId: string, roomName: string): Promise<string> {
    const myWhiteId = (await this.getWhiteId()) || '';
    const baseKey = await this.deriveBaseKey(peerWhiteId);
    const conversationId = [myWhiteId, peerWhiteId].sort().join('|');
    const digest = sha256(
      concatBytes(
        baseKey,
        utf8ToBytes('call'),
        utf8ToBytes(conversationId),
        utf8ToBytes(roomName || '')
      )
    );
    return toHex(digest);
  },

  /**
   * 32-byte KDF salt derived deterministically from call secret for Agora C++ hardware encryption:
   *   sha256( callSecretBytes || "kdf_salt" )
   */
  deriveKdfSalt(callSecretHex: string): number[] {
    const secretBytes = fromHex(callSecretHex);
    const digest = sha256(concatBytes(secretBytes, utf8ToBytes('kdf_salt')));
    return Array.from(digest);
  },

  /**
   * 4-byte dynamic call-stream magic header (H1..H4) for media packet header scrambling:
   *   sha256( callSecretBytes || "magic_header" )[0..4]
   */
  deriveMagicHeaderHex(callSecretHex: string): string {
    const secretBytes = fromHex(callSecretHex);
    const digest = sha256(concatBytes(secretBytes, utf8ToBytes('magic_header')));
    return toHex(digest.subarray(0, 4));
  },

  /* ------------------------------------------------------------------ */
  /* AES-256-GCM                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Encrypts UTF-8 plaintext with AES-256-GCM.
   * `ct` contains managedNonce(gcm)'s output: nonce (12) || ciphertext || tag (16).
   */
  async encryptText(plaintext: string, keyHex: string, aad?: string): Promise<EncryptedPayload> {
    const key = fromHex(keyHex);
    const aadBytes = aad ? utf8ToBytes(aad) : undefined;
    const cipher = managedNonce(gcm)(key, aadBytes);
    const ct = cipher.encrypt(utf8ToBytes(plaintext));

    return {
      v: 2,
      enc: 'aes-256-gcm',
      ct: toHex(ct),
    };
  },

  /**
   * Decrypts an AES-256-GCM ciphertext produced by encryptText.
   */
  async decryptText(payload: EncryptedPayload, keyHex: string, aad?: string): Promise<string> {
    if (!payload || payload.v !== 2 || payload.enc !== 'aes-256-gcm') {
      throw new Error('Unsupported encrypted payload version');
    }

    const key = fromHex(keyHex);
    const aadBytes = aad ? utf8ToBytes(aad) : undefined;
    const cipher = managedNonce(gcm)(key, aadBytes);
    const plaintext = cipher.decrypt(fromHex(payload.ct));
    return bytesToUtf8(plaintext);
  },

  /**
   * Encrypts raw bytes (file/media content) with AES-256-GCM.
   * Returns nonce (12) || ciphertext || tag (16) as raw bytes — no hex/base64
   * overhead, so media blobs stay as compact as the original file.
   */
  async encryptBytes(data: Uint8Array, keyHex: string, aad?: string): Promise<Uint8Array> {
    const key = fromHex(keyHex);
    const aadBytes = aad ? utf8ToBytes(aad) : undefined;
    const cipher = managedNonce(gcm)(key, aadBytes);
    return cipher.encrypt(data);
  },

  /**
   * Decrypts raw bytes produced by encryptBytes.
   */
  async decryptBytes(data: Uint8Array, keyHex: string, aad?: string): Promise<Uint8Array> {
    const key = fromHex(keyHex);
    const aadBytes = aad ? utf8ToBytes(aad) : undefined;
    const cipher = managedNonce(gcm)(key, aadBytes);
    return cipher.decrypt(data);
  },
};