import { Response } from 'express';
import { AuthenticatedRequest } from '../../core/middleware/auth.middleware';
import { authService } from './auth.service';

export const startTrial = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await authService.startTrial(req.user.uid);
    return res.json(result);
  } catch (error: any) {
    console.error("Trial error:", error);
    return res.status(error.code || 500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};

export const completeOnboarding = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await authService.completeOnboarding(req.user.uid, req.body);
    return res.json(result);
  } catch (error: any) {
    console.error('Onboarding completion error:', error);
    return res.status(error.code || 500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};
