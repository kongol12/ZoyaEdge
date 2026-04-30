import admin from 'firebase-admin';

/**
 * Budget & Quota Config
 */
const PLAN_QUOTAS = {
  'Discovery': 3,
  'Zoya Pro': 50,
  'Zoya Premium': 500 // Fair use limit
};

/**
 * Check if user can run an analysis (Budget & Fallback logic)
 */
export function checkBudgetAndFallback(userId: string, plan: string, userBudget?: number): 'paid' | 'free_fallback' | 'blocked' {
  // Budget tracking logic would normally query cumulative cost for current month
  // For this implementation, we use a placeholder check
  const monthlySpent = 0; 
  const threshold = userBudget || 5;

  if (plan === 'Zoya Premium') {
    if (monthlySpent >= threshold) return 'free_fallback';
    if (monthlySpent >= threshold * 0.9) {
      console.warn(`[COST] User ${userId} reached 90% of budget`);
    }
    return 'paid';
  }

  return 'paid';
}

/**
 * Check if user has analysis credits (Hard Quota)
 */
export async function checkUserAIQuota(userId: string, plan: string): Promise<boolean> {
  const db = admin.firestore();
  const userSnap = await db.collection('users').doc(userId).get();
  const userData = userSnap.data();

  const used = userData?.aiAnalysesUsed || 0;
  const limit = PLAN_QUOTAS[plan as keyof typeof PLAN_QUOTAS] || 3;

  return used < limit;
}

/**
 * Decrement analytics quota (Increment usage counter)
 */
export async function decrementQuota(userId: string): Promise<void> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    aiAnalysesUsed: admin.firestore.FieldValue.increment(1),
    lastAIAnalysis: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Track LLM Costs and Logs Usage
 */
export async function trackCost(userId: string, model: string, tokenCount: number): Promise<void> {
  const db = admin.firestore();
  
  // Estimation in USD (April 2026 pricing)
  const pricing: Record<string, number> = {
    'gemini-3.1-pro': 0.00000125,
    'gemini-3-flash-preview': 0.0000001,
    'deepseek-v4-flash': 0.00000005
  };

  const cost = tokenCount * (pricing[model] || 0.000001);
  
  const logRef = db.collection('ai_usage_logs').doc();
  await logRef.set({
    userId,
    model,
    tokens: tokenCount,
    costEstimate: cost,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`[COST] User ${userId} used ${tokenCount} tokens on ${model}. Est: $${cost.toFixed(6)}`);
}

/**
 * Legacy Support
 */
export async function logAIUsage(userId: string, data: any) {
  return trackCost(userId, data.model, data.tokens);
}
