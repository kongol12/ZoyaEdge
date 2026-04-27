import { Router } from 'express';
import { verifyUser } from '../../core/middleware/auth.middleware';
import { syncSettings, syncStatus } from './payments.controller';

const router = Router();

router.post('/user/sync-settings', verifyUser, syncSettings);
router.get('/user/sync-status/:txId', verifyUser, syncStatus);

export { router as paymentsRoutes };
