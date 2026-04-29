import { GoogleGenAI } from '@google/genai';
import { getDb } from '../../infrastructure/firebase/firebase.client';
import admin from 'firebase-admin';
import crypto from 'crypto';
import { logSystemActivity, logSystemEvent } from '../../infrastructure/logger/logger';
// Ideally AIPipeline is converted or moved. For now, since the monolith is being dismantled,
// we just point to the original or move its content later. If we need to move it, we will.
// But the AI Pipeline class is big, let's keep it imported from `../../../../../src/ai-engine/pipeline`
// or we can migrate it to `apps/server/src/modules/ai/pipeline.ts`.
import { AIPipeline } from '../../ai-engine/pipeline';

import { analyzeWithDeepSeek } from '../../ai-engine/providers/deepseek';

const AI_LIMITS = {
  free: 3,
  pro: 30,
  premium: 9999
};

export const getQuotaForSubscription = (subscription: string): number => {
  if (subscription === 'premium') return 9999;
  if (subscription === 'pro') return 30;
  return 3;
};

const getGeminiModel = (mode: string, subscription: string): string => {
  if (subscription === 'premium') return 'models/gemini-3.1-pro-preview';
  if (mode === 'DETAILED') return 'models/gemini-3.1-pro-preview';
  return 'models/gemini-3-flash-preview';
};

const getMaxTokens = (mode: string): number => {
  if (mode === 'CONCISE') return 300;
  if (mode === 'STANDARD') return 700;
  return 1000;
};

const getTradeLimit = (mode: string): number => {
  if (mode === 'CONCISE') return 20;
  if (mode === 'STANDARD') return 50;
  return 100;
};

const hashTradesData = (trades: any[]) => {
  const str = JSON.stringify(trades);
  return crypto.createHash('md5').update(str).digest('hex');
};

const getAICache = async (userId: string, hash: string, db: admin.firestore.Firestore) => {
  try {
    const doc = await db.collection('ai_cache').doc(`${userId}_${hash}`).get();
    if (doc.exists) {
      const data = doc.data()!;
      // Expire after 2 hours
      if (Date.now() - data.timestamp < 2 * 60 * 60 * 1000) {
        return data.response;
      }
    }
  } catch (e) {
    console.error('Cache read failed:', e);
  }
  return null;
};

const setAICache = async (userId: string, hash: string, response: any, db: admin.firestore.Firestore) => {
  try {
    await db.collection('ai_cache').doc(`${userId}_${hash}`).set({
      timestamp: Date.now(),
      response
    });
  } catch (e) {
    console.error('Cache write failed:', e);
  }
};

const checkAndDeductAICredit = async (
  userId: string,
  db: admin.firestore.Firestore,
  mode: string = 'STANDARD'
): Promise<{ allowed: boolean; reason?: string; remaining?: number; limit?: number }> => {
  const userRef = db.collection('users').doc(userId);
  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return { allowed: false, reason: "User not found" };
    const userData = userDoc.data()!;
    const subscription = userData.subscription || 'free';
    const limit = getQuotaForSubscription(subscription);

    if (mode === 'DETAILED' && subscription !== 'premium') {
      return {
        allowed: false,
        reason: "L'analyse DETAILED est réservée au plan Premium. Passez à Premium pour y accéder.",
        remaining: userData.aiCredits ?? 0,
        limit
      };
    }

    if (subscription === 'premium') return { allowed: true, remaining: 9999, limit: 9999 };

    const credits = userData.aiCredits ?? 0;
    if (credits <= 0) {
      const planLabel = subscription === 'pro' ? 'Premium' : 'Pro';
      return {
        allowed: false,
        reason: `Vous avez atteint votre limite d'analyses IA ce mois-ci (${limit} analyses). Passez à ${planLabel} pour continuer.`,
        remaining: 0,
        limit
      };
    }
    transaction.update(userRef, {
      aiCredits: admin.firestore.FieldValue.increment(-1)
    });
    return { allowed: true, remaining: credits - 1, limit };
  });
};

export const handleGeminiError = (error: any) => {
  console.error("Gemini API Error details:", error);
  if (error?.message?.includes('API key not valid')) {
    return { code: 401, message: "La clé API Gemini est invalide. Veuillez la vérifier dans les paramètres de l'application." };
  }
  if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
    return { code: 429, message: "Limite de quota atteinte pour l'IA. Veuillez réessayer dans quelques minutes." };
  }
  if (error?.status === 402 || error?.code === 402) {
    return { code: 402, message: error.message };
  }
  return { code: 500, message: error.message || "Une erreur est survenue lors de l'analyse IA." };
};

let aiPipeline: AIPipeline | null = null;

export const aiService = {
  coach: async (userId: string, input: any) => {
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;

    if (!hasGemini && !hasDeepSeek) {
      throw { code: 500, message: "IA Indisponible: Clé API Gemini ou DeepSeek manquante." };
    }

    const db = getDb();
    if (!db) throw { code: 503, message: "Service de base de données indisponible" };

    const userDoc = await db.collection('users').doc(userId).get();
    const subscription = userDoc.data()?.subscription || 'free';

    const creditCheck = await checkAndDeductAICredit(userId, db, input.mode || 'STANDARD');
    if (!creditCheck.allowed) {
      throw { code: 402, message: creditCheck.reason || "Crédits IA épuisés." };
    }

    // Fallback to DeepSeek if Gemini is missing
    if (!hasGemini && hasDeepSeek) {
      console.log("[AI COACH] Gemini missing, falling back to DeepSeek...");
      const deepSeekResult = await analyzeWithDeepSeek(input.metrics || []);
      return {
        decision: deepSeekResult.patterns?.length > 5 ? "ORANGE" : "GREEN",
        score: { risk: 80, discipline: 80, consistency: 80 },
        summary: deepSeekResult.dataReduction || "Analyse DeepSeek effectuée (Gemini indisponible).",
        insights: deepSeekResult.patterns || [],
        mistakes: deepSeekResult.anomalies || [],
        recommendations: ["Configurez la clé Gemini pour une analyse complète."],
        risk_level: "LOW",
        usage: {
          remaining: creditCheck.remaining,
          limit: creditCheck.limit
        }
      };
    }

    // Multi-model: Pre-analyze with DeepSeek if available
    let deepSeekContext = "";
    if (hasDeepSeek) {
      try {
        console.log("[AI COACH] Pre-analyzing with DeepSeek...");
        const dsResult = await analyzeWithDeepSeek(input.metrics?.trades || []);
        if (dsResult.dataReduction) {
          deepSeekContext = `\nDEEPSEEK PRE-ANALYSIS:\n${dsResult.dataReduction}\nPATTERNS DETECTED BY DEEPSEEK: ${dsResult.patterns?.join(', ')}\n`;
        }
      } catch (e) {
        console.error("DeepSeek pre-analysis failed:", e);
      }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = getGeminiModel(input.mode || 'STANDARD', subscription);
    console.log(`[AI COACH] Calling Gemini with model: ${model}`);
    
    const prompt = `
You are Zoya AI Coach, a professional hedge fund risk analyst, trading performance auditor, and discipline enforcement system.
Analyze the following trading metrics and behavioral data.
${deepSeekContext}

INPUT DATA:
${JSON.stringify(input, null, 2)}

MODE: ${input.mode || 'STANDARD'}
If CONCISE: Provide 1 decision and max 3 bullet points in summary/insights.
If STANDARD: Provide structured analysis.
If DETAILED: Provide full breakdown of performance, psychology, risk, and actions.

STRICT OUTPUT FORMAT REQUIRED (JSON ONLY):
{
  "decision": "GREEN" | "ORANGE" | "RED",
  "score": {
    "risk": number (0-100),
    "discipline": number (0-100),
    "consistency": number (0-100)
  },
  "summary": "string",
  "insights": ["string"],
  "mistakes": ["string"],
  "recommendations": ["string"],
  "risk_level": "LOW" | "MEDIUM" | "HIGH"
}
`;

    const response = await ai.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are Zoya AI Coach, a professional hedge fund risk analyst and trading performance auditor.",
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA (Coach)");
    
    // SDK with responseMimeType: "application/json" should return clean JSON
    const aiAnalysis = JSON.parse(text.trim());

    if (aiAnalysis.decision === 'RED') {
      await logSystemEvent('error', 'behavioral_analysis', `Critical behavioral risk detected for user ${userId}. Condition: ${aiAnalysis.summary}`, {
        userId,
        scores: aiAnalysis.score,
        risk_level: aiAnalysis.risk_level
      });
    } else if (aiAnalysis.decision === 'ORANGE') {
      await logSystemEvent('warn', 'behavioral_analysis', `Behavioral instability for user ${userId}`, {
        userId,
        scores: aiAnalysis.score
      });
    }

    try {
      await db.collection('users').doc(userId).collection('ai_reports').add({
        date: admin.firestore.Timestamp.now(),
        mode: input.mode || 'STANDARD',
        metrics: input.metrics,
        response: aiAnalysis
      });
    } catch (saveError) {
      console.error("[AI Coach] Failed to save report:", saveError);
    }

    return {
      ...aiAnalysis,
      usage: {
        remaining: creditCheck.remaining,
        limit: creditCheck.limit
      }
    };
  },

  ask: async (userId: string, body: any) => {
    const { trades, language, strategies, instruction, mode = 'STANDARD' } = body;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;

    if (!hasGemini && !hasDeepSeek) {
      throw { code: 500, message: "IA Indisponible: Clé API Gemini ou DeepSeek manquante." };
    }

    const db = getDb();
    if (!db) throw { code: 503, message: "Service de base de données indisponible" };

    const userDoc = await db.collection('users').doc(userId).get();
    const subscription = userDoc.data()?.subscription || 'free';

    const tradeLimit = getTradeLimit(mode);
    const tradesToAnalyze = (trades || []).slice(-tradeLimit);
    const tradesHash = hashTradesData(tradesToAnalyze);
    const cached = await getAICache(userId, tradesHash, db);
    if (cached) return { ...cached, fromCache: true };

    const creditCheck = await checkAndDeductAICredit(userId, db, mode);
    if (!creditCheck.allowed) {
      throw { code: 402, message: creditCheck.reason };
    }

    // Fallback to DeepSeek
    if (!hasGemini && hasDeepSeek) {
      console.log("[AI ASK] Gemini missing, falling back to DeepSeek...");
      const result = await analyzeWithDeepSeek(tradesToAnalyze);
      return {
        summary: result.dataReduction || "Analyse effectuée via DeepSeek.",
        actions: result.patterns?.map((p: string) => ({ priority: 1, action: p, reason: "Detected pattern" })) || [],
        coach_decision: { status: "orange", action: "reduce_risk" },
        usage: { remaining: creditCheck.remaining, limit: creditCheck.limit }
      };
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = getGeminiModel(mode, subscription);
    console.log(`[AI ASK] Calling Gemini with model: ${model}`);

    const prompt = `
Analyze this trading dataset and return structured output only.
IMPORTANT: All text fields MUST be in ${language === 'fr' ? 'French (Français)' : 'English'}.
MODE: ${mode}
${mode === 'CONCISE' ? 'CONCISE: Return only coach_decision, 1 summary sentence, max 3 actions.' : ''}
${mode === 'DETAILED' ? 'DETAILED: Full breakdown — performance, psychology, risk, behavioral patterns, strategic recommendations.' : ''}

USER STRATEGIES:
${strategies?.length > 0 ? JSON.stringify(strategies) : "No custom strategies."}

TRADES DATA (last ${tradeLimit}):
${JSON.stringify(tradesToAnalyze)}

STRICT JSON OUTPUT ONLY:
`;

    const response = await ai.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: instruction || "You are a professional trading AI assistant.",
        responseMimeType: "application/json",
        maxOutputTokens: getMaxTokens(mode),
      }
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA (Ask)");
    const result = JSON.parse(text.trim());

    await setAICache(userId, tradesHash, result, db);

    return {
      ...result,
      usage: {
        remaining: creditCheck.remaining,
        limit: creditCheck.limit
      }
    };
  },

  orchestrate: async (userId: string, body: any) => {
    const db = getDb();
    if (!db) throw { code: 503, message: "Service de base de données indisponible" };
    if (!aiPipeline) aiPipeline = new AIPipeline(db);

    const { trades, mode = 'STANDARD' } = body;
    const userDoc = await db.collection('users').doc(userId).get();
    const subscription = userDoc.data()?.subscription || 'free';

    const creditCheck = await checkAndDeductAICredit(userId, db, mode);
    if (!creditCheck.allowed) {
      throw { code: 402, message: creditCheck.reason };
    }

    const result = await aiPipeline.execute(userId, subscription, mode, trades);
    return {
      ...result,
      usage: {
        remaining: creditCheck.remaining,
        limit: creditCheck.limit
      }
    };
  }
};
