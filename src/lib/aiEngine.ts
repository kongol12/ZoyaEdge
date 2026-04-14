import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });

export interface AIReport {
  score: number;
  status: "Beginner" | "Intermediate" | "Advanced" | "Elite";
  alerts: string[];
  strengths: string[];
  weaknesses: string[];
  actions: string[];
}

export async function runZoyaAIAnalysis(statsPayload: string): Promise<AIReport> {
  const prompt = `
  You are a trading performance analysis engine.

  INPUT DATA:
  ${statsPayload}

  TASK:
  1. Evaluate performance quality (score 0–100)
  2. Detect critical risks
  3. Identify behavioral weaknesses
  4. Recommend 3 precise actions

  OUTPUT FORMAT (STRICT JSON ONLY):
  {
    "score": number,
    "status": "Beginner | Intermediate | Advanced | Elite",
    "alerts": [string],
    "strengths": [string],
    "weaknesses": [string],
    "actions": [string]
  }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text) as AIReport;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw new Error("Failed to analyze trading data.");
  }
}
