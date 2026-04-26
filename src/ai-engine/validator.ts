import { AIAnalysisResult } from './types';

export function validateDecision(data: any): AIAnalysisResult {
  const result: Partial<AIAnalysisResult> = {};

  // Score validation
  result.score = validateScore(data?.score);
  result.risk = validateScore(data?.risk);
  result.discipline = validateScore(data?.discipline);
  result.consistency = validateScore(data?.consistency);

  // Decision validation
  const validDecisions = ["STOP", "REDUCE", "GO"];
  if (validDecisions.includes(data?.decision)) {
    result.decision = data.decision;
  } else {
    // Fallback if AI hallucinates logic
    result.decision = result.score! >= 75 ? "GO" : (result.score! >= 50 ? "REDUCE" : "STOP");
  }

  result.keyIssues = Array.isArray(data?.keyIssues) ? data.keyIssues : ["Données insuffisantes"];
  result.actions = Array.isArray(data?.actions) && data.actions.length > 0 
    ? data.actions 
    : ["Revoir la stratégie de trading"];

  return result as AIAnalysisResult;
}

function validateScore(val: any): number {
  const num = Number(val);
  if (isNaN(num)) return 50; // default middle
  if (num < 0) return 0;
  if (num > 100) return 100;
  return num;
}
