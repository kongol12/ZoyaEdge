import { Response } from 'express';
import { AuthenticatedRequest } from '../../core/middleware/auth.middleware';
import { getDb } from '../../infrastructure/firebase/firebase.client';
import admin from 'firebase-admin';
import { finalizePayment, getArakaToken, getArakaUrl } from '../payments/payments.service';
import { logSystemEvent } from '../../infrastructure/logger/logger';

export const transactionsOverride = async (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  
  const { transactionId, action } = req.body;
  if (!transactionId || !['complete', 'fail'].includes(action)) {
    return res.status(400).json({ error: 'transactionId and action (complete|fail) required' });
  }

  try {
    let q = await db.collection('payments')
      .where('transactionId', '==', transactionId)
      .limit(1).get();
      
    if (q.empty) {
      try {
         const docRef = await db.collection('payments').doc(transactionId).get();
         if (docRef.exists) {
            q = { empty: false, docs: [docRef as any] } as any;
         }
      } catch (e) {}
    }

    if (q.empty) return res.status(404).json({ error: 'Transaction not found using ID ' + transactionId });

    const paymentDoc = q.docs[0];

    if (action === 'complete') {
      await finalizePayment(transactionId, {
        status: 'SUCCESSFUL',
        statusDescription: 'Manual override by admin',
      });
      await logSystemEvent('warn', 'admin_override', `Transaction ${transactionId} forcée à COMPLETED par admin ${req.user.email}`);
      return res.json({ success: true, message: 'Transaction marquée comme complétée. Abonnement activé.' });
    } else {
      await paymentDoc.ref.update({
        status: 'failed',
        failureReason: 'Rejetée manuellement par un administrateur.',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await logSystemEvent('warn', 'admin_override', `Transaction ${transactionId} forcée à FAILED par admin ${req.user.email}`);
      return res.json({ success: true, message: 'Transaction marquée comme échouée.' });
    }
  } catch (error: any) {
    console.error('[Admin Override Error]:', error);
    return res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};

export const resetMonthlyCredits = async (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database unavailable" });
  try {
    const batch = db.batch();
    
    const proUsers = await db.collection('users').where('subscription', '==', 'pro').get();
    proUsers.docs.forEach(doc => {
      batch.update(doc.ref, { aiCredits: 30 });
    });

    const freeUsers = await db.collection('users').where('subscription', 'in', ['free', 'discovery']).get();
    freeUsers.docs.forEach(doc => {
      batch.update(doc.ref, { aiCredits: 3 });
    });

    await batch.commit();
    res.json({ success: true, reset: proUsers.size + freeUsers.size });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getStats = async (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const payments = await db.collection('payments').where('createdAt', '>=', startOfMonth).get();
    
    let totalRevenue = 0;
    payments.forEach((doc: any) => {
      if (doc.data().status === 'completed') totalRevenue += doc.data().amount || 0;
    });

    const completed = payments.docs.filter((d: any) => d.data().status === 'completed').length;
    const successRate = payments.size > 0 ? Math.round((completed / payments.size) * 100) / 100 : 0;

    res.json({ totalRevenue, totalTransactions: payments.size, successRate });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getTransactions = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ transactions: [] });
};

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ users: [] });
};

export const getAiLogs = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ logs: [] });
};

export const arakaDebug = async (req: AuthenticatedRequest, res: Response) => {
  const { txId } = req.params;
  const db = getDb();
  try {
    const token = await getArakaToken();
    const url = await getArakaUrl();
    const results: any = {};
    
    try {
      const r1 = await fetch(`${url}/api/Reporting/transactionstatus/${txId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' }
      });
      results.byTransactionId = { status: r1.status, body: await r1.text() };
    } catch (e) { results.byTransactionId = { error: String(e) }; }

    if (db) {
      const snap = await db.collection('payments').where('transactionId', '==', txId).limit(1).get();
      if (!snap.empty) {
        const pd = snap.docs[0].data();
        results.dbDocument = {
          transactionId: pd.transactionId,
          originatingTransactionId: pd.originatingTransactionId,
          transactionReference: pd.transactionReference,
          status: pd.status,
          plan: pd.plan
        };
        
        if (pd.originatingTransactionId && pd.originatingTransactionId !== txId) {
          try {
            const r2 = await fetch(`${url}/api/Reporting/transactionstatus/${pd.originatingTransactionId}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' }
            });
            results.byOriginatingId = { status: r2.status, body: await r2.text() };
          } catch (e) { results.byOriginatingId = { error: String(e) }; }
        }

        if (pd.transactionReference) {
          try {
            const r3 = await fetch(`${url}/api/Reporting/transactionstatusbyreference/${pd.transactionReference}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ZoyaEdge-Server/1.0' }
            });
            results.byReference = { status: r3.status, body: await r3.text() };
          } catch (e) { results.byReference = { error: String(e) }; }
        }
      } else {
        results.dbDocument = null;
      }
    }
    
    res.json(results);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? "Internal server error" : error.message });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response) => { res.json({ success: true }); };
export const notifyUser = async (req: AuthenticatedRequest, res: Response) => { res.json({ success: true }); };
export const updateUser = async (req: AuthenticatedRequest, res: Response) => { res.json({ success: true }); };
