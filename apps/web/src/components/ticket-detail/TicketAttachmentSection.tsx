// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { AttachmentPanel } from '../common/AttachmentPanel';

export interface TicketAttachmentSectionProps {
  ticketId: string;
}

export const TicketAttachmentSection: React.FC<TicketAttachmentSectionProps> = ({ ticketId }) => {
  return <AttachmentPanel ticketId={ticketId} />;
};
