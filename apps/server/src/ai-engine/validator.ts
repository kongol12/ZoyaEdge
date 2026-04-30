import { AIAnalysisResult } from './types';

/**
 * Validates the AI Analysis Result
 */
export function validateAIOutput(data: any): AIAnalysisResult {
  return {
    summary: {
      total_pnl: data?.summary?.total_pnl ?? 0,
      winrate: data?.summary?.winrate ?? 0,
      avg_win: data?.summary?.avg_win ?? 0,
      avg_loss: data?.summary?.avg_loss ?? 0,
      largest_win: data?.summary?.largest_win ?? 0,
      largest_loss: data?.summary?.largest_loss ?? 0,
    },
    scores: {
      risk_score: data?.scores?.risk_score ?? 50,
      discipline_score: data?.scores?.discipline_score ?? 50,
      consistency_score: data?.scores?.consistency_score ?? 50,
    },
    metric_analysis: {
      risk: { 
        comment: data?.metric_analysis?.risk?.comment || "Analyse en attente...", 
        recommendation: data?.metric_analysis?.risk?.recommendation || "Appliquez votre stop-loss." 
      },
      discipline: { 
        comment: data?.metric_analysis?.discipline?.comment || "Analyse en attente...", 
        recommendation: data?.metric_analysis?.discipline?.recommendation || "Suivez votre routine." 
      },
      consistency: { 
        comment: data?.metric_analysis?.consistency?.comment || "Analyse en attente...", 
        recommendation: data?.metric_analysis?.consistency?.recommendation || "Soyez régulier." 
      },
    },
    global_recommendation: data?.global_recommendation || "Poursuivez vos efforts.",
    alerts: Array.isArray(data?.alerts) ? data.alerts : [],
    actions: Array.isArray(data?.actions) ? data.actions : [],
    coach_decision: {
      status: ['green', 'orange', 'red'].includes(data?.coach_decision?.status) ? data.coach_decision.status : 'orange',
      action: ['continue', 'reduce_risk', 'stop_trading'].includes(data?.coach_decision?.action) ? data.coach_decision.action : 'reduce_risk',
    },
    premiumReport: data?.premiumReport
  };
}

export function getFallbackAnalysis(): AIAnalysisResult {
  return {
    summary: { total_pnl: 0, winrate: 0, avg_win: 0, avg_loss: 0, largest_win: 0, largest_loss: 0 },
    scores: { risk_score: 50, discipline_score: 50, consistency_score: 50 },
    metric_analysis: {
      risk: { comment: "Données indisponibles", recommendation: "Prudence" },
      discipline: { comment: "Données indisponibles", recommendation: "Prudence" },
      consistency: { comment: "Données indisponibles", recommendation: "Prudence" },
    },
    global_recommendation: "Service d'analyse temporairement indisponible.",
    alerts: [{ type: 'risk', severity: 'medium', message: 'Calcul en cours...' }],
    actions: [{ priority: 1, action: 'Attendre validation', reason: 'Système indisponible' }],
    coach_decision: { status: 'orange', action: 'reduce_risk' }
  };
}
