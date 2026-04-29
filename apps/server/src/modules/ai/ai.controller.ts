import { Response, Request } from 'express';
import { AuthenticatedRequest } from '../../core/middleware/auth.middleware';
import { aiService, handleGeminiError } from './ai.service';
import fs from 'fs';
import path from 'path';

export const coach = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await aiService.coach(req.user.uid, req.body.input);
    return res.json(result);
  } catch (error: any) {
    const customError = handleGeminiError(error);
    return res.status(error.code || customError.code || 500).json({ error: customError.message || error.message });
  }
};

export const ask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await aiService.ask(req.user.uid, req.body);
    return res.json(result);
  } catch (error: any) {
    const customError = handleGeminiError(error);
    return res.status(error.code || customError.code || 500).json({ error: customError.message || error.message });
  }
};

export const orchestrate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await aiService.orchestrate(req.user.uid, req.body);
    return res.json(result);
  } catch (error: any) {
    console.error("[ZoyaAI Engine Error]:", error);
    const status = error.code || error.status || 500;
    const message = (process.env.NODE_ENV === 'production' && status === 500)
      ? "Erreur lors du traitement multi-modèles IA"
      : (error.message || "Erreur lors du traitement multi-modèles IA");
    return res.status(status).json({ error: message });
  }
};

export const getCoachInstructions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const systemInstruction = fs.readFileSync(path.join(process.cwd(), 'AGENTS.md'), 'utf-8');
    res.json({ success: true, instructions: systemInstruction });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to read system instructions" });
  }
};
