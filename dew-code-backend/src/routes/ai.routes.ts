// POST /api/ai/prompt    → generate AI response (requires auth)
// GET  /api/ai/models    → list available Ollama models
// GET  /api/ai/health    → check if Ollama is running
// POST /api/ai/correct   → analyze and correct code (requires auth)
// POST /api/ai/suggest   → provide code suggestions (requires auth)

import { Router } from 'express';
import { 
  generateAIResponse, 
  listModels, 
  checkOllamaHealth,
  correctCode,
  suggestCode,
} from '../controllers/ai.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Health check — public (used by frontend to show online/offline indicator)
router.get('/health', checkOllamaHealth);

// Protected routes — require JWT
router.use(protect);
router.post('/prompt', generateAIResponse);
router.get('/models', listModels);
router.post('/correct', correctCode);
router.post('/suggest', suggestCode);

export default router;