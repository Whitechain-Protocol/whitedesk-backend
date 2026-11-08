/**
 * WhiteDesk SDK — Authority & Trust Chain Engine
 * Cryptographic delegation without centralized master passwords
 */

import { AdminAllocationPayload, AdminAllocationRecord, WhiteDeskRole } from './types';
import { WhiteDeskCrypto, DEFAULT_THEWHITE_PUBKEY } from './crypto';
import { WhiteDeskDatabase, escapeSql } from './database';
import { i18nService } from '../../services/i18nService';

export class WhiteDeskAuthority {
  private db: WhiteDeskDatabase;
  private rootAuthorityPubKey: string;

  constructor(db: WhiteDeskDatabase, rootPubKey: string = DEFAULT_THEWHITE_PUBKEY) {
    this.db = db;
    this.rootAuthorityPubKey = rootPubKey;
  }

  /**
   * 1. BİLET ÜZERİNDEN YÖNETİCİ YETKİLENDİRME (TheWhite / Cosmos tarafından)
   * Adayın açtığı destek biletinden BlindID ve PubKey alınarak TheWhite'ın Ed25519
   * özel anahtarı ile imzalanır ve admin_allocations tablosuna mühürlenir.
   */
  async grantAdminFromTicket(params: {
    ticketNo: string;
    targetBlindId: string;
    targetPubKey: string;
    appId: string;
    categoryId: string;
    role: WhiteDeskRole;
    alias: string;
    grantorBlindId: string;
    grantorPrivKey: Uint8Array;
  }): Promise<AdminAllocationRecord> {
    const payload: AdminAllocationPayload = {
      admin_blind_id: params.targetBlindId,
      admin_pubkey: params.targetPubKey,
      app_id: params.appId,
      category_id: params.categoryId,
      role: params.role,
      alias: params.alias,
      granted_by_blind: params.grantorBlindId,
      nonce: 'nonce_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
    };

    // TheWhite veya Cosmos özel anahtarıyla imzala
    const signature = WhiteDeskCrypto.signAllocation(payload, params.grantorPrivKey);

    // Neon veritabanına mühürle
    const sql = `
      INSERT INTO admin_allocations (
        admin_blind_id, admin_pubkey, app_id, category_id, role, alias, granted_by_blind, nonce, signature
      ) VALUES (
        ${escapeSql(payload.admin_blind_id)},
        ${escapeSql(payload.admin_pubkey)},
        ${escapeSql(payload.app_id)},
        ${escapeSql(payload.category_id)},
        ${escapeSql(payload.role)},
        ${escapeSql(payload.alias)},
        ${escapeSql(payload.granted_by_blind)},
        ${escapeSql(payload.nonce)},
        ${escapeSql(signature)}
      )
      ON CONFLICT (admin_blind_id, app_id, category_id)
      DO UPDATE SET
        role = EXCLUDED.role,
        alias = EXCLUDED.alias,
        signature = EXCLUDED.signature,
        nonce = EXCLUDED.nonce;
    `;

    await this.db.executeSql(sql);

    // Bileti yanıtla ve kapat
    const replySql = `
      INSERT INTO whitedesk_ticket_messages (ticket_no, sender_blind_id, sender_role, sender_alias, message)
      VALUES (
        ${escapeSql(params.ticketNo)},
        ${escapeSql(params.grantorBlindId)},
        'admin',
        'TheWhite',
        ${escapeSql(i18nService.t('sdk.authority.grant_success_message', { alias: params.alias }))}
      );
      UPDATE whitedesk_tickets SET status = 'resolved', updated_at = NOW() WHERE ticket_no = ${escapeSql(params.ticketNo)};
    `;
    await this.db.executeSql(replySql);

    return { ...payload, signature };
  }

  /**
   * 2. ZERO-KNOWLEDGE YETKİ DENETİMİ (İstemci Açılışında)
   * Neon'dan kullanıcının blind_id'sine ait allocation kayıtları çekilir.
   * Her kaydın signature alanı TheWhite'ın açık anahtarıyla doğrulanır.
   * Geçersiz imzalar doğrudan elenir (veritabanı manipülasyonu engellenir).
   */
  async verifyAdminAllocations(adminBlindId: string): Promise<AdminAllocationRecord[]> {
    if (!adminBlindId) return [];

    const sql = `
      SELECT admin_blind_id, admin_pubkey, app_id, category_id, role, alias, granted_by_blind, nonce, signature
      FROM admin_allocations
      WHERE admin_blind_id = ${escapeSql(adminBlindId)}
    `;

    const records = await this.db.executeSql<AdminAllocationRecord>(sql);
    const validAllocations: AdminAllocationRecord[] = [];

    for (const rec of records) {
      const payload: AdminAllocationPayload = {
        admin_blind_id: rec.admin_blind_id,
        admin_pubkey: rec.admin_pubkey,
        app_id: rec.app_id,
        category_id: rec.category_id,
        role: rec.role,
        alias: rec.alias,
        granted_by_blind: rec.granted_by_blind,
        nonce: rec.nonce,
      };

      // Kriptografik imza doğrulaması: TheWhite imzaladı mı?
      const isValid = WhiteDeskCrypto.verifyAllocationSignature(
        payload,
        rec.signature,
        this.rootAuthorityPubKey
      );

      if (isValid) {
        validAllocations.push(rec);
      } else {
        console.warn('[WhiteDeskAuthority] Geçersiz/Sahte admin imzası reddedildi:', rec);
      }
    }

    return validAllocations;
  }

  /**
   * 3. ADMİN YETKİSİNİ İPTAL ETME
   */
  async revokeAdmin(adminBlindId: string, appId: string = '*'): Promise<void> {
    const whereApp = appId === '*' ? '' : `AND app_id = ${escapeSql(appId)}`;
    const sql = `DELETE FROM admin_allocations WHERE admin_blind_id = ${escapeSql(adminBlindId)} ${whereApp};`;
    await this.db.executeSql(sql);
  }
}
