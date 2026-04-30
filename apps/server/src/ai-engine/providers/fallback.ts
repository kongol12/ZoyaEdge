import { callGemini, GEMINI_MODELS } from './gemini';
import { deepSeekDecision } from './deepseek';
import { checkBudgetAndFallback, trackCost } from '../cost-tracker';
import { safeJSONParse } from '../utils';

/**
 * Orchestrateur de Fallback (Étape 1 du Pipeline)
 */
export async function callWithFallback(
  prompt: string,
  trades: any[],
  preAnalysis: any,
  userId: string,
  userPlan: string,
  userBudget?: number
): Promise<any> {
  // 1. Vérifier le budget pour Gemini 3.1 Pro (via helper cost-tracker)
  const budgetStatus = checkBudgetAndFallback(userId, userPlan, userBudget);
  
  if (budgetStatus === 'blocked') {
    throw new Error('Budget ou quota épuisé. Aucune ressource IA disponible.');
  }

  // 2. TENTATIVE A: Gemini 1.5 Pro (si Premium et budget OK)
  if (userPlan === 'Zoya Premium' && budgetStatus !== 'free_fallback') {
    try {
      console.log(`[FALLBACK] Tentative avec Gemini 1.5 Pro pour l'utilisateur ${userId}`);
      const result = await callGemini(GEMINI_MODELS.PRO_1_5, prompt);
      
      // Tracer le coût (estimation)
      await trackCost(userId, 'gemini-1.5-pro', prompt.length + result.length);
      
      return safeJSONParse(result);
    } catch (error: any) {
      console.warn(`[FALLBACK] Échec Gemini 1.5 Pro: ${error.message}. Bascule vers Flash.`);
    }
  }

  // 3. TENTATIVE B: Gemini 1.5 Flash (Gratuit)
  try {
    console.log(`[FALLBACK] Tentative avec Gemini 1.5 Flash pour l'utilisateur ${userId}`);
    const result = await callGemini(GEMINI_MODELS.FLASH_1_5, prompt);
    
    // Tracer l'utilisation (même si gratuit, pour quotas internes)
    await trackCost(userId, 'gemini-1.5-flash', prompt.length + result.length);
    
    return safeJSONParse(result);
  } catch (error: any) {
    console.warn(`[FALLBACK] Échec Gemini 1.5 Flash: ${error.message}. Bascule vers DeepSeek.`);
  }

  // 4. TENTATIVE C (Ultime recours): DeepSeek V4 Flash (Payant mais très économique)
  try {
    console.log(`[FALLBACK] Tentative ultime avec DeepSeek V4 Flash pour l'utilisateur ${userId}`);
    const result = await deepSeekDecision(trades, preAnalysis);
    
    await trackCost(userId, 'deepseek-v4-flash', prompt.length);
    
    return result;
  } catch (error: any) {
    console.error(`[FALLBACK] Échec critique DeepSeek: ${error.message}`);
    throw new Error('Service d\'analyse IA temporairement indisponible (Tous les modèles ont échoué).');
  }
}
