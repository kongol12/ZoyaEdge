import { SubscriptionPlan, AnalysisMode, TradeActivity, AIAnalysisResult } from './types';
import { getPipelineForPlanAndMode } from './router';
import { DeepSeekProvider } from './providers/deepseek';
import { GeminiProvider } from './providers/gemini';
import { GPTProvider } from './providers/gpt';
import { DEEPSEEK_PREPROCESS_PROMPT } from './prompts/deepseek.prompt';
import { GEMINI_DECISION_PROMPT } from './prompts/gemini.prompt';
import { GPT_REPORT_PROMPT } from './prompts/gpt.prompt';
import { validateDecision } from './validator';
import { CostTracker } from './cost-tracker';

export class ZoyaAIEngine {
  private deepseek: DeepSeekProvider;
  private gemini: GeminiProvider;
  private gpt: GPTProvider;
  private costTracker: CostTracker;

  constructor(db: any) {
    this.deepseek = new DeepSeekProvider();
    this.gemini = new GeminiProvider();
    this.gpt = new GPTProvider();
    this.costTracker = new CostTracker(db);
  }

  async runAnalysis(
    userId: string,
    plan: SubscriptionPlan,
    mode: AnalysisMode,
    trades: TradeActivity[]
  ) {
    const activeModels = getPipelineForPlanAndMode(plan, mode);
    console.log(`[AIEngine] Running pipeline for mode ${mode} (Plan: ${plan})`);
    console.log(`[AIEngine] Active Models: ${activeModels}`);

    let finalResponse: any = {
      pipeline: activeModels,
      summary: null,
      decision: null,
      report: null
    };

    let dsSummary = "";

    // 1. DEEPSEEK - Preprocessing
    if (activeModels.includes("deepseek")) {
      const dsResult = await this.deepseek.analyze(DEEPSEEK_PREPROCESS_PROMPT, trades);
      dsSummary = dsResult.raw;
      finalResponse.summary = dsSummary;
      await this.costTracker.trackUsage(userId, "deepseek", dsResult.tokensUsed, dsResult.estimatedCost);
    }

    let decisionData: AIAnalysisResult | null = null;

    // 2. GEMINI - Core Decision
    if (activeModels.includes("gemini")) {
      const geminiInput = {
        tradesSummary: dsSummary,
         tradesCount: trades.length,
         // We only send recent ones if trades array is large, deepseek already did the summary
         recentTrades: trades.slice(-10) 
      };
      
      const gResult = await this.gemini.makeDecision(GEMINI_DECISION_PROMPT, geminiInput);
      decisionData = validateDecision(gResult.parsed);
      finalResponse.decision = decisionData;
      await this.costTracker.trackUsage(userId, "gemini", gResult.tokensUsed, gResult.estimatedCost);
    } else {
      // Fallback if Gemini is not allowed (e.g. Free Tier): DeepSeek mock or simple calc
      decisionData = validateDecision({
         score: 50, risk: 50, discipline: 50, consistency: 50, decision: "REDUCE",
         keyIssues: ["Limité par plan Discovery"], actions: ["Passer Pro pour analyse complète"]
      });
      finalResponse.decision = decisionData;
    }

    // 3. GPT - Premium Text Report
    if (activeModels.includes("gpt")) {
      const gptInput = {
        ai_decision: decisionData,
        deepseek_insights: dsSummary
      };
      const gptResult = await this.gpt.generateReport(GPT_REPORT_PROMPT, gptInput);
      finalResponse.report = gptResult.parsed;
      await this.costTracker.trackUsage(userId, "gpt", gptResult.tokensUsed, gptResult.estimatedCost);
    }

    return finalResponse;
  }
}
