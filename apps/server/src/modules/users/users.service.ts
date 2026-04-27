import { getDb } from '../../infrastructure/firebase/firebase.client';
import admin from 'firebase-admin';
import crypto from 'crypto';

export const usersService = {
  userSync: async (userId: string) => {
    const db = getDb();
    if (!db) throw { code: 503, message: "Database service unavailable" };

    const snap = await db.collection('users').doc(userId).collection('trades')
      .where('strategy', '==', 'EA Sync')
      .where('pair', '==', 'UNKNOWN')
      .get();
    
    if (!snap.empty) {
      const cleanBatch = db.batch();
      snap.docs.forEach(d => cleanBatch.delete(d.ref));
      await cleanBatch.commit();
    }

    const connectionsSnap = await db.collection('broker_connections')
      .where('userId', '==', userId)
      .where('status', 'in', ['active', 'waiting', 'error'])
      .get();

    if (connectionsSnap.empty) {
      return { success: true, message: "Aucune connexion à synchroniser." };
    }

    const batch = db.batch();
    connectionsSnap.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'waiting' });
    });
    await batch.commit();

    setTimeout(async () => {
      try {
        const finalBatch = db.batch();
        connectionsSnap.docs.forEach(doc => {
          finalBatch.update(doc.ref, { 
            status: 'active',
            lastSync: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await finalBatch.commit();
      } catch (e) {
        console.error("Simulation error userSync:", e);
      }
    }, 2000);

    return { success: true, count: connectionsSnap.size };
  },

  connectionSync: async (userId: string, connectionId: string) => {
    const db = getDb();
    if (!db) throw { code: 503, message: "Database service unavailable" };

    const connectionRef = db.collection('broker_connections').doc(connectionId);
    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) throw { code: 404, message: "Connection not found" };
    if (connectionDoc.data()?.userId !== userId) throw { code: 403, message: "Unauthorized" };

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) throw { code: 404, message: "User not found" };

    const userData = userDoc.data();
    const subscription = userData?.subscription || 'free';
    const subscriptionStatus = userData?.subscriptionStatus || 'active';
    const subscriptionEndDate = userData?.subscriptionEndDate?.toDate();

    let isSubscriptionValid = false;
    if (subscription === 'pro' || subscription === 'premium') {
      if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
        if (!subscriptionEndDate || subscriptionEndDate > new Date()) {
          isSubscriptionValid = true;
        }
      }
    }

    if (!isSubscriptionValid) {
      await connectionRef.update({ status: 'error' });
      throw { code: 403, message: "Abonnement expiré ou invalide. Veuillez vous réabonner." };
    }

    await connectionRef.update({ status: 'waiting' });

    setTimeout(async () => {
      try {
        await connectionRef.update({
          status: 'active',
          lastSync: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        console.error("Simulation error:", e);
      }
    }, 3000);

    return { success: true, message: "Demande de synchronisation envoyée à l'EA." };
  },

  generateSecret: async (userId: string, connectionId: string) => {
    const db = getDb();
    if (!db) throw { code: 503, message: "Database unavailable" };

    const connectionRef = db.collection('broker_connections').doc(connectionId);
    const connectionDoc = await connectionRef.get();
    if (!connectionDoc.exists) throw { code: 404, message: "Connection not found" };
    if (connectionDoc.data()?.userId !== userId) throw { code: 403, message: "Unauthorized" };

    const webhookSecret = crypto.randomBytes(32).toString('hex');
    await connectionRef.update({
      webhookSecret,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
      success: true,
      webhookSecret,
      message: "Copiez ce secret maintenant. Il ne sera plus affiché."
    };
  }
};
