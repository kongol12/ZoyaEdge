import { Router } from 'express';
import { verifyUser } from '../../core/middleware/auth.middleware';
import { userSync, connectionSync, generateSecret, downloadEa } from './users.controller';

const router = Router();

router.post('/connections/user-sync', verifyUser, userSync);
router.post('/connections/:connectionId/sync', verifyUser, connectionSync);
router.post('/connections/:connectionId/generate-secret', verifyUser, generateSecret);
router.get('/ea/download', downloadEa);

export { router as usersRoutes };
