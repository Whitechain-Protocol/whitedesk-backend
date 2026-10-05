import { 
  HelpDeskTicket, 
  HelpDeskMessage, 
  HelpDeskCategory, 
  AdminEntry, 
  ApprovalEntry 
} from '../../services/helpDeskService';

export interface AttachedFile {
  data: string;
  name: string;
  type: 'image' | 'document';
  mimeType: string;
}

export type TicketViewType = 'list' | 'detail' | 'compose';

export type TicketFilterStatus = 'all' | 'open' | 'answered' | 'closed';

export type GeminiSectionKey = 'tenant' | 'license' | 'operators' | null;

export interface CustomFieldDef {
  key: string;
  label: string;
  required?: boolean;
}

export type CatalogItem = Record<string, string>;
