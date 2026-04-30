import { GoogleGenAI } from '@google/genai';

// Modèles supportés (juin 2024 - Gemini 1.5 Pro & Flash)
export const GEMINI_MODELS = {
  PRO_1_5: 'gemini-1.5-pro',   // Modèle Reasoning Premium
  FLASH_1_5: 'gemini-1.5-flash' // Modèle Flash Gratuit
} as const;

type GeminiModel = typeof GEMINI_MODELS[keyof typeof GEMINI_MODELS];

// Clés API distinctes avec repli sur la clé principale
const getApiKey = (model: GeminiModel) => {
  if (model === GEMINI_MODELS.PRO_1_5) {
    return process.env.GEMINI_API_KEY_PAID || process.env.GEMINI_API_KEY;
  }
  return process.env.GEMINI_API_KEY_FREE || process.env.GEMINI_API_KEY;
};

export async function callGemini(
  modelName: string,
  prompt: string
): Promise<string> {
  const apiKey = getApiKey(modelName as GeminiModel);
  if (!apiKey) throw new Error(`Clé API manquante pour Gemini (${modelName})`);

  const genAI = new GoogleGenAI(apiKey);
  const modelId = modelName.startsWith('models/') ? modelName : modelName;

  try {
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const response = await result.response;
    const text = response.text;
    if (!text) {
      console.error(`[GEMINI] Réponse vide de ${modelName}. Response object:`, response);
      throw new Error(`Réponse vide reçue de ${modelName}`);
    }

    return text;
  } catch (error: any) {
    console.error(`[GEMINI] Erreur sur ${modelName}:`, error);
    // Gestion spécifique des erreurs de quota
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      throw new Error(`QUOTA_EXCEEDED: ${modelName}`);
    }
    throw error;
  }
}

/**
 * Legacy wrapper pour compatibilité ascendante
 */
export async function analyzeWithGemini(trades: any[], deepSeekOutput: any) {
  const { UNIFIED_ANALYSIS_PROMPT } = await import('../prompts');
  const prompt = UNIFIED_ANALYSIS_PROMPT(trades, deepSeekOutput, 70, 70, 70);
  const result = await callGemini(GEMINI_MODELS.FLASH_1_5, prompt);
  return JSON.parse(result);
}
