/**
 * WhiteDesk SDK — Core Type Definitions
 * Zero-Knowledge, Sovereign Support & Provisioning Protocol
 */

export type WhiteDeskRole = 'genesis_root' | 'cosmos' | 'admin' | 'operator';

export type TicketStatus = 'open' | 'answered' | 'closed' | 'resolved';

export interface WhiteDeskIdentity {
  whiteId: string;
  mnemonic?: string;
  ed25519PrivateKey?: Uint8Array;
  ed25519PublicKeyHex?: string;
}

export interface AdminAllocationPayload {
  admin_blind_id: string;              // HMAC-SHA256(WhiteID, Salt)
  admin_pubkey: string;                // Ed25519 Public Key (Hex)
  app_id: string;                      // 'inwhite', 'app' or '*'
  category_id: string;                 // specific category id or '*'
  role: WhiteDeskRole;                 // 'cosmos', 'admin', 'operator'
  alias: string;                       // 'TheWhite', 'Macrocosm', 'Supernova-1'
  granted_by_blind: string;            // Granter's Blind ID
  nonce: string;                       // Replay prevention UUID
}

export interface AdminAllocationRecord extends AdminAllocationPayload {
  id?: number;
  signature: string;                   // Ed25519 Signature by TheWhite / Cosmos
  created_at?: string;
  expires_at?: string | null;
}

export interface WhiteDeskTicket {
  ticket_no: string;                   // e.g. "TKT-841920"
  app_id: string;                      // "inwhite", "support", etc.
  category_id: string;                 // "connection", "billing", etc.
  ticket_pubkey: string;               // Ephemeral X25519 / Ed25519 PubKey
  user_blind_id: string;               // Requester's Blind ID (never plain WhiteID)
  user_pubkey?: string;                // Requester's Ed25519 PubKey (for admin assignment)
  assigned_admin_blind?: string | null;
  subject: string;
  payload: string;                     // Ticket initial body
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface WhiteDeskMessage {
  id?: number;
  ticket_no: string;
  sender_blind_id: string;
  sender_role: 'user' | 'admin';
  sender_alias?: string | null;
  message: string;
  attachment_data?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  created_at: string;
}

export interface WhiteDeskCategory {
  id: string;
  key: string;
  labelTr: string;
  labelEn: string;
  icon?: string;
}

export interface WhiteDeskConfig {
  appId: string;
  appName: string;
  neonEndpoint?: string;
  neonConnectionString?: string;
  systemSalt?: string;
  theWhitePublicKey?: string;
}
