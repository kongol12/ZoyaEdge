import axios from 'axios';
import { AIProviderResult } from '../types';

export class GPTProvider {
  private apiKey: string;
  private endpoint = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
  }

  async generateReport(prompt: string, data: any): Promise<AIProviderResult> {
    if (!this.apiKey) {
      console.warn("[GPT] API Key missing, returning fallback mock");
      const mockResult = {
        overview: "Compte très performant",
        risk_analysis: "Bonne gestion du risque observée",
        discipline_analysis: "Excellente discipline",
        performance_analysis: "Croissance stable",
        action_plan: ["Maintenir cette stratégie", "Ne pas augmenter le levier"]
      };
      return {
        raw: JSON.stringify(mockResult),
        parsed: mockResult,
        tokensUsed: 400,
        estimatedCost: 0.001
      };
    }

    try {
      const response = await axios.post(
        this.endpoint,
        {
          model: "gpt-4o-mini", // Cost optimization
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: JSON.stringify(data) }
          ],
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const raw = response.data.choices[0].message.content;
      
      let parsed = {};
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.error("[GPT] JSON Parse Error on output:", raw);
      }

      return {
        raw,
        parsed,
        tokensUsed: response.data.usage?.total_tokens || 0,
        estimatedCost: (response.data.usage?.total_tokens || 0) * 0.000003
      };
    } catch (error: any) {
      console.error("[GPT Error]:", error.response?.data || error.message);
      throw new Error("GPT provider failed");
    }
  }
}
