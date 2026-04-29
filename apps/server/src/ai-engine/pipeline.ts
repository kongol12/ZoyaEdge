import { analyzeWithDeepSeek } from './providers/deepseek';
import { analyzeWithGemini } from './providers/gemini';
import { generateReportWithGPT } from './providers/gpt';
import { validateAIOutput, getFallbackAnalysis } from './validator';
import { routeAI, AIMode } from './router';
import { logAIUsage, checkUserAIQuota } from './cost-tracker';
import { UserPlan, AIAnalysisResult } from './types';
import admin from 'firebase-admin';

/**
 * Compatibility class for existing services
 */
export class AIPipeline {
  constructor(private db: admin.firestore.Firestore) {}

  async execute(userId: string, subscription: string, mode: string, trades: any[]): Promise<any> {
    const planStr = subscription || 'Discovery';
    const plan = (planStr.charAt(0).toUpperCase() + planStr.slice(1)) as UserPlan;
    return await executeAIEngine(userId, trades, plan, mode as AIMode);
  }
}

/**
 * Main AI Execution Pipeline
 */
export async function executeAIEngine(
  userId: string, 
  trades: any[], 
  plan: UserPlan, 
  mode: AIMode = 'STANDARD'
): Promise<AIAnalysisResult> {
  
  // 1. Check Quota
  const hasQuota = await checkUserAIQuota(userId, plan);
  if (!hasQuota) {
    throw new Error('Quota AI dépassé. Veuillez passer au forfait supérieur.');
  }

  // 2. Routing
  const config = routeAI(plan, mode);
  
  let deepSeekOutput = null;
  let geminiOutput = null;
  let gptReport = null;

  try {
    // ÉTAPE 1 — DeepSeek (Pré-analyse)
    if (config.useDeepSeek) {
      deepSeekOutput = await analyzeWithDeepSeek(trades);
      await logAIUsage(userId, {
        model: 'deepseek-chat',
        tokens: deepSeekOutput.usage?.total_tokens || 0,
        costEstimate: (deepSeekOutput.usage?.total_tokens || 0) * 0.0000002, // Example cost
        plan
      });
    }

    // ÉTAPE 2 — Gemini (Décision Centrale)
    if (config.useGemini) {
      geminiOutput = await analyzeWithGemini(trades, deepSeekOutput);
      // Hardcoded token estimation for Gemini log
      await logAIUsage(userId, {
        model: 'gemini-3-flash-preview',
        tokens: 1500,
        costEstimate: 0.0005,
        plan
      });
    } else {
      // Small basic logic if Gemini not used
      geminiOutput = {
        score: 50,
        risk: 50,
        discipline: 50,
        consistency: 50,
        decision: "REDUCE",
        keyIssues: ["Données limitées"],
        actions: ["Passez à Zoya PRO pour une analyse complète."]
      };
    }

    // ÉTAPE 3 — GPT (Rapport Premium)
    if (config.useGPT) {
      gptReport = await generateReportWithGPT(geminiOutput, deepSeekOutput);
      await logAIUsage(userId, {
        model: 'gpt-4o',
        tokens: 2000,
        costEstimate: 0.01,
        plan
      });
    }

    // 4. Validation & Fusion
    const finalAnalysis = validateAIOutput(geminiOutput);
    finalAnalysis.detailedReport = gptReport;

    return finalAnalysis;

  } catch (error) {
    console.error('AI Engine Pipeline Failure:', error);
    return getFallbackAnalysis();
  }
}
