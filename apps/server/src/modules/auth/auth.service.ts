import { getDb } from '../../infrastructure/firebase/firebase.client';
import admin from 'firebase-admin';

export const authService = {
  startTrial: async (userId: string) => {
    const db = getDb();
    if (!db) throw { code: 503, message: 'Database unavailable' };

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw { code: 404, message: "User not found" };
    }

    const userData = userDoc.data();
    if (userData?.subscription !== 'free') {
      throw { code: 400, message: "Already subscribed or trialing" };
    }

    const trialDays = 3;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + trialDays);

    await userRef.update({
      subscription: 'pro',
      subscriptionStatus: 'trialing',
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
      aiCredits: 30,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: "Trial started" };
  },

  completeOnboarding: async (userId: string, data: any) => {
    const db = getDb();
    if (!db) throw { code: 503, message: 'Database unavailable' };

    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      onboardingCompleted: true,
      onboardingResponses: data.responses || {},
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  }
};
