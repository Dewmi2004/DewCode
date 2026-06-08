// ✅ AI API Service
// Handles calls to /api/ai/* endpoints

import apiFetch from './api';
import { CodeCorrection, CodeSuggestion } from '../types';

interface CorrectionResponse {
  success: boolean;
  data?: CodeCorrection;
  message?: string;
}

interface SuggestionResponse {
  success: boolean;
  data?: { suggestions: CodeSuggestion[] };
  message?: string;
}

export const aiApi = {
  /**
   * Get code corrections and issues for provided code
   */
  async correctCode(code: string, language: string, model?: string): Promise<CodeCorrection> {
    const response = await apiFetch<CorrectionResponse>('/api/ai/correct', {
      method: 'POST',
      body: JSON.stringify({ code, language, model }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get code corrections');
    }

    return response.data;
  },

  /**
   * Get code suggestions based on context
   */
  async suggestCode(
    code: string,
    language: string,
    line?: number,
    column?: number,
    model?: string
  ): Promise<CodeSuggestion[]> {
    const response = await apiFetch<SuggestionResponse>('/api/ai/suggest', {
      method: 'POST',
      body: JSON.stringify({ code, language, line, column, model }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get code suggestions');
    }

    return response.data.suggestions;
  },

  /**
   * Generate general AI prompt response
   */
  async generatePrompt(prompt: string, model?: string): Promise<string> {
    interface PromptResponse {
      success: boolean;
      data?: { response: string };
      message?: string;
    }

    const response = await apiFetch<PromptResponse>('/api/ai/prompt', {
      method: 'POST',
      body: JSON.stringify({ prompt, model }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to generate AI response');
    }

    return response.data.response;
  },
};
