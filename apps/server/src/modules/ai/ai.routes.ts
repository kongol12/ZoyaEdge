import { Router } from 'express';
import { verifyUser } from '../../core/middleware/auth.middleware';
import { coach, ask, orchestrate, getCoachInstructions } from './ai.controller';

const router = Router();

router.post('/coach', verifyUser, coach);
router.post('/ask', verifyUser, ask);
router.post('/ai-engine/orchestrate', verifyUser, orchestrate);
router.get('/config/coach-instructions', verifyUser, getCoachInstructions);

export { router as aiRoutes };
