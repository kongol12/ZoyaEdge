import { UserPlan } from './types';

export type AIMode = 'CONCISE' | 'STANDARD' | 'DETAILED';

export interface AIRoutingConfig {
  useDeepSeekPreAnalysis: boolean;
  useGemini31Pro: boolean;
  useGemini3Flash: boolean;
  premiumReportProvider: 'deepseek' | null;
}

/**
 * Intelligent Router for AI Tasks (April 2026 Spec)
 */
export function routeAI(plan: UserPlan, mode: AIMode = 'STANDARD'): AIRoutingConfig {
  const config: AIRoutingConfig = {
    useDeepSeekPreAnalysis: true, // Always active for Étape 0
    useGemini31Pro: false,
    useGemini3Flash: true,
    premiumReportProvider: null
  };

  if (plan === 'Zoya Premium') {
    config.useGemini31Pro = true; // Attempt paid reasoning model
    config.premiumReportProvider = 'deepseek'; // DeepSeek V4 for report
  }

  // Adjustments based on mode
  if (mode === 'DETAILED' && plan === 'Zoya Pro') {
    // Pro users can get detailed mode with fallback models
    config.useGemini3Flash = true;
  }

  return config;
}
