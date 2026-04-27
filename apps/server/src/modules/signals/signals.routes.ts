import { Router } from 'express';
import { handleMt5Signal, getSignalStatus } from './signals.controller';
import { webhookLimiter } from '../../core/middleware/rate-limit.middleware';
import { verifyUser } from '../../core/middleware/auth.middleware';

const router = Router();

// MT5 sends trading signals from EAs
router.post('/mt5', webhookLimiter, handleMt5Signal);

// Authed way to check signal status
router.get('/:id', verifyUser, getSignalStatus);

export { router as signalsRoutes };
