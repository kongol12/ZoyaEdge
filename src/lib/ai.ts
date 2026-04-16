import { Trade, Strategy } from './db';

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

  try {
    const response = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trades: formattedTrades,
        language,
        strategies,
        instruction
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to get AI coach analysis");
    }

    return await response.json() as AICoachResponse;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Check for quota error
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("QUOTA_EXCEEDED: You have reached the AI usage limit. Please try again in a few minutes.");
    }
    
    throw new Error(error.message || "Failed to get AI coach analysis. Please check your API key.");
  }
};
