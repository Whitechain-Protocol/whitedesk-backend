export const CURRENT_APP_ID = 'whitedesk';

export const STORAGE_KEYS = {
  OWN_WHITE_ID: 'inwhite_id',
  ADMIN_KEY: 'inwhite_helpdesk_admin_secret',
  ADMIN_WHITE_ID: 'inwhite_helpdesk_admin_white_id',
  LEGACY_ADMIN_KEY: 'inwhite_mailbox_admin_secret',
  ADMIN_ROLE: 'inwhite_helpdesk_admin_role',
  ADMIN_ENTERPRISE_BLIND_ID: 'inwhite_helpdesk_admin_enterprise_blind_id',
  ADMIN_ORG_PUB: 'inwhite_helpdesk_admin_org_pub',
  ADMIN_ENTERPRISE_NAME: 'inwhite_helpdesk_admin_enterprise_name',
  USER_ORG_BLIND_ID: 'inwhite_helpdesk_user_org_blind_id',
  USER_ORG_PUB: 'inwhite_helpdesk_user_org_pub',
  USER_ENTERPRISE_NAME: 'inwhite_helpdesk_user_enterprise_name',
  USER_ORG_ID: 'inwhite_helpdesk_user_org_id',
  ADMIN_ORG_ID: 'inwhite_helpdesk_admin_org_id',
  CUSTOM_ALIAS: 'inwhite_helpdesk_custom_alias',
  ACTIVE_TENANT_BLIND_ID: 'inwhite_helpdesk_active_tenant_blind_id',
};

export const PLANET_NAMES = [
  'Planet', 'Orbit', 'Cluster',
];

export const COSMIC_PREFIXES = [
  'Planet', 'WhiteCosmos', 'Orbit', 'Nebula', 'Pulsar', 'Nova', 'Comet', 'Titan',
  'Atlas', 'Kronos', 'Aurora', 'Zenith', 'Vortex', 'Quasar', 'Solaris', 'Vega'
];

export type TicketStatus = 'open' | 'answered' | 'resolved' | 'closed' | 'revoked';

export interface HelpDeskCategory {
  id: string;
  key: string;
  enterprise_blind_id?: string | null;
  org_id?: string | null;
  app_id?: string | null;
  icon?: string;
  labelTr: string;
  labelEn: string;
}

export const INWHITE_CATEGORIES: HelpDeskCategory[] = [];

export interface AppEntry {
  app_id: string;
  enterprise_blind_id?: string;
  name: string;
  icon?: string;
  is_active?: boolean;
  created_at?: number;
}

export interface AppCatEntry {
  app_id: string;
  name?: string;
  enterprise_blind_id?: string;
  org_id?: string;
  categories: HelpDeskCategory[];
  updated_at: number;
}

export type AppRegStatus = 'registered' | 'pending' | 'rejected' | 'unregistered';

export interface AppRequestEntry {
  id: number;
  app_id: string;
  app_name: string;
  description: string;
  requestor_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
}

export interface AdminEntry {
  white_id: string;
  enterprise_blind_id?: string;
  org_id?: string;
  app_id?: string;
  enterprise_name?: string;
  alias: string;
  role: string;
  pub_key?: string;
  is_active: boolean;
  granted_by?: string;
  created_at: number;
}

export interface OrgEntry {
  org_id: string;
  enterprise_blind_id?: string;
  name: string;
  created_at: number;
}

export interface TenantEntry {
  enterprise_blind_id: string;
  name: string;
  org_pub: string;
  is_founder_tenant?: boolean;
  created_at: number;
}

export interface ApprovalEntry {
  id: number;
  type: 'global_admin' | 'admin' | 'user' | 'delete_app' | 'delete_org';
  tenant_blind_id: string;
  tenant_name?: string;
  candidate_white_id?: string;
  candidate_blind_id: string;
  candidate_alias?: string;
  target_org_id?: string;
  target_app_id?: string;
  target_categories?: string[];
  status: 'pending' | 'approved' | 'rejected';
  requested_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
}

export interface AdminAllocEntry {
  id?: number;
  admin_white_id: string;
  enterprise_blind_id?: string;
  org_id?: string;
  app_id: string;
  category_id?: string;
  categories: string[];
  updated_at: number;
}

export interface HelpDeskTicket {
  id: string;
  enterprise_blind_id?: string;
  enterprise_name?: string;
  org_id?: string;
  app_id: string;
  user_white_id: string;
  user_blind_id?: string;
  user_pubkey?: string;
  ticket_pubkey?: string;
  subject: string;
  category?: string;
  status: TicketStatus;
  is_discussion?: boolean;
  last_admin_reply_at?: number;
  assigned_admin_blind_id?: string;
  assigned_admin_name?: string | null;
  assigned_admin_alias?: string | null;
  resolution_note?: string;
  auto_delete_at?: number | null;
  transfer_status?: 'pending' | 'accepted' | 'rejected' | null;
  transfer_target_blind_id?: string | null;
  transfer_target_alias?: string | null;
  transfer_sender_blind_id?: string | null;
  transfer_sender_alias?: string | null;
  transferred_from_alias?: string | null;
  transferred_from_blind_id?: string | null;
  transfer_note?: string | null;
  transfer_requested_at?: number | null;
  attachment_data?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_r2_key?: string | null;
  attachments?: Array<{ data: string; name: string; type: string }>;
  is_relay_pending?: boolean;
  relay_item_id?: string;
  relay_attachment_r2_key?: string | null;
  escalation_stage?: number;
  reassigned_from?: string | null;
  reassigned_to?: string | null;
  revocation_reason?: string | null;
  audit_trail?: string | null;
  created_at: number;
  updated_at: number;
}

export interface TicketLifecycleStatus {
  stage: 'open' | 'closed_cooling' | 'rating_pending' | 'rated_cooling' | 'self_destructing';
  closedAt?: number;
  ratingDueAt?: number;
  ratedAt?: number;
  score?: number;
  ttlStartDueAt?: number;
  expiryMs?: number;
  remainingDays?: number;
  remainingText?: string;
  inDestruction: boolean;
}

export interface HelpDeskMessage {
  id: string;
  ticket_id: string;
  app_id: string;
  sender_white_id: string;
  sender_alias?: string | null;
  sender_blind_id?: string | null;
  is_admin: boolean;
  /** Role from whitedesk_admins: 'founder' | 'global_admin' | 'admin' | null */
  sender_role?: 'founder' | 'global_admin' | 'admin' | null;
  visibility_level?: 'customer' | 'internal' | 'whisper';
  is_internal?: boolean;
  is_whisper?: boolean;
  whisper_target_alias?: string | null;
  whisper_target_white_id?: string | null;
  whisper_target_blind_id?: string | null;
  message: string;
  attachment_data?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_r2_key?: string | null;
  attachments?: Array<{ data: string; name: string; type: string }>;
  created_at: number;
}
