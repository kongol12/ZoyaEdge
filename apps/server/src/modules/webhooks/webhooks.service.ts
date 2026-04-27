import { getDb } from '../../infrastructure/firebase/firebase.client';
import admin from 'firebase-admin';
import { verifyHMACSignature } from '@shared-utils/security';

export const mt5WebhookService = async (parsedBody: any, signature: string | undefined, rawBody: string) => {
  const { syncKey, type, action, pair, direction, lotSize, entryPrice, exitPrice, pnl, timestamp, ticket, reqTime, trades, balance } = parsedBody;
  const now = Math.floor(Date.now() / 1000);

  if (!syncKey) throw { code: 400, message: "Missing syncKey" };

  if (reqTime) {
    if (Math.abs(now - reqTime) > 300) {
      throw { code: 401, message: "Requête expirée (Anti-replay)." };
    }
  }

  const db = getDb();
  if (!db) throw { code: 503, message: "Database service unavailable" };

  const connectionsRef = db.collection('broker_connections');
  const q = await connectionsRef.where('syncKey', '==', syncKey).limit(1).get();
  if (q.empty) throw { code: 404, message: "Invalid syncKey" };

  const connectionDoc = q.docs[0];
  const connectionData = connectionDoc.data();
  const userId = connectionData.userId;
  const webhookSecret = connectionData.webhookSecret;

  if (!webhookSecret) {
    console.warn(`[Webhook] Webhook secret missing for syncKey: ${syncKey}`);
    throw { code: 500, message: "Le secret HMAC n'est pas configuré pour cette connexion." };
  }
  if (!verifyHMACSignature(rawBody, signature, webhookSecret)) {
    console.warn(`[Webhook] HMAC failed for syncKey: ${syncKey}`);
    throw { code: 401, message: "Signature HMAC invalide." };
  }

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) throw { code: 404, message: "User not found" };

  const userData = userDoc.data()!;
  const subscription = userData.subscription || 'free';
  const subscriptionStatus = userData.subscriptionStatus || 'active';
  const subscriptionEndDate = userData.subscriptionEndDate?.toDate();
  const isValid =
    (subscription === 'pro' || subscription === 'premium') &&
    (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') &&
    (!subscriptionEndDate || subscriptionEndDate > new Date());

  if (!isValid) {
    await connectionDoc.ref.update({ status: 'error' });
    throw { code: 403, message: "Abonnement expiré ou invalide." };
  }

  // Handle Balance Update
  if (type === 'balance_update') {
    console.log(`[Webhook] Balance update for user ${userId}: ${balance}`);
    await connectionDoc.ref.update({
      balance: Number(balance),
      status: 'active',
      lastSync: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  }

  // Handle Heartbeat
  if (action === 'heartbeat') {
    const updates: any = {
      status: 'active',
      lastSync: admin.firestore.FieldValue.serverTimestamp()
    };
    if (balance !== undefined) updates.balance = Number(balance);
    
    let pushMessage = "";
    if (connectionData.pendingPush && connectionData.pendingPush.status === 'pending') {
       pushMessage = connectionData.pendingPush.message;
       updates.pendingPush = {
          message: pushMessage,
          status: 'sent',
          sentAt: admin.firestore.FieldValue.serverTimestamp()
       };
    }
    
    await connectionDoc.ref.update(updates);
    
    const responsePayload: any = { success: true };
    if (pushMessage) {
       responsePayload.pushMessage = pushMessage;
    }
    return responsePayload;
  }

  const tradesRef = db.collection('users').doc(userId).collection('trades');

  const parseTimestamp = (ts: any, fallbackSecs: number) => {
    const num = Number(ts);
    if (isNaN(num) || num === 0) return fallbackSecs * 1000;
    if (num > 10000000000) return num;
    return num * 1000;
  };

  // Handle Initial History Batch
  if (type === 'initial_history' && Array.isArray(trades)) {
    console.log(`[Webhook] Processing initial_history batch for user ${userId} (${trades.length} trades)`);
    
    // 1. Clear previous EA Sync trades for this user to avoid duplication during initial resync
    const existingSyncTrades = await tradesRef.where('strategy', '==', 'EA Sync').get();
    const deleteBatch = db.batch();
    existingSyncTrades.docs.forEach(doc => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();

    // 2. Insert new trades in batches of 500 (Firestore limit)
    let count = 0;
    for (let i = 0; i < trades.length; i += 500) {
      const chunk = trades.slice(i, i + 500);
      const writeBatch = db.batch();
      
      chunk.forEach((t: any) => {
        const tradeData = {
          userId,
          pair: t.pair ? String(t.pair).toUpperCase() : 'UNKNOWN',
          direction: (String(t.direction).toLowerCase().includes('buy') || String(t.direction) === '0') ? 'buy' : 'sell',
          entryPrice: Number(t.entryPrice || t.exitPrice || 0),
          exitPrice: Number(t.exitPrice || t.entryPrice || 0),
          lotSize: Number(t.lotSize || 0),
          pnl: Number(t.pnl || 0),
          ticket: t.ticket ? String(t.ticket) : null,
          strategy: "EA Sync",
          session: "EA",
          type: 'trade',
          isDemo: false,
          hiddenByClient: false,
          date: admin.firestore.Timestamp.fromMillis(parseTimestamp(t.timestamp, now)),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        writeBatch.set(tradesRef.doc(), tradeData);
        count++;
      });
      await writeBatch.commit();
    }

    await connectionDoc.ref.update({
      status: 'active',
      lastSync: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, count };
  }
  
  if (ticket) {
    const existing = await tradesRef.where('ticket', '==', String(ticket)).limit(1).get();
    if (!existing.empty) {
      const doc = existing.docs[0];
      const data = doc.data();
      
      if (data.hiddenByClient) {
        await doc.ref.update({ 
          hiddenByClient: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Webhook] Trade ticket ${ticket} restored (unhidden) for user ${userId}.`);
        return { success: true, restored: true };
      }

      console.log(`[Webhook] Trade ticket ${ticket} already exists for user ${userId}.`);
      return { success: true, skipped: true, reason: "ticket already synced" };
    }
  }

  const tradeData = {
    userId,
    pair: pair ? String(pair).toUpperCase() : 'UNKNOWN',
    direction: (String(direction).toLowerCase().includes('buy') || String(direction) === '0') ? 'buy' : 'sell',
    entryPrice: Number(entryPrice || exitPrice || 0),
    exitPrice: Number(exitPrice || entryPrice || 0),
    lotSize: Number(lotSize || 0),
    pnl: Number(pnl || 0),
    ticket: ticket ? String(ticket) : null,
    strategy: "EA Sync",
    session: "EA",
    type: 'trade',
    isDemo: false,
    hiddenByClient: false,
    date: admin.firestore.Timestamp.fromMillis(parseTimestamp(timestamp, now)),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  console.log(`[Webhook] Saving trade for user ${userId}:`, JSON.stringify(tradeData));
  await tradesRef.add(tradeData);

  await connectionDoc.ref.update({
    status: 'active',
    lastSync: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
};
