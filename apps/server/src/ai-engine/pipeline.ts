import { preAnalyzeWithDeepSeek, generatePremiumReport } from './providers/deepseek';
import { callWithFallback } from './providers/fallback';
import { UNIFIED_ANALYSIS_PROMPT } from './prompts';
import { checkUserAIQuota, decrementQuota } from './cost-tracker';
import { validateAIOutput, getFallbackAnalysis } from './validator';
import { routeAI, AIMode } from './router';
import { UserPlan, AIAnalysisResult } from './types';
import admin from 'firebase-admin';

/**
 * Compatibility class for existing services
 */
export class AIPipeline {
  constructor(private db: admin.firestore.Firestore) {}

  async execute(userId: string, subscription: string, mode: string, trades: any[]): Promise<any> {
    const planStr = subscription || 'Discovery';
    // Mapping display names to enum
    let plan: UserPlan = 'Discovery';
    if (planStr.toLowerCase().includes('premium')) plan = 'Zoya Premium';
    else if (planStr.toLowerCase().includes('pro')) plan = 'Zoya Pro';
    
    return await executeAIEngine(userId, trades, plan, mode as AIMode);
  }
}

/**
 * Main AI Execution Pipeline (April 2026 Spec)
 */
export async function executeAIEngine(
  userId: string, 
  trades: any[], 
  plan: UserPlan, 
  mode: AIMode = 'STANDARD',
  userBudget: number = 5
): Promise<AIAnalysisResult> {
  
  // 1. Check Hard Quota (Credits)
  const hasQuota = await checkUserAIQuota(userId, plan);
  if (!hasQuota) {
    throw new Error('Quota AI épuisé pour votre forfait actuel.');
  }

  // 2. Routing Configuration
  const config = routeAI(plan, mode);
  
  try {
    // ÉTAPE 0 — Pré-analyse DeepSeek (Optionnelle si solde insuffisant)
    console.log(`[PIPELINE] Étape 0: Pré-analyse...`);
    let preAnalysis = null;
    try {
      preAnalysis = await preAnalyzeWithDeepSeek(trades);
    } catch (e) {
      console.warn(`[PIPELINE] Échec Pré-analyse DeepSeek (probable manque de solde):`, e);
      preAnalysis = { summary: "Pré-analyse indisponible (fallback actif)." };
    }

    // ÉTAPE 1 — Décision Centrale avec Fallback Orchestrateur
    console.log(`[PIPELINE] Étape 1: Décision centrale...`);
    
    // Preliminary scores calculation logic (can be simplistic as LLM will refine)
    const mockRisk = 75;
    const mockDisc = 80;
    const mockCons = 65;

    const unifiedPrompt = UNIFIED_ANALYSIS_PROMPT(trades, preAnalysis, mockRisk, mockDisc, mockCons);
    
    const analysis = await callWithFallback(
      unifiedPrompt,
      trades,
      preAnalysis,
      userId,
      plan,
      userBudget
    );

    // ÉTAPE 2 — Validation du JSON
    console.log(`[PIPELINE] Étape 2: Validation...`);
    let validated = validateAIOutput(analysis);

    // ÉTAPE 3 — Rapport Premium (Zoya Premium + Mode DETAILED)
    if (config.premiumReportProvider === 'deepseek' && (mode === 'DETAILED' || plan === 'Zoya Premium')) {
      try {
        console.log(`[PIPELINE] Étape 3: Génération rapport premium...`);
        const report = await generatePremiumReport(trades, validated);
        validated.premiumReport = report;
      } catch (e) {
        console.warn(`[PIPELINE] Échec Rapport Premium DeepSeek:`, e);
      }
    }

    // Décrémenter le quota après succès
    await decrementQuota(userId);

    return validated;

  } catch (error: any) {
    console.error('[PIPELINE] Échec critique:', error);
    // Return a safe fallback UI state instead of crashing completely if possible
    const fallback = getFallbackAnalysis();
    fallback.global_recommendation = "L'analyse a rencontré un problème technique. Voici un résumé de sécurité.";
    return fallback;
  }
}
