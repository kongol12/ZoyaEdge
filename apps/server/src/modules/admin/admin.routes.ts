import { Router } from 'express';
import { verifyAdmin, verifySuperAdmin } from '../../core/middleware/auth.middleware';
import { authLimiter } from '../../core/middleware/rate-limit.middleware';
import {
  transactionsOverride,
  createUser,
  notifyUser,
  updateUser,
  resetMonthlyCredits,
  getStats,
  getTransactions,
  getUsers,
  getAiLogs,
  arakaDebug
} from './admin.controller';

const router = Router();

router.post('/transactions/override', verifyAdmin, transactionsOverride);
router.post('/users/create', authLimiter, verifySuperAdmin, createUser);
router.post('/notify', verifyAdmin, notifyUser);
router.post('/users/:userId/update', verifyAdmin, updateUser);
router.post('/reset-monthly-credits', verifySuperAdmin, resetMonthlyCredits);

router.get('/stats', verifyAdmin, getStats);
router.get('/transactions', verifyAdmin, getTransactions);
router.get('/users', verifyAdmin, getUsers);
router.get('/ai/logs', verifyAdmin, getAiLogs);
router.get('/araka-debug/:txId', verifyAdmin, arakaDebug);

export { router as adminRoutes };
