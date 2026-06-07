// ✅ Day 8 → OLLAMA SETUP  +  Day 9 → AI API
// POST /api/ai/prompt → forwards prompt to Ollama → returns response
//
// Setup:
//   ollama run qwen2.5-coder
//   OLLAMA_URL=http://localhost:11434  (set in .env)

import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

// ── POST /api/ai/prompt ───────────────────────────────────────────────────
// Body: { prompt: string, model?: string, temperature?: number }
export const generateAIResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { prompt, model, temperature = 0.7 } = req.body;

    if (!prompt?.trim()) {
      sendError(res, 'Prompt is required.', 400);
      return;
    }

    const selectedModel = model?.trim() || DEFAULT_MODEL;

    const ollamaPayload: OllamaGenerateRequest = {
      model: selectedModel,
      prompt: prompt.trim(),
      stream: false,
      options: {
        temperature,
        top_p: 0.9,
        num_predict: 2048,
      },
    };

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload),
      signal: AbortSignal.timeout(120_000), // 2 minute timeout for large models
    });

    if (!ollamaResponse.ok) {
      const errBody = await ollamaResponse.text();
      console.error('[AI] Ollama error:', errBody);
      sendError(res, `Ollama error: ${ollamaResponse.statusText}. Is Ollama running?`, 502);
      return;
    }

    const data = (await ollamaResponse.json()) as OllamaGenerateResponse;

    sendSuccess(res, 'AI response generated.', {
      response: data.response,
      model: data.model,
      done: data.done,
      stats: {
        totalDuration: data.total_duration,
        evalCount: data.eval_count,
      },
    });
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'TimeoutError') {
      sendError(res, 'AI request timed out. The model may be loading — try again.', 504);
      return;
    }
    if ((error as { cause?: { code?: string } }).cause?.code === 'ECONNREFUSED') {
      sendError(res, 'Cannot connect to Ollama. Run: ollama serve', 503);
      return;
    }
    next(error);
  }
};

// ── GET /api/ai/models ────────────────────────────────────────────────────
// Returns list of locally available Ollama models
export const listModels = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });

    if (!ollamaResponse.ok) {
      sendError(res, 'Could not fetch models from Ollama.', 502);
      return;
    }

    const data = await ollamaResponse.json() as { models: Array<{ name: string; size: number; modified_at: string }> };
    sendSuccess(res, 'Models fetched.', { models: data.models ?? [] });
  } catch (error: unknown) {
    if ((error as { cause?: { code?: string } }).cause?.code === 'ECONNREFUSED') {
      sendError(res, 'Cannot connect to Ollama. Run: ollama serve', 503);
      return;
    }
    next(error);
  }
};

// ── GET /api/ai/health ────────────────────────────────────────────────────
export const checkOllamaHealth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/`, {
      signal: AbortSignal.timeout(3_000),
    });
    sendSuccess(res, 'Ollama is running.', { status: ollamaResponse.ok ? 'online' : 'error' });
  } catch {
    sendError(res, 'Ollama is offline. Run: ollama serve', 503);
  }
};