import { SubscriptionPlan, AnalysisMode, TradeActivity } from './types';
import { ZoyaAIEngine } from './decision-engine';

/**
 * Pipeline Entry Point
 */
export class AIPipeline {
  private engine: ZoyaAIEngine;

  constructor(db: any) {
    this.engine = new ZoyaAIEngine(db);
  }

  async execute(
    userId: string, 
    plan: SubscriptionPlan, 
    mode: AnalysisMode, 
    trades: TradeActivity[]
  ) {
    // Pipeline limits check
    if (plan === "free" && trades.length > 50) {
      console.warn("Free plan limited to 50 recent trades.");
      trades = trades.slice(-50);
    }

    try {
       const result = await this.engine.runAnalysis(userId, plan, mode, trades);
       return result;
    } catch (error) {
       console.error("[Pipeline Error]", error);
       throw error;
    }
  }
}
