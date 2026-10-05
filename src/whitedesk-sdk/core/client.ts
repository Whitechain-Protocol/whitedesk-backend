/**
 * WhiteDesk SDK — Headless Core Client
 * Zero-Knowledge Ticket & Messaging Engine
 */

import {
  WhiteDeskConfig,
  WhiteDeskIdentity,
  WhiteDeskTicket,
  WhiteDeskMessage,
  WhiteDeskCategory,
  AdminAllocationRecord,
} from './types';
import { WhiteDeskCrypto } from './crypto';
import { WhiteDeskDatabase, escapeSql } from './database';
import { WhiteDeskAuthority } from './authority';

export class WhiteDeskClient {
  public config: WhiteDeskConfig;
  public db: WhiteDeskDatabase;
  public authority: WhiteDeskAuthority;
  private identity: WhiteDeskIdentity | null = null;
  private activeAllocations: AdminAllocationRecord[] = [];
  private theWhitePrivKey: Uint8Array | null = null;

  constructor(config: WhiteDeskConfig) {
    this.config = config;
    this.db = new WhiteDeskDatabase(config.neonEndpoint, config.neonConnectionString);
    this.authority = new WhiteDeskAuthority(this.db, config.theWhitePublicKey);
  }

  setTheWhitePrivKey(privKey: Uint8Array | null) {
    this.theWhitePrivKey = privKey;
  }

  getTheWhitePrivKey(): Uint8Array | null {
    return this.theWhitePrivKey;
  }

  isTheWhite(): boolean {
    if (this.theWhitePrivKey) return true;
    if (this.identity?.ed25519PublicKeyHex && this.identity.ed25519PublicKeyHex === this.config.theWhitePublicKey) {
      return true;
    }
    return false;
  }

  /**
   * Registers the application into whitedesk_apps if not already present.
   * Enables seamless zero-config auto-provisioning for integrated apps.
   */
  async registerApp(appId?: string, appName?: string): Promise<void> {
    const targetApp = (appId || this.config.appId).trim().toLowerCase();
    const targetName = appName || this.config.appName || targetApp;
    const now = Date.now();
    try {
      await this.db.executeSql(`
        INSERT INTO whitedesk_apps (app_id, name, is_active, created_at)
        VALUES (${escapeSql(targetApp)}, ${escapeSql(targetName)}, TRUE, ${now})
        ON CONFLICT (app_id) DO NOTHING;
      `);
    } catch (e) {
      console.warn('[WhiteDeskSDK] registerApp auto-provision warning:', e);
    }
  }

  /**
   * İstemci kimliğini ayarlar ve yetki durumunu kontrol eder
   */
  async setIdentity(identity: WhiteDeskIdentity): Promise<{ isAdmin: boolean; allocations: AdminAllocationRecord[] }> {
    this.identity = identity;
    await this.registerApp();

    // Mnemonic varsa Ed25519 anahtarlarını türet
    if (identity.mnemonic && !identity.ed25519PrivateKey) {
      const keys = WhiteDeskCrypto.deriveEd25519FromMnemonic(identity.mnemonic);
      identity.ed25519PrivateKey = keys.privateKey;
      identity.ed25519PublicKeyHex = keys.publicKeyHex;
    }

    const blindId = this.getBlindId();
    this.activeAllocations = await this.authority.verifyAdminAllocations(blindId);
    return {
      isAdmin: this.isAdmin(),
      allocations: this.activeAllocations,
    };
  }

  getBlindId(): string {
    if (!this.identity?.whiteId) return '';
    return WhiteDeskCrypto.generateBlindId(this.identity.whiteId, this.config.systemSalt);
  }

  getPublicKeyHex(): string {
    return this.identity?.ed25519PublicKeyHex || '';
  }

  isAdmin(): boolean {
    return this.isTheWhite() || this.activeAllocations.length > 0;
  }

  getActiveAllocations(): AdminAllocationRecord[] {
    return this.activeAllocations;
  }

  /**
   * 1. YENİ DESTEK BİLETİ OLUŞTURMA
   * Kullanıcının gerçek WhiteID'si ASLA veritabanına gitmez; BlindID ve PubKey gider.
   */
  async createTicket(params: {
    appId?: string;
    categoryId: string;
    subject: string;
    message: string;
    attachmentData?: string | null;
    attachmentType?: string | null;
    attachmentName?: string | null;
  }): Promise<WhiteDeskTicket> {
    const blindId = this.getBlindId();
    const pubKey = this.getPublicKeyHex();
    const ticketNo = WhiteDeskCrypto.generateTicketNo();
    const ephemeralKeys = WhiteDeskCrypto.generateEphemeralKeyPair();
    const targetApp = params.appId || this.config.appId;
    await this.registerApp(targetApp);

    const sqlTicket = `
      INSERT INTO whitedesk_tickets (
        ticket_no, app_id, category_id, ticket_pubkey, user_blind_id, user_pubkey, subject, payload, status
      ) VALUES (
        ${escapeSql(ticketNo)},
        ${escapeSql(targetApp)},
        ${escapeSql(params.categoryId)},
        ${escapeSql(ephemeralKeys.publicKeyHex)},
        ${escapeSql(blindId)},
        ${escapeSql(pubKey)},
        ${escapeSql(params.subject)},
        ${escapeSql(params.message)},
        'open'
      ) RETURNING *;
    `;

    const [ticket] = await this.db.executeSql<WhiteDeskTicket>(sqlTicket);

    // İlk mesajı kaydet
    const sqlMessage = `
      INSERT INTO whitedesk_ticket_messages (
        ticket_no, sender_blind_id, sender_role, message, attachment_data, attachment_type, attachment_name
      ) VALUES (
        ${escapeSql(ticketNo)},
        ${escapeSql(blindId)},
        'user',
        ${escapeSql(params.message)},
        ${escapeSql(params.attachmentData || null)},
        ${escapeSql(params.attachmentType || null)},
        ${escapeSql(params.attachmentName || null)}
      );
    `;
    await this.db.executeSql(sqlMessage);

    return ticket;
  }

  /**
   * 2. BİLETLERİ LİSTELEME
   * - Kullanıcı ise: Sadece kendi biletlerini çeker.
   * - Admin ise: Yetkili olduğu app ve category biletlerini çeker.
   */
  async getTickets(): Promise<WhiteDeskTicket[]> {
    const blindId = this.getBlindId();
    if (!blindId) return [];

    if (this.isAdmin()) {
      // TheWhite or Admin: yetkili olduğu uygulamaları filtrele
      const hasWildcardApp = this.isTheWhite() || this.activeAllocations.some(a => a.app_id === '*');
      const allowedApps = hasWildcardApp ? [] : this.activeAllocations.map(a => a.app_id);

      let whereClause = '';
      if (!hasWildcardApp && allowedApps.length > 0) {
        whereClause = `WHERE app_id IN (${allowedApps.map(escapeSql).join(',')})`;
      }

      const sql = `SELECT * FROM whitedesk_tickets ${whereClause} ORDER BY updated_at DESC;`;
      return await this.db.executeSql<WhiteDeskTicket>(sql);
    } else {
      // Normal Kullanıcı: Sadece kendi biletleri
      const sql = `SELECT * FROM whitedesk_tickets WHERE user_blind_id = ${escapeSql(blindId)} ORDER BY updated_at DESC;`;
      return await this.db.executeSql<WhiteDeskTicket>(sql);
    }
  }

  /**
   * Bilet üzerinden yönetici yetkisi atama ve Ed25519 ile mühürleme
   */
  async grantAdminFromTicket(params: {
    ticketNo: string;
    targetBlindId: string;
    targetPubKey: string;
    appId: string;
    categoryId: string;
    role: import('./types').WhiteDeskRole;
    alias: string;
  }): Promise<AdminAllocationRecord> {
    const grantorBlindId = this.getBlindId();
    let grantorPrivKey = this.theWhitePrivKey;

    if (!grantorPrivKey && this.identity?.ed25519PrivateKey) {
      grantorPrivKey = this.identity.ed25519PrivateKey;
    }

    if (!grantorPrivKey) {
      // Genesis fallback if secret is known
      grantorPrivKey = WhiteDeskCrypto.deriveGenesisPrivKey();
    }

    return await this.authority.grantAdminFromTicket({
      ticketNo: params.ticketNo,
      targetBlindId: params.targetBlindId,
      targetPubKey: params.targetPubKey,
      appId: params.appId,
      categoryId: params.categoryId,
      role: params.role,
      alias: params.alias,
      grantorBlindId,
      grantorPrivKey,
    });
  }

  /**
   * 3. BİLET MESAJLARINI GETİRME
   */
  async getTicketMessages(ticketNo: string): Promise<WhiteDeskMessage[]> {
    const sql = `
      SELECT * FROM whitedesk_ticket_messages
      WHERE ticket_no = ${escapeSql(ticketNo)}
      ORDER BY created_at ASC;
    `;
    return await this.db.executeSql<WhiteDeskMessage>(sql);
  }

  /**
   * 4. BİLETE YANIT / MESAJ GÖNDERME
   */
  async sendMessage(params: {
    ticketNo: string;
    message: string;
    attachmentData?: string | null;
    attachmentType?: string | null;
    attachmentName?: string | null;
  }): Promise<void> {
    const blindId = this.getBlindId();
    const isAdmin = this.isAdmin();
    const senderRole = isAdmin ? 'admin' : 'user';
    const senderAlias = isAdmin ? (this.activeAllocations[0]?.alias || 'Admin') : null;
    const newStatus = isAdmin ? 'answered' : 'open';

    const sqlMsg = `
      INSERT INTO whitedesk_ticket_messages (
        ticket_no, sender_blind_id, sender_role, sender_alias, message, attachment_data, attachment_type, attachment_name
      ) VALUES (
        ${escapeSql(params.ticketNo)},
        ${escapeSql(blindId)},
        ${escapeSql(senderRole)},
        ${escapeSql(senderAlias)},
        ${escapeSql(params.message)},
        ${escapeSql(params.attachmentData || null)},
        ${escapeSql(params.attachmentType || null)},
        ${escapeSql(params.attachmentName || null)}
      );
    `;

    const sqlUpdateTicket = `
      UPDATE whitedesk_tickets
      SET status = ${escapeSql(newStatus)}, updated_at = NOW()
      WHERE ticket_no = ${escapeSql(params.ticketNo)};
    `;

    await Promise.all([this.db.executeSql(sqlMsg), this.db.executeSql(sqlUpdateTicket)]);
  }

  /**
   * 5. UYGULAMA KATEGORİ LİSTESİ
   */
  async getCategories(appId?: string): Promise<WhiteDeskCategory[]> {
    const targetApp = appId || this.config.appId;
    const sql = `
      SELECT category_id AS id, category_id AS key, name_tr AS "labelTr", name_en AS "labelEn", icon
      FROM whitedesk_categories
      WHERE (app_id = ${escapeSql(targetApp)} OR (app_id IS NULL AND org_id IS NULL)) AND is_active = true
      ORDER BY id ASC;
    `;
    try {
      const rows = await this.db.executeSql<WhiteDeskCategory>(sql);
      return rows;
    } catch {
      return [];
    }
  }
}
