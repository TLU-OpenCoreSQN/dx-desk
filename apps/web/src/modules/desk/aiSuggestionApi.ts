// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { ApiClientError, requestResponse } from '../../services/api';

export type SuggestedPriority = 'low' | 'normal' | 'high';
export interface SuggestionValues { category_id: string; team_id: string; priority: SuggestedPriority; summary: string }
export interface AiSuggestion extends SuggestionValues { id: string }

function suggestionPath(ticket: string) { return '/tickets/' + encodeURIComponent(ticket) + '/ai-suggestion'; }

export async function getAiSuggestion(ticket: string, signal: AbortSignal): Promise<AiSuggestion | null> {
  try {
    const response = await requestResponse(suggestionPath(ticket), { signal });
    return response.status === 204 ? null : await response.json() as AiSuggestion;
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) return null;
    throw error;
  }
}

export async function decideAiSuggestion(ticket: string, id: string, values: SuggestionValues | null) {
  await requestResponse(suggestionPath(ticket) + '/decision', {
    method: 'POST', body: JSON.stringify(values ? { id, action: 'accept', values } : { id, action: 'ignore' }),
  });
}
