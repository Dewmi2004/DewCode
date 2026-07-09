
import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';

const OLLAMA_URL    = process.env.OLLAMA_URL    || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL  || 'qwen2.5-coder:1.5b'; 

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options?: { temperature?: number; top_p?: number; num_predict?: number };
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

// ── POST /api/ai/prompt ───────────────────────────────────────────────────
export const generateAIResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { prompt, model, temperature = 0.7 } = req.body;

    if (!prompt?.trim()) { sendError(res, 'Prompt is required.', 400); return; }

    const selectedModel = model?.trim() || DEFAULT_MODEL;

    const ollamaPayload: OllamaGenerateRequest = {
      model: selectedModel,
      prompt: prompt.trim(),
      stream: false,
      options: {
        temperature,
        top_p: 0.9,
        num_predict: 512, // ✅ reduced from 2048 — fast responses
      },
    };

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload),
      signal: AbortSignal.timeout(60_000), // ✅ reduced from 120s to 60s
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
      stats: { totalDuration: data.total_duration, evalCount: data.eval_count },
    });
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'TimeoutError') {
      sendError(res, 'AI request timed out. Try: ollama pull qwen2.5-coder:1.5b', 504);
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
export const listModels = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!ollamaResponse.ok) { sendError(res, 'Could not fetch models from Ollama.', 502); return; }
    const data = await ollamaResponse.json() as { models: Array<{ name: string; size: number; modified_at: string }> };
    sendSuccess(res, 'Models fetched.', { models: data.models ?? [] });
  } catch (error: unknown) {
    if ((error as { cause?: { code?: string } }).cause?.code === 'ECONNREFUSED') {
      sendError(res, 'Cannot connect to Ollama. Run: ollama serve', 503); return;
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
    const ollamaResponse = await fetch(`${OLLAMA_URL}/`, { signal: AbortSignal.timeout(3_000) });
    sendSuccess(res, 'Ollama is running.', { status: ollamaResponse.ok ? 'online' : 'error' });
  } catch {
    sendError(res, 'Ollama is offline. Run: ollama serve', 503);
  }
};

// ── POST /api/ai/correct ──────────────────────────────────────────────────
export const correctCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { code, language, model } = req.body;
    if (!code?.trim()) { sendError(res, 'Code is required.', 400); return; }

    const selectedModel = model?.trim() || DEFAULT_MODEL;

    const correctionPrompt = `Fix any bugs in this ${language || 'code'}. Reply ONLY with JSON:
{"issues":[{"type":"error|warning","line":1,"message":"description"}],"correctedCode":"fixed code","explanation":"summary"}

Code:
\`\`\`${language || ''}
${code}
\`\`\``;

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        prompt: correctionPrompt,
        stream: false,
        options: { temperature: 0.2, top_p: 0.9, num_predict: 800 }, // ✅ reduced from 3000
      } satisfies OllamaGenerateRequest),
      signal: AbortSignal.timeout(60_000), // ✅ reduced from 120s
    });

    if (!ollamaResponse.ok) {
      sendError(res, `Ollama error: ${ollamaResponse.statusText}`, 502); return;
    }

    const data = (await ollamaResponse.json()) as OllamaGenerateResponse;
    let parsedResponse = { issues: [] as unknown[], correctedCode: code, explanation: data.response };

    try {
      const jsonMatch = data.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsedResponse = JSON.parse(jsonMatch[0]);
    } catch { console.warn('[AI] Could not parse correction JSON'); }

    sendSuccess(res, 'Code correction generated.', parsedResponse);
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'TimeoutError') {
      sendError(res, 'Code correction timed out.', 504); return;
    }
    next(error);
  }
};

// ── POST /api/ai/suggest ──────────────────────────────────────────────────
export const suggestCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { code, language, line = 1, model } = req.body;
    if (!code?.trim()) { sendError(res, 'Code is required.', 400); return; }

    const selectedModel = model?.trim() || DEFAULT_MODEL;

    const lines = code.split('\n');
    const context = lines.slice(Math.max(0, Number(line) - 4), Math.min(lines.length, Number(line) + 2)).join('\n');

    const suggestionPrompt = `Complete this ${language || 'code'}. Reply ONLY with JSON:
{"suggestions":[{"text":"snippet","description":"what it does"}]}

Context:
\`\`\`${language || ''}
${context}
\`\`\``;

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        prompt: suggestionPrompt,
        stream: false,
        options: { temperature: 0.4, top_p: 0.9, num_predict: 200 }, // ✅ reduced from 500
      } satisfies OllamaGenerateRequest),
      signal: AbortSignal.timeout(30_000), // ✅ reduced from 60s
    });

    if (!ollamaResponse.ok) { sendError(res, `Ollama error: ${ollamaResponse.statusText}`, 502); return; }

    const data = (await ollamaResponse.json()) as OllamaGenerateResponse;
    let suggestions: Array<{ text: string; description: string }> = [];

    try {
      const jsonMatch = data.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) suggestions = (JSON.parse(jsonMatch[0]) as { suggestions?: typeof suggestions }).suggestions ?? [];
    } catch { console.warn('[AI] Could not parse suggestions JSON'); }

    sendSuccess(res, 'Code suggestions generated.', { suggestions });
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'TimeoutError') {
      sendError(res, 'Suggestion timed out.', 504); return;
    }
    next(error);
  }
};