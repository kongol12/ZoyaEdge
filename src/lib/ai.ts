import { Trade, Strategy } from './db';
import { GoogleGenAI, Type } from "@google/genai";

export type AICoachResponse = {
  summary: {
    total_pnl: number;
    winrate: number;
  };
  scores: {
    risk_score: number;
    discipline_score: number;
    consistency_score: number;
  };
  alerts: {
    type: string;
    severity: string;
    message: string;
  }[];
  actions: {
    priority: number;
    action: string;
    reason: string;
  }[];
  coach_decision: {
    status: "green" | "orange" | "red";
    action: "continue" | "reduce_risk" | "stop_trading";
  };
};

export const askAICoach = async (trades: Trade[], language: 'fr' | 'en' = 'en', strategies: Strategy[] = []): Promise<AICoachResponse> => {
  // 1. Fetch system instructions from backend
  const instructionsResponse = await fetch("/api/config/coach-instructions");
  if (!instructionsResponse.ok) {
    throw new Error("Failed to fetch coach instructions");
  }
  const { instruction } = await instructionsResponse.json();

  // 2. Format trades
  const formattedTrades = trades.slice(-50).map(t => ({ // Limit to last 50 trades to save tokens/quota
    pair: t.pair,
    direction: t.direction,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    lotSize: t.lotSize,
    pnl: t.pnl,
    strategy: t.strategy,
    emotion: t.emotion,
    session: t.session,
    date: t.date.toISOString(),
  }));

  // 3. Initialize Gemini on frontend
  const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });

  const prompt = `
Analyze this trading dataset and return structured output only.
IMPORTANT: All text fields (message, action, reason, next_focus) MUST be in ${language === 'fr' ? 'French (Français)' : 'English'}.

USER STRATEGY DEFINITIONS:
${strategies.length > 0 ? JSON.stringify(strategies) : "No custom strategies defined. Use default trading knowledge."}

DATA:
${JSON.stringify(formattedTrades)}

MODE:
HYBRID

STRICT OUTPUT FORMAT REQUIRED:
JSON ONLY
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Use flash for better rate limits and speed
      contents: prompt,
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.OBJECT,
              properties: {
                total_pnl: { type: Type.NUMBER },
                winrate: { type: Type.NUMBER }
              },
              required: ["total_pnl", "winrate"]
            },
            scores: {
              type: Type.OBJECT,
              properties: {
                risk_score: { type: Type.NUMBER },
                discipline_score: { type: Type.NUMBER },
                consistency_score: { type: Type.NUMBER }
              },
              required: ["risk_score", "discipline_score", "consistency_score"]
            },
            alerts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  message: { type: Type.STRING }
                },
                required: ["type", "severity", "message"]
              }
            },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  priority: { type: Type.NUMBER },
                  action: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ["priority", "action", "reason"]
              }
            },
            coach_decision: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                action: { type: Type.STRING }
              },
              required: ["status", "action"]
            }
          },
          required: ["summary", "scores", "alerts", "actions", "coach_decision"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    const result = JSON.parse(text.replace(/```json\n?|```/g, '').trim());
    
    return result;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Check for quota error
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("QUOTA_EXCEEDED: You have reached the AI usage limit. Please try again in a few minutes.");
    }
    
    throw new Error("Failed to get AI coach analysis. Please check your API key.");
  }
};
