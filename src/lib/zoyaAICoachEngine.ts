import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { Trade } from './db';
import { computeZoyaMetrics, ZoyaMetrics } from './zoyaMetrics';

export type AnalysisMode = "CONCISE" | "STANDARD" | "DETAILED";

export interface ZoyaAICoachOutput {
  decision: "GREEN" | "ORANGE" | "RED";
  score: {
    risk: number;
    discipline: number;
    consistency: number;
  };
  summary: string;
  insights: string[];
  mistakes: string[];
  recommendations: string[];
  risk_level: "LOW" | "MEDIUM" | "HIGH";
}

export async function runZoyaAICoach(userId: string, mode: AnalysisMode = "STANDARD"): Promise<{ metrics: ZoyaMetrics, aiResponse: ZoyaAICoachOutput }> {
  // 1. Fetch trades from Firestore
  const tradesRef = collection(db, 'users', userId, 'trades');
  const q = query(tradesRef, orderBy('date', 'desc'), limit(100)); // Fetch last 100 for performance
  const snapshot = await getDocs(q);
  
  const trades: Trade[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    trades.push({
      id: doc.id,
      ...data,
      date: data.date?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate(),
      closedAt: data.closedAt?.toDate(),
    } as Trade);
  });

  // 2. Compute real metrics
  const metrics = computeZoyaMetrics(trades);

  // 3. Format AI input
  const emotionsCount = trades.reduce((acc, t) => {
    acc[t.emotion] = (acc[t.emotion] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sessionsCount = trades.reduce((acc, t) => {
    acc[t.session] = (acc[t.session] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const aiInput = {
    mode,
    metrics,
    behavior: {
      emotions: emotionsCount,
      sessions: sessionsCount,
      streaks: {
        maxWinStreak: metrics.stats.maxWinStreak,
        maxLossStreak: metrics.stats.maxLossStreak
      }
    }
  };

  // 4. Send to Gemini API
  const aiResponse = await callGeminiAICoach(aiInput);

  return { metrics, aiResponse };
}

async function callGeminiAICoach(input: any): Promise<ZoyaAICoachOutput> {
  try {
    const response = await fetch('/api/ai/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to get AI coach analysis");
    }

    return await response.json() as ZoyaAICoachOutput;
  } catch (error: any) {
    console.error("Zoya AI Coach Error:", error);
    
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("QUOTA_EXCEEDED: Limite d'utilisation de l'IA atteinte. Réessayez dans quelques minutes.");
    }
    
    throw new Error(error.message || "AI Coach temporairement indisponible.");
  }
}
