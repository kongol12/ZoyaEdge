import OpenAI from 'openai';
import { GPT_REPORT_PROMPT } from '../prompts';

const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * GPT Provider (Step 3: Human-Readable Premium Report)
 */
export async function generateReportWithGPT(geminiOutput: any, deepSeekOutput: any) {
  if (!client) {
    console.warn('OPENAI_API_KEY missing, skipping premium report');
    return null;
  }

  const prompt = `
    ${GPT_REPORT_PROMPT}

    DECISION DATA:
    ${JSON.stringify(geminiOutput)}
    
    PATTERNS DETECTED:
    ${JSON.stringify(deepSeekOutput)}
  `;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    return JSON.parse(content);
  } catch (error) {
    console.error('GPT Error:', error);
    return null;
  }
}
