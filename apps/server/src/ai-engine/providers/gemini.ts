import { GoogleGenAI } from '@google/genai';
import { GEMINI_DECISION_PROMPT } from '../prompts';

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Gemini Provider (Step 2: Core Decision Engine)
 */
export async function analyzeWithGemini(trades: any[], deepSeekOutput: any) {
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const prompt = `
    ${GEMINI_DECISION_PROMPT}

    DEEPSEEK SUMMARY:
    ${JSON.stringify(deepSeekOutput)}
    
    TRADES:
    ${JSON.stringify(trades)}
  `;

  try {
    const model = 'models/gemini-3-flash-preview';
    console.log(`[AI ENGINE] Calling Gemini with model: ${model}`);
    const response = await client.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are the ZoyaEdge Core Decision Engine, a strict trading risk auditor.",
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA Gemini");
    
    return JSON.parse(text.trim());
  } catch (error) {
    console.error('Gemini Error:', error);
    throw error;
  }
}
