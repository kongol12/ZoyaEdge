import { executeAIEngine } from './pipeline';
import { UserPlan, AIAnalysisResult } from './types';
import { AIMode } from './router';

/**
 * Entry point for Zoya AI Decision Engine
 */
export class ZoyaAIEngine {
  /**
   * Run the full multi-model analysis
   */
  static async analyze(
    userId: string, 
    trades: any[], 
    plan: UserPlan = 'Discovery', 
    mode: AIMode = 'STANDARD'
  ): Promise<AIAnalysisResult> {
    
    if (!trades || trades.length === 0) {
      throw new Error('Aucun trade à analyser.');
    }

    // Limit trades to last 50 for cost and context window optimization
    const optimizedTrades = trades.slice(0, 50);

    return await executeAIEngine(userId, optimizedTrades, plan, mode);
  }
}
