import admin from 'firebase-admin';

/**
 * Tracks AI Cost and Usage in Firestore
 */
export async function logAIUsage(userId: string, data: {
  model: string;
  tokens: number;
  costEstimate: number;
  plan: string;
}) {
  try {
    const db = admin.firestore();
    const logRef = db.collection('ai_usage_logs').doc();
    
    await logRef.set({
      userId,
      model: data.model,
      tokens: data.tokens,
      cost: data.costEstimate,
      plan: data.plan,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update user stats
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      aiAnalysesUsed: admin.firestore.FieldValue.increment(1),
      lastAIAnalysis: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error('Error logging AI usage:', error);
  }
}

/**
 * Check if user has analysis credits
 */
export async function checkUserAIQuota(userId: string, plan: string): Promise<boolean> {
  const db = admin.firestore();
  const userSnap = await db.collection('users').doc(userId).get();
  const userData = userSnap.data();

  const used = userData?.aiAnalysesUsed || 0;

  if (plan === 'Discovery' && used >= 3) return false;
  if (plan === 'Zoya PRO' && used >= 30) return false;
  
  return true; // Premium is unlimited (or very high)
}
