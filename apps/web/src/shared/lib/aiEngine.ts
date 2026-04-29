import { auth } from './firebase';

export interface AIReport {
  score: number;
  status: "Beginner" | "Intermediate" | "Advanced" | "Elite";
  alerts: string[];
  strengths: string[];
  weaknesses: string[];
  actions: string[];
}

export async function runZoyaAIAnalysis(statsPayload: string): Promise<AIReport> {
  try {
    const token = await auth.currentUser?.getIdToken();
    
    const response = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        trades: [], 
        language: 'fr',
        strategies: [],
        instruction: `Analyze this trading data and return JSON: ${statsPayload}`
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to analyze trading data.");
    }

    return await response.json() as AIReport;
  } catch (error: any) {
    console.error("AI Analysis failed:", error);
    throw new Error(error.message || "Failed to analyze trading data.");
  }
}
