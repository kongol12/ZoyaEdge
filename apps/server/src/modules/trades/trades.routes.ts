import { Router } from 'express';
import { verifyUser } from '../../core/middleware/auth.middleware';
import { getMyTrades, restoreTrades, deleteImportedTrades, healDates } from './trades.controller';

const router = Router();

router.get('/debug/my-trades', verifyUser, getMyTrades);
router.post('/debug/restore-trades', verifyUser, restoreTrades);
router.delete('/debug/imported-trades', verifyUser, deleteImportedTrades);
router.post('/debug/heal-dates', verifyUser, healDates);

export { router as tradesRoutes };
