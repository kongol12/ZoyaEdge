import axios from 'axios';
import { AIProviderResult } from '../types';

export class DeepSeekProvider {
  private apiKey: string;
  private endpoint = 'https://api.deepseek.com/chat/completions';

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
  }

  async analyze(prompt: string, data: any): Promise<AIProviderResult> {
    if (!this.apiKey) {
      console.warn("[DeepSeek] API Key missing, returning fallback mock");
      return {
        raw: "Résumé : Activité normale, PnL maitrisé. Patterns : Aucun overtrading majeur détecté.",
        tokensUsed: 150,
        estimatedCost: 0.0001
      };
    }

    try {
      const response = await axios.post(
        this.endpoint,
        {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: JSON.stringify(data) }
          ],
          temperature: 0.1,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        raw: response.data.choices[0].message.content,
        tokensUsed: response.data.usage?.total_tokens || 0,
        estimatedCost: (response.data.usage?.total_tokens || 0) * 0.000002 // Roughly 0.002$ per 1K
      };
    } catch (error: any) {
      console.error("[DeepSeek Error]:", error.response?.data || error.message);
      throw new Error("DeepSeek provider failed");
    }
  }
}
