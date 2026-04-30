import OpenAI from 'openai';
import { safeJSONParse } from '../utils';

const apiKey = process.env.DEEPSEEK_API_KEY;
const client = apiKey ? new OpenAI({
  apiKey,
  baseURL: 'https://api.deepseek.com/v1', // Updated base URL
}) : null;

const MODEL = 'deepseek-v4-flash'; // Optimized April 2026 model

/**
 * CORE LLM Call
 */
export async function callDeepSeek(prompt: string, jsonMode: boolean = false): Promise<string> {
  if (!client) throw new Error('DEEPSEEK_API_KEY non configuré');
  
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: jsonMode ? { type: 'json_object' } : undefined,
    temperature: 0.3
  });
  return response.choices[0].message.content || '';
}

/**
 * Étape 0 – Pré‑analyse (toujours active)
 */
export async function preAnalyzeWithDeepSeek(trades: any[]): Promise<any> {
  const prompt = `Analyse ces trades et retourne un JSON strict:
{
  "overtrading_detected": boolean,
  "emotional_pattern": "calme|impulsif|frustré",
  "max_consecutive_losses": number,
  "risk_reward_consistency": "faible|moyen|élevé",
  "summary": "phrase résumant la session"
}
Trades: ${JSON.stringify(trades)}`;
  
  const result = await callDeepSeek(prompt, true);
  return safeJSONParse(result);
}

/**
 * Legacy wrapper
 */
export async function analyzeWithDeepSeek(trades: any[]) {
  return preAnalyzeWithDeepSeek(trades);
}

/**
 * Décision de secours (quand Gemini échoue)
 */
export async function deepSeekDecision(trades: any[], preAnalysis: any): Promise<any> {
  const { UNIFIED_ANALYSIS_PROMPT } = await import('../prompts');
  // Baseline scores for prompt structure
  const risk = 70;
  const disc = 70;
  const cons = 70;
  
  const prompt = UNIFIED_ANALYSIS_PROMPT(trades, preAnalysis, risk, disc, cons);
  const result = await callDeepSeek(prompt, true);
  return safeJSONParse(result);
}

/**
 * Rapport premium (remplace GPT)
 */
export async function generatePremiumReport(trades: any[], analysis: any): Promise<string> {
  const prompt = `Génère un rapport de trading personnalisé en français (style professionnel, fluide). Utilise ces données :
- Trades : ${JSON.stringify(trades)}
- Scores : ${JSON.stringify(analysis.scores)}
- Analyse détaillée : ${JSON.stringify(analysis.metric_analysis)}
- Décision : ${JSON.stringify(analysis.coach_decision)}

Structure : intro (bilan global), analyse risque, discipline, constance, conclusion avec 3 actions prioritaires. Maximum 600 tokens.`;
  
  return callDeepSeek(prompt, false);
}

/**
 * Legacy Support
 */
export async function analyzeCoreWithDeepSeek(trades: any[], deepSeekOutput: any) {
  return deepSeekDecision(trades, deepSeekOutput);
}
