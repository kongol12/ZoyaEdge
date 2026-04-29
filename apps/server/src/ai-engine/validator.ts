import { AIAnalysisResult } from './types';

/**
 * Validates the AI Analysis Result
 */
export function validateAIOutput(data: any): AIAnalysisResult {
  const result: AIAnalysisResult = {
    score: typeof data.score === 'number' ? Math.min(100, Math.max(0, data.score)) : 50,
    risk: typeof data.risk === 'number' ? Math.min(100, Math.max(0, data.risk)) : 50,
    discipline: typeof data.discipline === 'number' ? Math.min(100, Math.max(0, data.discipline)) : 50,
    consistency: typeof data.consistency === 'number' ? Math.min(100, Math.max(0, data.consistency)) : 50,
    decision: ['STOP', 'REDUCE', 'GO'].includes(data.decision) ? data.decision : 'REDUCE',
    keyIssues: Array.isArray(data.keyIssues) ? data.keyIssues : [],
    actions: Array.isArray(data.actions) ? data.actions : []
  };

  if (result.actions.length === 0) {
    result.actions = ["Consultez votre journal de trading pour identifier vos erreurs."];
  }

  return result;
}

/**
 * Fallback mechanism if AI fails
 */
export function getFallbackAnalysis(): AIAnalysisResult {
  return {
    score: 0,
    risk: 100,
    discipline: 0,
    consistency: 0,
    decision: 'STOP',
    keyIssues: ["Analyse IA indisponible pour le moment."],
    actions: ["Réduisez vos positions", "Vérifiez vos paramètres de compte"]
  };
}
