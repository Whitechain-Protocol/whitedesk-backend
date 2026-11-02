import React from 'react';
import { PttScreenModal, PttScreenModalProps } from './PttScreenModal';

export interface TicketPttModalProps extends Omit<PttScreenModalProps, 'orgChannels' | 'currentOrgChannelId' | 'onChangeOrgChannel'> {}

/**
 * TicketPttModal: Bilet içi iki taraflı anlık bas-konuş (PTT) arayüzü.
 * Kurumsal telsiz kanallarından ve genel telsiz frekanslarından izole edilmiştir.
 */
export const TicketPttModal: React.FC<TicketPttModalProps> = (props) => {
  return <PttScreenModal {...props} />;
};
