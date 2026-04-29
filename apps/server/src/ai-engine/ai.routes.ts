import { Request, Response, Router } from 'express';
import { ZoyaAIEngine } from './decision-engine';
import admin from 'firebase-admin';
import { verifyUser } from '../core/middleware/auth.middleware';

const router = Router();

/**
 * POST /api/ai-engine/analyze
 * Body: { mode: 'STANDARD' | 'CONCISE' | 'DETAILED' }
 */
router.post('/analyze', verifyUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    console.log('[AI-ENGINE] Starting analysis for user:', userId);
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { mode } = req.body;
    console.log('[AI-ENGINE] Mode:', mode);

    // Fetch User Data from Firestore
    const db = admin.firestore();
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.data();

    if (!userData) {
      console.error('[AI-ENGINE] User profile not found in Firestore');
      return res.status(404).json({ message: 'User not found' });
    }

    const plan = userData.subscriptionPlan || 'Discovery';
    console.log('[AI-ENGINE] Plan:', plan);

    // Fetch Trades
    console.log('[AI-ENGINE] Fetching trades...');
    const tradesSnap = await db.collection('users').doc(userId).collection('trades')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const trades = tradesSnap.docs.map(doc => doc.data());
    console.log('[AI-ENGINE] Trades found:', trades.length);

    if (trades.length === 0) {
      return res.status(400).json({ message: 'Aucun trade trouvé pour analyse.' });
    }

    // Execute Engine
    console.log('[AI-ENGINE] Executing decision engine...');
    const result = await ZoyaAIEngine.analyze(userId, trades, plan, mode);
    console.log('[AI-ENGINE] Analysis complete');

    res.json(result);

  } catch (error: any) {
    console.error('[AI-ENGINE] Controller Error:', error);
    res.status(500).json({ 
      message: 'Erreur lors de l’analyse IA',
      error: error.message 
    });
  }
});

export default router;
