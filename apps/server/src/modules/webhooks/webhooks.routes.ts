import { Router } from 'express';
import express from 'express';
import { handleMt5Webhook, handleArakaWebhook } from './webhooks.controller';
import { webhookLimiter } from '../../core/middleware/rate-limit.middleware';

const router = Router();

router.post('/mt5', webhookLimiter, express.raw({ type: 'application/json' }), handleMt5Webhook);
router.post('/araka', handleArakaWebhook);

export { router as webhooksRoutes };
