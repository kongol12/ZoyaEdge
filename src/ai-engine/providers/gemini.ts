import { GoogleGenAI } from '@google/genai';
import { AIProviderResult } from '../types';

export class GeminiProvider {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      this.ai = new GoogleGenAI({ apiKey: key });
    } else {
      console.warn("[Gemini] API Key missing. Ensure GEMINI_API_KEY is set in .env");
    }
  }

  async makeDecision(prompt: string, data: any): Promise<AIProviderResult> {
    if (!this.ai) {
      console.warn("[Gemini] Fallback mock decision due to missing key");
      return {
        raw: JSON.stringify({
          score: 85, risk: 80, discipline: 90, consistency: 85,
          decision: "GO", keyIssues: [], actions: ["Continuer"]
        }),
        tokensUsed: 200,
        estimatedCost: 0.0005
      };
    }

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${prompt}\n\nDonnées:\n${typeof data === 'string' ? data : JSON.stringify(data)}`,
        config: {
          temperature: 0, // Strict for analytical tasks
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "{}";
      
      let parsed = {};
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        console.error("[Gemini] JSON Parse Error on output:", text);
      }

      return {
        raw: text,
        parsed,
        tokensUsed: 300, // GoogleGenAI via vertex might return this in metadata, approximate it for now
        estimatedCost: 0.0003
      };
    } catch (error: any) {
      console.error("[Gemini Error]:", error.message);
      throw new Error("Gemini provider failed");
    }
  }
}
