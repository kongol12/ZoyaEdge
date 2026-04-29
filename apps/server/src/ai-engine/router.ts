import { UserPlan } from './types';

export type AIMode = 'CONCISE' | 'STANDARD' | 'DETAILED';

export interface AIRoutingConfig {
  useDeepSeek: boolean;
  useGemini: boolean;
  useGPT: boolean;
}

/**
 * Intelligent Router for AI Tasks
 * Determines which providers to use based on plan and mode
 */
export function routeAI(plan: UserPlan, mode: AIMode = 'STANDARD'): AIRoutingConfig {
  const config: AIRoutingConfig = {
    useDeepSeek: true, // DeepSeek always used for pre-analysis/reduction
    useGemini: false,
    useGPT: false
  };

  // Logic based on User Plan
  if (plan === 'Zoya PRO' || plan === 'Zoya PREMIUM') {
    config.useGemini = true;
  }

  if (plan === 'Zoya PREMIUM') {
    config.useGPT = true;
  }

  // Override logic based on Mode
  if (mode === 'CONCISE') {
    config.useGPT = false; 
  } else if (mode === 'DETAILED') {
    config.useDeepSeek = true;
    config.useGemini = true;
    config.useGPT = true;
  }

  return config;
}
