export interface AICoachInput {
  winrate: number;
  profitFactor: number;
  rrAvg: number;
  drawdown: number;
  expectancy: number;
  equityTrend: string;
  streaks: { winStreak: number; lossStreak: number };
}

export interface AICoachOutput {
  score: {
    risk: number;
    discipline: number;
    consistency: number;
  };
  decision: "GREEN" | "ORANGE" | "RED";
  insights: string[];
  actions: string[];
}

export async function getAICoachDecision(input: AICoachInput): Promise<AICoachOutput> {
  try {
    const response = await fetch('/api/ai/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        input: {
          ...input,
          mode: 'CONCISE' // Use concise mode for the quick decision engine
        } 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to get AI coach decision");
    }

    const data = await response.json();
    
    // Map the server response to the expected AICoachOutput format
    return {
      score: data.score,
      decision: data.decision,
      insights: data.insights,
      actions: data.recommendations || data.actions || []
    };
  } catch (error: any) {
    console.error("AI Coach Error:", error);
    throw new Error(error.message || "AI temporarily unavailable, retry later");
  }
}
