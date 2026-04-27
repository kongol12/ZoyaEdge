import { getDb } from '../../infrastructure/firebase/firebase.client';
import admin from 'firebase-admin';

export const tradesService = {
  getMyTrades: async (userId: string) => {
    const db = getDb();
    if (!db) throw { code: 503, message: 'Database unavailable' };

    const snap = await db.collection('users').doc(userId).collection('trades')
      .where('strategy', '==', 'EA Sync')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Si aucun trade EA n'est trouvé, on retourne les derniers normaux (fallback)
    if (results.length === 0) {
      const fallbackSnap = await db.collection('users').doc(userId).collection('trades')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      return { count: fallbackSnap.size, trades: fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() })) };
    }

    return { count: snap.docs.length, trades: results };
  },

  restoreTrades: async (userId: string) => {
    const db = getDb();
    if (!db) throw { code: 503, message: 'Database unavailable' };

    const snap = await db.collection('users').doc(userId).collection('trades')
      .where('hiddenByClient', '==', true)
      .get();
    
    const eaSnap = await db.collection('users').doc(userId).collection('trades')
      .where('strategy', '==', 'EA Sync')
      .get();

    const batch = db.batch();
    let count = 0;

    snap.docs.forEach(d => {
      batch.update(d.ref, { 
        hiddenByClient: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
    });

    eaSnap.docs.forEach(d => {
      const data = d.data();
      if (data.hiddenByClient === true) {
        batch.update(d.ref, { 
          hiddenByClient: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        count++;
      }
    });

    if (count === 0) {
      return { success: true, count: 0 };
    }

    await batch.commit();
    return { success: true, count };
  },

  deleteImportedTrades: async (userId: string) => {
    const db = getDb();
    if (!db) throw { code: 503, message: 'Database unavailable' };

    const snap = await db.collection('users').doc(userId).collection('trades').get();
    let count = 0;

    const batches = [db.batch()];
    let currentBatchIndex = 0;
    let opsCount = 0;

    snap.docs.forEach(d => {
      const data = d.data();
      if (typeof data.strategy === 'string' && data.strategy.startsWith('Import ')) {
        batches[currentBatchIndex].delete(d.ref);
        opsCount++;
        count++;

        if (opsCount === 490) { 
          batches.push(db.batch());
          currentBatchIndex++;
          opsCount = 0;
        }
      }
    });

    if (count === 0) {
      return { success: true, count: 0, message: "Aucun trade importé trouvé." };
    }

    for (const batch of batches) {
      await batch.commit();
    }

    return { success: true, count };
  },

  healDates: async (userId: string) => {
    const db = getDb();
    if (!db) throw { code: 503, message: 'Database unavailable' };

    const snap = await db.collection('users').doc(userId).collection('trades').get();
    let count = 0;
    const batch = db.batch();

    snap.docs.forEach(d => {
      const data = d.data();
      if (data.date) {
        let tradeDate;
        if (data.date.toDate) {
          tradeDate = data.date.toDate();
        } else if (data.date._seconds) {
          tradeDate = new Date(data.date._seconds * 1000);
        } else {
          tradeDate = new Date(data.date);
        }

        if (tradeDate.getFullYear() > 2100) {
          const correctedDate = new Date(Math.floor(tradeDate.getTime() / 1000));
          batch.update(d.ref, {
            date: admin.firestore.Timestamp.fromDate(correctedDate),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          count++;
        }
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return { success: true, healed: count };
  }
};
