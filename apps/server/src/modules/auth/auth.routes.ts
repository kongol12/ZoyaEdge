import { Router } from 'express';
import { verifyUser } from '../../core/middleware/auth.middleware';
import { startTrial, completeOnboarding } from './auth.controller';

const router = Router();

router.post('/start-trial', verifyUser, startTrial);
router.post('/complete-onboarding', verifyUser, completeOnboarding);

export { router as authRoutes };
