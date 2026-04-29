import OpenAI from 'openai';
import { DEEPSEEK_PRE_ANALYSIS_PROMPT } from '../prompts';

const apiKey = process.env.DEEPSEEK_API_KEY;
const client = apiKey ? new OpenAI({
  apiKey,
  baseURL: 'https://api.deepseek.com',
}) : null;

/**
 * DeepSeek Provider (Step 1: Pre-analysis & Data Reduction)
 */
export async function analyzeWithDeepSeek(trades: any[]) {
  if (!client) {
    console.warn('DeepSeek API Key missing, skipping pre-analysis');
    return {
      patterns: [],
      anomalies: [],
      dataReduction: "No pre-analysis available.",
      rawStats: {}
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: DEEPSEEK_PRE_ANALYSIS_PROMPT
        },
        {
          role: 'user',
          content: `Analyze these trades: ${JSON.stringify(trades)}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    const result = JSON.parse(content);

    return {
      patterns: result.patterns || [],
      anomalies: result.anomalies || [],
      dataReduction: result.summary || "Summary generated.",
      usage: response.usage
    };
  } catch (error) {
    console.error('DeepSeek Error:', error);
    throw error;
  }
}
