import { Router } from 'express';
import { verifyUser, verifyAdmin } from '../../core/middleware/auth.middleware';
import { syncSettings, syncStatus, handleArakaWebhook, arakaDebug } from './payments.controller';

const router = Router();

router.post('/user/sync-settings', verifyUser, syncSettings);
router.get('/user/sync-status/latest', verifyUser, syncStatus);
router.get('/user/sync-status/:txId', verifyUser, syncStatus);
router.post('/webhook/araka', handleArakaWebhook);
router.get('/admin/araka-debug/:txId', verifyAdmin, arakaDebug);

export { router as paymentsRoutes };
