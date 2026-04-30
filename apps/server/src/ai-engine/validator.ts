import { AIAnalysisResult } from './types';

/**
 * Validates the AI Analysis Result
 */
export function validateAIOutput(data: any): AIAnalysisResult {
  return {
    summary: {
      total_pnl: data?.summary?.total_pnl || 0,
      winrate: data?.summary?.winrate || 0,
    },
    scores: {
      risk_score: data?.scores?.risk_score || 50,
      discipline_score: data?.scores?.discipline_score || 50,
      consistency_score: data?.scores?.consistency_score || 50,
    },
    alerts: Array.isArray(data?.alerts) ? data.alerts : [],
    actions: Array.isArray(data?.actions) ? data.actions : [],
    coach_decision: {
      status: ['green', 'orange', 'red'].includes(data?.coach_decision?.status) ? data.coach_decision.status : 'orange',
      action: ['continue', 'reduce_risk', 'stop_trading'].includes(data?.coach_decision?.action) ? data.coach_decision.action : 'reduce_risk',
    }
  };
}

export function getFallbackAnalysis(): AIAnalysisResult {
  return {
    summary: { total_pnl: 0, winrate: 0 },
    scores: { risk_score: 50, discipline_score: 50, consistency_score: 50 },
    alerts: [{ type: 'risk', severity: 'medium', message: 'Analyse temporairement indisponible' }],
    actions: [{ priority: 1, action: 'Réduisez vos positions', reason: 'Système indisponible' }],
    coach_decision: { status: 'orange', action: 'reduce_risk' }
  };
}
