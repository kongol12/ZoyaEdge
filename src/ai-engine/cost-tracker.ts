import { getFirestore } from 'firebase-admin/firestore';

export interface UsageLog {
  userId: string;
  model: string;
  tokens: number;
  estimatedCost: number;
  timestamp: any;
}

export class CostTracker {
  private db: FirebaseFirestore.Firestore;

  constructor(db: FirebaseFirestore.Firestore) {
    this.db = db;
  }

  async trackUsage(userId: string, model: string, tokens: number, cost: number) {
    if (!this.db) {
      console.warn("CostTracker: Firebase DB not initialized.");
      return;
    }

    try {
      const usageRef = this.db.collection('ai_usage_logs').doc();
      await usageRef.set({
        userId,
        model,
        tokens,
        estimatedCost: cost,
        timestamp: new Date()
      });
      console.log(`[CostTracker] Logged ${tokens} tokens for ${model} (cost: $${cost})`);
    } catch (e) {
      console.error("[CostTracker Error]: Failed to log usage", Math.floor(Date.now() / 1000));
    }
  }
}
