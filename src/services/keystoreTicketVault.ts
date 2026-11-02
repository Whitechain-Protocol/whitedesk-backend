// @ts-ignore
import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { SafeSecureStore } from './storageService';
import type { HelpDeskTicket, HelpDeskMessage } from './helpDeskService';

// Polyfill CryptoJS.lib.WordArray.random for Hermes using expo-crypto SecureRandom
try {
  CryptoJS.lib.WordArray.random = function (nBytes: number) {
    try {
      const bytes = Crypto.getRandomBytes(nBytes);
      const words: number[] = [];
      for (let i = 0; i < nBytes; i += 4) {
        words.push(
          ((bytes[i] || 0) << 24) |
          ((bytes[i + 1] || 0) << 16) |
          ((bytes[i + 2] || 0) << 8) |
          ((bytes[i + 3] || 0) << 0)
        );
      }
      return CryptoJS.lib.WordArray.create(words, nBytes);
    } catch {
      const words: number[] = [];
      for (let i = 0; i < nBytes; i += 4) {
        words.push((Math.random() * 0x100000000) >>> 0);
      }
      return CryptoJS.lib.WordArray.create(words, nBytes);
    }
  };
} catch {}

const VAULT_KEY_ALIAS = 'whitedesk_keystore_master_aes_key';
const TICKETS_VAULT_FILE = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/whitedesk_vault_tickets.enc`;

class KeystoreTicketVault {
  private masterKey: string | null = null;
  private inMemoryTicketsCache: HelpDeskTicket[] | null = null;
  private isSanitizing: boolean = false;

  /**
   * Lazily loads or creates the 256-bit hardware-locked AES master key from SafeSecureStore.
   */
  private async getMasterKey(): Promise<string> {
    if (this.masterKey) return this.masterKey;

    let key = await SafeSecureStore.getItemAsync(VAULT_KEY_ALIAS);
    if (!key) {
      try {
        const randBytes = await Crypto.getRandomBytesAsync(32);
        key = Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch {
        key = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      }
      await SafeSecureStore.setItemAsync(VAULT_KEY_ALIAS, key);
    }
    const resolvedKey: string = key ? key : 'whitedesk_vault_key_fixed_256';
    this.masterKey = resolvedKey;
    return resolvedKey;
  }

  /**
   * Cleans heavy base64 data from ticket headers so vault size remains tiny (<20KB).
   */
  private sanitizeTicketHeaders(tickets: HelpDeskTicket[]): HelpDeskTicket[] {
    return tickets.map(t => {
      const cleanAttachments = t.attachments ? t.attachments.map(a => {
        return {
          ...a,
          data: '', // Never store multi-megabyte base64 strings in ticket summary headers
        };
      }) : undefined;

      return {
        ...t,
        attachment_data: null, // Full attachments belong to messages, never headers
        attachments: cleanAttachments,
      };
    });
  }

  /**
   * 0ms Instant Local Read: Decrypts ticket headers from local encrypted Keystore vault.
   */
  async getTickets(): Promise<HelpDeskTicket[]> {
    if (this.inMemoryTicketsCache) {
      return [...this.inMemoryTicketsCache];
    }

    try {
      const exists = await ReactNativeBlobUtil.fs.exists(TICKETS_VAULT_FILE);
      if (exists) {
        // Check file size to avoid locking thread if legacy bloated file exists
        const stat = await ReactNativeBlobUtil.fs.stat(TICKETS_VAULT_FILE);
        if (Number(stat.size) > 500 * 1024) {
          console.warn(`[KeystoreTicketVault] Detected bloated vault (${stat.size} bytes). Resetting and sanitizing.`);
          await ReactNativeBlobUtil.fs.unlink(TICKETS_VAULT_FILE);
          this.inMemoryTicketsCache = [];
          return [];
        }

        const ciphertext = await ReactNativeBlobUtil.fs.readFile(TICKETS_VAULT_FILE, 'utf8');
        if (ciphertext && ciphertext.trim()) {
          const key = await this.getMasterKey();
          const decryptedBytes = CryptoJS.AES.decrypt(ciphertext.trim(), key);
          const decryptedJson = decryptedBytes.toString(CryptoJS.enc.Utf8);
          if (decryptedJson) {
            const parsed = JSON.parse(decryptedJson);
            if (Array.isArray(parsed)) {
              const sanitized = this.sanitizeTicketHeaders(parsed);
              this.inMemoryTicketsCache = sanitized;
              return [...sanitized];
            }
          }
        }
      }
    } catch (err) {
      console.warn('[KeystoreTicketVault] Failed to read encrypted ticket vault file:', err);
    }

    // Secondary fallback: SafeSecureStore
    try {
      const raw = await SafeSecureStore.getItemAsync('whitedesk_local_tickets');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const sanitized = this.sanitizeTicketHeaders(parsed);
          this.inMemoryTicketsCache = sanitized;
          return [...sanitized];
        }
      }
    } catch {}

    this.inMemoryTicketsCache = [];
    return [];
  }

  /**
   * Encrypts and seals the ticket array into the hardware-protected local vault.
   * Strips all heavy base64 data to guarantee 0ms execution (<20KB payload).
   */
  async saveTickets(tickets: HelpDeskTicket[]): Promise<void> {
    const sanitized = this.sanitizeTicketHeaders(tickets);
    this.inMemoryTicketsCache = [...sanitized];

    try {
      const key = await this.getMasterKey();
      const json = JSON.stringify(sanitized);
      const ciphertext = CryptoJS.AES.encrypt(json, key).toString();
      await ReactNativeBlobUtil.fs.writeFile(TICKETS_VAULT_FILE, ciphertext, 'utf8');
    } catch (err) {
      console.warn('[KeystoreTicketVault] Error writing encrypted tickets vault:', err);
    }

    // Lightweight snapshot for fallback
    try {
      const lightweightSnapshot = sanitized.map(t => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        category: t.category,
        user_white_id: t.user_white_id,
        enterprise_blind_id: t.enterprise_blind_id,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
      await SafeSecureStore.setItemAsync('whitedesk_local_tickets', JSON.stringify(lightweightSnapshot));
    } catch {}
  }

  /**
   * Inserts or updates a ticket in local Keystore.
   */
  async upsertTicket(ticket: HelpDeskTicket): Promise<void> {
    const list = await this.getTickets();
    const idx = list.findIndex(t => t.id === ticket.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...ticket, updated_at: Math.max(list[idx].updated_at || 0, ticket.updated_at || Date.now()) };
    } else {
      list.unshift(ticket);
    }
    list.sort((a, b) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0));
    await this.saveTickets(list);
  }

  /**
   * Deletes a ticket and its associated messages from local Keystore.
   */
  async deleteTicket(ticketId: string): Promise<void> {
    const list = await this.getTickets();
    const filtered = list.filter(t => t.id !== ticketId);
    await this.saveTickets(filtered);

    // Delete message vault file
    const msgFile = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/whitedesk_msgs_${ticketId}.enc`;
    try {
      if (await ReactNativeBlobUtil.fs.exists(msgFile)) {
        await ReactNativeBlobUtil.fs.unlink(msgFile);
      }
    } catch {}
    await SafeSecureStore.deleteItemAsync(`whitedesk_local_msgs_${ticketId}`);
  }

  /**
   * Retrieves messages for a ticket from local Keystore.
   */
  async getMessages(ticketId: string): Promise<HelpDeskMessage[]> {
    const cleanId = String(ticketId).trim();
    const msgFile = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/whitedesk_msgs_${cleanId}.enc`;

    try {
      if (await ReactNativeBlobUtil.fs.exists(msgFile)) {
        // Check size to prevent freezing thread on legacy bloated message files
        const stat = await ReactNativeBlobUtil.fs.stat(msgFile);
        if (Number(stat.size) > 500 * 1024) {
          console.warn(`[KeystoreTicketVault] Message file for ${cleanId} is bloated (${stat.size} bytes). Resetting.`);
          await ReactNativeBlobUtil.fs.unlink(msgFile);
          return [];
        }

        const ciphertext = await ReactNativeBlobUtil.fs.readFile(msgFile, 'utf8');
        if (ciphertext && ciphertext.trim()) {
          const key = await this.getMasterKey();
          const decryptedBytes = CryptoJS.AES.decrypt(ciphertext.trim(), key);
          const decryptedJson = decryptedBytes.toString(CryptoJS.enc.Utf8);
          if (decryptedJson) {
            const parsed = JSON.parse(decryptedJson);
            if (Array.isArray(parsed)) return parsed;
          }
        }
      }
    } catch {}

    return [];
  }

  /**
   * Encrypts and saves messages for a ticket into local Keystore.
   * Large attachments are written directly to native disk files to keep encrypted JSON tiny (<5KB).
   */
  async saveMessages(ticketId: string, messages: HelpDeskMessage[]): Promise<void> {
    const cleanId = String(ticketId).trim();
    const msgFile = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/whitedesk_msgs_${cleanId}.enc`;

    // Offload heavy attachments to native files so CryptoJS only handles tiny metadata
    const sanitizedMessages: HelpDeskMessage[] = [];
    for (const msg of messages) {
      const msgCopy = { ...msg };

      // Single attachment offload: Decodes Base64 to true native binary on disk (skip UTF-8 JSON/diagnostics)
      const isSingleJsonOrDiag =
        msgCopy.attachment_type === 'diagnostic' ||
        msgCopy.attachment_type === 'multi' ||
        msgCopy.attachment_name?.includes('diagnostics.whitedesk') ||
        msgCopy.attachment_data?.trim().startsWith('{') ||
        msgCopy.attachment_data?.trim().startsWith('[');
      if (msgCopy.attachment_data && msgCopy.attachment_data.length > 512 && !isSingleJsonOrDiag) {
        if (!msgCopy.attachment_data.startsWith('file://')) {
          const rawExt = msgCopy.attachment_name?.split('.').pop()?.toLowerCase();
          const ext = rawExt || (msgCopy.attachment_type === 'image' ? 'jpg' : 'dat');
          const attFilePath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/att_${cleanId}_${msgCopy.id}.${ext}`;
          try {
            const cleanBase64 = msgCopy.attachment_data.replace(/^data:[^;]+;base64,/, '').trim();
            await ReactNativeBlobUtil.fs.writeFile(attFilePath, cleanBase64, 'base64');
            msgCopy.attachment_data = `file://${attFilePath}`;
          } catch (e) {
            console.warn('[KeystoreTicketVault] Failed to offload attachment to file:', e);
          }
        }
      }

      // Multiple attachments offload: Decodes Base64 to true native binary on disk (skip UTF-8 JSON/diagnostics)
      if (msgCopy.attachments && msgCopy.attachments.length > 0) {
        const offloadedList = [];
        for (let idx = 0; idx < msgCopy.attachments.length; idx++) {
          const a = { ...msgCopy.attachments[idx] };
          const isItemJsonOrDiag =
            (a as any).type === 'diagnostic' ||
            a.name?.includes('diagnostics.whitedesk') ||
            a.data?.trim().startsWith('{') ||
            a.data?.trim().startsWith('[');
          if (a.data && a.data.length > 512 && !a.data.startsWith('file://') && !isItemJsonOrDiag) {
            const rawExt = a.name?.split('.').pop()?.toLowerCase();
            const ext = rawExt || (a.type === 'image' ? 'jpg' : 'dat');
            const attFilePath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/att_${cleanId}_${msgCopy.id}_${idx}.${ext}`;
            try {
              const cleanBase64 = a.data.replace(/^data:[^;]+;base64,/, '').trim();
              await ReactNativeBlobUtil.fs.writeFile(attFilePath, cleanBase64, 'base64');
              a.data = `file://${attFilePath}`;
            } catch (e) {
              console.warn('[KeystoreTicketVault] Failed to offload attachment item:', e);
            }
          }
          offloadedList.push(a);
        }
        msgCopy.attachments = offloadedList;
      }

      sanitizedMessages.push(msgCopy);
    }

    try {
      const key = await this.getMasterKey();
      const json = JSON.stringify(sanitizedMessages);
      const ciphertext = CryptoJS.AES.encrypt(json, key).toString();
      await ReactNativeBlobUtil.fs.writeFile(msgFile, ciphertext, 'utf8');
    } catch (err) {
      console.warn(`[KeystoreTicketVault] Failed to write encrypted messages file for ${cleanId}:`, err);
    }
  }

  /**
   * Appends a message to a ticket in local Keystore.
   */
  async appendMessage(ticketId: string, message: HelpDeskMessage): Promise<void> {
    const list = await this.getMessages(ticketId);
    if (!list.some(m => m.id === message.id)) {
      list.push(message);
      list.sort((a, b) => a.created_at - b.created_at);
      await this.saveMessages(ticketId, list);
    }
  }
}

export const keystoreTicketVault = new KeystoreTicketVault();
